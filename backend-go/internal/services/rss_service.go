package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/mmcdole/gofeed"
	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type RssService struct {
	db          *gorm.DB
	config      *config.Config
	configSvc   *ConfigService // 用于从数据库读取最新配置
}

func NewRssService(db *gorm.DB, cfg *config.Config, configSvc *ConfigService) *RssService {
	return &RssService{
		db:        db,
		config:    cfg,
		configSvc: configSvc,
	}
}

// FetchAllFeeds 抓取所有活跃的RSS源（带并发控制）
func (s *RssService) FetchAllFeeds() (int, error) {
	var feeds []models.RssFeed
	if err := s.db.Where("isActive = ?", true).Find(&feeds).Error; err != nil {
		return 0, err
	}

	if len(feeds) == 0 {
		return 0, nil
	}

	// 修复：使用 WaitGroup + Semaphore 控制并发，避免同时请求过多导致超时
	// 设置最大并发数为 3（根据服务器负载调整）
	maxConcurrency := 3
	if len(feeds) < maxConcurrency {
		maxConcurrency = len(feeds)
	}

	// 使用 channel 作为信号量控制并发
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	totalNew := 0

	for i := range feeds {
		feed := feeds[i] // 避免闭包捕获问题
		wg.Add(1)

		go func() {
			defer wg.Done()
			// 获取信号量
			sem <- struct{}{}
			defer func() { <-sem }()

			count, err := s.FetchFeed(feed.ID)
			if err != nil {
				log.Warn().Err(err).Uint("feed_id", feed.ID).Msg("抓取RSS源失败")
				return
			}
			mu.Lock()
			totalNew += count
			mu.Unlock()
		}()
	}

	// 等待所有 goroutine 完成
	wg.Wait()

	return totalNew, nil
}

// FetchFeed 抓取单个RSS源
func (s *RssService) FetchFeed(feedID uint) (int, error) {
	// 内存检查
	if s.isMemoryHigh() {
		log.Warn().Uint("feed_id", feedID).Msg("内存使用率过高，跳过抓取")
		return 0, nil
	}

	var feed models.RssFeed
	if err := s.db.First(&feed, feedID).Error; err != nil {
		return 0, err
	}

	if !feed.IsActive {
		return 0, nil
	}

	// 修复：校验 feed.ID 有效性，防止 rss_feed_id 插入失败
	if feed.ID == 0 {
		log.Error().Uint("feed_id", feedID).Msg("RSS源ID无效，无法创建新闻")
		return 0, fmt.Errorf("无效的RSS源ID: %d", feedID)
	}

	// 获取RSS内容
	rssContent, err := s.fetchRssContent(feed.URL)
	if err != nil {
		return 0, err
	}

	// 解析RSS
	parser := gofeed.NewParser()
	feedData, err := parser.ParseString(rssContent)
	if err != nil {
		return 0, err
	}

	// 限制处理数量
	maxNews := s.config.RSS.MaxNewsPerFeed
	items := feedData.Items
	if len(items) > maxNews {
		items = items[:maxNews]
	}

	// 处理每个条目
	newCount := 0
	for _, item := range items {
		processedGuid := s.processGuid(item.GUID, item.Link)

		// 检查是否已存在
		var existing models.News
		if err := s.db.Where("guid = ?", processedGuid).First(&existing).Error; err == nil {
			continue
		} else if err != gorm.ErrRecordNotFound {
			// 仅记录非"记录不存在"错误
			log.Warn().Err(err).Str("guid", processedGuid).Msg("检查新闻是否存在时出错")
		}

		// 解析发布时间
		publishedAt := time.Now()
		if item.PublishedParsed != nil {
			publishedAt = *item.PublishedParsed
		}

		// 提取内容
		content := ""
		summary := ""
		if item.Content != "" {
			content = item.Content
		}
		if content == "" && item.Description != "" {
			content = item.Description
		}

		// 获取完整内容（可选）
		if item.Link != "" && content == "" {
			fullContent, err := s.fetchFullContent(item.Link)
			if err == nil && fullContent != "" {
				content = fullContent
			}
		}

		// 创建新闻记录（清理无效字符，使用替换符）
		news := models.News{
			Title:       s.truncateString(strings.ToValidUTF8(item.Title, ""), 500),
			Content:     s.truncateString(strings.ToValidUTF8(content, ""), 50000),
			Summary:     s.truncateString(strings.ToValidUTF8(summary, ""), 2000),
			Link:        item.Link,
			Author:      "",
			PublishedAt: &publishedAt,
			SourceName:  feed.Name,
			Category:    feed.Category,
			Status:      "published",
			RssFeedID:   feed.ID,
			GUID:        processedGuid,
		}

		// 修复：创建前再次校验 rss_feed_id，防止边缘情况
		if news.RssFeedID == 0 {
			log.Error().Str("title", item.Title).Msg("rssFeedId 字段未赋值，跳过创建")
			continue
		}

		if err := s.db.Create(&news).Error; err != nil {
			log.Error().Err(err).Str("title", item.Title).Uint("rssFeedId", news.RssFeedID).Msg("创建新闻失败")
			continue
		}

		newCount++
	}

	// 更新最后抓取时间
	now := time.Now()
	s.db.Model(&feed).Update("lastFetchTime", now)

	log.Info().Str("feed", feed.Name).Int("new", newCount).Msg("RSS源抓取完成")
	return newCount, nil
}

// fetchRssContent 获取RSS内容（带代理和重试）
func (s *RssService) fetchRssContent(feedURL string) (string, error) {
	// 创建请求
	req, err := http.NewRequest("GET", feedURL, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// 限制响应大小
	maxSize := int64(2 * 1024 * 1024) // 2MB

	// 创建独立的transport避免修改共享client
	transport := &http.Transport{
		MaxIdleConns:        5,
		MaxIdleConnsPerHost: 5,
		IdleConnTimeout:     30 * time.Second,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 20 * time.Second,
	}

	// 设置代理 - 优先从数据库读取，其次使用配置文件
	proxyEnabled := s.config.Proxy.Enabled
	proxyURL := s.config.Proxy.URL

	// 从数据库读取最新的代理配置
	if s.configSvc != nil {
		if configs, err := s.configSvc.GetAllConfigs(); err == nil {
			if val, ok := configs["http_proxy_enabled"]; ok && val == "true" {
				proxyEnabled = true
			}
			if val, ok := configs["http_proxy_url"]; ok && val != "" {
				proxyURL = val
			} else if val, ok := configs["http_proxy"]; ok && val != "" {
				proxyURL = val
			}
		}
	}

	if proxyEnabled && proxyURL != "" {
		if pURL, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(pURL)
		}
	}

	client := &http.Client{Transport: transport}

	// 重试逻辑 - 为每次重试创建新的context（避免复用已取消的context）
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		// 修复：每次重试创建新的context和cancel
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.config.RSS.FetchTimeout)*time.Second)
		defer cancel()

		resp, err := client.Do(req.WithContext(ctx))
		if err != nil {
			lastErr = err
			log.Warn().Int("attempt", attempt).Str("url", feedURL).Err(err).Msg("RSS请求失败")
			// 修复：使用真正的指数退避 (1s, 2s, 4s)
			if attempt < 3 {
				sleepDuration := time.Duration(1<<(attempt-1)) * time.Second
				time.Sleep(sleepDuration)
			}
			continue
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode >= 400 {
			lastErr = fmt.Errorf("HTTP错误 %d", resp.StatusCode)
			log.Warn().Int("attempt", attempt).Int("status", resp.StatusCode).Msg("RSS响应错误")
			if attempt < 3 {
				sleepDuration := time.Duration(1<<(attempt-1)) * time.Second
				time.Sleep(sleepDuration)
			}
			continue
		}

		// 限制读取大小
		limitedReader := io.LimitReader(resp.Body, maxSize)
		body, err := ioutil.ReadAll(limitedReader)
		if err != nil {
			lastErr = err
			log.Warn().Err(err).Msg("读取响应失败")
			if attempt < 3 {
				sleepDuration := time.Duration(1<<(attempt-1)) * time.Second
				time.Sleep(sleepDuration)
			}
			continue
		}

		return string(body), nil
	}

	return "", fmt.Errorf("RSS抓取失败 (重试3次): %w", lastErr)
}

// fetchFullContent 获取网页完整内容
func (s *RssService) fetchFullContent(pageURL string) (string, error) {
	// 创建请求
	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// 限制响应大小
	maxSize := int64(1 * 1024 * 1024) // 1MB

	// 使用带超时的上下文（使用配置的超时时间，但最多10秒）
	timeout := s.config.RSS.FetchTimeout
	if timeout > 10 {
		timeout = 10
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	// 创建独立的transport避免修改共享client
	transport := &http.Transport{
		MaxIdleConns:        2,
		MaxIdleConnsPerHost: 2,
		IdleConnTimeout:     10 * time.Second,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 10 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}

	// 设置代理 - 优先从数据库读取，其次使用配置文件
	proxyEnabled := s.config.Proxy.Enabled
	proxyURL := s.config.Proxy.URL

	// 从数据库读取最新的代理配置
	if s.configSvc != nil {
		if configs, err := s.configSvc.GetAllConfigs(); err == nil {
			if val, ok := configs["http_proxy_enabled"]; ok && val == "true" {
				proxyEnabled = true
			}
			if val, ok := configs["http_proxy_url"]; ok && val != "" {
				proxyURL = val
			} else if val, ok := configs["http_proxy"]; ok && val != "" {
				proxyURL = val
			}
		}
	}

	if proxyEnabled && proxyURL != "" {
		if pURL, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(pURL)
		}
	}

	client := &http.Client{Transport: transport}
	resp, err := client.Do(req.WithContext(ctx))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// 限制读取大小
	limitedReader := io.LimitReader(resp.Body, maxSize)
	htmlContent, err := ioutil.ReadAll(limitedReader)
	if err != nil {
		return "", err
	}

	// 解析HTML
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(htmlContent))
	if err != nil {
		return "", err
	}

	// 移除不需要的元素
	doc.Find("script, style, nav, footer, aside, iframe, form").Remove()

	// 尝试获取主要内容
	contentSelectors := []string{
		"article",
		".article-content",
		".post-content",
		".entry-content",
		".content",
		"main",
		".main-content",
	}

	content := ""
	for _, selector := range contentSelectors {
		selected := doc.Find(selector)
		if selected.Length() > 0 {
			content = selected.Text()
			if len(content) > 100 {
				break
			}
		}
	}

	// 如果没找到，使用body内容
	if content == "" || len(content) < 100 {
		content = doc.Find("body").Text()
	}

	// 清理和截断
	content = strings.TrimSpace(content)
	if len(content) > 3000 {
		content = content[:3000]
	}

	return content, nil
}

// processGuid 处理guid，确保不超过数据库字段长度限制
func (s *RssService) processGuid(rawGuid, fallbackURL string) string {
	maxLen := 255

	if rawGuid != "" {
		if len(rawGuid) <= maxLen {
			return rawGuid
		}
		// 使用hash处理过长的guid
		hash := sha256.Sum256([]byte(rawGuid))
		return hex.EncodeToString(hash[:])
	}

	if fallbackURL != "" {
		if len(fallbackURL) <= maxLen {
			return fallbackURL
		}
		hash := sha256.Sum256([]byte(fallbackURL))
		return hex.EncodeToString(hash[:])
	}

	// 生成随机guid
	return fmt.Sprintf("guid-%d", time.Now().UnixNano())
}

// truncateString 截断字符串
func (s *RssService) truncateString(str string, maxLen int) string {
	if len(str) <= maxLen {
		return str
	}
	return str[:maxLen]
}

// cleanInvalidUTF8 清理无效的UTF-8字符（兼容MySQL utf8mb3）
func (s *RssService) cleanInvalidUTF8(str string) string {
	// 使用 runes 来处理并过滤无效字符
	runes := []rune(str)
	validRunes := make([]rune, 0, len(runes))
	for _, r := range runes {
		// 过滤掉替换字符和超出3字节UTF-8范围的字符（4字节emoji等）
		// UTF-8: 1字节 0-127, 2字节 128-2047, 3字节 2048-65535, 4字节 65536+
		if r != 0xFFFD && r > 0 && r < 0x10000 {
			validRunes = append(validRunes, r)
		}
	}
	return string(validRunes)
}

// isMemoryHigh 检查内存使用率
func (s *RssService) isMemoryHigh() bool {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	heapUsedMB := m.HeapAlloc / 1024 / 1024
	heapTotalMB := m.HeapSys / 1024 / 1024

	if heapTotalMB == 0 {
		return false
	}

	usagePercent := float64(heapUsedMB) / float64(heapTotalMB) * 100
	log.Debug().Float64("usage_percent", usagePercent).Msg("内存使用率")

	return usagePercent > 80
}

// GetAllFeeds 获取所有RSS源
// 参数:
//   - sortBy: 排序字段 (createdAt, name, category, lastFetchTime, isActive, articleCount)
//   - sortOrder: 排序方向 (ASC, DESC)
func (s *RssService) GetAllFeeds(sortBy, sortOrder string) ([]models.RssFeed, error) {
	// 校验排序字段（白名单，防止 SQL 注入）
	validSortFields := map[string]bool{
		"createdAt":      true,
		"name":           true,
		"category":       true,
		"lastFetchTime":  true,
		"isActive":       true,
		"articleCount":   true,
	}
	if !validSortFields[sortBy] {
		sortBy = "createdAt"
	}

	// 校验排序方向
	if sortOrder != "ASC" && sortOrder != "DESC" {
		sortOrder = "DESC"
	}

	var feeds []models.RssFeed

	// articleCount 需要通过子查询实现排序
	if sortBy == "articleCount" {
		// 先获取所有 feeds
		err := s.db.Find(&feeds).Error
		if err != nil {
			return feeds, err
		}

		// 为每个 feed 计算 articleCount
		for i := range feeds {
			var count int64
			s.db.Model(&models.News{}).Where("rssFeedId = ?", feeds[i].ID).Count(&count)
			feeds[i].ArticleCount = int(count)
		}

		// Go 层面排序（简单可靠）
		if sortOrder == "DESC" {
			sort.Slice(feeds, func(i, j int) bool {
				return feeds[i].ArticleCount > feeds[j].ArticleCount
			})
		} else {
			sort.Slice(feeds, func(i, j int) bool {
				return feeds[i].ArticleCount < feeds[j].ArticleCount
			})
		}
	} else {
		// 普通字段直接排序
		err := s.db.Order(sortBy + " " + sortOrder).Find(&feeds).Error
		if err != nil {
			return feeds, err
		}
	}

	// 为每个RSS源计算新闻数量（如果没用子查询）
	if sortBy != "articleCount" {
		for i := range feeds {
			var count int64
			s.db.Model(&models.News{}).Where("rssFeedId = ?", feeds[i].ID).Count(&count)
			feeds[i].ArticleCount = int(count)
		}
	}

	return feeds, nil
}

// GetActiveFeeds 获取所有活跃的RSS源
func (s *RssService) GetActiveFeeds() ([]models.RssFeed, error) {
	var feeds []models.RssFeed
	err := s.db.Where("isActive = ?", true).Find(&feeds).Error
	return feeds, err
}

// GetFeedByID 根据ID获取RSS源
func (s *RssService) GetFeedByID(id uint) (*models.RssFeed, error) {
	var feed models.RssFeed
	err := s.db.First(&feed, id).Error
	if err != nil {
		return nil, err
	}
	return &feed, nil
}

// CreateFeed 创建RSS源
func (s *RssService) CreateFeed(feed *models.RssFeed) error {
	return s.db.Create(feed).Error
}

// UpdateFeed 更新RSS源
func (s *RssService) UpdateFeed(feed *models.RssFeed) error {
	return s.db.Save(feed).Error
}

// DeleteFeed 删除RSS源
func (s *RssService) DeleteFeed(id uint) error {
	return s.db.Delete(&models.RssFeed{}, id).Error
}

// ValidateFeed 验证RSS源
func (s *RssService) ValidateFeed(feedURL string) (bool, error) {
	_, err := s.fetchRssContent(feedURL)
	if err != nil {
		return false, err
	}
	return true, nil
}

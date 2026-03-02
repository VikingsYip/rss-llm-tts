package services

import (
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron     *cron.Cron
	rssSvc   *RssService
	feedMgr  *FeedManager
	entries  map[uint]cron.EntryID
}

type FeedManager struct {
	db *FeedDB
}

type FeedDB interface {
	Where(interface{}, ...interface{}) interface{}
	Find(interface{}, ...interface{}) interface{}
	First(interface{}, ...interface{}) interface{}
}

func NewScheduler(rssSvc *RssService) *Scheduler {
	return &Scheduler{
		cron:    cron.New(),
		rssSvc:  rssSvc,
		entries: make(map[uint]cron.EntryID),
	}
}

// Start 启动调度器
func (s *Scheduler) Start() error {
	// 加载所有RSS源并调度
	feeds, err := s.rssSvc.GetActiveFeeds()
	if err != nil {
		return err
	}

	for _, feed := range feeds {
		s.ScheduleFeedFetch(&feed)
	}

	// 启动cron
	s.cron.Start()
	log.Info().Int("count", len(feeds)).Msg("RSS定时抓取任务已启动")

	return nil
}

// ScheduleFeedFetch 为RSS源安排抓取任务
func (s *Scheduler) ScheduleFeedFetch(feed *models.RssFeed) error {
	if feed == nil || !feed.IsActive {
		return nil
	}

	// 移除旧的定时任务
	if entryID, ok := s.entries[feed.ID]; ok {
		s.cron.Remove(entryID)
	}

	// 根据分类设置不同的抓取频率
	spec := s.getScheduleSpec(feed.Category)

	_, err := s.cron.AddFunc(spec, func() {
		s.fetchFeedWithCheck(feed.ID)
	})
	if err != nil {
		return err
	}

	entryID := s.cron.Entries()[len(s.cron.Entries())-1].ID
	s.entries[feed.ID] = entryID

	log.Info().Str("feed", feed.Name).Str("spec", spec).Msg("RSS源定时任务已设置")
	return nil
}

// getScheduleSpec 根据分类获取调度规则
func (s *Scheduler) getScheduleSpec(category string) string {
	// 科技类：每30分钟抓取
	techCategories := []string{"科技", "技术", "Tech", "Technology"}
	for _, cat := range techCategories {
		if strings.Contains(category, cat) {
			return "*/30 * * * *" // 每30分钟
		}
	}

	// 其他分类：每天凌晨3点
	return "0 3 * * *"
}

// fetchFeedWithCheck 带检查的抓取
func (s *Scheduler) fetchFeedWithCheck(feedID uint) {
	// 内存检查
	if s.rssSvc.isMemoryHigh() {
		log.Warn().Uint("feed_id", feedID).Msg("内存使用率过高，跳过定时抓取")
		return
	}

	count, err := s.rssSvc.FetchFeed(feedID)
	if err != nil {
		log.Error().Err(err).Uint("feed_id", feedID).Msg("定时抓取失败")
		return
	}

	log.Info().Uint("feed_id", feedID).Int("new", count).Msg("定时抓取完成")
}

// RemoveFeedTask 移除RSS源的定时任务
func (s *Scheduler) RemoveFeedTask(feedID uint) {
	if entryID, ok := s.entries[feedID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, feedID)
		log.Info().Uint("feed_id", feedID).Msg("RSS源定时任务已移除")
	}
}

// Stop 停止调度器
func (s *Scheduler) Stop() {
	s.cron.Stop()
	log.Info().Msg("RSS定时抓取任务已停止")
}

// GetStatus 获取任务状态
func (s *Scheduler) GetStatus() map[string]interface{} {
	entries := s.cron.Entries()
	feedTasks := make([]map[string]interface{}, 0)

	for _, entry := range entries {
		feedTasks = append(feedTasks, map[string]interface{}{
			"next_run":  entry.Next.Format(time.RFC3339),
			"prev_run":  entry.Prev.Format(time.RFC3339),
			"schedule":  "cron job",
		})
	}

	return map[string]interface{}{
		"active":   true,
		"tasks":    len(entries),
		"feeds":    feedTasks,
	}
}

// StartMemoryMonitor 启动内存监控
func StartMemoryMonitor(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		for range ticker.C {
			printMemoryStats()
		}
	}()
}

func printMemoryStats() {
	// 简单的内存统计输出
	log.Debug().Msg("定时检查完成")
}

// CleanupOldNews 清理旧新闻（已禁用）
func (s *Scheduler) CleanupOldNews() int {
	// 已禁用历史新闻自动清理功能
	log.Info().Msg("cleanupOldNews 已禁用，新闻将永久保留")
	return 0
}

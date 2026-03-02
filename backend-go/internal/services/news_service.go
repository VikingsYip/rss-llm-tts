package services

import (
	"strconv"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type NewsService struct {
	db *gorm.DB
}

func NewNewsService(db *gorm.DB) *NewsService {
	return &NewsService{db: db}
}

// GetNewsList 获取新闻列表
// 参数说明：
// - page: 页码（从1开始）
// - limit: 每页数量
// - keyword: 关键词搜索（标题和内容）
// - category: 分类筛选
// - source: 来源筛选（对应 sourceName 字段）
// - isRead: 已读状态筛选
// - isFavorite: 收藏状态筛选
// - startDate: 开始日期筛选 (格式: 2006-01-02)
// - endDate: 结束日期筛选 (格式: 2006-01-02)
func (s *NewsService) GetNewsList(page, limit int, category, status, keyword, source string, isRead, isFavorite *bool, startDate, endDate string) ([]models.News, int64, error) {
	var news []models.News
	var total int64

	query := s.db.Model(&models.News{})

	// 关键词搜索
	if keyword != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	// 分类筛选
	if category != "" {
		query = query.Where("category = ?", category)
	}
	// 来源筛选（对应 sourceName）
	if source != "" {
		query = query.Where("sourceName = ?", source)
	}
	// 状态筛选
	if status != "" {
		query = query.Where("status = ?", status)
	}
	// 已读状态筛选
	if isRead != nil {
		query = query.Where("isRead = ?", *isRead)
	}
	// 收藏状态筛选
	if isFavorite != nil {
		query = query.Where("isFavorite = ?", *isFavorite)
	}
	// 日期筛选 (支持日期格式: 2006-01-02 或 datetime格式: 2006-01-02T15:04:05)
	if startDate != "" {
		if len(startDate) > 10 {
			// datetime格式
			query = query.Where("publishedAt >= ?", startDate)
		} else {
			// 日期格式
			query = query.Where("DATE(publishedAt) >= ?", startDate)
		}
	}
	if endDate != "" {
		if len(endDate) > 10 {
			// datetime格式
			query = query.Where("publishedAt <= ?", endDate)
		} else {
			// 日期格式
			query = query.Where("DATE(publishedAt) <= ?", endDate)
		}
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * limit
	if err := query.Order("publishedAt DESC").Offset(offset).Limit(limit).Find(&news).Error; err != nil {
		return nil, 0, err
	}

	return news, total, nil
}

// GetNewsByID 获取新闻详情
func (s *NewsService) GetNewsByID(id uint) (*models.News, error) {
	var news models.News
	if err := s.db.First(&news, id).Error; err != nil {
		return nil, err
	}
	return &news, nil
}

// UpdateNewsStatus 更新新闻状态
func (s *NewsService) UpdateNewsStatus(id uint, status string) error {
	return s.db.Model(&models.News{}).Where("id = ?", id).Update("status", status).Error
}

// UpdateNewsField 更新新闻字段
func (s *NewsService) UpdateNewsField(id uint, field string, value interface{}) error {
	return s.db.Model(&models.News{}).Where("id = ?", id).Update(field, value).Error
}

// MarkAsRead 标记为已读
func (s *NewsService) MarkAsRead(id uint) error {
	return s.UpdateNewsField(id, "isRead", true)
}

// MarkAsFavorite 标记为收藏
func (s *NewsService) MarkAsFavorite(id uint) error {
	return s.UpdateNewsField(id, "isFavorite", true)
}

// MarkAsIgnored 标记为忽略
func (s *NewsService) MarkAsIgnored(id uint) error {
	return s.UpdateNewsField(id, "isIgnored", true)
}

// GetNewsStats 获取新闻统计
func (s *NewsService) GetNewsStats() (map[string]interface{}, error) {
	var total int64
	var byStatus []struct {
		Status string
		Count  int64
	}
	var byCategory []struct {
		Category string
		Count    int64
	}

	// 总数
	s.db.Model(&models.News{}).Count(&total)

	// 按状态统计
	s.db.Model(&models.News{}).Select("status, COUNT(*) as count").Group("status").Scan(&byStatus)

	// 按分类统计
	s.db.Model(&models.News{}).Select("category, COUNT(*) as count").Group("category").Scan(&byCategory)

	result := map[string]interface{}{
		"total":      total,
		"byStatus":   byStatus,
		"byCategory": byCategory,
	}

	return result, nil
}

// GetDashboardStats 获取仪表板统计
func (s *NewsService) GetDashboardStats() (map[string]interface{}, error) {
	var newsTotal int64
	var newsToday int64
	var feedTotal int64
	var feedActive int64
	var dialogueTotal int64
	var dialogueToday int64

	// 新闻统计
	s.db.Model(&models.News{}).Count(&newsTotal)
	// 今日新闻（假设有 createdAt 字段）
	today := time.Now().Truncate(24 * time.Hour)
	s.db.Model(&models.News{}).Where("createdAt >= ?", today).Count(&newsToday)

	// RSS源统计
	s.db.Model(&models.RssFeed{}).Count(&feedTotal)
	s.db.Model(&models.RssFeed{}).Where("isActive = ?", true).Count(&feedActive)

	// 对话统计
	s.db.Model(&models.Dialogue{}).Count(&dialogueTotal)
	s.db.Model(&models.Dialogue{}).Where("createdAt >= ?", today).Count(&dialogueToday)

	// 获取分类统计
	categories, _ := s.GetCategoryStats()

	// 获取来源统计（从 news 表的 sourceName 字段）
	var sources []map[string]interface{}
	// 使用原生 SQL 查询，结果直接映射到 map
	rows, err := s.db.Raw("SELECT sourceName as name, COUNT(*) as count FROM news GROUP BY sourceName ORDER BY count DESC LIMIT 5").Rows()
	if err != nil {
		log.Error().Err(err).Msg("获取来源统计失败")
	} else {
		defer rows.Close()
		for rows.Next() {
			var name string
			var count int64
			if err := rows.Scan(&name, &count); err == nil && name != "" {
				sources = append(sources, map[string]interface{}{
					"name":  name,
					"count": count,
				})
			}
		}
	}
	log.Info().Int("sources_len", len(sources)).Msg("来源统计")

	return map[string]interface{}{
		"news": map[string]interface{}{
			"total":  newsTotal,
			"today":  newsToday,
		},
		"feeds": map[string]interface{}{
			"total":  feedTotal,
			"active": feedActive,
		},
		"dialogues": map[string]interface{}{
			"total": dialogueTotal,
			"today": dialogueToday,
		},
		"categories": categories,
		"sources":   sources,
	}, nil
}

// GetAllCategories 获取所有分类
func (s *NewsService) GetAllCategories() ([]string, error) {
	var categories []string
	err := s.db.Model(&models.News{}).Distinct("category").Where("category != ''").Pluck("category", &categories).Error
	return categories, err
}

// GetCategoryStats 获取分类统计
func (s *NewsService) GetCategoryStats() ([]map[string]interface{}, error) {
	var stats []struct {
		Category string
		Count    int64
	}

	s.db.Model(&models.News{}).
		Select("category, COUNT(*) as count").
		Group("category").
		Order("count DESC").
		Limit(5).
		Scan(&stats)

	result := make([]map[string]interface{}, 0, len(stats))
	for _, stat := range stats {
		if stat.Category == "" {
			continue
		}
		result = append(result, map[string]interface{}{
			"name":  stat.Category,
			"count": stat.Count,
		})
	}

	return result, nil
}

// GetRandomNews 获取随机新闻
func (s *NewsService) GetRandomNews(count int) ([]models.News, error) {
	var news []models.News
	err := s.db.Where("status = ?", "published").
		Order("RAND()").
		Limit(count).
		Find(&news).Error
	return news, err
}

// GetNewsByIDs 根据ID列表获取新闻
func (s *NewsService) GetNewsByIDs(ids []uint) ([]models.News, error) {
	var news []models.News
	err := s.db.Where("id IN ?", ids).Find(&news).Error
	return news, err
}

// ParseNewsIDs 解析新闻ID字符串
func ParseNewsIDs(idsStr string) ([]uint, error) {
	if idsStr == "" || idsStr == "[]" {
		return []uint{}, nil
	}

	// 移除方括号
	idsStr = idsStr[1 : len(idsStr)-1]
	if idsStr == "" {
		return []uint{}, nil
	}

	// 分割并解析
	var ids []uint
	for _, idStr := range splitAndTrim(idsStr) {
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			log.Warn().Err(err).Str("id", idStr).Msg("解析新闻ID失败")
			continue
		}
		ids = append(ids, uint(id))
	}

	return ids, nil
}

func splitAndTrim(s string) []string {
	var result []string
	current := ""
	for _, c := range s {
		if c == ',' {
			result = append(result, current)
			current = ""
		} else if c != ' ' && c != '"' {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

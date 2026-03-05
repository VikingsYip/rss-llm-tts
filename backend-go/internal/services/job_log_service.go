package services

import (
	"sync"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// JobLogService RSS任务日志服务
type JobLogService struct {
	db *gorm.DB
	// 实时日志订阅者
	subscribers map[chan *models.RssJobLog]bool
	mu          sync.RWMutex
}

func NewJobLogService(db *gorm.DB) *JobLogService {
	return &JobLogService{
		db:          db,
		subscribers: make(map[chan *models.RssJobLog]bool),
	}
}

// CreateLog 创建任务日志
func (s *JobLogService) CreateLog(logEntry *models.RssJobLog) error {
	return s.db.Create(logEntry).Error
}

// UpdateLog 更新任务日志（直接用map更新，避免零值问题）
func (s *JobLogService) UpdateLog(logEntry *models.RssJobLog) error {
	// 使用 map 直接更新，避免 GORM 的零值问题
	updates := make(map[string]interface{})

	if logEntry.Status != "" {
		updates["status"] = logEntry.Status
	}
	if logEntry.EndTime != nil {
		updates["endTime"] = logEntry.EndTime
	}
	if logEntry.NewArticles > 0 {
		updates["newArticles"] = logEntry.NewArticles
	}
	if logEntry.TotalArticles > 0 {
		updates["totalArticles"] = logEntry.TotalArticles
	}
	if logEntry.ErrorMsg != "" {
		updates["errorMsg"] = logEntry.ErrorMsg
	}
	if logEntry.Duration > 0 {
		updates["duration"] = logEntry.Duration
	}
	if logEntry.ExecutorIP != "" {
		updates["executorIp"] = logEntry.ExecutorIP
	}

	// 直接用 Table + Where 更新，避免触发 model 的零值
	return s.db.Table("rss_job_logs").Where("id = ?", logEntry.ID).Updates(updates).Error
}

// GetLogs 获取任务日志列表
func (s *JobLogService) GetLogs(feedID *uint, status *string, triggerType *string, page, pageSize int) ([]models.RssJobLogWithFeed, int64, error) {
	var logs []models.RssJobLogWithFeed
	var total int64

	// 构建基础查询
	query := s.db.Model(&models.RssJobLog{})

	if feedID != nil && *feedID > 0 {
		query = query.Where("feedId = ?", *feedID)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}
	if triggerType != nil && *triggerType != "" {
		query = query.Where("triggerType = ?", *triggerType)
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询，关联rss_feeds表获取更多信息
	queryBuilder := s.db.Table("rss_job_logs").
		Select("rss_job_logs.*, rss_feeds.url as feedUrl, rss_feeds.category as feedCategory").
		Joins("LEFT JOIN rss_feeds ON rss_feeds.id = rss_job_logs.feedId")

	if feedID != nil && *feedID > 0 {
		queryBuilder = queryBuilder.Where("rss_job_logs.feedId = ?", *feedID)
	}
	if status != nil && *status != "" {
		queryBuilder = queryBuilder.Where("rss_job_logs.status = ?", *status)
	}
	if triggerType != nil && *triggerType != "" {
		queryBuilder = queryBuilder.Where("rss_job_logs.triggerType = ?", *triggerType)
	}

	err := queryBuilder.
		Order("rss_job_logs.triggerTime DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&logs).Error

	return logs, total, err
}

// GetLogByID 根据ID获取日志
func (s *JobLogService) GetLogByID(id uint) (*models.RssJobLog, error) {
	var logEntry models.RssJobLog
	err := s.db.First(&logEntry, id).Error
	if err != nil {
		return nil, err
	}
	return &logEntry, nil
}

// GetRunningCount 获取正在运行的任务数
func (s *JobLogService) GetRunningCount() (int64, error) {
	var count int64
	err := s.db.Model(&models.RssJobLog{}).Where("status = ?", "running").Count(&count).Error
	return count, err
}

// GetTodayStats 获取今日统计
func (s *JobLogService) GetTodayStats() (map[string]interface{}, error) {
	today := time.Now().Format("2006-01-02")
	stats := make(map[string]interface{})

	var total, success, failed, running int64
	s.db.Model(&models.RssJobLog{}).Where("DATE(triggerTime) = ?", today).Count(&total)
	s.db.Model(&models.RssJobLog{}).Where("status = ? AND DATE(triggerTime) = ?", "success", today).Count(&success)
	s.db.Model(&models.RssJobLog{}).Where("status = ? AND DATE(triggerTime) = ?", "failed", today).Count(&failed)
	s.db.Model(&models.RssJobLog{}).Where("status = ?", "running").Count(&running)

	stats["total"] = total
	stats["success"] = success
	stats["failed"] = failed
	stats["running"] = running
	stats["today"] = today

	return stats, nil
}

// Subscribe 订阅实时日志
func (s *JobLogService) Subscribe() chan *models.RssJobLog {
	ch := make(chan *models.RssJobLog, 100)
	s.mu.Lock()
	s.subscribers[ch] = true
	s.mu.Unlock()
	return ch
}

// Unsubscribe 取消订阅
func (s *JobLogService) Unsubscribe(ch chan *models.RssJobLog) {
	s.mu.Lock()
	delete(s.subscribers, ch)
	close(ch)
	s.mu.Unlock()
}

// Publish 发布日志到所有订阅者
func (s *JobLogService) Publish(logEntry *models.RssJobLog) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for ch := range s.subscribers {
		select {
		case ch <- logEntry:
		default:
			// 如果通道满了，跳过
		}
	}
}

// JobLogHelper 任务日志辅助类
type JobLogHelper struct {
	db          *gorm.DB
	jobLogSvc   *JobLogService
	feedID      uint
	feedName    string
	triggerType string
	logID       uint
	startTime   time.Time
}

// NewJobLogHelper 创建日志辅助对象
func (s *JobLogService) NewJobLogHelper(feedID uint, feedName, triggerType string) *JobLogHelper {
	return &JobLogHelper{
		db:          s.db,
		jobLogSvc:   s,
		feedID:      feedID,
		feedName:    feedName,
		triggerType: triggerType,
		startTime:   time.Now(),
	}
}

// Start 开始记录日志
func (h *JobLogHelper) Start() uint {
	logEntry := &models.RssJobLog{
		FeedID:      h.feedID,
		FeedName:    h.feedName,
		TriggerType: h.triggerType,
		TriggerTime: h.startTime,
		StartTime:   h.startTime,
		Status:      "running",
	}

	if err := h.jobLogSvc.CreateLog(logEntry); err != nil {
		log.Error().Err(err).Msg("创建任务日志失败")
		return 0
	}

	h.logID = logEntry.ID

	// 发布开始日志
	h.jobLogSvc.Publish(logEntry)

	return logEntry.ID
}

// Success 记录成功
func (h *JobLogHelper) Success(newArticles, totalArticles int) {
	if h.logID == 0 {
		return
	}

	now := time.Now()
	logEntry := &models.RssJobLog{
		ID:            h.logID,
		Status:        "success",
		EndTime:       &now,
		NewArticles:   newArticles,
		TotalArticles: totalArticles,
		Duration:      now.Sub(h.startTime).Milliseconds(),
	}

	if err := h.jobLogSvc.UpdateLog(logEntry); err != nil {
		log.Error().Err(err).Msg("更新任务日志失败")
	}

	// 重新查询获取完整日志
	if updated, err := h.jobLogSvc.GetLogByID(h.logID); err == nil {
		h.jobLogSvc.Publish(updated)
	}
}

// Fail 记录失败
func (h *JobLogHelper) Fail(errMsg string) {
	if h.logID == 0 {
		return
	}

	now := time.Now()
	logEntry := &models.RssJobLog{
		ID:         h.logID,
		Status:     "failed",
		EndTime:    &now,
		ErrorMsg:   errMsg,
		Duration:   now.Sub(h.startTime).Milliseconds(),
	}

	if err := h.jobLogSvc.UpdateLog(logEntry); err != nil {
		log.Error().Err(err).Msg("更新任务日志失败")
	}

	// 重新查询获取完整日志
	if updated, err := h.jobLogSvc.GetLogByID(h.logID); err == nil {
		h.jobLogSvc.Publish(updated)
	}
}

// Timeout 记录超时
func (h *JobLogHelper) Timeout() {
	if h.logID == 0 {
		return
	}

	now := time.Now()
	logEntry := &models.RssJobLog{
		ID:       h.logID,
		Status:   "timeout",
		EndTime:  &now,
		ErrorMsg: "任务执行超时",
		Duration: now.Sub(h.startTime).Milliseconds(),
	}

	if err := h.jobLogSvc.UpdateLog(logEntry); err != nil {
		log.Error().Err(err).Msg("更新任务日志失败")
	}

	// 重新查询获取完整日志
	if updated, err := h.jobLogSvc.GetLogByID(h.logID); err == nil {
		h.jobLogSvc.Publish(updated)
	}
}

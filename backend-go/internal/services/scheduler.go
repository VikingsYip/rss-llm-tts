package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron         *cron.Cron
	rssSvc       *RssService
	jobLogSvc    *JobLogService
	dailyTaskSvc *DailyTaskService
	feedMgr      *FeedManager
	entries      map[uint]cron.EntryID
	feedNames    map[uint]string // feedID -> feedName
	dailyEntryID cron.EntryID    // 每日任务ID
}

type FeedManager struct {
	db *FeedDB
}

type FeedDB interface {
	Where(interface{}, ...interface{}) interface{}
	Find(interface{}, ...interface{}) interface{}
	First(interface{}, ...interface{}) interface{}
}

func NewScheduler(rssSvc *RssService, jobLogSvc *JobLogService, dailyTaskSvc *DailyTaskService) *Scheduler {
	return &Scheduler{
		cron:         cron.New(),
		rssSvc:       rssSvc,
		jobLogSvc:    jobLogSvc,
		dailyTaskSvc: dailyTaskSvc,
		entries:      make(map[uint]cron.EntryID),
		feedNames:    make(map[uint]string),
	}
}

// Start 启动调度器
func (s *Scheduler) Start() error {
	// 加载所有RSS源并调度
	feeds, err := s.rssSvc.GetActiveFeeds()
	if err != nil {
		return err
	}

	// 保存 feed 名称映射
	for _, feed := range feeds {
		s.feedNames[feed.ID] = feed.Name
		s.ScheduleFeedFetch(&feed)
	}

	// 启动cron
	s.cron.Start()
	log.Info().Int("count", len(feeds)).Msg("RSS定时抓取任务已启动")

	// 启动每日定时任务
	s.ScheduleDailyTask()

	return nil
}

// Reload 重新加载所有RSS源定时任务
func (s *Scheduler) Reload() error {
	// 移除所有现有的定时任务
	for feedID := range s.entries {
		if entryID, ok := s.entries[feedID]; ok {
			s.cron.Remove(entryID)
		}
	}
	s.entries = make(map[uint]cron.EntryID)
	s.feedNames = make(map[uint]string)

	// 重新加载所有活跃RSS源
	feeds, err := s.rssSvc.GetActiveFeeds()
	if err != nil {
		return err
	}

	// 保存 feed 名称映射
	for _, feed := range feeds {
		s.feedNames[feed.ID] = feed.Name
		s.ScheduleFeedFetch(&feed)
	}

	log.Info().Int("count", len(feeds)).Msg("RSS定时任务已重新加载")
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

	// 复制 feedID 到局部变量，避免闭包捕获问题
	feedID := feed.ID

	_, err := s.cron.AddFunc(spec, func() {
		s.fetchFeedWithCheck(feedID)
	})
	if err != nil {
		return err
	}

	entryID := s.cron.Entries()[len(s.cron.Entries())-1].ID
	s.entries[feed.ID] = entryID

	log.Info().Uint("feed_id", feed.ID).Str("name", feed.Name).Str("spec", spec).Msg("RSS源定时任务已设置")
	return nil
}

// getScheduleSpec 根据分类获取调度规则
func (s *Scheduler) getScheduleSpec(category string) string {
	// 科技类：每30分钟抓取
	techCategories := []string{"科技", "技术", "Tech", "Technology", "AI", "人工智能", "视频播客", "Podcast"}
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
	// 使用局部变量避免闭包问题
	feedIDLocal := feedID

	feedName := s.feedNames[feedIDLocal]
	if feedName == "" {
		feedName = "Unknown"
		log.Warn().Uint("feed_id", feedIDLocal).Msg("未找到feed名称")
	}

	// 创建日志记录器
	var jobLog *JobLogHelper
	if s.jobLogSvc != nil {
		jobLog = s.jobLogSvc.NewJobLogHelper(feedIDLocal, feedName, "schedule")
		jobLog.Start()
	}

	// 内存检查
	if s.rssSvc.isMemoryHigh() {
		log.Warn().Uint("feed_id", feedIDLocal).Msg("内存使用率过高，跳过定时抓取")
		if jobLog != nil {
			jobLog.Fail("内存使用率过高，跳过抓取")
		}
		return
	}

	// 使用 channel 实现超时保护
	done := make(chan struct{})
	var count int
	var err error

	go func() {
		count, err = s.rssSvc.FetchFeed(feedIDLocal)
		close(done)
	}()

	// 等待完成或超时（60秒）
	select {
	case <-done:
		// 任务完成
		if err != nil {
			log.Error().Err(err).Uint("feed_id", feedIDLocal).Msg("定时抓取失败")
			if jobLog != nil {
				jobLog.Fail(err.Error())
			}
		} else {
			log.Info().Uint("feed_id", feedIDLocal).Int("new", count).Msg("定时抓取完成")
			if jobLog != nil {
				jobLog.Success(count, 0)
			}
		}
	case <-time.After(60 * time.Second):
		// 超时
		log.Error().Uint("feed_id", feedIDLocal).Msg("定时抓取超时")
		if jobLog != nil {
			jobLog.Timeout()
		}
	}
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

// ScheduleDailyTask 安排每日定时任务
func (s *Scheduler) ScheduleDailyTask() {
	// 如果已有每日任务，先移除
	if s.dailyEntryID > 0 {
		s.cron.Remove(s.dailyEntryID)
	}

	// 检查是否启用
	if s.dailyTaskSvc == nil || !s.dailyTaskSvc.IsEnabled() {
		log.Info().Msg("每日任务未启用")
		return
	}

	// 获取执行时间 (格式 HH:MM -> 分 时)
	execTime := s.dailyTaskSvc.GetExecutionTime()
	parts := strings.Split(execTime, ":")
	if len(parts) != 2 {
		log.Error().Str("time", execTime).Msg("执行时间格式错误，应为 HH:MM")
		return
	}
	minute := parts[0]
	hour := parts[1]
	spec := fmt.Sprintf("%s %s * * ?", minute, hour) // 格式: 分 时 日 月 周 (5字段)

	// 引用指针避免闭包问题
	svc := s.dailyTaskSvc

	// 添加定时任务
	entryID, err := s.cron.AddFunc(spec, func() {
		log.Info().Msg("开始执行每日定时任务")
		if err := svc.GenerateDailyDialogue(); err != nil {
			log.Error().Err(err).Msg("每日任务执行失败")
		}
	})
	if err != nil {
		log.Error().Err(err).Str("spec", spec).Msg("每日任务调度失败")
		return
	}

	s.dailyEntryID = entryID
	log.Info().Str("time", execTime).Msg("每日定时任务已启动")
}

// ReloadDailyTask 重新加载每日任务配置
func (s *Scheduler) ReloadDailyTask() {
	log.Info().Msg("重新加载每日任务配置")
	s.ScheduleDailyTask()
}

// GetStatus 获取任务状态

// GetStatus 获取任务状态
func (s *Scheduler) GetStatus() map[string]interface{} {
	entries := s.cron.Entries()
	feedTasks := make([]map[string]interface{}, 0)

	// 构建 feedID -> cronEntryID 的反向映射
	entryIDToFeedID := make(map[cron.EntryID]uint)
	for feedID, entryID := range s.entries {
		entryIDToFeedID[entryID] = feedID
	}

	// 遍历 cron entries
	for _, entry := range entries {
		feedID := entryIDToFeedID[entry.ID]
		feedName := s.feedNames[feedID]

		feedTasks = append(feedTasks, map[string]interface{}{
			"feed_id":  feedID,
			"feedName": feedName,
			"next_run": entry.Next.Format(time.RFC3339),
			"prev_run": entry.Prev.Format(time.RFC3339),
			"schedule": "cron job",
		})
	}

	return map[string]interface{}{
		"active":     true,
		"tasks":      len(entries),
		"feeds":      feedTasks,
		"feedNames":  s.feedNames,
	}
}

// TriggerManual 手动触发RSS源抓取
func (s *Scheduler) TriggerManual(feedID uint) error {
	feedName := s.feedNames[feedID]
	if feedName == "" {
		// 尝试从数据库获取
		feeds, err := s.rssSvc.GetActiveFeeds()
		if err != nil {
			return err
		}
		for _, feed := range feeds {
			if feed.ID == feedID {
				feedName = feed.Name
				break
			}
		}
	}
	if feedName == "" {
		feedName = "Unknown"
	}

	// 创建日志记录器
	var jobLog *JobLogHelper
	if s.jobLogSvc != nil {
		jobLog = s.jobLogSvc.NewJobLogHelper(feedID, feedName, "manual")
		jobLog.Start()
	}

	// 内存检查
	if s.jobLogSvc != nil && s.rssSvc.isMemoryHigh() {
		errMsg := "内存使用率过高，跳过抓取"
		log.Warn().Uint("feed_id", feedID).Msg(errMsg)
		if jobLog != nil {
			jobLog.Fail(errMsg)
		}
		return nil
	}

	// 使用 channel 实现超时保护
	done := make(chan struct{})
	var count int
	var err error

	go func() {
		count, err = s.rssSvc.FetchFeed(feedID)
		close(done)
	}()

	// 等待完成或超时（60秒）
	select {
	case <-done:
		if err != nil {
			log.Error().Err(err).Uint("feed_id", feedID).Msg("手动抓取失败")
			if jobLog != nil {
				jobLog.Fail(err.Error())
			}
			return err
		}
		log.Info().Uint("feed_id", feedID).Int("new", count).Msg("手动抓取完成")
		if jobLog != nil {
			jobLog.Success(count, 0)
		}
		return nil
	case <-time.After(60 * time.Second):
		log.Error().Uint("feed_id", feedID).Msg("手动抓取超时")
		if jobLog != nil {
			jobLog.Timeout()
		}
		return fmt.Errorf("抓取超时")
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

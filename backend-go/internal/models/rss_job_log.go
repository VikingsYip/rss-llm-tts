package models

import (
	"time"
)

// RssJobLog RSS抓取任务日志
type RssJobLog struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	FeedID        uint       `gorm:"column:feedId;index" json:"feedId"`
	FeedName      string     `gorm:"column:feedName;size:255" json:"feedName"`
	TriggerType   string     `gorm:"column:triggerType;size:50" json:"triggerType"` // manual, schedule
	TriggerTime   time.Time  `gorm:"column:triggerTime;index" json:"triggerTime"`
	StartTime     time.Time  `gorm:"column:startTime" json:"startTime"`
	EndTime       *time.Time `gorm:"column:endTime" json:"endTime"`
	Status        string     `gorm:"column:status;size:20;index" json:"status"` // running, success, failed, timeout
	NewArticles   int        `gorm:"column:newArticles" json:"newArticles"`
	TotalArticles int        `gorm:"column:totalArticles" json:"totalArticles"`
	ErrorMsg      string     `gorm:"column:errorMsg;type:text" json:"errorMsg"`
	Duration      int64      `gorm:"column:duration" json:"duration"` // 毫秒
	ExecutorIP    string     `gorm:"column:executorIp;size:50" json:"executorIp"`
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
}

func (RssJobLog) TableName() string {
	return "rss_job_logs"
}

// RssJobLogWithFeed 关联RSS源的日志
type RssJobLogWithFeed struct {
	RssJobLog
	FeedURL      string `gorm:"column:feedUrl" json:"feedUrl"`
	FeedCategory string `gorm:"column:feedCategory" json:"feedCategory"`
}

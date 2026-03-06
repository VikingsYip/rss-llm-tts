package models

import (
	"time"
)

// DailyTaskLog 每日任务日志
type DailyTaskLog struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Title         string     `gorm:"column:title;size:50" json:"title"`           // 对话标题 MMDD
	Host          string     `gorm:"column:host;size:100" json:"host"`            // 主持人
	Guest         string     `gorm:"column:guest;size:100" json:"guest"`          // 嘉宾
	Rounds        int        `gorm:"column:rounds" json:"rounds"`                 // 对话轮次
	NewsCount     int        `gorm:"column:newsCount" json:"newsCount"`            // 使用的新闻数量
	DialogueID    uint       `gorm:"column:dialogueId" json:"dialogueId"`         // 生成的对话ID
	WeChatPushed  bool       `gorm:"column:wechatPushed" json:"wechatPushed"`     // 是否推送到微信
	MediaID       string     `gorm:"column:mediaId;size:100" json:"mediaId"`       // 微信素材ID
	Status        string     `gorm:"column:status;size:20" json:"status"`          // 状态: success, failed
	ErrorMsg      string     `gorm:"column:errorMsg;type:text" json:"errorMsg"`   // 错误信息
	TriggerTime   time.Time `gorm:"column:triggerTime" json:"triggerTime"`        // 触发时间
	Duration      int64      `gorm:"column:duration" json:"duration"`              // 执行耗时(毫秒)
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
}

func (DailyTaskLog) TableName() string {
	return "daily_task_logs"
}

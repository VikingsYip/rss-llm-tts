package models

import (
	"time"
)

// WeChatMPConfig 微信公众号配置
type WeChatMPConfig struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	AppID           string    `gorm:"column:appId;size:100" json:"appId"`                     // 公众号AppID
	AppSecret       string    `gorm:"column:appSecret;size:200" json:"appSecret"`             // 公众号AppSecret
	Token           string    `gorm:"column:token;size:200" json:"token"`                   // 公众号Token
	EncodingAESKey  string    `gorm:"column:encodingAESKey;size:200" json:"encodingAESKey"` // 公众号EncodingAESKey
	TemplateID      string    `gorm:"column:templateId;size:100" json:"templateId"`          // 模板消息ID
	UserOpenID      string    `gorm:"column:userOpenId;size:100" json:"userOpenId"`          // 接收通知的用户OpenID
	Enabled         bool      `gorm:"column:enabled;default:false" json:"enabled"`           // 是否启用
	CreatedAt       time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (WeChatMPConfig) TableName() string {
	return "wechat_mp_configs"
}

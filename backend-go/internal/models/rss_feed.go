package models

import (
	"time"
)

type RssFeed struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Name         string     `gorm:"column:name;size:255;not null" json:"name"`
	URL          string     `gorm:"column:url;type:text;not null" json:"url"`
	Category     string     `gorm:"column:category;size:100;default:'其他'" json:"category"`
	Description  string     `gorm:"column:description;type:text" json:"description"`
	IsActive     bool       `gorm:"column:isActive;default:true" json:"isActive"`
	LastFetchTime *time.Time `gorm:"column:lastFetchTime" json:"lastFetchTime"`
	FetchInterval int64      `gorm:"column:fetchInterval;default:3600000" json:"fetchInterval"`
	ArticleCount int         `gorm:"-" json:"articleCount"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (RssFeed) TableName() string {
	return "rss_feeds"
}

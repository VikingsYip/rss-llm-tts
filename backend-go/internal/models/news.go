package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONTime time.Time

func (jt JSONTime) MarshalJSON() ([]byte, error) {
	if time.Time(jt).IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(time.Time(jt))
}

func (jt *JSONTime) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*jt = JSONTime(time.Time{})
		return nil
	}
	var t time.Time
	if err := json.Unmarshal(data, &t); err != nil {
		return err
	}
	*jt = JSONTime(t)
	return nil
}

func (jt JSONTime) Value() (driver.Value, error) {
	if time.Time(jt).IsZero() {
		return nil, nil
	}
	return time.Time(jt), nil
}

// Scan 实现 sql.Scanner 接口，用于从数据库读取时间
func (jt *JSONTime) Scan(value interface{}) error {
	if value == nil {
		*jt = JSONTime(time.Time{})
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		*jt = JSONTime(v)
	case []byte:
		if len(v) == 0 {
			*jt = JSONTime(time.Time{})
			return nil
		}
		t, err := time.Parse("2006-01-02T15:04:05Z07:00", string(v))
		if err != nil {
			t, err = time.Parse("2006-01-02 15:04:05", string(v))
		}
		if err != nil {
			return err
		}
		*jt = JSONTime(t)
	case string:
		if v == "" {
			*jt = JSONTime(time.Time{})
			return nil
		}
		t, err := time.Parse("2006-01-02T15:04:05Z07:00", v)
		if err != nil {
			t, err = time.Parse("2006-01-02 15:04:05", v)
		}
		if err != nil {
			return err
		}
		*jt = JSONTime(t)
	default:
		return fmt.Errorf("无法扫描类型 %T 作为 JSONTime", value)
	}
	return nil
}

type News struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Title        string     `gorm:"size:500;not null" json:"title"`
	Content      string     `gorm:"type:text" json:"content"`
	Summary      string     `gorm:"type:text" json:"summary"`
	Link         string     `gorm:"type:text;not null" json:"link"`
	Author       string     `gorm:"size:255" json:"author"`
	PublishedAt  *time.Time `gorm:"column:publishedAt" json:"publishedAt"`
	SourceName   string     `gorm:"column:sourceName;size:255" json:"sourceName"`
	Category     string     `gorm:"column:category;size:100" json:"category"`
	Status       string     `gorm:"column:status;size:50;default:'published'" json:"status"`
	IsRead       bool       `gorm:"column:isRead;default:false" json:"isRead"`
	IsFavorite   bool       `gorm:"column:isFavorite;default:false" json:"isFavorite"`
	IsIgnored    bool       `gorm:"column:isIgnored;default:false" json:"isIgnored"`
	RssFeedID    uint       `gorm:"column:rssFeedId;not null" json:"rssFeedId"`
	GUID         string     `gorm:"column:guid;size:255;uniqueIndex" json:"guid"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (News) TableName() string {
	return "news"
}

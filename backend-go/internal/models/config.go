package models

import (
	"time"
)

type Config struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"column:key;size:100;uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"column:value;type:text" json:"value"`
	Description string    `gorm:"column:description;size:255" json:"description"`
	Type        string    `gorm:"column:type;size:20;default:'string'" json:"type"`
	IsEncrypted bool      `gorm:"column:isEncrypted;default:false" json:"isEncrypted"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Config) TableName() string {
	return "configs"
}

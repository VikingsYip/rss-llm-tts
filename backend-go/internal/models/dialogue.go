package models

import (
	"time"
)

type Dialogue struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Title        string     `gorm:"column:title;size:255;not null" json:"title"`
	DialogueType string     `gorm:"column:dialogueType;size:50;not null" json:"dialogueType"`
	Character1   string     `gorm:"column:character1;size:100;not null" json:"character1"`
	Character2   string     `gorm:"column:character2;size:100;not null" json:"character2"`
	Status       string     `gorm:"column:status;size:50;default:'generating'" json:"status"`
	Rounds       int        `gorm:"column:rounds;default:8" json:"rounds"`
	NewsCount    int        `gorm:"column:newsCount;default:0" json:"newsCount"`
	AudioFile    string     `gorm:"column:audioFile;size:255" json:"audioFile"`
	Duration     int        `gorm:"column:duration" json:"duration"`
	Content      string     `gorm:"column:content;type:json" json:"content"`
	NewsIDs      string     `gorm:"column:newsIds;type:json" json:"newsIds"`
	ErrorMessage string     `gorm:"column:errorMessage;type:text" json:"errorMessage"`
	IsActive     bool       `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Dialogue) TableName() string {
	return "dialogues"
}

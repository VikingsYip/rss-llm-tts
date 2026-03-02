package database

import (
	"fmt"
	"time"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	var err error
	dsn := cfg.GetDSN()

	// 配置GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
		NowFunc: func() time.Time {
			return time.Now().Local()
		},
	}

	// 连接数据库
	DB, err = gorm.Open(mysql.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("数据库连接失败: %w", err)
	}

	// 配置连接池
	sqlDB, err := DB.DB()
	if err != nil {
		return nil, fmt.Errorf("获取数据库连接失败: %w", err)
	}

	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 迁移 news 表结构（删除旧的 rss_feed_id 列）
	if err := MigrateNewsTable(DB); err != nil {
		log.Warn().Err(err).Msg("news表迁移失败，请手动执行SQL")
	}

	log.Info().Msg("数据库连接成功")
	return DB, nil
}

// autoMigrate 自动迁移数据库表
func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.RssFeed{},
		&models.News{},
		&models.Dialogue{},
		&models.Config{},
	)
}

// MigrateNewsTable 迁移 news 表结构（删除旧列）
func MigrateNewsTable(db *gorm.DB) error {
	// 检查 rss_feed_id 列是否存在
	var count int64
	db.Raw("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news' AND COLUMN_NAME = 'rss_feed_id'").Scan(&count)

	if count > 0 {
		log.Info().Msg("检测到旧的 rss_feed_id 列，准备删除...")
		// 检查 rssFeedId 是否存在
		var countNew int64
		db.Raw("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news' AND COLUMN_NAME = 'rssFeedId'").Scan(&countNew)

		if countNew == 0 {
			// 重命名
			if err := db.Exec("ALTER TABLE news CHANGE COLUMN rss_feed_id rssFeedId INT UNSIGNED NOT NULL").Error; err != nil {
				return err
			}
			log.Info().Msg("列 rss_feed_id 已重命名为 rssFeedId")
		} else {
			// 删除旧的
			if err := db.Exec("ALTER TABLE news DROP COLUMN rss_feed_id").Error; err != nil {
				return err
			}
			log.Info().Msg("列 rss_feed_id 已删除")
		}
	} else {
		log.Info().Msg("news 表结构已是最新，无需迁移")
	}

	return nil
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}

// CloseDB 关闭数据库连接
func CloseDB() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

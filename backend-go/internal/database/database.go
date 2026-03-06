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

	// 自动迁移数据库表
	if err := autoMigrate(DB); err != nil {
		log.Warn().Err(err).Msg("数据库表迁移失败")
	}

	// 迁移 news 表结构（删除旧的 rss_feed_id 列）
	if err := MigrateNewsTable(DB); err != nil {
		log.Warn().Err(err).Msg("news表迁移失败，请手动执行SQL")
	}

	// 迁移 news 表字符集为 utf8mb4
	if err := MigrateNewsCharset(DB); err != nil {
		log.Warn().Err(err).Msg("news表字符集迁移失败")
	}

	log.Info().Msg("数据库连接成功")
	return DB, nil
}

// autoMigrate 自动迁移数据库表
func autoMigrate(db *gorm.DB) error {
	// 先执行 AutoMigrate
	err := db.AutoMigrate(
		&models.RssFeed{},
		&models.News{},
		&models.Dialogue{},
		&models.Config{},
		&models.RssJobLog{},
		&models.WeChatMPConfig{},
		&models.DailyTaskLog{},
	)
	if err != nil {
		return err
	}

	// 修复 dialogueType 列宽度（兼容旧数据库）
	log.Info().Msg("修复 dialogueType 列...")
	if err := db.Exec("ALTER TABLE dialogues MODIFY COLUMN dialogueType VARCHAR(50) NOT NULL").Error; err != nil {
		log.Warn().Err(err).Msg("修复 dialogueType 列失败，可能是列类型问题")
	}

	// 确保 Content 列是 JSON 类型
	log.Info().Msg("检查 Content 列...")
	if err := db.Exec("ALTER TABLE dialogues MODIFY COLUMN content JSON").Error; err != nil {
		log.Warn().Err(err).Msg("修复 Content 列失败")
	}

	return nil
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

// MigrateNewsCharset 迁移 news 表字符集为 utf8mb4
func MigrateNewsCharset(db *gorm.DB) error {
	// 检查当前表的字符集
	type tableCharset struct {
		Charset   string
		Collation string
	}
	var result tableCharset
	db.Raw("SELECT CC.CHARACTER_SET_NAME AS charset, CC.COLLATION_NAME AS collation FROM information_schema.TABLES T JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY CC ON T.TABLE_COLLATION = CC.COLLATION_NAME WHERE T.TABLE_SCHEMA = DATABASE() AND T.TABLE_NAME = 'news'").Scan(&result)

	needConvert := false
	if result.Charset != "utf8mb4" {
		log.Info().Str("charset", result.Charset).Str("collation", result.Collation).Msg("检测到news表字符集不是utf8mb4，准备转换...")
		needConvert = true
	}

	// 检查content列的字符集
	type columnCharset struct {
		ColumnName string
		Charset    string
		Collation  string
	}
	var contentCol columnCharset
	db.Raw("SELECT COLUMN_NAME AS columnName, CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news' AND COLUMN_NAME = 'content'").Scan(&contentCol)

	if contentCol.Charset != "utf8mb4" {
		log.Info().Str("charset", contentCol.Charset).Str("collation", contentCol.Collation).Msg("检测到news.content列字符集不是utf8mb4，准备转换...")
		needConvert = true
	}

	if needConvert {
		// 转换表字符集
		if err := db.Exec("ALTER TABLE news CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").Error; err != nil {
			return err
		}
		log.Info().Msg("news表及content列字符集已转换为utf8mb4_unicode_ci")
	} else {
		log.Debug().Msg("news表和content列字符集已是utf8mb4，无需转换")
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

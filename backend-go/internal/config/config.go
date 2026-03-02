package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	LLM      LLMConfig
	TTS      TTSConfig
	Proxy    ProxyConfig
	Storage  StorageConfig
	RSS      RSSConfig
	Dialogue DialogueConfig
}

type ServerConfig struct {
	Port string
	Env  string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	Name     string
	User     string
	Password string
}

type LLMConfig struct {
	APIURL string
	APIKey string
	Model  string
}

type TTSConfig struct {
	APIURL       string
	APIKey       string
	Voice        string
	VoiceHost    string
	VoiceGuest   string
}

type ProxyConfig struct {
	Enabled bool
	URL     string
}

type StorageConfig struct {
	UploadPath string
	LogPath    string
}

type RSSConfig struct {
	MaxNewsPerFeed int
	FetchTimeout   int
}

type DialogueConfig struct {
	NewsCount int
	Rounds    int
}

var AppConfig *Config

func LoadConfig() (*Config, error) {
	// 尝试加载.env文件（开发环境）
	_ = godotenv.Load()

	// 使用viper加载配置
	viper.SetConfigName(".env")
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AddConfigPath("../")
	viper.AddConfigPath("../../")

	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		log.Warn().Err(err).Msg("无法读取配置文件，使用环境变量")
	}

	config := &Config{
		Server: ServerConfig{
			Port: getEnv("PORT", "3001"),
			Env:  getEnv("ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "127.0.0.1"),
			Port:     getEnvInt("DB_PORT", 3306),
			Name:     getEnv("DB_NAME", "rss_llm_tts"),
			User:     getEnv("DB_USER", "root"),
			Password: getEnv("DB_PASSWORD", ""),
		},
		LLM: LLMConfig{
			APIURL: getEnv("LLM_API_URL", "https://api.openai.com/v1/chat/completions"),
			APIKey: getEnv("LLM_API_KEY", ""),
			Model:  getEnv("LLM_MODEL", "gpt-3.5-turbo"),
		},
		TTS: TTSConfig{
			APIURL:     getEnv("TTS_API_URL", "https://api.openai.com/v1/audio/speech"),
			APIKey:     getEnv("TTS_API_KEY", ""),
			Voice:      getEnv("TTS_VOICE", "alloy"),
			VoiceHost:  getEnv("TTS_VOICE_HOST", "alloy"),
			VoiceGuest: getEnv("TTS_VOICE_GUEST", "nova"),
		},
		Proxy: ProxyConfig{
			Enabled: getEnvBool("HTTP_PROXY_ENABLED", false),
			URL:     getEnv("HTTP_PROXY_URL", ""),
		},
		Storage: StorageConfig{
			UploadPath: getEnv("UPLOAD_PATH", "./uploads"),
			LogPath:    getEnv("LOG_PATH", "./logs"),
		},
		RSS: RSSConfig{
			MaxNewsPerFeed: getEnvInt("MAX_NEWS_PER_FEED", 20),
			FetchTimeout:   getEnvInt("FETCH_TIMEOUT", 30), // 修复：增加默认超时到 30 秒
		},
		Dialogue: DialogueConfig{
			NewsCount: getEnvInt("DIALOGUE_NEWS_COUNT", 5),
			Rounds:    getEnvInt("DIALOGUE_ROUNDS", 8),
		},
	}

	AppConfig = config

	// 确保目录存在
	config.ensureDirectories()

	log.Info().Msg("配置加载成功")
	return config, nil
}

func (c *Config) ensureDirectories() {
	dirs := []string{c.Storage.UploadPath, c.Storage.LogPath}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Error().Err(err).Str("dir", dir).Msg("无法创建目录")
		}
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.Database.User,
		c.Database.Password,
		c.Database.Host,
		c.Database.Port,
		c.Database.Name,
	)
}

// GetProxyURL 解析代理URL
func (c *ProxyConfig) GetProxyURL() *url.URL {
	if !c.Enabled || c.URL == "" {
		return nil
	}
	proxyURL, err := url.Parse(c.URL)
	if err != nil {
		log.Error().Err(err).Msg("代理URL解析失败")
		return nil
	}
	return proxyURL
}

// 等待数据库连接
func WaitForDB(dsn string, maxRetries int, retryInterval time.Duration) error {
	for i := 0; i < maxRetries; i++ {
		db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
		if err == nil {
			sqlDB, _ := db.DB()
			sqlDB.Close()
			return nil
		}
		log.Warn().Err(err).Int("retry", i+1).Msg("数据库连接失败，等待重试...")
		time.Sleep(retryInterval)
	}
	return fmt.Errorf("无法连接到数据库")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

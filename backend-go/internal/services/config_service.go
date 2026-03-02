package services

import (
	"fmt"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/utils"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type ConfigService struct {
	db *gorm.DB
	cfg *config.Config
}

func NewConfigService(db *gorm.DB, cfg *config.Config) *ConfigService {
	return &ConfigService{db: db, cfg: cfg}
}

// GetAllConfigs 获取所有配置
func (s *ConfigService) GetAllConfigs() (map[string]string, error) {
	var configs []models.Config
	if err := s.db.Find(&configs).Error; err != nil {
		return nil, err
	}

	// 先用.env配置作为默认值
	result := map[string]string{
		"http_proxy_enabled": fmt.Sprintf("%v", s.cfg.Proxy.Enabled),
		"http_proxy_url":    s.cfg.Proxy.URL,
		"llm_api_url":       s.cfg.LLM.APIURL,
		"llm_model":         s.cfg.LLM.Model,
		"tts_api_url":       s.cfg.TTS.APIURL,
		"tts_voice":         s.cfg.TTS.Voice,
		"tts_voice_host":   s.cfg.TTS.VoiceHost,
		"tts_voice_guest":  s.cfg.TTS.VoiceGuest,
	}

	// 用数据库配置覆盖.env配置
	for _, c := range configs {
		value := c.Value
		if c.IsEncrypted {
			decrypted, err := utils.Decrypt(c.Value)
			if err != nil {
				log.Warn().Err(err).Str("key", c.Key).Msg("配置解密失败，使用原始值")
				// 解密失败时使用原始值
				value = c.Value
			} else {
				value = decrypted
			}
		}
		result[c.Key] = value
	}

	return result, nil
}

// GetConfig 获取单个配置
func (s *ConfigService) GetConfig(key string) (*models.Config, error) {
	var config models.Config
	if err := s.db.Where("`key` = ?", key).First(&config).Error; err != nil {
		return nil, err
	}

	if config.IsEncrypted {
		decrypted, err := utils.Decrypt(config.Value)
		if err != nil {
			return nil, err
		}
		config.Value = decrypted
	}

	return &config, nil
}

// SetConfig 设置配置
func (s *ConfigService) SetConfig(key, value, configType string, isEncrypted bool) error {
	storeValue := value
	if isEncrypted {
		encrypted, err := utils.Encrypt(value)
		if err != nil {
			return err
		}
		storeValue = encrypted
	}

	var config models.Config
	if err := s.db.Where("`key` = ?", key).First(&config).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// 创建新配置
			config = models.Config{
				Key:         key,
				Value:       storeValue,
				Type:        configType,
				IsEncrypted: isEncrypted,
			}
			return s.db.Create(&config).Error
		}
		return err
	}

	// 更新现有配置
	config.Value = storeValue
	config.Type = configType
	return s.db.Save(&config).Error
}

// DeleteConfig 删除配置
func (s *ConfigService) DeleteConfig(key string) error {
	return s.db.Where("`key` = ?", key).Delete(&models.Config{}).Error
}

// BatchSetConfig 批量设置配置
func (s *ConfigService) BatchSetConfig(configs map[string]interface{}) error {
	for key, value := range configs {
		var strValue string
		var isEncrypted bool
		configType := "string"

		switch v := value.(type) {
		case string:
			strValue = v
		case bool:
			strValue = fmt.Sprintf("%v", v)
		case float64, float32:
			strValue = fmt.Sprintf("%v", v)
		default:
			strValue = fmt.Sprintf("%v", value)
		}

		// 检查是否需要加密
		if key == "llm_api_key" || key == "tts_api_key" || key == "tts_api_secret" {
			isEncrypted = true
		}

		if err := s.SetConfig(key, strValue, configType, isEncrypted); err != nil {
			return err
		}
	}
	return nil
}

// TestLLM 测试LLM连接
func (s *ConfigService) TestLLM() (map[string]interface{}, error) {
	// 获取配置
	configs, _ := s.GetAllConfigs()
	llm := NewLLMService(s.db, s.cfg, configs)

	testParams := DialogueParams{
		DialogueType: "chat",
		Character1:   "主持人",
		Character2:   "嘉宾",
		Rounds:        2,
		NewsContent: []NewsContent{
			{
				Title:    "测试新闻",
				Summary:  "这是一个测试",
				Source:   "测试来源",
			},
		},
	}

	_, err := llm.GenerateDialogue(testParams)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"message": err.Error(),
		}, nil
	}

	return map[string]interface{}{
		"success": true,
		"message": "LLM连接测试成功",
	}, nil
}

// TestTTS 测试TTS连接
func (s *ConfigService) TestTTS() (map[string]interface{}, error) {
	// 获取配置
	configs, _ := s.GetAllConfigs()
	tts := NewTTSService(s.db, s.cfg, configs)

	testText := "你好，这是TTS连接测试。"
	_, err := tts.callTTSAPI(testText)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"message": err.Error(),
		}, nil
	}

	return map[string]interface{}{
		"success": true,
		"message": "TTS连接测试成功",
	}, nil
}

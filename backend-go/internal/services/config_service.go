package services

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

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

// TestProxy 测试代理连接
func (s *ConfigService) TestProxy(proxyUrl, httpsProxy, noProxy string) (map[string]interface{}, error) {
	startTime := time.Now()

	// 创建一个简单的 HTTP 客户端，使用代理
	transport := &http.Transport{}

	// 设置 HTTP 代理
	if proxyUrl != "" {
		proxyURL, err := url.Parse(proxyUrl)
		if err != nil {
			return map[string]interface{}{
				"success": false,
				"message": "代理地址格式不正确: " + err.Error(),
			}, nil
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}

	// 测试访问一个常用的外部网站（使用 http 而不是 https 来简化测试）
	testURL := "http://www.google.com/generate_204"

	req, err := http.NewRequest("GET", testURL, nil)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"message": "创建请求失败: " + err.Error(),
		}, nil
	}

	// 添加常见的请求头
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"message": "代理连接失败: " + err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	responseTime := int(time.Since(startTime).Milliseconds())

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return map[string]interface{}{
			"success":      true,
			"message":      "代理连接成功",
			"responseTime": responseTime,
		}, nil
	} else {
		return map[string]interface{}{
			"success":      false,
			"message":      "代理连接异常，状态码: " + strconv.Itoa(resp.StatusCode),
			"responseTime": responseTime,
		}, nil
	}
}

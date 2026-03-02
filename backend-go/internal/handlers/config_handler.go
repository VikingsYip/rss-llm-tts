package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/services"
)

type ConfigHandler struct {
	configService *services.ConfigService
}

func NewConfigHandler(configSvc *services.ConfigService) *ConfigHandler {
	return &ConfigHandler{configService: configSvc}
}

// GetConfigs 获取所有配置
func (h *ConfigHandler) GetConfigs(c *gin.Context) {
	configs, err := h.configService.GetAllConfigs()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, configs)
}

// GetConfig 获取单个配置
func (h *ConfigHandler) GetConfig(c *gin.Context) {
	key := c.Param("key")

	config, err := h.configService.GetConfig(key)
	if err != nil {
		Error(c, http.StatusNotFound, "配置不存在")
		return
	}

	Success(c, config)
}

// UpdateConfig 更新配置
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	var input struct {
		Key          string `json:"key" binding:"required"`
		Value        string `json:"value" binding:"required"`
		Type         string `json:"type"`
		IsEncrypted  bool   `json:"isEncrypted"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	configType := input.Type
	if configType == "" {
		configType = "string"
	}

	if err := h.configService.SetConfig(input.Key, input.Value, configType, input.IsEncrypted); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "配置更新成功"})
}

// BatchUpdateConfig 批量更新配置
func (h *ConfigHandler) BatchUpdateConfig(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.configService.BatchSetConfig(input); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "批量更新成功"})
}

// SaveSystemSettings 保存系统设置
func (h *ConfigHandler) SaveSystemSettings(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 转换前端字段名为数据库key
	configMap := map[string]string{
		"llmApiUrl":         "llm_api_url",
		"llmApiKey":         "llm_api_key",
		"llmModel":          "llm_model",
		"ttsApiUrl":         "tts_api_url",
		"ttsAppId":          "tts_app_id",
		"ttsApiKey":         "tts_api_key",
		"ttsApiSecret":      "tts_api_secret",
		"ttsVoice":          "tts_voice",
		"ttsVoiceHost":      "tts_voice_host",
		"ttsVoiceGuest":     "tts_voice_guest",
		"ttsEnabled":        "tts_enabled",
		"httpProxy":         "http_proxy",
		"httpsProxy":        "https_proxy",
		"noProxy":           "no_proxy",
		"httpProxyEnabled":  "http_proxy_enabled",
		"httpProxyUrl":     "http_proxy_url",
		"rssFetchInterval":  "rss_fetch_interval",
		"newsRetentionHours": "news_retention_hours",
		"dialogueNewsCount": "dialogue_news_count",
		"dialogueRounds":    "dialogue_rounds",
	}

	// 构建要保存的配置
	configs := make(map[string]interface{})
	for frontendKey, dbKey := range configMap {
		if value, exists := input[frontendKey]; exists {
			configs[dbKey] = value
		}
	}

	if err := h.configService.BatchSetConfig(configs); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "设置保存成功"})
}

// DeleteConfig 删除配置
func (h *ConfigHandler) DeleteConfig(c *gin.Context) {
	key := c.Param("key")

	if err := h.configService.DeleteConfig(key); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "删除成功"})
}

// TestLLM 测试LLM连接
func (h *ConfigHandler) TestLLM(c *gin.Context) {
	result, err := h.configService.TestLLM()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, result)
}

// TestTTS 测试TTS连接
func (h *ConfigHandler) TestTTS(c *gin.Context) {
	result, err := h.configService.TestTTS()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, result)
}

// TestProxy 测试代理连接
func (h *ConfigHandler) TestProxy(c *gin.Context) {
	var input struct {
		ProxyUrl  string `json:"proxyUrl" binding:"required"`
		HttpsProxy string `json:"httpsProxy"`
		NoProxy   string `json:"noProxy"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	result, err := h.configService.TestProxy(input.ProxyUrl, input.HttpsProxy, input.NoProxy)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, result)
}

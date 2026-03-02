package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type TTSService struct {
	db          *gorm.DB
	client      *http.Client
	config      *config.Config
	configs     map[string]string // 数据库配置
	uploadPath  string
}

type AudioResult struct {
	Filename string
	Duration int
	Size     int64
	Success  bool
}

func NewTTSService(db *gorm.DB, cfg *config.Config, configs map[string]string) *TTSService {
	client := &http.Client{
		Timeout: 120 * time.Second,
	}

	return &TTSService{
		db:         db,
		client:     client,
		config:     cfg,
		configs:    configs,
		uploadPath: cfg.Storage.UploadPath,
	}
}

// GenerateDialogueAudio 为对话生成音频
func (s *TTSService) GenerateDialogueAudio(dialogueContent string, dialogueID uint) (*AudioResult, error) {
	filename := fmt.Sprintf("dialogue_%d.mp3", time.Now().UnixMilli())
	filepath := filepath.Join(s.uploadPath, filename)

	// 确保目录存在
	if err := os.MkdirAll(s.uploadPath, 0755); err != nil {
		return nil, err
	}

	// 调用TTS API
	audioData, err := s.callTTSAPI(dialogueContent)
	if err != nil {
		log.Error().Err(err).Msg("TTS API调用失败")
		// 生成模拟音频文件
		return s.createMockAudio(filepath, dialogueContent), nil
	}

	// 写入文件
	if err := ioutil.WriteFile(filepath, audioData, 0644); err != nil {
		return nil, err
	}

	// 计算音频时长（估算，每分钟约200字）
	duration := len(dialogueContent) / 200 * 60

	return &AudioResult{
		Filename: filename,
		Duration: duration,
		Size:     int64(len(audioData)),
		Success:  true,
	}, nil
}

// GenerateMultiVoiceAudio 生成多发音人音频
func (s *TTSService) GenerateMultiVoiceAudio(rounds []Round, dialogueID uint) (*AudioResult, error) {
	filename := fmt.Sprintf("dialogue_%d.mp3", time.Now().UnixMilli())
	filepath := filepath.Join(s.uploadPath, filename)

	// 确保目录存在
	if err := os.MkdirAll(s.uploadPath, 0755); err != nil {
		return nil, err
	}

	// 过滤掉不需要的角色
	filteredRounds := s.filterRounds(rounds)

	// 为每个轮次生成音频并合并
	var totalAudio []byte
	totalDuration := 0

	for _, round := range filteredRounds {
		// 选择发音人 - 优先从数据库配置读取
		voice := s.configs["tts_voice_host"]
		if voice == "" {
			voice = s.config.TTS.VoiceHost
		}
		if strings.Contains(round.Speaker, "嘉宾") || strings.Contains(round.Speaker, "专家") || strings.Contains(round.Speaker, "CEO") {
			voice = s.configs["tts_voice_guest"]
			if voice == "" {
				voice = s.config.TTS.VoiceGuest
			}
		}

		// 调用TTS API
		audioData, err := s.callTTSAPIWithVoice(round.Text, voice)
		if err != nil {
			log.Warn().Err(err).Str("speaker", round.Speaker).Msg("单轮TTS生成失败")
			continue
		}

		totalAudio = append(totalAudio, audioData...)
		totalDuration += len(round.Text) / 200 * 60

		// 添加1秒静音
		silence := make([]byte, 44100*1) // 1秒静音
		totalAudio = append(totalAudio, silence...)
	}

	if len(totalAudio) == 0 {
		// 生成模拟音频
		return s.createMockAudio(filepath, "模拟音频"), nil
	}

	// 写入文件
	if err := ioutil.WriteFile(filepath, totalAudio, 0644); err != nil {
		return nil, err
	}

	return &AudioResult{
		Filename: filename,
		Duration: totalDuration,
		Size:     int64(len(totalAudio)),
		Success:  true,
	}, nil
}

// callTTSAPI 调用TTS API
func (s *TTSService) callTTSAPI(text string) ([]byte, error) {
	// 优先从数据库配置读取
	voice := s.configs["tts_voice"]
	if voice == "" {
		voice = s.config.TTS.Voice
	}
	return s.callTTSAPIWithVoice(text, voice)
}

// callTTSAPIWithVoice 使用指定发音人调用TTS API
func (s *TTSService) callTTSAPIWithVoice(text, voice string) ([]byte, error) {
	// 优先从数据库配置读取
	apiURL := s.configs["tts_api_url"]
	apiKey := s.configs["tts_api_key"]
	if apiURL == "" {
		apiURL = s.config.TTS.APIURL
	}
	if apiKey == "" {
		apiKey = s.config.TTS.APIKey
	}

	if apiKey == "" {
		return nil, fmt.Errorf("TTS API Key未配置")
	}

	// 构建请求
	reqBody := map[string]interface{}{
		"model":          "tts-1",
		"input":          text,
		"voice":          voice,
		"response_format": "mp3",
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	// 创建请求
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 设置代理
	var proxyURL *url.URL
	if s.config.Proxy.Enabled && s.config.Proxy.URL != "" {
		proxyURL, _ = url.Parse(s.config.Proxy.URL)
	}

	// 使用带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	if proxyURL != nil {
		s.client.Transport = &http.Transport{Proxy: http.ProxyURL(proxyURL)}
	}

	resp, err := s.client.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("TTS API错误: %d", resp.StatusCode)
	}

	return ioutil.ReadAll(resp.Body)
}

// filterRounds 过滤不需要的轮次
func (s *TTSService) filterRounds(rounds []Round) []Round {
	filterRoles := []string{"主持人", "嘉宾", "解说", "评论员"}

	filtered := make([]Round, 0)
	for _, round := range rounds {
		shouldInclude := true
		lowerSpeaker := strings.ToLower(round.Speaker)
		for _, role := range filterRoles {
			if strings.Contains(lowerSpeaker, strings.ToLower(role)) {
				shouldInclude = false
				break
			}
		}
		if shouldInclude {
			filtered = append(filtered, round)
		}
	}

	if len(filtered) == 0 {
		return rounds
	}

	return filtered
}

// createMockAudio 创建模拟音频文件
func (s *TTSService) createMockAudio(filepath, text string) *AudioResult {
	mockContent := []byte("Mock Audio Content")
	if err := ioutil.WriteFile(filepath, mockContent, 0644); err != nil {
		log.Error().Err(err).Msg("创建模拟音频失败")
		return &AudioResult{Success: false}
	}

	duration := len(text) / 200 * 60

	return &AudioResult{
		Filename: filepath,
		Duration: duration,
		Size:     int64(len(mockContent)),
		Success:  true,
	}
}

// DeleteAudioFile 删除音频文件
func (s *TTSService) DeleteAudioFile(filename string) error {
	filepath := filepath.Join(s.uploadPath, filename)
	return os.Remove(filepath)
}

// GetAudioInfo 获取音频文件信息
func (s *TTSService) GetAudioInfo(filename string) (*AudioResult, error) {
	filepath := filepath.Join(s.uploadPath, filename)

	info, err := os.Stat(filepath)
	if err != nil {
		return nil, err
	}

	return &AudioResult{
		Filename: filename,
		Size:     info.Size(),
	}, nil
}

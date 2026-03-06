package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type DialogueService struct {
	db             *gorm.DB
	llmService     *LLMService
	ttsService     *TTSService
	newsService    *NewsService
	configSvc      *ConfigService
	wechatMPService *WeChatMPService
	configs        map[string]string // 缓存配置
}

// NewDialogueService 创建对话服务
func NewDialogueService(db *gorm.DB, llm *LLMService, tts *TTSService, news *NewsService, configSvc *ConfigService) *DialogueService {
	// 获取最新配置
	configs, _ := configSvc.GetAllConfigs()
	return &DialogueService{
		db:             db,
		llmService:     llm,
		ttsService:     tts,
		newsService:    news,
		configSvc:      configSvc,
		wechatMPService: NewWeChatMPService(db),
		configs:        configs,
	}
}

// CreateDialogue 创建对话
func (s *DialogueService) CreateDialogue(data map[string]interface{}) (*models.Dialogue, error) {
	title, _ := data["title"].(string)
	dialogueType, _ := data["dialogueType"].(string)
	character1, _ := data["character1"].(string)
	character2, _ := data["character2"].(string)
	rounds, _ := data["rounds"].(float64)

	// 处理newsIds - 可能是数组或字符串
	var newsIDsStr string
	if newsIDs, ok := data["newsIds"].([]interface{}); ok {
		// 是数组，转换为字符串
		var ids []string
		for _, id := range newsIDs {
			ids = append(ids, fmt.Sprintf("%v", id))
		}
		newsIDsStr = "[" + strings.Join(ids, ",") + "]"
	} else if newsIDsStrVal, ok := data["newsIds"].(string); ok {
		newsIDsStr = newsIDsStrVal
	}

	// 读取newsCount
	newsCount := 0
	if nc, ok := data["newsCount"].(float64); ok {
		newsCount = int(nc)
	}

	// 从配置读取默认值
	if rounds == 0 {
		if val, ok := s.configs["dialogue_default_rounds"]; ok {
			fmt.Sscanf(val, "%d", &rounds)
		}
		if rounds == 0 {
			rounds = 8 // 最终默认值
		}
	}

	dialogue := &models.Dialogue{
		Title:        title,
		DialogueType: dialogueType,
		Character1:   character1,
		Character2:   character2,
		Status:       "generating",
		Rounds:       int(rounds),
		NewsIDs:      newsIDsStr,
		NewsCount:    newsCount,
		IsActive:     true,
	}

	if err := s.db.Create(dialogue).Error; err != nil {
		return nil, err
	}

	// 异步生成对话内容
	go s.generateDialogueContent(dialogue.ID)

	log.Info().Uint("id", dialogue.ID).Msg("对话创建成功")
	return dialogue, nil
}

// generateDialogueContent 异步生成对话内容
func (s *DialogueService) generateDialogueContent(dialogueID uint) {
	var dialogue models.Dialogue
	if err := s.db.First(&dialogue, dialogueID).Error; err != nil {
		log.Error().Err(err).Uint("id", dialogueID).Msg("对话不存在")
		return
	}

	// 更新状态为生成中
	s.db.Model(&dialogue).Update("status", "generating")

	// 获取新闻内容
	var newsContent []NewsContent
	newsIDs, err := ParseNewsIDs(dialogue.NewsIDs)
	if err != nil || len(newsIDs) == 0 {
		// 获取随机新闻
		news, err := s.newsService.GetRandomNews(5)
		if err != nil || len(news) == 0 {
			s.updateDialogueError(dialogueID, "没有找到新闻素材")
			return
		}
		for _, n := range news {
			newsContent = append(newsContent, NewsContent{
				Title:      n.Title,
				Summary:    n.Summary,
				Content:    n.Content,
				Source:     n.SourceName,
				PublishedAt: *n.PublishedAt,
				Author:     n.Author,
			})
		}
	} else {
		news, err := s.newsService.GetNewsByIDs(newsIDs)
		if err != nil || len(news) == 0 {
			s.updateDialogueError(dialogueID, "无法获取选择的新闻")
			return
		}
		for _, n := range news {
			publishedAt := *n.PublishedAt
			if publishedAt.IsZero() {
				publishedAt = time.Now()
			}
			newsContent = append(newsContent, NewsContent{
				Title:      n.Title,
				Summary:    n.Summary,
				Content:    n.Content,
				Source:     n.SourceName,
				PublishedAt: publishedAt,
				Author:     n.Author,
			})
		}
	}

	// 调用LLM生成对话
	params := DialogueParams{
		DialogueType: dialogue.DialogueType,
		Character1:   dialogue.Character1,
		Character2:   dialogue.Character2,
		Rounds:       dialogue.Rounds,
		NewsContent:  newsContent,
	}

	dialogueResult, err := s.llmService.GenerateDialogue(params)
	if err != nil {
		log.Error().Err(err).Msg("LLM生成失败")
		s.updateDialogueError(dialogueID, err.Error())
		return
	}

	// 转换内容为JSON
	contentJSON, _ := json.Marshal(dialogueResult)

	// 检查是否启用TTS - 每次重新读取最新配置
	var audioFile string
	var duration int
	ttsEnabled := "true"
	if s.configSvc != nil {
		latestConfigs, _ := s.configSvc.GetAllConfigs()
		ttsEnabled = latestConfigs["tts_enabled"]
	}
	if ttsEnabled == "false" || ttsEnabled == "0" {
		log.Info().Msg("TTS已禁用，仅生成LLM对话")
	} else {
		// 调用TTS生成音频
		audioResult, err := s.ttsService.GenerateMultiVoiceAudio(dialogueResult.Rounds, dialogueID)
		if err != nil {
			log.Warn().Err(err).Msg("TTS生成失败")
		} else {
			audioFile = audioResult.Filename
			duration = audioResult.Duration
		}
	}

	// 更新对话记录
	newsCount := len(newsContent)

	s.db.Model(&dialogue).Updates(map[string]interface{}{
		"status":      "completed",
		"content":      string(contentJSON),
		"audioFile":   audioFile,
		"duration":    duration,
		"newsCount":   newsCount,
	})

	log.Info().Uint("id", dialogueID).Msg("对话生成完成")

	// 对话生成完成后，推送到微信公众号草稿箱
	go s.pushToWeChatDraft(dialogueID, dialogue.Title, dialogueResult.Rounds)
}

// pushToWeChatDraft 推送到微信公众号草稿箱
func (s *DialogueService) pushToWeChatDraft(dialogueID uint, title string, rounds []Round) {
	// 检查微信公众号推送是否启用
	wechatConfig, err := s.wechatMPService.GetConfig()
	if err != nil {
		log.Warn().Err(err).Uint("id", dialogueID).Msg("获取微信公众号配置失败")
		return
	}

	if !wechatConfig.Enabled {
		log.Debug().Uint("id", dialogueID).Msg("微信公众号推送未启用，跳过草稿推送")
		return
	}

	if wechatConfig.AppID == "" || wechatConfig.AppSecret == "" {
		log.Warn().Uint("id", dialogueID).Msg("微信公众号AppID或AppSecret未配置，跳过草稿推送")
		return
	}

	// 转换rounds格式
	dialogueRounds := make([]DialogueRound, len(rounds))
	for i, r := range rounds {
		dialogueRounds[i] = DialogueRound{
			Speaker: r.Speaker,
			Text:    r.Text,
		}
	}

	// 添加到草稿箱
	author := "RSS-LLM-TTS"
	mediaID, err := s.wechatMPService.AddDraft(title, author, "", dialogueRounds)
	if err != nil {
		log.Error().Err(err).Uint("id", dialogueID).Msg("推送微信公众号草稿失败")
		return
	}

	log.Info().Uint("id", dialogueID).Str("media_id", mediaID).Msg("对话已推送到微信公众号草稿箱")
}

// updateDialogueError 更新对话错误信息
func (s *DialogueService) updateDialogueError(id uint, errorMsg string) {
	s.db.Model(&models.Dialogue{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       "failed",
		"errorMessage": errorMsg,
	})
}

// GetDialogueList 获取对话列表
// 参数说明：
// - page: 页码（从1开始）
// - limit: 每页数量
// - status: 状态筛选
// - dialogueType: 对话类型筛选
// - startDate: 开始日期筛选 (格式: 2006-01-02)
// - endDate: 结束日期筛选 (格式: 2006-01-02)
func (s *DialogueService) GetDialogueList(page, limit int, status, dialogueType, startDate, endDate string) ([]models.Dialogue, int64, error) {
	var dialogues []models.Dialogue
	var total int64

	query := s.db.Model(&models.Dialogue{}).Where("isActive = ?", true)

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if dialogueType != "" {
		query = query.Where("dialogueType = ?", dialogueType)
	}
	// 日期筛选
	if startDate != "" {
		query = query.Where("DATE(createdAt) >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("DATE(createdAt) <= ?", endDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	if err := query.Order("createdAt DESC").Offset(offset).Limit(limit).Find(&dialogues).Error; err != nil {
		return nil, 0, err
	}

	return dialogues, total, nil
}

// GetDialogueByID 获取对话详情
func (s *DialogueService) GetDialogueByID(id uint) (*models.Dialogue, error) {
	var dialogue models.Dialogue
	if err := s.db.Where("id = ? AND isActive = ?", id, true).First(&dialogue).Error; err != nil {
		return nil, err
	}
	return &dialogue, nil
}

// UpdateDialogueStatus 更新对话状态
func (s *DialogueService) UpdateDialogueStatus(id uint, status string) error {
	return s.db.Model(&models.Dialogue{}).Where("id = ?", id).Update("status", status).Error
}

// DeleteDialogue 删除对话
func (s *DialogueService) DeleteDialogue(id uint) error {
	return s.db.Model(&models.Dialogue{}).Where("id = ?", id).Update("isActive", false).Error
}

// RegenerateDialogue 重新生成对话
func (s *DialogueService) RegenerateDialogue(id uint) error {
	go s.generateDialogueContent(id)
	return nil
}

// GetDialogueStats 获取对话统计
func (s *DialogueService) GetDialogueStats() (map[string]interface{}, error) {
	var stats []struct {
		Status string
		Count  int64
	}

	s.db.Model(&models.Dialogue{}).Select("status, COUNT(*) as count").Where("isActive = ?", true).Group("status").Scan(&stats)

	result := map[string]interface{}{
		"total":      int64(0),
		"generating": int64(0),
		"completed":  int64(0),
		"failed":     int64(0),
	}

	for _, stat := range stats {
		result["total"] = result["total"].(int64) + stat.Count
		result[stat.Status] = stat.Count
	}

	return result, nil
}

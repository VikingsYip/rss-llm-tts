package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// DailyTaskConfigData 每日任务配置数据（从数据库读取）
type DailyTaskConfigData struct {
	Enabled      bool   `json:"enabled"`
	ExecutionTime string `json:"executionTime"`
	Host         string `json:"host"`
	Guest        string `json:"guest"`
	Rounds       int    `json:"rounds"`
	PushToWeChat bool   `json:"pushToWeChat"`
}

// DailyTaskService 每日定时任务服务
type DailyTaskService struct {
	db              *gorm.DB
	llmService     *LLMService
	wechatMPService *WeChatMPService
	config          *config.Config
	configData      DailyTaskConfigData
}

// NewDailyTaskService 创建每日任务服务
func NewDailyTaskService(db *gorm.DB, llm *LLMService, wechat *WeChatMPService, cfg *config.Config) *DailyTaskService {
	svc := &DailyTaskService{
		db:              db,
		llmService:      llm,
		wechatMPService: wechat,
		config:          cfg,
	}
	// 初始化时从数据库加载配置
	svc.loadConfigFromDB()
	return svc
}

// loadConfigFromDB 从数据库加载配置
func (s *DailyTaskService) loadConfigFromDB() {
	// 默认值从环境变量
	s.configData = DailyTaskConfigData{
		Enabled:       s.config.DailyTask.Enabled,
		ExecutionTime: s.config.DailyTask.ExecutionTime,
		Host:          s.config.DailyTask.Host,
		Guest:         s.config.DailyTask.Guest,
		Rounds:        s.config.DailyTask.Rounds,
		PushToWeChat:  s.config.DailyTask.PushToWeChat,
	}

	// 从数据库读取覆盖
	s.loadConfigValue("daily_task_enabled", &s.configData.Enabled)
	s.loadConfigValue("daily_task_time", &s.configData.ExecutionTime)
	s.loadConfigValue("daily_task_host", &s.configData.Host)
	s.loadConfigValue("daily_task_guest", &s.configData.Guest)
	s.loadConfigValue("daily_task_rounds", &s.configData.Rounds)
	s.loadConfigValue("daily_task_push_wechat", &s.configData.PushToWeChat)
}

// loadConfigValue 从数据库加载单个配置值
func (s *DailyTaskService) loadConfigValue(key string, value interface{}) {
	var config models.Config
	if err := s.db.Where("`key` = ?", key).First(&config).Error; err == nil {
		switch v := value.(type) {
		case *bool:
			*v = config.Value == "true"
		case *string:
			*v = config.Value
		case *int:
			fmt.Sscanf(config.Value, "%d", v)
		}
	}
}

// GetConfig 获取每日任务配置
func (s *DailyTaskService) GetConfig() DailyTaskConfigData {
	return s.configData
}

// SaveConfig 保存每日任务配置到数据库
func (s *DailyTaskService) SaveConfig(data DailyTaskConfigData) error {
	s.configData = data

	// 保存到数据库
	s.saveConfigValue("daily_task_enabled", fmt.Sprintf("%t", data.Enabled))
	s.saveConfigValue("daily_task_time", data.ExecutionTime)
	s.saveConfigValue("daily_task_host", data.Host)
	s.saveConfigValue("daily_task_guest", data.Guest)
	s.saveConfigValue("daily_task_rounds", fmt.Sprintf("%d", data.Rounds))
	s.saveConfigValue("daily_task_push_wechat", fmt.Sprintf("%t", data.PushToWeChat))

	log.Info().Msg("每日任务配置已保存")
	return nil
}

// saveConfigValue 保存单个配置值到数据库
func (s *DailyTaskService) saveConfigValue(key, value string) {
	var config models.Config
	if err := s.db.Where("`key` = ?", key).First(&config).Error; err == gorm.ErrRecordNotFound {
		// 创建新配置
		config = models.Config{Key: key, Value: value, Type: "string"}
		s.db.Create(&config)
	} else if err == nil {
		// 更新现有配置
		s.db.Model(&config).Update("value", value)
	}
}

// IsEnabled 检查每日任务是否启用
func (s *DailyTaskService) IsEnabled() bool {
	return s.configData.Enabled
}

// GetExecutionTime 获取每日任务执行时间
func (s *DailyTaskService) GetExecutionTime() string {
	return s.configData.ExecutionTime
}

// GetHost 获取主持人
func (s *DailyTaskService) GetHost() string {
	return s.configData.Host
}

// GetGuest 获取嘉宾
func (s *DailyTaskService) GetGuest() string {
	return s.configData.Guest
}

// GetRounds 获取对话轮次
func (s *DailyTaskService) GetRounds() int {
	return s.configData.Rounds
}

// IsPushToWeChat 检查是否推送到微信
func (s *DailyTaskService) IsPushToWeChat() bool {
	return s.configData.PushToWeChat
}

// CreateLog 创建每日任务日志
func (s *DailyTaskService) CreateLog(log models.DailyTaskLog) (*models.DailyTaskLog, error) {
	if err := s.db.Create(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

// GetLogs 获取每日任务日志列表
func (s *DailyTaskService) GetLogs(page, limit int) ([]models.DailyTaskLog, int64, error) {
	var logs []models.DailyTaskLog
	var total int64

	query := s.db.Model(&models.DailyTaskLog{})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	if err := query.Order("createdAt DESC").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetFavoriteNews 获取当天收藏的文章
// date 格式: 2006-01-02
func (s *DailyTaskService) GetFavoriteNews(date string) ([]models.News, error) {
	var news []models.News
	// 查询当天收藏的文章（isFavorite = true）
	err := s.db.Where("isFavorite = ? AND DATE(createdAt) = ?", true, date).
		Order("createdAt DESC").
		Find(&news).Error
	if err != nil {
		return nil, fmt.Errorf("获取收藏文章失败: %v", err)
	}
	log.Info().Int("count", len(news)).Str("date", date).Msg("获取当天收藏文章")
	return news, nil
}

// GenerateDailyDialogue 生成每日对话
func (s *DailyTaskService) GenerateDailyDialogue() error {
	cfg := s.config.DailyTask

	// 检查是否启用
	if !cfg.Enabled {
		log.Debug().Msg("每日任务未启用")
		return nil
	}

	// 获取当天日期 MMDD 格式
	now := time.Now()
	title := now.Format("0102") // MMDD 格式，如 0306
	dateStr := now.Format("2006-01-02")

	log.Info().Str("title", title).Str("date", dateStr).Msg("开始生成每日对话")

	// 创建任务日志
	startTime := time.Now()
	taskLog := models.DailyTaskLog{
		Title:       title,
		Host:        cfg.Host,
		Guest:       cfg.Guest,
		Rounds:      cfg.Rounds,
		Status:      "running",
		TriggerTime: startTime,
	}
	if err := s.db.Create(&taskLog).Error; err != nil {
		log.Error().Err(err).Msg("创建任务日志失败")
	}
	log.Info().Uint("taskLogId", taskLog.ID).Msg("任务日志已创建")

	// 获取当天收藏的文章
	articles, err := s.GetFavoriteNews(dateStr)
	if err != nil {
		taskLog.Status = "failed"
		taskLog.ErrorMsg = err.Error()
		taskLog.Duration = time.Since(startTime).Milliseconds()
		s.db.Save(&taskLog)
		return err
	}

	if len(articles) == 0 {
		log.Warn().Msg("当天没有收藏的文章，跳过生成")
		taskLog.Status = "skipped"
		taskLog.ErrorMsg = "当天没有收藏的文章"
		taskLog.Duration = time.Since(startTime).Milliseconds()
		s.db.Save(&taskLog)
		return nil
	}

	taskLog.NewsCount = len(articles)

	// 构建新闻内容摘要
	newsContent := s.buildNewsSummary(articles)

	// 生成对话
	dialogueResult, err := s.llmService.GenerateDailyDialogue(llmDialogueParams{
		Title:        title,
		Host:         cfg.Host,
		Guest:        cfg.Guest,
		Rounds:        cfg.Rounds,
		NewsContent:  newsContent,
	})
	if err != nil {
		log.Error().Err(err).Msg("生成每日对话失败")
		taskLog.Status = "failed"
		taskLog.ErrorMsg = err.Error()
		taskLog.Duration = time.Since(startTime).Milliseconds()
		s.db.Save(&taskLog)
		return fmt.Errorf("生成对话失败: %v", err)
	}

	// 保存对话到数据库
	dialogue, err := s.saveDialogue(title, cfg.Host, cfg.Guest, cfg.Rounds, dialogueResult.Rounds, articles)
	if err != nil {
		log.Error().Err(err).Msg("保存每日对话失败")
		taskLog.Status = "failed"
		taskLog.ErrorMsg = err.Error()
		taskLog.Duration = time.Since(startTime).Milliseconds()
		s.db.Save(&taskLog)
		return fmt.Errorf("保存对话失败: %v", err)
	}

	taskLog.DialogueID = dialogue.ID
	log.Info().Uint("id", dialogue.ID).Msg("每日对话生成并保存成功")

	// 如果启用微信推送，推送对话
	if cfg.PushToWeChat {
		mediaID, err := s.pushToWeChatSync(dialogue.ID, dialogue.Title, dialogueResult.Rounds)
		taskLog.WeChatPushed = (err == nil)
		taskLog.MediaID = mediaID
		if err != nil {
			taskLog.ErrorMsg = "对话生成成功，但微信推送失败: " + err.Error()
		}
	}

	// 更新日志状态
	taskLog.Status = "success"
	taskLog.Duration = time.Since(startTime).Milliseconds()
	s.db.Save(&taskLog)

	return nil
}

// buildNewsSummary 构建新闻内容摘要
func (s *DailyTaskService) buildNewsSummary(articles []models.News) string {
	var sb strings.Builder
	for i, article := range articles {
		if i > 0 {
			sb.WriteString("\n\n")
		}
		sb.WriteString(fmt.Sprintf("【新闻%d】%s\n%s", i+1, article.Title, article.Summary))
	}
	return sb.String()
}

// saveDialogue 保存对话到数据库
func (s *DailyTaskService) saveDialogue(title, host, guest string, rounds int, dialogueRounds []Round, articles []models.News) (*models.Dialogue, error) {
	// 转换对话内容为JSON
	contentJSON, err := json.Marshal(dialogueRounds)
	if err != nil {
		return nil, fmt.Errorf("序列化对话内容失败: %v", err)
	}

	// 转换新闻ID为JSON
	newsIDs := make([]uint, len(articles))
	for i, a := range articles {
		newsIDs[i] = a.ID
	}
	newsIDsJSON, _ := json.Marshal(newsIDs)

	dialogue := &models.Dialogue{
		Title:        title,
		DialogueType: "daily",
		Character1:   host,
		Character2:   guest,
		Status:       "completed",
		Rounds:       rounds,
		NewsCount:    len(articles),
		Content:      string(contentJSON),
		NewsIDs:      string(newsIDsJSON),
		IsActive:     true,
	}

	if err := s.db.Create(dialogue).Error; err != nil {
		return nil, err
	}

	return dialogue, nil
}

// pushToWeChat 推送到微信公众号（带重试机制）
func (s *DailyTaskService) pushToWeChat(dialogueID uint, title string, rounds []Round) {
	// 构建推送标题
	pushTitle := fmt.Sprintf("%s %s&%s交流实录", title, s.config.DailyTask.Host, s.config.DailyTask.Guest)

	// 转换对话格式
	dialogueRounds := make([]DialogueRound, len(rounds))
	for i, r := range rounds {
		dialogueRounds[i] = DialogueRound{
			Speaker: r.Speaker,
			Text:    r.Text,
		}
	}

	// 重试机制：最多3次，每次间隔5秒
	maxRetries := 3
	retryInterval := 5 * time.Second

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Info().Uint("id", dialogueID).Int("attempt", attempt).Msg("尝试推送微信公众号")

		mediaID, err := s.wechatMPService.AddDraft(pushTitle, "RSS-LLM-TTS", "", dialogueRounds)
		if err == nil {
			log.Info().Uint("id", dialogueID).Str("media_id", mediaID).Msg("微信公众号推送成功")
			return
		}

		log.Warn().Err(err).Uint("id", dialogueID).Int("attempt", attempt).Msg("微信公众号推送失败")

		// 如果不是最后一次，等待后重试
		if attempt < maxRetries {
			log.Info().Dur("interval", retryInterval).Msg("等待后重试...")
			time.Sleep(retryInterval)
		}
	}

	log.Error().Uint("id", dialogueID).Msg("微信公众号推送失败，已达到最大重试次数")
}

// pushToWeChatSync 同步推送到微信公众号（带重试机制）
func (s *DailyTaskService) pushToWeChatSync(dialogueID uint, title string, rounds []Round) (string, error) {
	// 构建推送标题
	pushTitle := fmt.Sprintf("%s %s&%s交流实录", title, s.config.DailyTask.Host, s.config.DailyTask.Guest)

	// 转换对话格式
	dialogueRounds := make([]DialogueRound, len(rounds))
	for i, r := range rounds {
		dialogueRounds[i] = DialogueRound{
			Speaker: r.Speaker,
			Text:    r.Text,
		}
	}

	// 重试机制：最多3次，每次间隔5秒
	maxRetries := 3
	retryInterval := 5 * time.Second

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Info().Uint("id", dialogueID).Int("attempt", attempt).Msg("尝试推送微信公众号")

		mediaID, err := s.wechatMPService.AddDraft(pushTitle, "RSS-LLM-TTS", "", dialogueRounds)
		if err == nil {
			log.Info().Uint("id", dialogueID).Str("media_id", mediaID).Msg("微信公众号推送成功")
			return mediaID, nil
		}

		log.Warn().Err(err).Uint("id", dialogueID).Int("attempt", attempt).Msg("微信公众号推送失败")

		// 如果不是最后一次，等待后重试
		if attempt < maxRetries {
			log.Info().Dur("interval", retryInterval).Msg("等待后重试...")
			time.Sleep(retryInterval)
		}
	}

	return "", fmt.Errorf("微信公众号推送失败，已达到最大重试次数")
}

// llmDialogueParams LLM对话参数
type llmDialogueParams struct {
	Title       string
	Host        string
	Guest       string
	Rounds      int
	NewsContent string
}

// GenerateDailyDialogue 生成每日对话（调用LLM）
func (s *LLMService) GenerateDailyDialogue(params llmDialogueParams) (*DialogueResult, error) {
	// 构建prompt
	prompt := fmt.Sprintf(`请生成一段 %s 格式的对话。
主持人：%s
嘉宾：%s
轮次：%d轮（交替发言，首轮由主持人开场）

对话内容需基于以下新闻素材生成，符合商务沟通语境，每轮发言50-100字：

%s

要求：
1. 对话标题格式为「%s」
2. 严格按轮次交替发言
3. 内容要体现新闻的核心信息
4. 语言风格：专业、简洁、商务
5. 每轮50-100字

请以JSON格式返回，格式如下：
{"rounds": [{"speaker": "主持人/嘉宾", "text": "对话内容"}]}`, params.Title, params.Host, params.Guest, params.Rounds, params.NewsContent, params.Title)

	// 构建请求
	reqBody := map[string]interface{}{
		"model": s.config.LLM.Model,
		"messages": []map[string]string{
			{"role": "system", "content": "你是一个专业的商业对话生成助手，擅长生成简洁有力的商务对话。"},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.7,
	}

	// 发送请求
	jsonData, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", s.config.LLM.APIURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if s.config.LLM.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.config.LLM.APIKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 解析响应
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	// 提取内容
	choices, ok := result["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return nil, fmt.Errorf("LLM响应格式错误")
	}

	content, ok := choices[0].(map[string]interface{})["message"].(map[string]interface{})["content"].(string)
	if !ok {
		return nil, fmt.Errorf("无法提取LLM响应内容")
	}

	// 解析JSON
	// 尝试提取JSON部分
	content = strings.TrimSpace(content)
	// 移除可能的markdown代码块
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")

	var dialogueResult DialogueResult
	if err := json.Unmarshal([]byte(content), &dialogueResult); err != nil {
		// 尝试提取rounds数组
		if idx := strings.Index(content, `"rounds"`); idx > 0 {
			content = content[idx:]
			if endIdx := strings.LastIndex(content, "}"); endIdx > 0 {
				content = content[:endIdx+1]
			}
			if err := json.Unmarshal([]byte(content), &dialogueResult); err != nil {
				return nil, fmt.Errorf("解析对话JSON失败: %v", err)
			}
		} else {
			return nil, fmt.Errorf("解析对话JSON失败: %v", err)
		}
	}

	return &dialogueResult, nil
}

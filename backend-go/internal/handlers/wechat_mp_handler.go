package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/services"
	"github.com/rs/zerolog/log"
)

// WeChatMPHandler 微信公众号处理器
type WeChatMPHandler struct {
	wechatSvc *services.WeChatMPService
}

func NewWeChatMPHandler(wechatSvc *services.WeChatMPService) *WeChatMPHandler {
	return &WeChatMPHandler{
		wechatSvc: wechatSvc,
	}
}

// GetConfig 获取公众号配置
func (h *WeChatMPHandler) GetConfig(c *gin.Context) {
	config, err := h.wechatSvc.GetConfig()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	Success(c, config)
}

// SaveConfig 保存公众号配置
func (h *WeChatMPHandler) SaveConfig(c *gin.Context) {
	var input models.WeChatMPConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.wechatSvc.SaveConfig(&input); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "配置保存成功"})
}

// TestSend 测试发送模板消息
func (h *WeChatMPHandler) TestSend(c *gin.Context) {
	var input struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.wechatSvc.SendTemplateMessage(input.Title, input.Content, ""); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "测试消息发送成功"})
}

// VerifyServer 验证微信服务器
func (h *WeChatMPHandler) VerifyServer(c *gin.Context) {
	signature := c.Query("signature")
	timestamp := c.Query("timestamp")
	nonce := c.Query("nonce")
	echostr := c.Query("echostr")

	result, err := h.wechatSvc.VerifyServer(signature, timestamp, nonce, echostr)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	c.String(http.StatusOK, result)
}

// PushDialogueAsText 将对话推送到微信公众号（文本消息）
func (h *WeChatMPHandler) PushDialogueAsText(c *gin.Context) {
	log.Info().Msg(">>> PushDialogueAsText handler called <<<")
	dialogueIDStr := c.Param("id")
	var dialogueID uint
	if _, err := fmt.Sscanf(dialogueIDStr, "%d", &dialogueID); err != nil {
		Error(c, http.StatusBadRequest, "无效的对话ID")
		return
	}

	// 获取对话详情
	var dialogue models.Dialogue
	if err := h.wechatSvc.GetDB().First(&dialogue, dialogueID).Error; err != nil {
		Error(c, http.StatusNotFound, "对话不存在")
		return
	}

	if dialogue.Status != "completed" {
		Error(c, http.StatusBadRequest, "只有已完成的对话才能推送")
		return
	}

	// 解析对话内容
	var content []map[string]string
	if err := json.Unmarshal([]byte(dialogue.Content), &content); err != nil {
		Error(c, http.StatusInternalServerError, "解析对话内容失败")
		return
	}

	// 转换为DialogueRound格式
	rounds := make([]services.DialogueRound, len(content))
	for i, round := range content {
		speaker := ""
		text := ""
		if v, ok := round["speaker"]; ok {
			speaker = v
		}
		if v, ok := round["text"]; ok {
			text = v
		}
		rounds[i] = services.DialogueRound{
			Speaker: speaker,
			Text:    text,
		}
	}

	// 直接调用 SendTextMessage（文本客服消息）
	err := h.wechatSvc.SendTextMessage(fmt.Sprintf("%s\n\n%s", dialogue.Title, formatRounds(rounds)))
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "推送成功"})
}

// formatRounds 格式化对话轮次
func formatRounds(rounds []services.DialogueRound) string {
	var sb strings.Builder
	for i, r := range rounds {
		sb.WriteString(fmt.Sprintf("%d. %s：%s\n", i+1, r.Speaker, r.Text))
		if (i+1)%2 == 0 {
			sb.WriteString("\n")
		}
	}
	return sb.String()
}

// PushDialogueToDraft 将对话推送到微信公众号草稿箱
func (h *WeChatMPHandler) PushDialogueToDraft(c *gin.Context) {
	dialogueIDStr := c.Param("id")
	var dialogueID uint
	if _, err := fmt.Sscanf(dialogueIDStr, "%d", &dialogueID); err != nil {
		Error(c, http.StatusBadRequest, "无效的对话ID")
		return
	}

	// 获取对话详情
	var dialogue models.Dialogue
	if err := h.wechatSvc.GetDB().First(&dialogue, dialogueID).Error; err != nil {
		Error(c, http.StatusNotFound, "对话不存在")
		return
	}

	if dialogue.Status != "completed" {
		Error(c, http.StatusBadRequest, "只有已完成的对话才能推送")
		return
	}

	// 解析对话内容
	var content []map[string]string
	if err := json.Unmarshal([]byte(dialogue.Content), &content); err != nil {
		Error(c, http.StatusInternalServerError, "解析对话内容失败")
		return
	}

	// 转换为DialogueRound格式
	rounds := make([]services.DialogueRound, len(content))
	for i, round := range content {
		speaker := ""
		text := ""
		if v, ok := round["speaker"]; ok {
			speaker = v
		}
		if v, ok := round["text"]; ok {
			text = v
		}
		rounds[i] = services.DialogueRound{
			Speaker: speaker,
			Text:    text,
		}
	}

	// 推送到微信公众号（文本客服消息）
	log.Info().Msg(">>> HANDLER: Using PushDialogueAsText <<<")
	err := h.wechatSvc.PushDialogueAsText(dialogue.Title, rounds)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "推送成功"})
}

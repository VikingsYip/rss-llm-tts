package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/services"
	"github.com/rs/zerolog/log"
)

type WeChatMPHandler struct {
	wechatSvc *services.WeChatMPService
}

type storedDialogueRound struct {
	Speaker string `json:"speaker"`
	Text    string `json:"text"`
}

type wrappedDialogueContent struct {
	Rounds []storedDialogueRound `json:"rounds"`
}

func NewWeChatMPHandler(wechatSvc *services.WeChatMPService) *WeChatMPHandler {
	return &WeChatMPHandler{wechatSvc: wechatSvc}
}

func (h *WeChatMPHandler) GetConfig(c *gin.Context) {
	config, err := h.wechatSvc.GetConfig()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	Success(c, config)
}

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

func (h *WeChatMPHandler) PushDialogueAsText(c *gin.Context) {
	log.Info().Msg("PushDialogueAsText called")

	dialogueID, rounds, dialogueTitle, err := h.loadDialogueRounds(c.Param("id"))
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if dialogueID == 0 {
		return
	}

	if err := h.wechatSvc.SendTextMessage(fmt.Sprintf("%s\n\n%s", dialogueTitle, formatRounds(rounds))); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "推送成功"})
}

func (h *WeChatMPHandler) PushDialogueToDraft(c *gin.Context) {
	dialogueID, rounds, dialogueTitle, err := h.loadDialogueRounds(c.Param("id"))
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if dialogueID == 0 {
		return
	}

	mediaID, err := h.wechatSvc.AddDraft(dialogueTitle, "vikingsyip", "", rounds)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"message": "草稿创建成功",
		"mediaId": mediaID,
	})
}

func (h *WeChatMPHandler) CreateArticleDraft(c *gin.Context) {
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Error().
			Err(err).
			Str("contentType", c.GetHeader("Content-Type")).
			Msg("CreateArticleDraft failed to read request body")
		Error(c, http.StatusBadRequest, "failed to read request body: "+err.Error())
		return
	}

	log.Info().
		Str("contentType", c.GetHeader("Content-Type")).
		Int("bodyLength", len(rawBody)).
		Msg("CreateArticleDraft raw request received")

	var input services.WeChatDraftArticleInput
	if err := json.Unmarshal(rawBody, &input); err != nil {
		preview := string(rawBody)
		if len(preview) > 800 {
			preview = preview[:800]
		}
		log.Error().
			Err(err).
			Str("contentType", c.GetHeader("Content-Type")).
			Int("bodyLength", len(rawBody)).
			Str("bodyPreview", preview).
			Msg("CreateArticleDraft JSON bind failed")
		Error(c, http.StatusBadRequest, "invalid JSON payload: "+err.Error())
		return
	}

	log.Info().
		Str("title", input.Title).
		Str("author", input.Author).
		Str("coverImagePath", input.CoverImagePath).
		Int("inlineImageCount", len(input.InlineImagePaths)).
		Int("contentLength", len(input.Content)).
		Msg("CreateArticleDraft request received")

	mediaID, err := h.wechatSvc.CreateArticleDraft(input)
	if err != nil {
		log.Error().Err(err).Str("title", input.Title).Msg("CreateArticleDraft failed")
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"message": "草稿创建成功",
		"mediaId": mediaID,
	})
}

func (h *WeChatMPHandler) loadDialogueRounds(dialogueIDStr string) (uint, []services.DialogueRound, string, error) {
	var dialogueID uint
	if _, err := fmt.Sscanf(dialogueIDStr, "%d", &dialogueID); err != nil {
		return 0, nil, "", fmt.Errorf("无效的对话 ID")
	}

	var dialogue models.Dialogue
	if err := h.wechatSvc.GetDB().First(&dialogue, dialogueID).Error; err != nil {
		return 0, nil, "", fmt.Errorf("对话不存在")
	}
	if dialogue.Status != "completed" {
		return 0, nil, "", fmt.Errorf("只有已完成的对话才能推送")
	}

	rounds, err := parseDialogueRounds(dialogue.Content)
	if err != nil {
		log.Error().
			Err(err).
			Uint("dialogueID", dialogueID).
			Int("contentLength", len(dialogue.Content)).
			Msg("loadDialogueRounds failed")
		return 0, nil, "", fmt.Errorf("解析对话内容失败")
	}

	return dialogueID, rounds, dialogue.Title, nil
}

func parseDialogueRounds(content string) ([]services.DialogueRound, error) {
	var wrapped wrappedDialogueContent
	if err := json.Unmarshal([]byte(content), &wrapped); err == nil && len(wrapped.Rounds) > 0 {
		return convertStoredRounds(wrapped.Rounds), nil
	}

	var direct []storedDialogueRound
	if err := json.Unmarshal([]byte(content), &direct); err == nil && len(direct) > 0 {
		return convertStoredRounds(direct), nil
	}

	return nil, fmt.Errorf("unsupported dialogue content format")
}

func convertStoredRounds(input []storedDialogueRound) []services.DialogueRound {
	rounds := make([]services.DialogueRound, 0, len(input))
	for _, round := range input {
		rounds = append(rounds, services.DialogueRound{
			Speaker: round.Speaker,
			Text:    round.Text,
		})
	}
	return rounds
}

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

package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/services"
)

type DialogueHandler struct {
	dialogueService *services.DialogueService
}

func NewDialogueHandler(dialogueSvc *services.DialogueService) *DialogueHandler {
	return &DialogueHandler{dialogueService: dialogueSvc}
}

// CreateDialogue 创建对话
func (h *DialogueHandler) CreateDialogue(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	dialogue, err := h.dialogueService.CreateDialogue(input)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, dialogue)
}

// GetDialogues 获取对话列表
func (h *DialogueHandler) GetDialogues(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	status := c.Query("status")
	dialogueType := c.Query("dialogueType")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	dialogues, total, err := h.dialogueService.GetDialogueList(page, limit, status, dialogueType, startDate, endDate)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"dialogues": dialogues,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetDialogueDetail 获取对话详情
func (h *DialogueHandler) GetDialogueDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	dialogue, err := h.dialogueService.GetDialogueByID(uint(id))
	if err != nil {
		Error(c, http.StatusNotFound, "对话不存在")
		return
	}

	Success(c, dialogue)
}

// DeleteDialogue 删除对话
func (h *DialogueHandler) DeleteDialogue(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.dialogueService.DeleteDialogue(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "删除成功"})
}

// GenerateDialogueContent 生成对话内容
func (h *DialogueHandler) GenerateDialogueContent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.dialogueService.RegenerateDialogue(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "对话生成已开始"})
}

// UpdateDialogueStatus 更新对话状态
func (h *DialogueHandler) UpdateDialogueStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var input struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.dialogueService.UpdateDialogueStatus(uint(id), input.Status); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "更新成功"})
}

// GetDialogueStats 获取对话统计
func (h *DialogueHandler) GetDialogueStats(c *gin.Context) {
	stats, err := h.dialogueService.GetDialogueStats()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}

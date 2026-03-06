package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/services"
	"github.com/rs/zerolog/log"
)

// DailyTaskHandler 每日任务处理器
type DailyTaskHandler struct {
	dailyTaskSvc *services.DailyTaskService
	scheduler    *services.Scheduler
}

func NewDailyTaskHandler(dailyTaskSvc *services.DailyTaskService, scheduler *services.Scheduler) *DailyTaskHandler {
	return &DailyTaskHandler{
		dailyTaskSvc: dailyTaskSvc,
		scheduler:    scheduler,
	}
}

// GetConfig 获取每日任务配置
func (h *DailyTaskHandler) GetConfig(c *gin.Context) {
	config := h.dailyTaskSvc.GetConfig()
	Success(c, config)
}

// SaveConfig 保存每日任务配置
func (h *DailyTaskHandler) SaveConfig(c *gin.Context) {
	var input struct {
		Enabled       bool   `json:"enabled"`
		ExecutionTime string `json:"executionTime"`
		Host          string `json:"host"`
		Guest         string `json:"guest"`
		Rounds        int    `json:"rounds"`
		PushToWeChat  bool   `json:"pushToWeChat"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	config := services.DailyTaskConfigData{
		Enabled:       input.Enabled,
		ExecutionTime: input.ExecutionTime,
		Host:          input.Host,
		Guest:         input.Guest,
		Rounds:        input.Rounds,
		PushToWeChat:  input.PushToWeChat,
	}

	if err := h.dailyTaskSvc.SaveConfig(config); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 重新加载定时任务
	h.scheduler.ReloadDailyTask()

	Success(c, gin.H{"message": "配置保存成功"})
}

// Trigger 手动触发每日任务
func (h *DailyTaskHandler) Trigger(c *gin.Context) {
	go func() {
		if err := h.dailyTaskSvc.GenerateDailyDialogue(); err != nil {
			log.Error().Err(err).Msg("手动触发每日任务失败")
		}
	}()

	Success(c, gin.H{"message": "每日任务已触发"})
}

// GetLogs 获取每日任务日志
func (h *DailyTaskHandler) GetLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	logs, total, err := h.dailyTaskSvc.GetLogs(page, limit)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"logs": logs,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

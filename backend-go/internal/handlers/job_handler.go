package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/services"
)

// JobHandler 任务处理器
type JobHandler struct {
	jobLogSvc *services.JobLogService
}

func NewJobHandler(jobLogSvc *services.JobLogService) *JobHandler {
	return &JobHandler{
		jobLogSvc: jobLogSvc,
	}
}

// GetLogs 获取任务日志列表
// 参数:
//   - feedId: RSS源ID
//   - status: 状态 (running, success, failed, timeout)
//   - triggerType: 触发类型 (manual, schedule)
//   - page: 页码
//   - pageSize: 每页数量
func (h *JobHandler) GetLogs(c *gin.Context) {
	feedIDStr := c.Query("feedId")
	status := c.Query("status")
	triggerType := c.Query("triggerType")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("pageSize", "20")

	var feedID *uint
	if feedIDStr != "" {
		id, err := strconv.ParseUint(feedIDStr, 10, 32)
		if err == nil {
			fid := uint(id)
			feedID = &fid
		}
	}

	page, _ := strconv.Atoi(pageStr)
	pageSize, _ := strconv.Atoi(pageSizeStr)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := h.jobLogSvc.GetLogs(feedID, &status, &triggerType, page, pageSize)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
		"totalPage": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// GetLogByID 获取单个日志详情
func (h *JobHandler) GetLogByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	logEntry, err := h.jobLogSvc.GetLogByID(uint(id))
	if err != nil {
		Error(c, http.StatusNotFound, "日志不存在")
		return
	}

	Success(c, logEntry)
}

// GetStats 获取任务统计
func (h *JobHandler) GetStats(c *gin.Context) {
	stats, err := h.jobLogSvc.GetTodayStats()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}

// GetRunningCount 获取正在运行的任务数
func (h *JobHandler) GetRunningCount(c *gin.Context) {
	count, err := h.jobLogSvc.GetRunningCount()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"count": count})
}

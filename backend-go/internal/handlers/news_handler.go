package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/services"
)

type NewsHandler struct {
	newsService *services.NewsService
}

func NewNewsHandler(newsSvc *services.NewsService) *NewsHandler {
	return &NewsHandler{newsService: newsSvc}
}

// GetNews 获取新闻列表
func (h *NewsHandler) GetNews(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	keyword := c.Query("keyword")
	category := c.Query("category")
	source := c.Query("source")
	status := c.Query("status")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	// 解析布尔参数
	var isRead, isFavorite *bool
	if isReadStr := c.Query("isRead"); isReadStr != "" {
		isReadVal := isReadStr == "true"
		isRead = &isReadVal
	}
	if isFavoriteStr := c.Query("isFavorite"); isFavoriteStr != "" {
		isFavoriteVal := isFavoriteStr == "true"
		isFavorite = &isFavoriteVal
	}

	news, total, err := h.newsService.GetNewsList(page, limit, category, status, keyword, source, isRead, isFavorite, startDate, endDate)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"news": news,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetNewsDetail 获取新闻详情
func (h *NewsHandler) GetNewsDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	news, err := h.newsService.GetNewsByID(uint(id))
	if err != nil {
		Error(c, http.StatusNotFound, "新闻不存在")
		return
	}

	Success(c, news)
}

// UpdateNewsStatus 更新新闻状态
func (h *NewsHandler) UpdateNewsStatus(c *gin.Context) {
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

	if err := h.newsService.UpdateNewsStatus(uint(id), input.Status); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "更新成功"})
}

// MarkAsRead 标记为已读
func (h *NewsHandler) MarkAsRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.newsService.MarkAsRead(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "标记成功"})
}

// MarkAsFavorite 标记为收藏
func (h *NewsHandler) MarkAsFavorite(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.newsService.MarkAsFavorite(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "收藏成功"})
}

// MarkAsIgnored 标记为忽略
func (h *NewsHandler) MarkAsIgnored(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.newsService.MarkAsIgnored(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "已忽略"})
}

// GetNewsStats 获取新闻统计
func (h *NewsHandler) GetNewsStats(c *gin.Context) {
	stats, err := h.newsService.GetNewsStats()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}

// GetDashboardStats 获取仪表板统计
func (h *NewsHandler) GetDashboardStats(c *gin.Context) {
	stats, err := h.newsService.GetDashboardStats()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}

// GetCategoryStats 获取分类统计
func (h *NewsHandler) GetCategoryStats(c *gin.Context) {
	stats, err := h.newsService.GetCategoryStats()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}

// GetCategories 获取所有分类
func (h *NewsHandler) GetCategories(c *gin.Context) {
	categories, err := h.newsService.GetAllCategories()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, categories)
}

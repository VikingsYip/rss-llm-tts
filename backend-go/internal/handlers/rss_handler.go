package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/services"
)

type RssHandler struct {
	rssService  *services.RssService
	newsService *services.NewsService
}

func NewRssHandler(rssSvc *services.RssService, newsSvc *services.NewsService) *RssHandler {
	return &RssHandler{
		rssService:  rssSvc,
		newsService: newsSvc,
	}
}

// GetFeeds 获取所有RSS源
// 参数:
//   - sortBy: 排序字段 (createdAt, name, category, lastFetchTime)
//   - sortOrder: 排序方向 (ASC, DESC)
//   - search: 搜索关键词（搜索名称和URL）
//   - category: 分类筛选
func (h *RssHandler) GetFeeds(c *gin.Context) {
	sortBy := c.DefaultQuery("sortBy", "createdAt")
	sortOrder := c.DefaultQuery("sortOrder", "DESC")
	search := c.Query("search")
	category := c.Query("category")

	feeds, err := h.rssService.GetAllFeeds(sortBy, sortOrder, search, category)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, feeds)
}

// AddFeed 添加RSS源
func (h *RssHandler) AddFeed(c *gin.Context) {
	var input struct {
		Name        string `json:"name" binding:"required"`
		URL         string `json:"url" binding:"required"`
		Category    string `json:"category"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if input.Category == "" {
		input.Category = "其他"
	}

	feed := &models.RssFeed{
		Name:        input.Name,
		URL:         input.URL,
		Category:    input.Category,
		Description: input.Description,
		IsActive:    true,
	}

	// 验证RSS源
	valid, err := h.rssService.ValidateFeed(input.URL)
	if err != nil || !valid {
		Error(c, http.StatusBadRequest, "RSS源无效或无法访问")
		return
	}

	if err := h.rssService.CreateFeed(feed); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, feed)
}

// UpdateFeed 更新RSS源
func (h *RssHandler) UpdateFeed(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	feed, err := h.rssService.GetFeedByID(uint(id))
	if err != nil {
		Error(c, http.StatusNotFound, "RSS源不存在")
		return
	}

	// 更新字段
	if name, ok := input["name"].(string); ok {
		feed.Name = name
	}
	if url, ok := input["url"].(string); ok {
		feed.URL = url
	}
	if category, ok := input["category"].(string); ok {
		feed.Category = category
	}
	if description, ok := input["description"].(string); ok {
		feed.Description = description
	}
	if isActive, ok := input["isActive"].(bool); ok {
		feed.IsActive = isActive
	}

	if err := h.rssService.UpdateFeed(feed); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, feed)
}

// DeleteFeed 删除RSS源
func (h *RssHandler) DeleteFeed(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	if err := h.rssService.DeleteFeed(uint(id)); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "删除成功"})
}

// ValidateFeed 验证RSS源
func (h *RssHandler) ValidateFeed(c *gin.Context) {
	var input struct {
		URL string `json:"url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	valid, err := h.rssService.ValidateFeed(input.URL)
	if err != nil || !valid {
		Error(c, http.StatusBadRequest, "RSS源无效或无法访问")
		return
	}

	Success(c, gin.H{"valid": true})
}

// FetchFeed 抓取单个RSS源
func (h *RssHandler) FetchFeed(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	count, err := h.rssService.FetchFeed(uint(id))
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"count": count})
}

// FetchAllFeeds 抓取所有RSS源
func (h *RssHandler) FetchAllFeeds(c *gin.Context) {
	count, err := h.rssService.FetchAllFeeds()
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"count": count})
}

// BatchUpdateFeeds 批量更新RSS源
func (h *RssHandler) BatchUpdateFeeds(c *gin.Context) {
	var input struct {
		IDs      []uint `json:"ids" binding:"required"`
		IsActive bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	result := gin.H{
		"updated": 0,
		"failed":  0,
		"details": []gin.H{},
	}

	for _, id := range input.IDs {
		feed, err := h.rssService.GetFeedByID(id)
		if err != nil {
			result["failed"] = result["failed"].(int) + 1
			continue
		}

		feed.IsActive = input.IsActive
		if err := h.rssService.UpdateFeed(feed); err != nil {
			result["failed"] = result["failed"].(int) + 1
		} else {
			result["updated"] = result["updated"].(int) + 1
		}
	}

	Success(c, result)
}

// ImportOpml 导入OPML
func (h *RssHandler) ImportOpml(c *gin.Context) {
	var input struct {
		OPML string `json:"opml" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// TODO: 实现OPML解析
	Success(c, gin.H{"message": "OPML导入功能待实现"})
}

package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/database"
	"github.com/raciel/rss-llm-tts/internal/handlers"
	"github.com/raciel/rss-llm-tts/internal/middleware"
	"github.com/raciel/rss-llm-tts/internal/services"
	"github.com/rs/zerolog/log"
)

func main() {
	// 初始化日志
	middleware.InitLogger("./logs")
	log.Info().Msg("=== RSS-LLM-TTS Backend (Go) 启动中 ===")

	// 加载配置
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("配置加载失败")
		return
	}

	// 等待数据库连接
	log.Info().Msg("正在连接数据库...")
	if err := config.WaitForDB(cfg.GetDSN(), 10, 3*time.Second); err != nil {
		log.Fatal().Err(err).Msg("数据库连接失败")
		return
	}

	// 初始化数据库
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("数据库初始化失败")
		return
	}
	defer database.CloseDB()

	// 初始化服务
	configService := services.NewConfigService(db, cfg)
	newsService := services.NewNewsService(db)
	rssService := services.NewRssService(db, cfg, configService)
	// 获取配置供各服务使用
	appConfigs, _ := configService.GetAllConfigs()
	llmService := services.NewLLMService(db, cfg, appConfigs)
	ttsService := services.NewTTSService(db, cfg, appConfigs)
	dialogueService := services.NewDialogueService(db, llmService, ttsService, newsService, configService)

	// 初始化调度器
	scheduler := services.NewScheduler(rssService)
	if err := scheduler.Start(); err != nil {
		log.Error().Err(err).Msg("调度器启动失败")
	}

	// 启动内存监控
	services.StartMemoryMonitor(5 * time.Minute)

	// 创建Gin引擎
	r := gin.Default()

	// 添加中间件
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	// 创建处理器
	rssHandler := handlers.NewRssHandler(rssService, newsService)
	newsHandler := handlers.NewNewsHandler(newsService)
	dialogueHandler := handlers.NewDialogueHandler(dialogueService)
	configHandler := handlers.NewConfigHandler(configService)

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success":   true,
			"message":   "服务运行正常",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "Go 1.0",
		})
	})

	// API路由
	api := r.Group("/api")
	{
		// RSS路由
		rss := api.Group("/rss")
		{
			rss.GET("/feeds", rssHandler.GetFeeds)
			rss.POST("/feeds", rssHandler.AddFeed)
			rss.PUT("/feeds/:id", rssHandler.UpdateFeed)
			rss.DELETE("/feeds/:id", rssHandler.DeleteFeed)
			rss.PUT("/feeds/batch-update", rssHandler.BatchUpdateFeeds)
			rss.POST("/feeds/validate", rssHandler.ValidateFeed)
			rss.POST("/feeds/:id/fetch", rssHandler.FetchFeed)
			rss.POST("/feeds/fetch-all", rssHandler.FetchAllFeeds)
			rss.GET("/jobs/status", func(c *gin.Context) {
				handlers.Success(c, scheduler.GetStatus())
			})
			rss.POST("/cleanup", func(c *gin.Context) {
				count := scheduler.CleanupOldNews()
				handlers.Success(c, gin.H{"deleted": count})
			})
		}

		// 新闻路由
		news := api.Group("/news")
		{
			news.GET("", newsHandler.GetNews)
			news.GET("/categories", newsHandler.GetCategories)
			news.GET("/:id", newsHandler.GetNewsDetail)
			news.PUT("/:id/status", newsHandler.UpdateNewsStatus)
			news.GET("/stats/overview", newsHandler.GetNewsStats)
			news.GET("/stats/dashboard", newsHandler.GetDashboardStats)
			news.GET("/stats/categories", newsHandler.GetCategoryStats)
		}

		// 对话路由
		dialogue := api.Group("/dialogue")
		{
			dialogue.POST("", dialogueHandler.CreateDialogue)
			dialogue.GET("", dialogueHandler.GetDialogues)
			dialogue.GET("/:id", dialogueHandler.GetDialogueDetail)
			dialogue.DELETE("/:id", dialogueHandler.DeleteDialogue)
			dialogue.POST("/:id/generate", dialogueHandler.GenerateDialogueContent)
			dialogue.PUT("/:id/status", dialogueHandler.UpdateDialogueStatus)
			dialogue.GET("/stats/overview", dialogueHandler.GetDialogueStats)
		}

		// 配置路由
		config := api.Group("/config")
		{
			config.GET("", configHandler.GetConfigs)
			config.PUT("", configHandler.UpdateConfig)
			config.PUT("/batch", configHandler.BatchUpdateConfig)
			config.POST("/system", configHandler.SaveSystemSettings)
			config.GET("/:key", configHandler.GetConfig)
			config.DELETE("/:key", configHandler.DeleteConfig)
			config.POST("/test/llm", configHandler.TestLLM)
			config.POST("/test/tts", configHandler.TestTTS)
			config.POST("/test/proxy", configHandler.TestProxy)
		}
	}

	// 启动服务器
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Info().Str("addr", addr).Msg("服务器启动成功")

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := r.Run(addr); err != nil {
			log.Fatal().Err(err).Msg("服务器启动失败")
		}
	}()

	<-quit
	log.Info().Msg("正在关闭服务器...")

	// 停止调度器
	scheduler.Stop()

	log.Info().Msg("服务器已关闭")
}

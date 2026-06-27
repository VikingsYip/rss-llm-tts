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
	middleware.InitLogger("./logs")
	log.Info().Msg("=== RSS-LLM-TTS Backend (Go) Starting ===")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
		return
	}

	log.Info().Msg("connecting to database")
	if err := config.WaitForDB(cfg.GetDSN(), 10, 3*time.Second); err != nil {
		log.Fatal().Err(err).Msg("database connection failed")
		return
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize database")
		return
	}
	defer database.CloseDB()

	configService := services.NewConfigService(db, cfg)
	newsService := services.NewNewsService(db)
	rssService := services.NewRssService(db, cfg, configService)
	jobLogService := services.NewJobLogService(db)
	wechatMPService := services.NewWeChatMPService(db)
	appConfigs, _ := configService.GetAllConfigs()
	llmService := services.NewLLMService(db, cfg, appConfigs)
	ttsService := services.NewTTSService(db, cfg, appConfigs)
	dialogueService := services.NewDialogueService(db, llmService, ttsService, newsService, configService)
	dailyTaskService := services.NewDailyTaskService(db, llmService, wechatMPService, cfg)

	scheduler := services.NewScheduler(rssService, jobLogService, dailyTaskService)
	if err := scheduler.Start(); err != nil {
		log.Error().Err(err).Msg("failed to start scheduler")
	}

	services.StartMemoryMonitor(5 * time.Minute)

	r := gin.Default()
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	rssHandler := handlers.NewRssHandler(rssService, newsService)
	newsHandler := handlers.NewNewsHandler(newsService)
	dialogueHandler := handlers.NewDialogueHandler(dialogueService)
	configHandler := handlers.NewConfigHandler(configService)
	jobHandler := handlers.NewJobHandler(jobLogService)
	wechatMPHandler := handlers.NewWeChatMPHandler(wechatMPService)
	dailyTaskHandler := handlers.NewDailyTaskHandler(dailyTaskService, scheduler)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success":   true,
			"message":   "service is running",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "Go 1.0",
		})
	})

	r.Static("/uploads", cfg.Storage.UploadPath)

	api := r.Group("/api")
	{
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
			rss.POST("/jobs/reload", func(c *gin.Context) {
				if err := scheduler.Reload(); err != nil {
					handlers.Error(c, 500, err.Error())
					return
				}
				handlers.Success(c, gin.H{"message": "定时任务已重新加载"})
			})
			rss.POST("/jobs/trigger/:id", func(c *gin.Context) {
				idStr := c.Param("id")
				var id uint
				fmt.Sscanf(idStr, "%d", &id)
				if err := scheduler.TriggerManual(id); err != nil {
					handlers.Error(c, 500, err.Error())
					return
				}
				handlers.Success(c, gin.H{"message": "任务已触发"})
			})
			rss.GET("/job-logs", jobHandler.GetLogs)
			rss.GET("/job-logs/:id", jobHandler.GetLogByID)
			rss.GET("/job-logs/stats", jobHandler.GetStats)
			rss.GET("/job-logs/running", jobHandler.GetRunningCount)
			rss.POST("/cleanup", func(c *gin.Context) {
				count := scheduler.CleanupOldNews()
				handlers.Success(c, gin.H{"deleted": count})
			})
		}

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

		configGroup := api.Group("/config")
		{
			configGroup.GET("", configHandler.GetConfigs)
			configGroup.PUT("", configHandler.UpdateConfig)
			configGroup.PUT("/batch", configHandler.BatchUpdateConfig)
			configGroup.POST("/system", configHandler.SaveSystemSettings)
			configGroup.GET("/:key", configHandler.GetConfig)
			configGroup.DELETE("/:key", configHandler.DeleteConfig)
			configGroup.POST("/test/llm", configHandler.TestLLM)
			configGroup.POST("/test/tts", configHandler.TestTTS)
			configGroup.POST("/test/proxy", configHandler.TestProxy)
		}

		wechat := api.Group("/wechat-mp")
		{
			wechat.GET("/config", wechatMPHandler.GetConfig)
			wechat.POST("/config", wechatMPHandler.SaveConfig)
			wechat.POST("/test", wechatMPHandler.TestSend)
			wechat.POST("/dialogue/:id/push", wechatMPHandler.PushDialogueAsText)
			wechat.POST("/dialogue/:id/draft", wechatMPHandler.PushDialogueToDraft)
			wechat.POST("/drafts/article", wechatMPHandler.CreateArticleDraft)
			wechat.GET("/callback", wechatMPHandler.VerifyServer)
		}

		dailyTask := api.Group("/daily-task")
		{
			dailyTask.GET("/config", dailyTaskHandler.GetConfig)
			dailyTask.POST("/config", dailyTaskHandler.SaveConfig)
			dailyTask.POST("/trigger", dailyTaskHandler.Trigger)
			dailyTask.GET("/logs", dailyTaskHandler.GetLogs)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Info().Str("addr", addr).Msg("server started")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := r.Run(addr); err != nil {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	<-quit
	log.Info().Msg("shutting down server")
	scheduler.Stop()
	log.Info().Msg("server stopped")
}

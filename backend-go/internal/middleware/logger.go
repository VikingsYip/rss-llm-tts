package middleware

import (
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		c.Next()

		log.Info().
			Str("method", method).
			Str("path", path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Str("ip", c.ClientIP()).
			Msg("HTTP request")
	}
}

func InitLogger(logPath string) {
	baseDir, err := os.Executable()
	if err != nil {
		baseDir = "."
	}
	resolvedLogPath := filepath.Join(filepath.Dir(baseDir), logPath)

	if err := os.MkdirAll(resolvedLogPath, 0755); err != nil {
		log.Error().Err(err).Msg("failed to create log directory")
		return
	}

	zerolog.TimeFieldFormat = time.RFC3339
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	logFilePath := filepath.Join(resolvedLogPath, "backend-"+time.Now().Format("2006-01-02")+".log")
	logFile, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Error().Err(err).Str("path", logFilePath).Msg("failed to open log file")
		consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
		log.Logger = zerolog.New(consoleWriter).With().Timestamp().Logger()
		return
	}

	consoleWriter := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
	}
	multi := io.MultiWriter(consoleWriter, logFile)
	log.Logger = zerolog.New(multi).With().Timestamp().Logger()
	log.Info().Str("logFile", logFilePath).Msg("logger initialized")
}

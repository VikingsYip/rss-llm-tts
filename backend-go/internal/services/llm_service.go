package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/utils"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const (
	llmRequestTimeout = 120 * time.Second
	llmMaxRetries     = 3
	llmMaxContentSize = 1200
)

type LLMService struct {
	db      *gorm.DB
	client  *http.Client
	config  *config.Config
	configs map[string]string
}

type DialogueParams struct {
	DialogueType string
	Character1   string
	Character2   string
	Rounds       int
	NewsContent  []NewsContent
}

type NewsContent struct {
	Title       string
	Summary     string
	Content     string
	Source      string
	PublishedAt time.Time
	Author      string
}

type DialogueResult struct {
	Rounds []Round `json:"rounds"`
}

type Round struct {
	Speaker string `json:"speaker"`
	Text    string `json:"text"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func NewLLMService(db *gorm.DB, cfg *config.Config, configs map[string]string) *LLMService {
	client := &http.Client{Timeout: llmRequestTimeout}
	return &LLMService{
		db:      db,
		client:  client,
		config:  cfg,
		configs: configs,
	}
}

func (s *LLMService) GenerateDialogue(params DialogueParams) (*DialogueResult, error) {
	prompt := s.buildPrompt(params)

	result, err := s.callLLMAPI(prompt)
	if err != nil {
		log.Error().Err(err).Msg("LLM request failed")
		return nil, err
	}

	jsonStr := extractJSONObject(result)
	if jsonStr == "" {
		return nil, fmt.Errorf("llm response did not contain a valid JSON object")
	}

	var dialogue DialogueResult
	if err := json.Unmarshal([]byte(jsonStr), &dialogue); err != nil {
		log.Warn().
			Err(err).
			Str("response", truncateForLog(result, 600)).
			Msg("Failed to parse LLM JSON response")
		return nil, fmt.Errorf("failed to parse llm json response: %w", err)
	}

	if err := validateDialogueResult(&dialogue, params); err != nil {
		return nil, err
	}

	if len(dialogue.Rounds) != params.Rounds {
		log.Warn().
			Int("expected", params.Rounds).
			Int("actual", len(dialogue.Rounds)).
			Msg("LLM returned unexpected round count; normalizing result")
		dialogue.Rounds = s.adjustRounds(dialogue.Rounds, params.Rounds, params.Character1, params.Character2)
	}

	return &dialogue, nil
}

func (s *LLMService) buildPrompt(params DialogueParams) string {
	var newsDetails strings.Builder
	for i, news := range params.NewsContent {
		newsDetails.WriteString(fmt.Sprintf("Article %d\n", i+1))
		newsDetails.WriteString(fmt.Sprintf("Title: %s\n", news.Title))
		if news.Summary != "" {
			newsDetails.WriteString(fmt.Sprintf("Summary: %s\n", news.Summary))
		}
		if news.Source != "" {
			newsDetails.WriteString(fmt.Sprintf("Source: %s\n", news.Source))
		}
		if !news.PublishedAt.IsZero() {
			newsDetails.WriteString(fmt.Sprintf("Published At: %s\n", news.PublishedAt.Format("2006-01-02 15:04:05")))
		}
		if news.Author != "" {
			newsDetails.WriteString(fmt.Sprintf("Author: %s\n", news.Author))
		}
		if news.Content != "" {
			newsDetails.WriteString(fmt.Sprintf("Details: %s\n", truncateForLog(news.Content, llmMaxContentSize)))
		}
		newsDetails.WriteString("\n")
	}

	typeDetails := s.getDialogueTypeDetails(params.DialogueType)

	return fmt.Sprintf(`You are an expert dialogue writer.

Create a high-quality %s conversation in Simplified Chinese.

Requirements:
1. Return valid JSON only, with no markdown fences and no extra commentary.
2. The JSON schema must be exactly: {"rounds":[{"speaker":"string","text":"string"}]}.
3. Produce exactly %d rounds.
4. Speakers must alternate naturally between "%s" and "%s".
5. Each round should be substantial, specific, and grounded in the provided articles.
6. Keep the conversation coherent, insightful, and conversational.
7. Use Simplified Chinese for the dialogue text, except for standard product, company, or technical names when needed.

Dialogue style:
- Type: %s
- Description: %s
- Tone: %s

Articles:
%s`, typeDetails.Name, params.Rounds, params.Character1, params.Character2, typeDetails.Name, typeDetails.Description, typeDetails.Style, newsDetails.String())
}

func (s *LLMService) loadRuntimeConfigs() map[string]string {
	result := map[string]string{
		"llm_api_url":        s.config.LLM.APIURL,
		"llm_api_key":        s.config.LLM.APIKey,
		"llm_model":          s.config.LLM.Model,
		"http_proxy_enabled": strconv.FormatBool(s.config.Proxy.Enabled),
		"http_proxy_url":     s.config.Proxy.URL,
	}

	for key, value := range s.configs {
		if strings.TrimSpace(value) != "" {
			result[key] = value
		}
	}

	var dbConfigs []models.Config
	if err := s.db.Find(&dbConfigs).Error; err != nil {
		log.Warn().Err(err).Msg("Failed to reload configs from database; using cached/runtime values")
		return result
	}

	for _, cfg := range dbConfigs {
		value := cfg.Value
		if cfg.IsEncrypted && value != "" {
			decrypted, err := utils.Decrypt(value)
			if err != nil {
				log.Warn().Err(err).Str("key", cfg.Key).Msg("Failed to decrypt config value; using stored value")
			} else {
				value = decrypted
			}
		}
		if strings.TrimSpace(value) != "" {
			result[cfg.Key] = value
		}
	}

	s.configs = result
	return result
}

func (s *LLMService) callLLMAPI(prompt string) (string, error) {
	configs := s.loadRuntimeConfigs()

	apiURL := firstNonEmpty(configs["llm_api_url"], s.config.LLM.APIURL)
	apiKey := firstNonEmpty(configs["llm_api_key"], s.config.LLM.APIKey)
	model := firstNonEmpty(configs["llm_model"], s.config.LLM.Model)

	if apiURL == "" {
		return "", fmt.Errorf("llm api url is not configured")
	}
	if apiKey == "" {
		return "", fmt.Errorf("llm api key is not configured")
	}
	if model == "" {
		return "", fmt.Errorf("llm model is not configured")
	}

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "You write polished Chinese dialogue and must respond with a JSON object only.",
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.3,
		"max_tokens":  4000,
		"top_p":       0.9,
		"response_format": map[string]string{
			"type": "json_object",
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	proxyURL := resolveProxyURL(configs["http_proxy_enabled"], configs["http_proxy_url"])
	client := s.newHTTPClient(proxyURL)

	var lastErr error
	for attempt := 1; attempt <= llmMaxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), llmRequestTimeout)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			cancel()
			return "", err
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := client.Do(req)
		if err != nil {
			cancel()
			lastErr = fmt.Errorf("llm request attempt %d failed: %w", attempt, err)
			log.Warn().Err(lastErr).Int("attempt", attempt).Msg("LLM request error")
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		responseBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel()
		if readErr != nil {
			lastErr = fmt.Errorf("failed to read llm response body: %w", readErr)
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		if resp.StatusCode >= http.StatusBadRequest {
			lastErr = fmt.Errorf("llm api status %d: %s", resp.StatusCode, truncateForLog(string(responseBody), 800))
			log.Warn().Err(lastErr).Int("attempt", attempt).Msg("LLM returned non-success status")
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		var parsed chatCompletionResponse
		if err := json.Unmarshal(responseBody, &parsed); err != nil {
			lastErr = fmt.Errorf("failed to decode llm api response: %w", err)
			log.Warn().
				Err(lastErr).
				Int("attempt", attempt).
				Str("body", truncateForLog(string(responseBody), 800)).
				Msg("Invalid LLM API response JSON")
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		if parsed.Error != nil && parsed.Error.Message != "" {
			lastErr = fmt.Errorf("llm api error: %s", parsed.Error.Message)
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		if len(parsed.Choices) == 0 {
			lastErr = fmt.Errorf("llm api returned no choices")
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		content := strings.TrimSpace(parsed.Choices[0].Message.Content)
		if content == "" {
			lastErr = fmt.Errorf("llm api returned empty message content")
			if attempt < llmMaxRetries {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
			continue
		}

		return content, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("llm request failed for an unknown reason")
	}
	return "", lastErr
}

func (s *LLMService) newHTTPClient(proxyURL *url.URL) *http.Client {
	transport := &http.Transport{}
	if proxyURL != nil {
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	return &http.Client{
		Timeout:   llmRequestTimeout,
		Transport: transport,
	}
}

func (s *LLMService) getDialogueTypeDetails(dialogueType string) DialogueTypeDetails {
	detailsMap := map[string]DialogueTypeDetails{
		"interview": {
			Name:        "interview",
			Description: "A focused interviewer and guest discussion with clear questions, analysis, and takeaways.",
			Style:       "professional, analytical, and engaging",
		},
		"ceo_interview": {
			Name:        "ceo interview",
			Description: "A business-oriented conversation about strategy, execution, leadership, and market direction.",
			Style:       "strategic, executive, and insightful",
		},
		"commentary": {
			Name:        "commentary",
			Description: "A current-events conversation that compares viewpoints and explains implications.",
			Style:       "sharp, balanced, and thoughtful",
		},
		"chat": {
			Name:        "chat",
			Description: "A relaxed but substantive conversation that still delivers clear ideas and depth.",
			Style:       "natural, conversational, and clear",
		},
	}

	if details, ok := detailsMap[dialogueType]; ok {
		return details
	}

	return detailsMap["interview"]
}

type DialogueTypeDetails struct {
	Name        string
	Description string
	Style       string
}

func (s *LLMService) generateMockDialogue(params DialogueParams) *DialogueResult {
	rounds := make([]Round, params.Rounds)
	typeDetails := s.getDialogueTypeDetails(params.DialogueType)

	for i := 0; i < params.Rounds; i++ {
		speaker := params.Character1
		if i%2 == 1 {
			speaker = params.Character2
		}

		newsIndex := 0
		if len(params.NewsContent) > 0 {
			newsIndex = i % len(params.NewsContent)
		}

		title := "the topic"
		if len(params.NewsContent) > 0 && params.NewsContent[newsIndex].Title != "" {
			title = params.NewsContent[newsIndex].Title
		}

		text := fmt.Sprintf("This is a placeholder %s round about %s.", typeDetails.Name, title)
		rounds[i] = Round{Speaker: speaker, Text: text}
	}

	return &DialogueResult{Rounds: rounds}
}

func (s *LLMService) adjustRounds(rounds []Round, target int, char1, char2 string) []Round {
	if target <= 0 {
		return []Round{}
	}

	if len(rounds) > target {
		return rounds[:target]
	}

	for len(rounds) < target {
		speaker := char1
		if len(rounds)%2 == 1 {
			speaker = char2
		}
		rounds = append(rounds, Round{
			Speaker: speaker,
			Text:    "Please continue the discussion with a concrete point tied to the news.",
		})
	}

	return rounds
}

func extractJSONObject(raw string) string {
	trimmed := strings.TrimSpace(raw)
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start == -1 || end == -1 || end < start {
		return ""
	}

	return strings.TrimSpace(trimmed[start : end+1])
}

func validateDialogueResult(dialogue *DialogueResult, params DialogueParams) error {
	if dialogue == nil {
		return fmt.Errorf("llm returned an empty dialogue result")
	}
	if len(dialogue.Rounds) == 0 {
		return fmt.Errorf("llm returned zero dialogue rounds")
	}

	for i := range dialogue.Rounds {
		dialogue.Rounds[i].Speaker = strings.TrimSpace(dialogue.Rounds[i].Speaker)
		dialogue.Rounds[i].Text = strings.TrimSpace(dialogue.Rounds[i].Text)

		if dialogue.Rounds[i].Speaker == "" {
			if i%2 == 0 {
				dialogue.Rounds[i].Speaker = params.Character1
			} else {
				dialogue.Rounds[i].Speaker = params.Character2
			}
		}

		if dialogue.Rounds[i].Text == "" {
			return fmt.Errorf("llm returned an empty text for round %d", i+1)
		}
	}

	return nil
}

func truncateForLog(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func resolveProxyURL(enabledValue, proxyValue string) *url.URL {
	if !parseBool(enabledValue) || strings.TrimSpace(proxyValue) == "" {
		return nil
	}

	proxyURL, err := url.Parse(strings.TrimSpace(proxyValue))
	if err != nil {
		log.Warn().Err(err).Str("proxy", proxyValue).Msg("Invalid proxy URL; ignoring proxy")
		return nil
	}

	return proxyURL
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

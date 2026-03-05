package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type LLMService struct {
	db      *gorm.DB
	client  *http.Client
	config  *config.Config
	configs map[string]string // 数据库配置
}

type DialogueParams struct {
	DialogueType string
	Character1   string
	Character2   string
	Rounds       int
	NewsContent  []NewsContent
}

type NewsContent struct {
	Title      string
	Summary    string
	Content    string
	Source     string
	PublishedAt time.Time
	Author     string
}

type DialogueResult struct {
	Rounds []Round `json:"rounds"`
}

type Round struct {
	Speaker string `json:"speaker"`
	Text    string `json:"text"`
}

func NewLLMService(db *gorm.DB, cfg *config.Config, configs map[string]string) *LLMService {
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	return &LLMService{
		db:      db,
		client:  client,
		config:  cfg,
		configs: configs,
	}
}

// GenerateDialogue 调用LLM生成对话
func (s *LLMService) GenerateDialogue(params DialogueParams) (*DialogueResult, error) {
	// 构建新闻内容
	newsDetails := ""
	for i, news := range params.NewsContent {
		newsDetails += fmt.Sprintf("【新闻%d】\n", i+1)
		newsDetails += fmt.Sprintf("标题: %s\n", news.Title)
		newsDetails += fmt.Sprintf("摘要: %s\n", news.Summary)
		newsDetails += fmt.Sprintf("来源: %s\n", news.Source)
		newsDetails += fmt.Sprintf("发布时间: %s\n", news.PublishedAt.Format("2006-01-02"))
		if news.Content != "" {
			summary := news.Content
			if len(summary) > 500 {
				summary = summary[:500] + "..."
			}
			newsDetails += fmt.Sprintf("详细内容: %s\n", summary)
		}
		newsDetails += "\n"
	}

	// 获取对话类型详情
	typeDetails := s.getDialogueTypeDetails(params.DialogueType)

	prompt := fmt.Sprintf(`你是一位专业的对话生成专家，请基于以下新闻内容，生成一个高质量的%s对话。

## 对话设置
- 对话类型：%s
- 对话特点：%s
- 参与者：%s、%s
- 对话轮次：%d轮
- 对话风格：%s

## 新闻素材
%s

## 生成要求
1. **语言要求**：对话内容必须使用中文，除了专业的技术词汇（如API、AI、VR、AR、5G、区块链等）和外国的公司名称（如Google、Microsoft、Apple、Meta等）外，其他内容一律使用中文表达
2. **口语化表达**：使用自然、流畅的中文口语表达，避免过于书面化的语言
3. **内容深度**：对话要有深度，不是简单的问答，要有见解和分析
4. **逻辑连贯**：每轮对话都要自然衔接，逻辑清晰
5. **角色特色**：%s和%s要有各自的语言特点和观点
6. **新闻结合**：充分利用提供的新闻内容，引用具体事实和数据
7. **对话自然**：语言要自然流畅，符合%s的特点
8. **观点多元**：展现不同角度的思考和讨论
9. **结构完整**：对话要有开头、发展、高潮和总结

## 输出格式
请严格按照以下JSON格式输出，不要添加任何其他文字：

{
  "rounds": [
    {
      "speaker": "%s",
      "text": "具体的对话内容，要丰富详细，至少100字以上，使用中文口语化表达"
    },
    {
      "speaker": "%s",
      "text": "具体的对话内容，要丰富详细，至少100字以上，使用中文口语化表达"
    }
  ]
}

现在请开始生成对话内容：`,
		typeDetails.Name,
		typeDetails.Name,
		typeDetails.Description,
		params.Character1,
		params.Character2,
		params.Rounds,
		typeDetails.Style,
		newsDetails,
		params.Character1,
		params.Character2,
		typeDetails.Name,
		params.Character1,
		params.Character2,
	)

	// 调用LLM API
	result, err := s.callLLMAPI(prompt)
	if err != nil {
		log.Error().Err(err).Msg("LLM API调用失败")
		// 返回模拟数据作为后备
		return s.generateMockDialogue(params), nil
	}

	// 解析JSON - 去除markdown代码块
	jsonStr := result
	// 去除可能的markdown代码块标记
	if strings.HasPrefix(strings.TrimSpace(result), "```") {
		// 找到第一个换行后的内容
		lines := strings.SplitN(result, "\n", 2)
		if len(lines) > 1 {
			jsonStr = strings.TrimSuffix(lines[1], "```")
			jsonStr = strings.TrimSpace(jsonStr)
			// 去除可能的 "json" 或其他语言标识
			if strings.HasPrefix(jsonStr, "json") {
				jsonStr = strings.TrimPrefix(jsonStr, "json")
				jsonStr = strings.TrimSpace(jsonStr)
			}
		}
	}

	var dialogue DialogueResult
	if err := json.Unmarshal([]byte(jsonStr), &dialogue); err != nil {
		log.Warn().Err(err).Str("result", result[:min(100, len(result))]).Msg("JSON解析失败，使用模拟数据")
		return s.generateMockDialogue(params), nil
	}

	// 验证轮次
	if len(dialogue.Rounds) != params.Rounds {
		log.Warn().Int("expected", params.Rounds).Int("actual", len(dialogue.Rounds)).Msg("对话轮次不匹配")
		dialogue.Rounds = s.adjustRounds(dialogue.Rounds, params.Rounds, params.Character1, params.Character2)
	}

	return &dialogue, nil
}

// callLLMAPI 调用LLM API
func (s *LLMService) callLLMAPI(prompt string) (string, error) {
	// 优先从数据库配置读取，fallback到.env配置
	apiURL := s.configs["llm_api_url"]
	apiKey := s.configs["llm_api_key"]
	model := s.configs["llm_model"]

	// 如果数据库没有配置，使用.env配置
	if apiURL == "" {
		apiURL = s.config.LLM.APIURL
	}
	if apiKey == "" {
		apiKey = s.config.LLM.APIKey
	}
	if model == "" {
		model = s.config.LLM.Model
	}

	if apiKey == "" {
		return "", fmt.Errorf("LLM API Key未配置")
	}

	// 构建请求
	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role": "system",
				"content": fmt.Sprintf("你是一个专业的对话生成助手，擅长根据新闻内容生成高质量的对话。你的对话总是内容丰富、观点深刻、逻辑清晰。你必须严格按照JSON格式输出，不添加任何解释或额外文字。"),
			},
			{
				"role": "user",
				"content": prompt,
			},
		},
		"temperature": 0.7,
		"max_tokens": 4000,
		"top_p": 0.9,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	// 创建请求
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 设置代理
	var proxyURL *url.URL
	if s.config.Proxy.Enabled && s.config.Proxy.URL != "" {
		proxyURL, _ = url.Parse(s.config.Proxy.URL)
	}

	// 使用带超时的上下文（增加到120秒）
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	if proxyURL != nil {
		s.client.Transport = &http.Transport{Proxy: http.ProxyURL(proxyURL)}
	}

	resp, err := s.client.Do(req.WithContext(ctx))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// 解析响应
	var respData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&respData); err != nil {
		return "", err
	}

	// 提取内容
	if choices, ok := respData["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					return content, nil
				}
			}
		}
	}

	return "", fmt.Errorf("无法从响应中提取内容")
}

// getDialogueTypeDetails 获取对话类型详情
func (s *LLMService) getDialogueTypeDetails(dialogueType string) DialogueTypeDetails {
	detailsMap := map[string]DialogueTypeDetails{
		"interview": {
			Name:        "访谈",
			Description: "深度访谈对话，一般由主持人提问，嘉宾回答，注重挖掘观点和见解",
			Style:       "专业、深入、互动性强",
		},
		"ceo_interview": {
			Name:        "CEO采访",
			Description: "高端商业访谈，探讨企业战略、行业趋势、管理理念等商业话题",
			Style:       "高端、专业、商业化、具有前瞻性",
		},
		"commentary": {
			Name:        "评论对话",
			Description: "针对时事新闻进行分析评论，展现不同观点和深度思考",
			Style:       "客观、分析性强、观点鲜明",
		},
		"chat": {
			Name:        "聊天对话",
			Description: "轻松的对话交流，更加随意和自然，但仍要有内容深度",
			Style:       "轻松自然、互动性强、贴近生活",
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

// generateMockDialogue 生成模拟对话（后备方案）
func (s *LLMService) generateMockDialogue(params DialogueParams) *DialogueResult {
	rounds := make([]Round, params.Rounds)
	typeDetails := s.getDialogueTypeDetails(params.DialogueType)

	for i := 0; i < params.Rounds; i++ {
		speaker := params.Character1
		if i%2 == 1 {
			speaker = params.Character2
		}

		newsIndex := i % len(params.NewsContent)
		news := params.NewsContent[newsIndex]

		var text string
		if i == 0 {
			text = fmt.Sprintf("欢迎收看今天的%s节目。今天我们要讨论的是关于\"%s\"这个备受关注的话题。%s这个现象引发了广泛的讨论，您怎么看待这个问题？",
				typeDetails.Name, news.Title, news.Summary)
		} else if i == params.Rounds-1 {
			text = fmt.Sprintf("非常感谢您今天的精彩分享。通过今天的讨论，我相信观众朋友们对\"%s\"这个话题有了更深入的理解。您对未来的发展有什么展望吗？",
				news.Title)
		} else {
			topics := []string{"从技术发展的角度来看", "考虑到社会影响方面", "从经济效益的角度分析", "从用户体验的维度思考"}
			topic := topics[i%len(topics)]
			text = fmt.Sprintf("您刚才提到的观点很有道理。%s，您认为%s这个现象会对我们的生活产生什么样的影响？", topic, news.Title)
		}

		rounds[i] = Round{
			Speaker: speaker,
			Text:    text,
		}
	}

	return &DialogueResult{Rounds: rounds}
}

// adjustRounds 调整对话轮次
func (s *LLMService) adjustRounds(rounds []Round, target int, char1, char2 string) []Round {
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
			Text:    "感谢您的分享，这个话题确实值得我们继续深入探讨。",
		})
	}

	return rounds
}

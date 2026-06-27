package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type WeChatMPService struct {
	db *gorm.DB
}

type DialogueRound struct {
	Speaker string `json:"speaker"`
	Text    string `json:"text"`
}

type WeChatDraftArticleInput struct {
	Title            string   `json:"title"`
	Author           string   `json:"author"`
	Digest           string   `json:"digest"`
	Content          string   `json:"content"`
	ContentSourceURL string   `json:"contentSourceUrl"`
	CoverImagePath   string   `json:"coverImagePath"`
	InlineImagePaths []string `json:"inlineImagePaths"`
}

func NewWeChatMPService(db *gorm.DB) *WeChatMPService {
	return &WeChatMPService{db: db}
}

func (s *WeChatMPService) GetDB() *gorm.DB {
	return s.db
}

func (s *WeChatMPService) GetConfig() (*models.WeChatMPConfig, error) {
	var config models.WeChatMPConfig
	err := s.db.First(&config).Error
	if err == gorm.ErrRecordNotFound {
		return &models.WeChatMPConfig{}, nil
	}
	return &config, err
}

func (s *WeChatMPService) SaveConfig(config *models.WeChatMPConfig) error {
	var existing models.WeChatMPConfig
	err := s.db.First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return s.db.Create(config).Error
	}
	if err != nil {
		return err
	}

	if config.AppID != "" {
		existing.AppID = config.AppID
	}
	if config.AppSecret != "" {
		existing.AppSecret = config.AppSecret
	}
	if config.Token != "" {
		existing.Token = config.Token
	}
	if config.EncodingAESKey != "" {
		existing.EncodingAESKey = config.EncodingAESKey
	}
	if config.TemplateID != "" {
		existing.TemplateID = config.TemplateID
	}
	if config.UserOpenID != "" {
		existing.UserOpenID = config.UserOpenID
	}
	existing.Enabled = config.Enabled

	return s.db.Save(&existing).Error
}

func (s *WeChatMPService) GetAccessToken() (string, error) {
	config, err := s.GetConfig()
	if err != nil {
		return "", err
	}
	if !config.Enabled {
		return "", fmt.Errorf("微信公众号推送未启用")
	}
	if config.AppID == "" || config.AppSecret == "" {
		return "", fmt.Errorf("请先配置公众号 AppID 和 AppSecret")
	}

	url := fmt.Sprintf(
		"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		config.AppID,
		config.AppSecret,
	)
	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("获取 access_token 失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 access_token 响应失败: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析 access_token 响应失败: %v", err)
	}
	if errCode, ok := result["errcode"].(float64); ok && errCode != 0 {
		return "", fmt.Errorf("微信 API 错误: %v", result["errmsg"])
	}

	accessToken, ok := result["access_token"].(string)
	if !ok || accessToken == "" {
		return "", fmt.Errorf("未获取到 access_token")
	}
	return accessToken, nil
}

func (s *WeChatMPService) SendTemplateMessage(title, content, url string) error {
	config, err := s.GetConfig()
	if err != nil {
		return err
	}
	if !config.Enabled {
		return fmt.Errorf("微信公众号推送未启用")
	}

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return err
	}

	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=%s", accessToken)
	payload := map[string]interface{}{
		"touser":      config.UserOpenID,
		"template_id": config.TemplateID,
		"data": map[string]interface{}{
			"first": map[string]string{
				"value": title,
				"color": "#173177",
			},
			"keyword1": map[string]string{
				"value": "RSS-LLM-TTS 推送",
				"color": "#173177",
			},
			"keyword2": map[string]string{
				"value": time.Now().Format("2006-01-02 15:04:05"),
				"color": "#173177",
			},
			"remark": map[string]string{
				"value": content,
				"color": "#666666",
			},
		},
	}
	if url != "" {
		payload["url"] = url
	}

	_, err = s.postJSON(apiURL, payload)
	return err
}

func (s *WeChatMPService) SendTextMessage(content string) error {
	config, err := s.GetConfig()
	if err != nil {
		return err
	}
	if !config.Enabled {
		return fmt.Errorf("微信公众号推送未启用")
	}
	if config.UserOpenID == "" {
		return fmt.Errorf("未配置用户 OpenID")
	}

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return err
	}

	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=%s", accessToken)
	payload := map[string]interface{}{
		"touser":  config.UserOpenID,
		"msgtype": "text",
		"text": map[string]string{
			"content": content,
		},
	}

	_, err = s.postJSON(apiURL, payload)
	return err
}

func (s *WeChatMPService) PushDialogueAsText(title string, rounds []DialogueRound) error {
	var textContent strings.Builder
	textContent.WriteString(title + "\n\n")
	for i, r := range rounds {
		textContent.WriteString(fmt.Sprintf("%d. %s：%s\n", i+1, r.Speaker, r.Text))
		if (i+1)%2 == 0 {
			textContent.WriteString("\n")
		}
	}
	return s.SendTextMessage(textContent.String())
}

func (s *WeChatMPService) uploadPermanentImage(imagePath string) (string, error) {
	return s.uploadImage(imagePath, "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", "media_id")
}

func (s *WeChatMPService) uploadInlineImage(imagePath string) (string, error) {
	return s.uploadImage(imagePath, "https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=%s", "url")
}

func (s *WeChatMPService) uploadImage(imagePath, endpointFormat, resultKey string) (string, error) {
	if imagePath == "" {
		return "", fmt.Errorf("图片路径不能为空")
	}

	file, err := os.Open(imagePath)
	if err != nil {
		return "", fmt.Errorf("打开图片失败: %v", err)
	}
	defer file.Close()

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return "", err
	}

	apiURL := fmt.Sprintf(endpointFormat, accessToken)
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("media", filepath.Base(imagePath))
	if err != nil {
		return "", fmt.Errorf("创建图片表单失败: %v", err)
	}
	if _, err := io.Copy(part, file); err != nil {
		return "", fmt.Errorf("写入图片失败: %v", err)
	}
	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("关闭图片表单失败: %v", err)
	}

	req, err := http.NewRequest("POST", apiURL, &buf)
	if err != nil {
		return "", fmt.Errorf("创建图片请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("上传图片失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取图片响应失败: %v", err)
	}

	log.Info().
		Str("imagePath", imagePath).
		Str("endpoint", apiURL).
		Str("response", string(body)).
		Msg("wechat image upload response")

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析图片响应失败: %v", err)
	}
	if errCode, ok := result["errcode"].(float64); ok && errCode != 0 {
		return "", fmt.Errorf("微信图片上传失败: errcode=%d errmsg=%v", int(errCode), result["errmsg"])
	}

	value, ok := result[resultKey].(string)
	if !ok || value == "" {
		return "", fmt.Errorf("微信图片上传未返回 %s", resultKey)
	}
	return value, nil
}

func (s *WeChatMPService) replaceInlineImagePlaceholders(content string, imagePaths []string) (string, error) {
	updated := content
	for _, imagePath := range imagePaths {
		imageURL, err := s.uploadInlineImage(imagePath)
		if err != nil {
			return "", err
		}
		placeholder := "LOCALIMG:" + filepath.Base(imagePath)
		updated = strings.ReplaceAll(updated, placeholder, imageURL)
	}
	return updated, nil
}

func (s *WeChatMPService) CreateArticleDraft(input WeChatDraftArticleInput) (string, error) {
	if strings.TrimSpace(input.Title) == "" {
		return "", fmt.Errorf("文章标题不能为空")
	}
	if strings.TrimSpace(input.Author) == "" {
		input.Author = "vikingsyip"
	}
	if strings.TrimSpace(input.Content) == "" {
		return "", fmt.Errorf("文章内容不能为空")
	}
	if strings.TrimSpace(input.CoverImagePath) == "" {
		return "", fmt.Errorf("封面图片不能为空")
	}

	log.Info().
		Str("title", input.Title).
		Str("author", input.Author).
		Str("coverImagePath", input.CoverImagePath).
		Str("contentSourceURL", input.ContentSourceURL).
		Int("inlineImageCount", len(input.InlineImagePaths)).
		Int("contentLength", len(input.Content)).
		Msg("CreateArticleDraft started")

	content := input.Content
	if len(input.InlineImagePaths) > 0 {
		var err error
		content, err = s.replaceInlineImagePlaceholders(content, input.InlineImagePaths)
		if err != nil {
			log.Error().
				Err(err).
				Str("title", input.Title).
				Msg("CreateArticleDraft inline image replacement failed")
			return "", err
		}
	}

	thumbMediaID, err := s.uploadPermanentImage(input.CoverImagePath)
	if err != nil {
		log.Error().
			Err(err).
			Str("title", input.Title).
			Str("coverImagePath", input.CoverImagePath).
			Msg("CreateArticleDraft cover upload failed")
		return "", err
	}

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return "", err
	}

	article := map[string]interface{}{
		"title":              input.Title,
		"author":             input.Author,
		"digest":             input.Digest,
		"content":            content,
		"content_source_url": input.ContentSourceURL,
		"thumb_media_id":     thumbMediaID,
	}
	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/draft/add?access_token=%s", accessToken)
	payload := map[string]interface{}{"articles": []interface{}{article}}

	result, err := s.postJSON(apiURL, payload)
	if err != nil {
		log.Error().
			Err(err).
			Str("title", input.Title).
			Msg("CreateArticleDraft draft/add failed")
		return "", err
	}

	mediaID, ok := result["media_id"].(string)
	if !ok || mediaID == "" {
		return "", fmt.Errorf("未获取到 media_id，微信返回: %v", result)
	}

	log.Info().
		Str("title", input.Title).
		Str("media_id", mediaID).
		Msg("CreateArticleDraft succeeded")
	return mediaID, nil
}

func (s *WeChatMPService) AddDraft(title, author, coverImagePath string, rounds []DialogueRound) (string, error) {
	if strings.TrimSpace(coverImagePath) == "" {
		var err error
		coverImagePath, err = s.ensureDefaultCoverImage()
		if err != nil {
			return "", err
		}
	}

	return s.CreateArticleDraft(WeChatDraftArticleInput{
		Title:          title,
		Author:         author,
		Content:        s.buildDialogueHTML(rounds),
		CoverImagePath: coverImagePath,
	})
}

func (s *WeChatMPService) ensureDefaultCoverImage() (string, error) {
	baseDir, err := os.Executable()
	if err != nil {
		baseDir = "."
	}

	tempDir := filepath.Join(filepath.Dir(baseDir), "tmp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", fmt.Errorf("创建默认封面目录失败: %v", err)
	}

	coverPath := filepath.Join(tempDir, "default-wechat-cover.png")
	if _, err := os.Stat(coverPath); err == nil {
		return coverPath, nil
	}

	img := image.NewRGBA(image.Rect(0, 0, 900, 383))
	bg := color.RGBA{R: 24, G: 119, B: 242, A: 255}
	for y := 0; y < 383; y++ {
		for x := 0; x < 900; x++ {
			img.Set(x, y, bg)
		}
	}

	file, err := os.Create(coverPath)
	if err != nil {
		return "", fmt.Errorf("创建默认封面失败: %v", err)
	}
	defer file.Close()

	if err := png.Encode(file, img); err != nil {
		return "", fmt.Errorf("写入默认封面失败: %v", err)
	}

	return coverPath, nil
}

func (s *WeChatMPService) buildDialogueHTML(rounds []DialogueRound) string {
	var sb strings.Builder
	sb.WriteString("<div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;'>")
	for _, round := range rounds {
		style := "background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;"
		if strings.Contains(round.Speaker, "A") || strings.Contains(round.Speaker, "主持") {
			style = "background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0;"
		}
		sb.WriteString(fmt.Sprintf("<div style='%s'>", style))
		sb.WriteString(fmt.Sprintf("<strong style='color: #1976d2;'>%s</strong>", html.EscapeString(round.Speaker)))
		sb.WriteString(fmt.Sprintf("<p style='margin: 10px 0 0 0; line-height: 1.6;'>%s</p>", html.EscapeString(round.Text)))
		sb.WriteString("</div>")
	}
	sb.WriteString("</div>")
	return sb.String()
}

func (s *WeChatMPService) VerifyServer(signature, timestamp, nonce, echostr string) (string, error) {
	config, err := s.GetConfig()
	if err != nil {
		return "", err
	}
	if config.Token == "" {
		return "", fmt.Errorf("请先配置公众号 Token")
	}

	tmpArr := []string{config.Token, timestamp, nonce}
	sort.Strings(tmpArr)
	tmpStr := strings.Join(tmpArr, "")
	hash := sha256.Sum256([]byte(tmpStr))
	sign := hex.EncodeToString(hash[:])
	if sign != signature {
		return "", fmt.Errorf("签名验证失败")
	}
	return echostr, nil
}

func (s *WeChatMPService) postJSON(apiURL string, payload map[string]interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("序列化请求失败: %v", err)
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %v", err)
	}

	log.Info().
		Int("status", resp.StatusCode).
		Str("apiURL", apiURL).
		Str("response", string(body)).
		Msg("wechat api response")

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %v", err)
	}
	if errCode, ok := result["errcode"].(float64); ok && errCode != 0 {
		return nil, fmt.Errorf("微信 API 错误: %d - %s", int(errCode), result["errmsg"])
	}
	return result, nil
}

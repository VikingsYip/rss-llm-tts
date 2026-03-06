package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// WeChatMPService 微信公众号服务
type WeChatMPService struct {
	db *gorm.DB
}

func NewWeChatMPService(db *gorm.DB) *WeChatMPService {
	return &WeChatMPService{db: db}
}

// GetDB 获取数据库连接
func (s *WeChatMPService) GetDB() *gorm.DB {
	return s.db
}

// GetConfig 获取公众号配置
func (s *WeChatMPService) GetConfig() (*models.WeChatMPConfig, error) {
	var config models.WeChatMPConfig
	// 只获取第一条记录（系统只需要一个配置）
	err := s.db.First(&config).Error
	if err == gorm.ErrRecordNotFound {
		// 如果没有配置，返回默认空配置
		return &models.WeChatMPConfig{}, nil
	}
	return &config, err
}

// SaveConfig 保存公众号配置
func (s *WeChatMPService) SaveConfig(config *models.WeChatMPConfig) error {
	var existing models.WeChatMPConfig
	err := s.db.First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新配置
		return s.db.Create(config).Error
	} else if err != nil {
		return err
	}

	// 更新现有配置
	// AppID
	if config.AppID != "" {
		existing.AppID = config.AppID
	}
	// AppSecret
	if config.AppSecret != "" {
		existing.AppSecret = config.AppSecret
	}
	// Token
	if config.Token != "" {
		existing.Token = config.Token
	}
	// EncodingAESKey
	if config.EncodingAESKey != "" {
		existing.EncodingAESKey = config.EncodingAESKey
	}
	// TemplateID
	if config.TemplateID != "" {
		existing.TemplateID = config.TemplateID
	}
	// UserOpenID
	if config.UserOpenID != "" {
		existing.UserOpenID = config.UserOpenID
	}
	existing.Enabled = config.Enabled

	return s.db.Save(&existing).Error
}

// GetAccessToken 获取公众号access_token
func (s *WeChatMPService) GetAccessToken() (string, error) {
	config, err := s.GetConfig()
	if err != nil {
		return "", err
	}

	if !config.Enabled {
		return "", fmt.Errorf("微信公众号推送未启用")
	}

	if config.AppID == "" || config.AppSecret == "" {
		return "", fmt.Errorf("请先配置公众号AppID和AppSecret")
	}

	// 使用缓存的token（这里简化处理，实际应该存储token和过期时间）
	// 调用微信API获取token
	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		config.AppID, config.AppSecret)

	log.Info().Str("appid", config.AppID).Msg("获取access_token")

	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("获取access_token失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %v", err)
	}

	log.Info().Str("response", string(body)).Msg("access_token响应")

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %v", err)
	}

	if errcode, ok := result["errcode"].(float64); ok && errcode != 0 {
		errmsg, _ := result["errmsg"].(string)
		return "", fmt.Errorf("微信API错误: %s", errmsg)
	}

	accessToken, ok := result["access_token"].(string)
	if !ok {
		return "", fmt.Errorf("未获取到access_token")
	}

	return accessToken, nil
}

// SendTemplateMessage 发送模板消息
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

	// 调用发送模板消息API
	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=%s", accessToken)

	// 构建模板数据
	data := map[string]interface{}{
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
	}

	msg := map[string]interface{}{
		"touser":      config.UserOpenID,
		"template_id": config.TemplateID,
		"data":        data,
	}

	if url != "" {
		msg["url"] = url
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("序列化消息失败: %v", err)
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("解析响应失败: %v", err)
	}

	if errcode, ok := result["errcode"].(float64); ok && errcode != 0 {
		errmsg, _ := result["errmsg"].(string)
		return fmt.Errorf("微信API错误: %s", errmsg)
	}

	log.Info().Str("title", title).Msg("微信公众号模板消息发送成功")
	return nil
}

// SendTextMessage 发送文本客服消息（不需要media_id）
func (s *WeChatMPService) SendTextMessage(content string) error {
	config, err := s.GetConfig()
	if err != nil {
		return err
	}

	if !config.Enabled {
		return fmt.Errorf("微信公众号推送未启用")
	}

	if config.UserOpenID == "" {
		return fmt.Errorf("未配置用户OpenID")
	}

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return err
	}

	// 调用客服消息API
	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=%s", accessToken)

	// 构建文本消息
	msg := map[string]interface{}{
		"touser":  config.UserOpenID,
		"msgtype": "text",
		"text": map[string]string{
			"content": content,
		},
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("序列化消息失败: %v", err)
	}

	log.Info().Str("request", string(jsonData)).Msg("发送文本客服消息")

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("解析响应失败: %v", err)
	}

	if errcode, ok := result["errcode"].(float64); ok && errcode != 0 {
		errmsg, _ := result["errmsg"].(string)
		return fmt.Errorf("微信API错误: %d - %s", int(errcode), errmsg)
	}

	log.Info().Msg("微信公众号文本消息发送成功")
	return nil
}

// DialogueRound 对话轮次结构
type DialogueRound struct {
	Speaker string `json:"speaker"`
	Text    string `json:"text"`
}

// AddDraft 添加文章到草稿箱
func (s *WeChatMPService) AddDraft(title, author, content string, rounds []DialogueRound) (string, error) {
	config, err := s.GetConfig()
	if err != nil {
		return "", err
	}

	if !config.Enabled {
		return "", fmt.Errorf("微信公众号推送未启用")
	}

	if config.AppID == "" || config.AppSecret == "" {
		return "", fmt.Errorf("请先配置公众号AppID和AppSecret")
	}

	accessToken, err := s.GetAccessToken()
	if err != nil {
		return "", err
	}

	// 构建HTML内容
	htmlContent := s.buildDialogueHTML(rounds)

	// 调用永久图文素材API（虽然文档说部分废弃，但实际仍可用）
	apiURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_news?access_token=%s", accessToken)

	article := map[string]interface{}{
		"title":        title,
		"author":       author,
		"content":      htmlContent,
	}

	articles := []interface{}{article}

	msg := map[string]interface{}{
		"articles": articles,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return "", fmt.Errorf("序列化消息失败: %v", err)
	}

	log.Info().Str("request", string(jsonData)).Msg("微信公众号草稿请求")
	fmt.Printf("=== WECHAT DRAFT REQUEST: %s\n", string(jsonData))

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %v", err)
	}

	log.Info().Str("response", string(respBody)).Msg("微信公众号API响应")

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %v", err)
	}

	if errcode, ok := result["errcode"].(float64); ok && errcode != 0 {
		errmsg, _ := result["errmsg"].(string)
		return "", fmt.Errorf("微信API错误: %d - %s", int(errcode), errmsg)
	}

	mediaID, ok := result["media_id"].(string)
	if !ok {
		return "", fmt.Errorf("未获取到media_id")
	}

	log.Info().Str("title", title).Str("media_id", mediaID).Msg("微信公众号草稿添加成功")
	return mediaID, nil
}

// buildDialogueHTML 将对话内容转换为HTML格式
func (s *WeChatMPService) buildDialogueHTML(rounds []DialogueRound) string {
	var sb strings.Builder
	sb.WriteString("<div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;'>")

	for _, round := range rounds {
		// 根据角色设置不同的样式
		style := "background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;"
		if strings.Contains(round.Speaker, "A") || strings.Contains(round.Speaker, "主持人") {
			style = "background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0;"
		}

		sb.WriteString(fmt.Sprintf("<div style='%s'>", style))
		sb.WriteString(fmt.Sprintf("<strong style='color: #1976d2;'>%s</strong>", round.Speaker))
		sb.WriteString(fmt.Sprintf("<p style='margin: 10px 0 0 0; line-height: 1.6;'>%s</p>", round.Text))
		sb.WriteString("</div>")
	}

	sb.WriteString("</div>")
	return sb.String()
}

// VerifyServer 验证微信服务器
func (s *WeChatMPService) VerifyServer(signature, timestamp, nonce, echostr string) (string, error) {
	config, err := s.GetConfig()
	if err != nil {
		return "", err
	}

	if config.Token == "" {
		return "", fmt.Errorf("请先配置公众号Token")
	}

	// 验证签名
	tmpArr := []string{config.Token, timestamp, nonce}
	sort.Strings(tmpArr)
	tmpStr := strings.Join(tmpArr, "")
	hash := sha256.Sum256([]byte(tmpStr))
	sign := hex.EncodeToString(hash[:])

	if sign != signature {
		return "", fmt.Errorf("签名验证失败")
	}

	// 解密echostr（如果配置了EncodingAESKey）
	if config.EncodingAESKey != "" {
		// 简单验证，实际需要AES解密
		return echostr, nil
	}

	return echostr, nil
}

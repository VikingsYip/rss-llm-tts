package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raciel/rss-llm-tts/internal/config"
	"github.com/raciel/rss-llm-tts/internal/models"
	"github.com/raciel/rss-llm-tts/internal/utils"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const (
	edgeBaseURL         = "api.msedgeservices.com/tts/cognitiveservices"
	edgeTTSURL          = "wss://" + edgeBaseURL + "/websocket/v1"
	edgeTrustedClientID = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	edgeChromiumVersion = "140.0.3485.14"
	edgeChromiumMajor   = "140"
	edgeSecMSGECVersion = "1-" + edgeChromiumVersion
	edgeOutputFormat    = "audio-24khz-48kbitrate-mono-mp3"
	edgeWindowsEpoch    = 11644473600
	ttsRequestTimeout   = 120 * time.Second
)

var (
	edgeClockSkewMu sync.RWMutex
	edgeClockSkew   float64
)

type TTSService struct {
	db         *gorm.DB
	client     *http.Client
	config     *config.Config
	configs    map[string]string
	uploadPath string
}

type AudioResult struct {
	Filename string
	Duration int
	Size     int64
	Success  bool
}

func NewTTSService(db *gorm.DB, cfg *config.Config, configs map[string]string) *TTSService {
	client := &http.Client{Timeout: ttsRequestTimeout}
	return &TTSService{
		db:         db,
		client:     client,
		config:     cfg,
		configs:    configs,
		uploadPath: cfg.Storage.UploadPath,
	}
}

func (s *TTSService) GenerateDialogueAudio(dialogueContent string, dialogueID uint) (*AudioResult, error) {
	filename := fmt.Sprintf("dialogue_%d.mp3", time.Now().UnixMilli())
	filePath := filepath.Join(s.uploadPath, filename)

	if err := os.MkdirAll(s.uploadPath, 0755); err != nil {
		return nil, err
	}

	audioData, err := s.callTTSAPI(dialogueContent)
	if err != nil {
		log.Error().Err(err).Msg("TTS request failed")
		return nil, err
	}

	if err := os.WriteFile(filePath, audioData, 0644); err != nil {
		return nil, err
	}

	return &AudioResult{
		Filename: filename,
		Duration: estimateDurationSeconds(dialogueContent),
		Size:     int64(len(audioData)),
		Success:  true,
	}, nil
}

func (s *TTSService) GenerateMultiVoiceAudio(rounds []Round, dialogueID uint) (*AudioResult, error) {
	filename := fmt.Sprintf("dialogue_%d.mp3", time.Now().UnixMilli())
	filePath := filepath.Join(s.uploadPath, filename)

	if err := os.MkdirAll(s.uploadPath, 0755); err != nil {
		return nil, err
	}

	filteredRounds := s.filterRounds(rounds)
	var combined bytes.Buffer
	totalDuration := 0

	for _, round := range filteredRounds {
		voice := s.getVoiceForSpeaker(round.Speaker)
		audioData, err := s.callTTSAPIWithVoice(round.Text, voice)
		if err != nil {
			log.Warn().Err(err).Str("speaker", round.Speaker).Msg("Failed to generate audio for round")
			continue
		}
		combined.Write(audioData)
		totalDuration += estimateDurationSeconds(round.Text)
	}

	if combined.Len() == 0 {
		return nil, fmt.Errorf("failed to generate audio for all dialogue rounds")
	}

	if err := os.WriteFile(filePath, combined.Bytes(), 0644); err != nil {
		return nil, err
	}

	return &AudioResult{
		Filename: filename,
		Duration: totalDuration,
		Size:     int64(combined.Len()),
		Success:  true,
	}, nil
}

func (s *TTSService) callTTSAPI(text string) ([]byte, error) {
	return s.callTTSAPIWithVoice(text, s.getDefaultVoice())
}

func (s *TTSService) callTTSAPIWithVoice(text, voice string) ([]byte, error) {
	runtimeConfigs := s.loadRuntimeConfigs()
	provider := strings.ToLower(firstNonEmpty(runtimeConfigs["tts_provider"], s.config.TTS.Provider))
	if provider == "" {
		provider = "openai"
	}

	switch provider {
	case "edge":
		return s.callEdgeTTS(text, voice, runtimeConfigs)
	case "openai":
		return s.callOpenAITTS(text, voice, runtimeConfigs)
	default:
		return nil, fmt.Errorf("unsupported tts provider: %s", provider)
	}
}

func (s *TTSService) callOpenAITTS(text, voice string, configs map[string]string) ([]byte, error) {
	apiURL := firstNonEmpty(configs["tts_api_url"], s.config.TTS.APIURL)
	apiKey := firstNonEmpty(configs["tts_api_key"], s.config.TTS.APIKey)
	if apiURL == "" {
		return nil, fmt.Errorf("tts api url is not configured")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("tts api key is not configured")
	}

	reqBody := map[string]interface{}{
		"model":           "tts-1",
		"input":           text,
		"voice":           voice,
		"response_format": "mp3",
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	client := s.newHTTPClient(resolveProxyURL(configs["http_proxy_enabled"], configs["http_proxy_url"]))
	ctx, cancel := context.WithTimeout(context.Background(), ttsRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("tts api status %d: %s", resp.StatusCode, truncateForLog(string(body), 400))
	}

	return body, nil
}

func (s *TTSService) callEdgeTTS(text, voice string, configs map[string]string) ([]byte, error) {
	proxyURL := resolveProxyURL(configs["http_proxy_enabled"], configs["http_proxy_url"])
	dialer := websocket.Dialer{
		HandshakeTimeout:  ttsRequestTimeout,
		Proxy:             http.ProxyFromEnvironment,
		EnableCompression: true,
	}
	if proxyURL != nil {
		dialer.Proxy = http.ProxyURL(proxyURL)
	}

	requestID := randomHex(16)
	connectionID := randomHex(16)
	connURL := fmt.Sprintf(
		"%s?Ocp-Apim-Subscription-Key=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s&ConnectionId=%s",
		edgeTTSURL,
		edgeTrustedClientID,
		edgeGenerateSecMSGEC(),
		edgeSecMSGECVersion,
		connectionID,
	)
	header := http.Header{}
	header.Set("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
	header.Set("Pragma", "no-cache")
	header.Set("Cache-Control", "no-cache")
	header.Set("Sec-WebSocket-Protocol", "synthesize")
	header.Set("User-Agent", edgeUserAgent())
	header.Set("Accept-Encoding", "gzip, deflate, br")
	header.Set("Accept-Language", "en-US,en;q=0.9")

	ctx, cancel := context.WithTimeout(context.Background(), ttsRequestTimeout)
	defer cancel()

	conn, resp, err := dialer.DialContext(ctx, connURL, header)
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusForbidden {
			edgeAdjustClockSkew(resp)
			retryURL := fmt.Sprintf(
				"%s?Ocp-Apim-Subscription-Key=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s&ConnectionId=%s",
				edgeTTSURL,
				edgeTrustedClientID,
				edgeGenerateSecMSGEC(),
				edgeSecMSGECVersion,
				randomHex(16),
			)
			conn, resp, err = dialer.DialContext(ctx, retryURL, header)
			if err == nil {
				goto connected
			}
		}
		if resp != nil {
			return nil, fmt.Errorf("edge tts websocket failed: %s", resp.Status)
		}
		return nil, err
	}
connected:
	defer conn.Close()
	conn.EnableWriteCompression(true)

	if err := conn.SetReadDeadline(time.Now().Add(ttsRequestTimeout)); err != nil {
		return nil, err
	}
	if err := conn.SetWriteDeadline(time.Now().Add(ttsRequestTimeout)); err != nil {
		return nil, err
	}

	configMessage := fmt.Sprintf(
		"X-Timestamp:%s\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":false,\"wordBoundaryEnabled\":false},\"outputFormat\":\"%s\"}}}}",
		edgeTimestamp(),
		edgeOutputFormat,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(configMessage)); err != nil {
		return nil, err
	}

	ssml, err := buildEdgeSSML(text, voice)
	if err != nil {
		return nil, err
	}

	ssmlMessage := fmt.Sprintf(
		"X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:%sZ\r\nPath:ssml\r\n\r\n%s",
		requestID,
		edgeTimestamp(),
		ssml,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(ssmlMessage)); err != nil {
		return nil, err
	}

	var audio bytes.Buffer
	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			return nil, err
		}

		switch messageType {
		case websocket.BinaryMessage:
			audioChunk := extractEdgeAudioChunk(data)
			if len(audioChunk) > 0 {
				audio.Write(audioChunk)
			}
		case websocket.TextMessage:
			textMessage := string(data)
			if strings.Contains(textMessage, "Path:turn.end") {
				if audio.Len() == 0 {
					return nil, fmt.Errorf("edge tts returned no audio data")
				}
				return audio.Bytes(), nil
			}
			if strings.Contains(strings.ToLower(textMessage), "error") {
				return nil, fmt.Errorf("edge tts error: %s", truncateForLog(textMessage, 300))
			}
		}
	}
}

func (s *TTSService) filterRounds(rounds []Round) []Round {
	filtered := make([]Round, 0, len(rounds))
	for _, round := range rounds {
		if strings.TrimSpace(round.Text) == "" {
			continue
		}
		filtered = append(filtered, round)
	}
	if len(filtered) == 0 {
		return rounds
	}
	return filtered
}

func (s *TTSService) DeleteAudioFile(filename string) error {
	filePath := filepath.Join(s.uploadPath, filename)
	return os.Remove(filePath)
}

func (s *TTSService) GetAudioInfo(filename string) (*AudioResult, error) {
	filePath := filepath.Join(s.uploadPath, filename)
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	return &AudioResult{
		Filename: filename,
		Size:     info.Size(),
	}, nil
}

func (s *TTSService) loadRuntimeConfigs() map[string]string {
	result := map[string]string{
		"tts_provider":       s.config.TTS.Provider,
		"tts_api_url":        s.config.TTS.APIURL,
		"tts_api_key":        s.config.TTS.APIKey,
		"tts_voice":          s.config.TTS.Voice,
		"tts_voice_host":     s.config.TTS.VoiceHost,
		"tts_voice_guest":    s.config.TTS.VoiceGuest,
		"http_proxy_enabled": fmt.Sprintf("%v", s.config.Proxy.Enabled),
		"http_proxy_url":     s.config.Proxy.URL,
	}

	for key, value := range s.configs {
		if strings.TrimSpace(value) != "" {
			result[key] = value
		}
	}

	var dbConfigs []models.Config
	if err := s.db.Find(&dbConfigs).Error; err != nil {
		log.Warn().Err(err).Msg("Failed to reload TTS configs from database; using cached/runtime values")
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

func (s *TTSService) getDefaultVoice() string {
	return firstNonEmpty(s.configs["tts_voice"], s.config.TTS.Voice, "zh-CN-XiaoxiaoNeural")
}

func (s *TTSService) getVoiceForSpeaker(speaker string) string {
	lowerSpeaker := strings.ToLower(strings.TrimSpace(speaker))
	if strings.Contains(lowerSpeaker, "guest") ||
		strings.Contains(lowerSpeaker, "expert") ||
		strings.Contains(lowerSpeaker, "ceo") ||
		strings.Contains(lowerSpeaker, "嘉宾") ||
		strings.Contains(lowerSpeaker, "专家") {
		return firstNonEmpty(s.configs["tts_voice_guest"], s.config.TTS.VoiceGuest, s.getDefaultVoice())
	}

	return firstNonEmpty(s.configs["tts_voice_host"], s.config.TTS.VoiceHost, s.getDefaultVoice())
}

func (s *TTSService) newHTTPClient(proxyURL *url.URL) *http.Client {
	transport := &http.Transport{}
	if proxyURL != nil {
		transport.Proxy = http.ProxyURL(proxyURL)
	}
	return &http.Client{
		Timeout:   ttsRequestTimeout,
		Transport: transport,
	}
}

func buildEdgeSSML(text, voice string) (string, error) {
	cleanText := edgeEscapeXML(edgeRemoveIncompatibleCharacters(strings.TrimSpace(text)))
	if cleanText == "" {
		return "", fmt.Errorf("tts text is empty after sanitization")
	}

	normalizedVoice := edgeNormalizeVoice(voice)
	return fmt.Sprintf(
		"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>"+
			"<voice name='%s'>"+
			"<prosody pitch='+0Hz' rate='+0%%' volume='+0%%'>%s</prosody>"+
			"</voice>"+
			"</speak>",
		normalizedVoice,
		cleanText,
	), nil
}

func extractEdgeAudioChunk(payload []byte) []byte {
	if len(payload) < 2 {
		return nil
	}
	headerLength := int(binary.BigEndian.Uint16(payload[:2]))
	if headerLength+2 > len(payload) {
		return nil
	}

	headerData := payload[2 : 2+headerLength]
	headers := make(map[string]string)
	for _, line := range bytes.Split(headerData, []byte("\r\n")) {
		if len(line) == 0 {
			continue
		}
		parts := bytes.SplitN(line, []byte(":"), 2)
		if len(parts) != 2 {
			continue
		}
		headers[string(bytes.TrimSpace(parts[0]))] = string(bytes.TrimSpace(parts[1]))
	}

	if headers["Path"] != "audio" {
		return nil
	}
	if contentType, ok := headers["Content-Type"]; ok && contentType != "audio/mpeg" {
		return nil
	}

	return payload[headerLength+2:]
}

func edgeTimestamp() string {
	return time.Now().UTC().Format("Mon Jan 02 2006 15:04:05 GMT+0000 (Coordinated Universal Time)")
}

func edgeUserAgent() string {
	return fmt.Sprintf(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s.0.0.0 Safari/537.36 Edg/%s.0.0.0",
		edgeChromiumMajor,
		edgeChromiumMajor,
	)
}

func edgeGenerateSecMSGEC() string {
	ticks := edgeUnixTimestamp() + edgeWindowsEpoch
	ticks = math.Floor(ticks/300) * 300
	ticks *= 1e9 / 100
	hash := sha256.Sum256([]byte(fmt.Sprintf("%.0f%s", ticks, edgeTrustedClientID)))
	return fmt.Sprintf("%X", hash)
}

func edgeUnixTimestamp() float64 {
	edgeClockSkewMu.RLock()
	defer edgeClockSkewMu.RUnlock()
	return float64(time.Now().UTC().Unix()) + edgeClockSkew
}

func edgeAdjustClockSkew(resp *http.Response) {
	if resp == nil {
		return
	}
	serverDate := resp.Header.Get("Date")
	if serverDate == "" {
		return
	}
	parsed, err := time.Parse(time.RFC1123, serverDate)
	if err != nil {
		return
	}

	edgeClockSkewMu.Lock()
	edgeClockSkew += float64(parsed.UTC().Unix()) - (float64(time.Now().UTC().Unix()) + edgeClockSkew)
	edgeClockSkewMu.Unlock()
}

func edgeNormalizeVoice(voice string) string {
	trimmed := strings.TrimSpace(voice)
	parts := strings.Split(trimmed, "-")
	if len(parts) >= 3 && strings.HasSuffix(trimmed, "Neural") {
		lang := parts[0]
		region := parts[1]
		name := strings.Join(parts[2:], "-")
		return fmt.Sprintf("Microsoft Server Speech Text to Speech Voice (%s-%s, %s)", lang, region, name)
	}
	return trimmed
}

func edgeRemoveIncompatibleCharacters(value string) string {
	var builder strings.Builder
	for _, r := range value {
		code := int(r)
		if (0 <= code && code <= 8) || (11 <= code && code <= 12) || (14 <= code && code <= 31) {
			builder.WriteRune(' ')
			continue
		}
		builder.WriteRune(r)
	}
	return builder.String()
}

func edgeEscapeXML(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&apos;",
	)
	return replacer.Replace(value)
}

func randomHex(byteLen int) string {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	}
	return hex.EncodeToString(buf)
}

func estimateDurationSeconds(text string) int {
	length := len([]rune(strings.TrimSpace(text)))
	if length == 0 {
		return 0
	}
	seconds := length * 60 / 200
	if seconds <= 0 {
		return 1
	}
	return seconds
}

# HTTP代理功能实现说明

## 功能概述

本系统已成功添加HTTP代理支持功能，允许用户通过代理服务器访问外部API和RSS源。当代理开关关闭时，系统将直接连接，不使用代理。

## 新增配置项

### 1. HTTP代理开关
- **配置键**: `http_proxy_enabled`
- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 控制是否启用HTTP代理

### 2. HTTP代理地址
- **配置键**: `http_proxy_url`
- **类型**: `string`
- **默认值**: `''`
- **描述**: HTTP代理服务器地址，格式为 `http://host:port`

### 3. TTS发音人（主持人）
- **配置键**: `tts_voice_host`
- **类型**: `string`
- **默认值**: `'alloy'`
- **描述**: 主持人使用的TTS发音人

### 4. TTS发音人（嘉宾）
- **配置键**: `tts_voice_guest`
- **类型**: `string`
- **默认值**: `'nova'`
- **描述**: 嘉宾使用的TTS发音人

## 支持代理的服务

### 1. RSS抓取服务 (`backend/src/services/rssService.js`)
- **功能**: 抓取RSS源和获取完整文章内容
- **代理支持**: 
  - `validateRssFeed()` - RSS源验证
  - `fetchFeed()` - RSS源抓取
  - `fetchFullContent()` - 获取完整文章内容

### 2. LLM服务 (`backend/src/services/llmService.js`)
- **功能**: 调用大语言模型API
- **代理支持**:
  - `callLLMAPI()` - 生成对话内容
  - `testConnection()` - 测试LLM连接

### 3. TTS服务 (`backend/src/services/ttsService.js`)
- **功能**: 调用语音合成API
- **代理支持**:
  - `callTTSAPI()` - 生成语音
- **多发音人支持**:
  - `getHostVoice()` - 获取主持人发音人
  - `getGuestVoice()` - 获取嘉宾发音人

### 4. 对话服务 (`backend/src/services/dialogueService.js`)
- **功能**: 生成对话和语音
- **代理支持**:
  - `callLLMAPI()` - 调用LLM生成对话
  - `callOpenAITTSWithDifferentVoices()` - 调用OpenAI兼容的TTS API（多发音人）
  - `callXunfeiMultiVoiceTTS()` - 调用科大讯飞TTS API（多发音人）

### 5. 科大讯飞TTS服务 (`backend/src/services/xunfeiTtsService.js`)
- **功能**: 科大讯飞语音合成
- **多发音人支持**:
  - `generateMultiVoiceTTS()` - 生成多发音人TTS音频

## 前端界面

### 设置页面 (`frontend/src/pages/Settings.jsx`)
在"API配置"标签页的"科大讯飞 TTS API配置"部分添加了：

1. **TTS发音人（主持人）**: 输入框，用于设置主持人使用的发音人
2. **TTS发音人（嘉宾）**: 输入框，用于设置嘉宾使用的发音人
3. **表单验证**: 两个发音人配置都是必填项

## 技术实现

### 代理配置获取
每个服务都实现了 `getProxyConfig()` 方法：

```javascript
async getProxyConfig() {
  try {
    const httpProxyEnabled = await this.getConfigValue('http_proxy_enabled', false);
    const httpProxyUrl = await this.getConfigValue('http_proxy_url', '');
    
    if (httpProxyEnabled && httpProxyUrl) {
      return {
        host: new URL(httpProxyUrl).hostname,
        port: new URL(httpProxyUrl).port || 80,
        protocol: new URL(httpProxyUrl).protocol.replace(':', '')
      };
    }
    
    return null;
  } catch (error) {
    logger.error('获取代理配置失败:', error);
    return null;
  }
}
```

### 网络请求代理支持
使用axios的proxy配置：

```javascript
const axiosConfig = {
  headers: { /* ... */ },
  timeout: 60000
};

// 如果启用了代理，添加代理配置
if (proxyConfig) {
  axiosConfig.proxy = proxyConfig;
  logger.info(`使用代理调用API: ${apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
}

const response = await axios.post(apiUrl, data, axiosConfig);
```

### 多发音人TTS实现
对话生成时，系统会根据说话者自动选择不同的发音人：

```javascript
// 根据说话者选择发音人
let voice = hostVoice; // 默认使用主持人发音人
if (round.speaker.includes('嘉宾') || round.speaker.includes('专家') || round.speaker.includes('CEO')) {
  voice = guestVoice;
}

// 为每个对话轮次分别生成音频
const response = await axios.post(ttsConfig.apiUrl, {
  model: 'tts-1',
  input: `${round.speaker}：${round.text}`,
  voice: voice,
  response_format: 'mp3'
}, axiosConfig);
```

## 使用方法

### 1. 配置代理
1. 打开系统设置页面
2. 进入"系统配置"标签页
3. 找到"网络代理配置"部分
4. 打开"启用HTTP代理"开关
5. 输入代理服务器地址（格式：`http://proxy.example.com:8080`）
6. 点击"保存设置"

### 2. 配置TTS发音人
1. 打开系统设置页面
2. 进入"API配置"标签页
3. 找到"科大讯飞 TTS API配置"部分
4. 设置"TTS发音人（主持人）"（建议选择男声：alloy, echo, fable, onyx）
5. 设置"TTS发音人（嘉宾）"（建议选择女声：nova, shimmer）
6. 点击"保存设置"

### 3. 验证功能
- **RSS抓取**: 添加需要代理的RSS源，系统会自动使用代理抓取
- **LLM测试**: 在设置页面点击"测试LLM连接"
- **TTS测试**: 在设置页面点击"测试TTS连接"
- **对话生成**: 创建新对话，系统会自动使用不同的发音人

## 日志记录

系统会记录代理和发音人使用情况：

```
使用代理获取RSS: https://example.com/rss, 代理: proxy.example.com:8080
使用代理调用LLM API: https://api.deepseek.com/v1/chat/completions, 代理: proxy.example.com:8080
使用代理调用TTS API: https://api.openai.com/v1/audio/speech, 代理: proxy.example.com:8080
为 主持人 生成音频，使用发音人: alloy
为 嘉宾 生成音频，使用发音人: nova
```

## 注意事项

1. **代理格式**: 代理地址必须包含协议前缀（如 `http://` 或 `https://`）
2. **代理验证**: 系统不会验证代理服务器的可用性，请确保代理服务器正常工作
3. **错误处理**: 如果代理连接失败，系统会记录错误日志但不会中断服务
4. **性能影响**: 使用代理可能会增加网络延迟，建议使用稳定的代理服务器
5. **发音人选择**: 建议主持人选择男声发音人，嘉宾选择女声发音人，以区分角色
6. **音频生成**: 多发音人对话会为每个轮次分别生成音频，然后合并，生成时间较长

## 兼容性

- 保持与现有配置的兼容性
- 旧版的 `http_proxy`、`https_proxy`、`no_proxy` 配置仍然保留
- 新的代理配置与旧配置可以同时使用
- 原有的 `tts_voice` 配置仍然保留，用于单发音人场景

## 测试

可以使用提供的测试脚本验证功能：

```bash
node test_tts_voices.js
```

该脚本会：
1. 设置TTS发音人配置
2. 验证配置是否保存成功
3. 测试创建多发音人对话
4. 验证多发音人功能是否正常工作 
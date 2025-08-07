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

### 4. 对话服务 (`backend/src/services/dialogueService.js`)
- **功能**: 生成对话和语音
- **代理支持**:
  - `callLLMAPI()` - 调用LLM生成对话
  - `callOpenAITTS()` - 调用OpenAI兼容的TTS API

## 前端界面

### 设置页面 (`frontend/src/pages/Settings.jsx`)
在"系统配置"标签页的"网络代理配置"部分添加了：

1. **启用HTTP代理开关**: 使用Switch组件控制代理开关
2. **HTTP代理地址输入框**: 输入代理服务器地址
3. **表单验证**: 当启用代理时，代理地址为必填项

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

## 使用方法

### 1. 配置代理
1. 打开系统设置页面
2. 进入"系统配置"标签页
3. 找到"网络代理配置"部分
4. 打开"启用HTTP代理"开关
5. 输入代理服务器地址（格式：`http://proxy.example.com:8080`）
6. 点击"保存设置"

### 2. 验证代理功能
- **RSS抓取**: 添加需要代理的RSS源，系统会自动使用代理抓取
- **LLM测试**: 在设置页面点击"测试LLM连接"
- **TTS测试**: 在设置页面点击"测试TTS连接"

## 日志记录

系统会记录代理使用情况：

```
使用代理获取RSS: https://example.com/rss, 代理: proxy.example.com:8080
使用代理调用LLM API: https://api.deepseek.com/v1/chat/completions, 代理: proxy.example.com:8080
使用代理调用TTS API: https://api.openai.com/v1/audio/speech, 代理: proxy.example.com:8080
```

## 注意事项

1. **代理格式**: 代理地址必须包含协议前缀（如 `http://` 或 `https://`）
2. **代理验证**: 系统不会验证代理服务器的可用性，请确保代理服务器正常工作
3. **错误处理**: 如果代理连接失败，系统会记录错误日志但不会中断服务
4. **性能影响**: 使用代理可能会增加网络延迟，建议使用稳定的代理服务器

## 兼容性

- 保持与现有配置的兼容性
- 旧版的 `http_proxy`、`https_proxy`、`no_proxy` 配置仍然保留
- 新的代理配置与旧配置可以同时使用

## 测试

可以使用提供的测试脚本验证代理功能：

```bash
node test_rss_proxy.js
```

该脚本会：
1. 设置代理配置
2. 添加测试RSS源
3. 测试RSS抓取功能
4. 验证代理是否正常工作 
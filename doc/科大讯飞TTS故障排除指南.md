# 科大讯飞TTS故障排除指南

## 问题概述

您遇到的错误包括：
1. **401认证错误**: `Unexpected server response: 401`
2. **方法未定义错误**: `this.estimateDuration is not a function`
3. **响应解析错误**: `科大讯飞TTS错误: undefined HTTP/1.1 200 OK`

## 已修复的问题

### 1. estimateDuration方法未定义错误

**问题**: `dialogueService.js`中缺少`estimateDuration`方法，导致调用失败。

**解决方案**: 已在`backend/src/services/dialogueService.js`中添加了该方法：

```javascript
// 估算音频时长（秒）
estimateDuration(text) {
  const charactersPerMinute = 200;
  const durationMinutes = text.length / charactersPerMinute;
  return Math.ceil(durationMinutes * 60);
}
```

### 2. 改进的错误处理

已对科大讯飞TTS服务进行了以下改进：
- 添加了详细的日志记录
- 改进了错误信息，提供更具体的错误原因
- 增强了多发音人TTS的错误处理
- 添加了代理配置检查
- **新增**: 改进了WebSocket响应解析，处理HTTP响应错误

### 3. 响应解析错误修复

**问题**: 科大讯飞TTS返回HTTP 200状态码但错误信息显示为"undefined"。

**原因**: WebSocket握手失败，服务器返回HTTP响应而不是WebSocket消息。

**解决方案**: 
- 改进了错误处理逻辑，能够识别HTTP响应错误
- 添加了详细的响应结构分析
- 提供了更准确的错误分类和解决建议

### 4. API格式更新

**问题**: 科大讯飞TTS API返回"unknown field"错误，提示common、business、data字段未知。

**原因**: 科大讯飞TTS API已更新为新的请求格式，使用header/parameter/payload结构。

**解决方案**: 
- 更新了请求格式，使用新的header/parameter/payload结构
- 更新了响应处理逻辑，适应新的响应格式
- 修复了音频数据提取路径

## 401认证错误的解决方案

### 1. 检查API凭据

确保在系统设置中正确配置了以下参数：

- **TTS App ID**: 您的科大讯飞应用ID
- **TTS API Key**: 您的科大讯飞API密钥
- **TTS API Secret**: 您的科大讯飞API密钥对应的密钥
- **TTS发音人**: 有效的发音人名称（如：xiaoyan, x5_lingfeiyi_flow等）

### 2. 验证API凭据

使用配置检查工具验证您的配置：

```bash
cd backend
node check-xunfei-config.js
```

### 3. 常见401错误原因

#### 3.1 API凭据错误
- **API Key或API Secret不正确**: 检查是否复制完整，是否有多余的空格
- **App ID不正确**: 确认App ID是否与API Key匹配

#### 3.2 账户问题
- **账户余额不足**: 登录科大讯飞开放平台检查账户余额
- **服务未开通**: 确认TTS服务是否已开通
- **发音人权限未开通**: 检查是否开通了对应发音人的使用权限

#### 3.3 网络问题
- **网络连接问题**: 检查网络连接是否正常
- **防火墙阻止**: 确认防火墙是否阻止了WebSocket连接
- **代理配置问题**: 如果使用代理，确认代理配置是否正确

### 4. 测试连接

使用测试脚本验证连接：

```bash
cd backend
node test-xunfei-auth.js
```

**注意**: 使用前请先在脚本中配置您的实际API凭据。

## 响应解析错误的解决方案

### 1. 问题诊断

当遇到"undefined HTTP/1.1 200 OK"错误时，使用专门的调试工具：

```bash
cd backend
node debug-xunfei-response.js
```

### 2. 常见原因

#### 2.1 WebSocket握手失败
- **认证URL错误**: 检查API Key和API Secret是否正确
- **时间戳问题**: 确保系统时间准确
- **签名算法错误**: 确认使用正确的HMAC-SHA256算法

#### 2.2 网络问题
- **代理配置错误**: 如果使用代理，确认代理支持WebSocket
- **防火墙阻止**: 检查防火墙是否阻止WebSocket连接
- **DNS解析问题**: 确认域名解析正常

#### 2.3 服务器问题
- **服务地址错误**: 确认WebSocket地址正确
- **服务器过载**: 稍后重试
- **服务维护**: 查看科大讯飞服务状态

### 3. 解决步骤

1. **运行调试工具**: 使用`debug-xunfei-response.js`获取详细信息
2. **检查配置**: 确认API凭据正确
3. **测试网络**: 检查网络连接和代理设置
4. **联系支持**: 如果问题持续，联系科大讯飞技术支持

## 配置检查工具使用

### 运行配置检查

```bash
cd backend
node check-xunfei-config.js
```

该工具会检查：
1. 系统配置完整性
2. API凭据有效性
3. 网络连接状态
4. 代理配置
5. 实际TTS功能测试

### 检查结果说明

- ✅ **成功**: 配置正确，功能正常
- ❌ **失败**: 需要根据错误信息进行修复
- ⚠️ **警告**: 可能存在问题，建议检查
- ℹ️ **信息**: 正常状态信息

## 发音人配置

### 常用发音人列表

| 发音人 | 类型 | 说明 |
|--------|------|------|
| xiaoyan | 女声 | 标准女声，清晰自然 |
| x5_lingfeiyi_flow | 女声 | 流式发音人，适合实时应用 |
| aisxping | 女声 | 标准女声 |
| asdf_viola | 女声 | 温柔女声 |
| aisjinger | 男声 | 标准男声 |
| aisbabyxu | 童声 | 儿童声音 |

### 多发音人配置

在系统设置中配置：
- **TTS发音人（主持人）**: 建议选择男声发音人
- **TTS发音人（嘉宾）**: 建议选择女声发音人

## 代理配置

如果您的网络环境需要使用代理，请在系统设置中配置：

1. **启用HTTP代理**: 勾选启用代理选项
2. **代理地址**: 输入代理服务器地址（如：http://proxy.example.com:8080）
3. **代理认证**: 如果代理需要认证，在地址中包含用户名和密码

**注意**: 确保代理服务器支持WebSocket连接。

## 日志查看

### 查看详细日志

```bash
# 查看错误日志
tail -f backend/logs/error.log

# 查看完整日志
tail -f backend/logs/combined.log
```

### 日志级别

- **ERROR**: 错误信息，需要立即处理
- **WARN**: 警告信息，可能存在问题
- **INFO**: 一般信息，记录正常操作
- **DEBUG**: 调试信息，详细的操作记录

## 联系支持

如果问题仍然存在，请：

1. 运行配置检查工具并保存输出结果
2. 查看错误日志文件
3. 联系科大讯飞技术支持
4. 提供详细的错误信息和配置信息

## 预防措施

1. **定期检查账户余额**: 确保账户有足够的余额
2. **监控API使用量**: 避免超出使用限制
3. **备份配置**: 定期备份重要的配置信息
4. **测试连接**: 定期运行连接测试确保服务正常
5. **保持系统时间准确**: 确保系统时间与标准时间同步

## 更新日志

- **2025-08-07**: 修复estimateDuration方法未定义错误
- **2025-08-07**: 改进科大讯飞TTS错误处理
- **2025-08-07**: 添加配置检查工具
- **2025-08-07**: 创建故障排除指南
- **2025-08-07**: 修复响应解析错误，添加调试工具
- **2025-08-07**: 更新科大讯飞TTS API格式，适配新的header/parameter/payload结构 
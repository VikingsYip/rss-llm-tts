# TTS功能改进说明

## 概述
本次更新对TTS（文本转语音）功能进行了多项改进，主要包括：

1. **角色过滤功能** - 过滤掉主持人、嘉宾等角色的对话
2. **语速优化** - 将TTS语速调整为1.5倍速
3. **口语化改进** - 对话内容更加口语化和自然

## 详细改进

### 1. 角色过滤功能

#### 功能说明
- 自动过滤掉包含以下关键词的角色对话：
  - 主持人
  - 嘉宾
  - 专家
  - 记者
  - 主播
  - 导播
  - 编导
  - 制片人

#### 配置文件
角色过滤列表可在 `src/config/ttsConfig.js` 中自定义：

```javascript
filterRoles: [
  '主持人',
  '嘉宾', 
  '专家',
  '记者',
  '主播',
  // 可以添加更多角色
]
```

#### 实现位置
- `src/services/dialogueService.js` - 对话服务中的TTS调用
- `src/services/xunfeiTtsService.js` - 科大讯飞TTS服务

### 2. 语速优化

#### 功能说明
- **OpenAI TTS**: 语速设置为1.5倍速
- **科大讯飞TTS**: 语速设置为75（正常速度为50）

#### 配置文件
语速设置可在 `src/config/ttsConfig.js` 中调整：

```javascript
speed: {
  openai: 1.5,        // OpenAI TTS语速 (1.0 = 正常速度)
  xunfei: 75,         // 科大讯飞TTS语速 (0-100, 50为正常速度)
}
```

#### 实现位置
- `src/services/ttsService.js` - OpenAI TTS服务
- `src/services/xunfeiTtsService.js` - 科大讯飞TTS服务
- `src/services/dialogueService.js` - 对话TTS调用

### 3. 口语化改进

#### 功能说明
- 修改了LLM提示词，要求生成更口语化的对话内容
- 添加了口语化特点指导：
  - 使用日常用语和表达方式
  - 适当使用语气词和感叹词
  - 避免过于正式的学术语言
  - 保持对话的自然节奏和语调

#### 实现位置
- `src/services/dialogueService.js` - `callLLMAPI` 方法中的提示词

## 配置文件说明

### ttsConfig.js
```javascript
const ttsConfig = {
  // 语速设置
  speed: {
    openai: 1.5,        // OpenAI TTS语速
    xunfei: 75,         // 科大讯飞TTS语速
  },
  
  // 角色过滤设置
  filterRoles: [
    '主持人', '嘉宾', '专家', '记者', '主播'
  ],
  
  // 发音人设置
  voices: {
    host: {
      openai: 'alloy',
      xunfei: 'x5_lingfeiyi_flow'
    },
    guest: {
      openai: 'nova',
      xunfei: 'xiaoyan'
    }
  },
  
  // 音频设置
  audio: {
    format: 'mp3',
    sampleRate: 24000,
    channels: 1,
    bitDepth: 16
  },
  
  // 静音设置
  silence: {
    betweenRounds: 1,    // 对话轮次之间的静音时长
    betweenSpeakers: 0.5  // 不同说话者之间的静音时长
  }
};
```

## 使用说明

### 1. 调整语速
如需调整语速，修改 `src/config/ttsConfig.js` 中的 `speed` 配置：

```javascript
speed: {
  openai: 1.2,  // 调整为1.2倍速
  xunfei: 60,   // 调整为60（稍快于正常速度）
}
```

### 2. 自定义角色过滤
如需添加或移除过滤角色，修改 `filterRoles` 数组：

```javascript
filterRoles: [
  '主持人', '嘉宾', '专家', '记者', '主播',
  '新增角色1', '新增角色2'  // 添加新角色
]
```

### 3. 调整发音人
如需更换发音人，修改 `voices` 配置：

```javascript
voices: {
  host: {
    openai: 'echo',      // 更换主持人发音人
    xunfei: 'xiaoyan'    // 更换科大讯飞发音人
  },
  guest: {
    openai: 'shimmer',   // 更换嘉宾发音人
    xunfei: 'aisjiuxu'   // 更换科大讯飞发音人
  }
}
```

## 注意事项

1. **语速调整**: 语速过快可能影响语音清晰度，建议在1.0-2.0之间调整
2. **角色过滤**: 如果过滤后没有可用内容，系统会自动使用原始内容
3. **配置文件**: 修改配置文件后需要重启服务才能生效
4. **兼容性**: 这些改进同时支持OpenAI TTS和科大讯飞TTS

## 测试建议

1. 创建不同类型的对话，测试角色过滤效果
2. 调整语速设置，找到最适合的语速
3. 检查生成的对话内容是否更加口语化
4. 验证音频文件的质量和时长

## 故障排除

### 常见问题

1. **语速过快导致听不清**
   - 降低 `speed.openai` 或 `speed.xunfei` 的值

2. **角色过滤过于严格**
   - 检查 `filterRoles` 数组，移除不必要的角色

3. **对话内容仍然过于正式**
   - 检查LLM提示词是否正确应用

4. **音频文件生成失败**
   - 检查TTS API配置是否正确
   - 查看日志文件获取详细错误信息

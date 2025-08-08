// TTS配置文件
const ttsConfig = {
  // 语速设置 (1.0 = 正常速度, 1.5 = 1.5倍速)
  speed: {
    openai: 1.5,        // OpenAI TTS语速
    xunfei: 90,         // 科大讯飞TTS语速 (0-100, 50为正常速度)
  },
  
  // 角色过滤设置 - 这些角色的对话不会被转换为TTS
  filterRoles: [
    '主持人',
    '技术专家',
    '嘉宾',
    '甲方视觉CIO嘉宾'
  ],
  
  // 发音人设置
  voices: {
    host: {
      openai: 'alloy',      // 主持人发音人 (OpenAI)
      xunfei: 'x5_lingfeiyi_flow'  // 主持人发音人 (科大讯飞)
    },
    guest: {
      openai: 'nova',       // 嘉宾发音人 (OpenAI)
      xunfei: 'xiaoyan'     // 嘉宾发音人 (科大讯飞)
    }
  },
  
  // 音频设置
  audio: {
    format: 'mp3',
    sampleRate: 24000,
    channels: 1,
    bitDepth: 16
  },
  
  // 静音设置 (秒)
  silence: {
    betweenRounds: 0.2,    // 对话轮次之间的静音时长
    betweenSpeakers: 0.1  // 不同说话者之间的静音时长
  }
};

module.exports = ttsConfig;

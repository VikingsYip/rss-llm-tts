const sequelize = require('../config/database');
const RssFeed = require('./RssFeed');
const News = require('./News');
const Dialogue = require('./Dialogue');
const Config = require('./Config');

// 定义关联关系
RssFeed.hasMany(News, {
  foreignKey: 'rssFeedId',
  as: 'news'
});

News.belongsTo(RssFeed, {
  foreignKey: 'rssFeedId',
  as: 'rssFeed'
});

// 同步数据库
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('数据库同步完成');
    
    // 初始化默认配置
    await initializeDefaultConfigs();
  } catch (error) {
    console.error('数据库同步失败:', error);
  }
};

// 初始化默认配置
const initializeDefaultConfigs = async () => {
  const defaultConfigs = [
    {
      key: 'llm_api_url',
      value: 'https://api.openai.com/v1/chat/completions',
      description: 'LLM API地址',
      type: 'string',
      isEncrypted: false
    },
    {
      key: 'llm_api_key',
      value: '',
      description: 'LLM API密钥',
      type: 'string',
      isEncrypted: true
    },
    {
      key: 'llm_model',
      value: 'gpt-3.5-turbo',
      description: 'LLM模型名称',
      type: 'string',
      isEncrypted: false
    },
    {
      key: 'tts_api_url',
      value: 'https://api.openai.com/v1/audio/speech',
      description: 'TTS API地址',
      type: 'string',
      isEncrypted: false
    },
    {
      key: 'tts_api_key',
      value: '',
      description: 'TTS API密钥',
      type: 'string',
      isEncrypted: true
    },
    {
      key: 'tts_voice',
      value: 'alloy',
      description: 'TTS语音',
      type: 'string',
      isEncrypted: false
    },
    {
      key: 'rss_fetch_interval',
      value: '3600000',
      description: 'RSS抓取间隔(毫秒)',
      type: 'number',
      isEncrypted: false
    },
    {
      key: 'news_retention_hours',
      value: '24',
      description: '新闻保留时间(小时)',
      type: 'number',
      isEncrypted: false
    },
    {
      key: 'dialogue_news_count',
      value: '5',
      description: '对话使用的新闻数量',
      type: 'number',
      isEncrypted: false
    },
    {
      key: 'dialogue_rounds',
      value: '8',
      description: '对话轮次',
      type: 'number',
      isEncrypted: false
    }
  ];

  for (const config of defaultConfigs) {
    const existing = await Config.findOne({ where: { key: config.key } });
    if (!existing) {
      await Config.create(config);
    }
  }
};

module.exports = {
  sequelize,
  RssFeed,
  News,
  Dialogue,
  Config,
  syncDatabase
}; 
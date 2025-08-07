const axios = require('axios');
const logger = require('../utils/logger');
const { Config, News } = require('../models');
const { decrypt } = require('../utils/encryption');

class LLMService {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
    this.model = null;
  }

  // 初始化配置
  async initialize() {
    try {
      this.apiUrl = await this.getConfigValue('llm_api_url');
      this.apiKey = await this.getConfigValue('llm_api_key');
      this.model = await this.getConfigValue('llm_model');
      
      if (!this.apiUrl || !this.apiKey) {
        throw new Error('LLM API配置不完整');
      }
    } catch (error) {
      logger.error('LLM服务初始化失败:', error);
      throw error;
    }
  }

  // 获取配置值
  async getConfigValue(key, defaultValue = null) {
    try {
      const config = await Config.findOne({ where: { key } });
      if (!config) return defaultValue;
      
      let value = config.value;
      if (config.isEncrypted) {
        value = decrypt(value);
      }
      
      return value;
    } catch (error) {
      logger.error(`获取配置失败: ${key}`, error);
      return defaultValue;
    }
  }

  // 获取代理配置
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

  // 生成对话
  async generateDialogue(dialogueParams) {
    try {
      await this.initialize();
      
      const {
        dialogueType = 'interview',
        character1 = '主持人',
        character2 = '嘉宾',
        rounds = 8,
        newsCount = 5
      } = dialogueParams;

      // 获取最新新闻
      const news = await this.getLatestNews(newsCount);
      if (news.length === 0) {
        throw new Error('没有可用的新闻数据');
      }

      // 构建新闻摘要
      const newsSummary = this.buildNewsSummary(news);
      
      // 构建对话提示
      const prompt = this.buildDialoguePrompt(dialogueType, character1, character2, newsSummary, rounds);
      
      // 调用LLM API
      const response = await this.callLLMAPI(prompt);
      
      // 解析对话内容
      const dialogue = this.parseDialogueResponse(response, character1, character2);
      
      return {
        title: `${character1}与${character2}的${this.getDialogueTypeName(dialogueType)}`,
        content: dialogue,
        dialogueType,
        character1,
        character2,
        rounds,
        newsCount,
        news: news.map(n => ({
          id: n.id,
          title: n.title,
          source: n.sourceName
        }))
      };
    } catch (error) {
      logger.error('生成对话失败:', error);
      throw error;
    }
  }

  // 获取最新新闻
  async getLatestNews(count) {
    return await News.findAll({
      where: {
        isIgnored: false
      },
      order: [['publishedAt', 'DESC']],
      limit: count,
      attributes: ['id', 'title', 'summary', 'content', 'sourceName', 'category', 'publishedAt']
    });
  }

  // 构建新闻摘要
  buildNewsSummary(news) {
    return news.map((item, index) => {
      const summary = item.summary || item.content?.substring(0, 200) || item.title;
      return `${index + 1}. ${item.title}\n   来源: ${item.sourceName}\n   摘要: ${summary}`;
    }).join('\n\n');
  }

  // 构建对话提示
  buildDialoguePrompt(dialogueType, character1, character2, newsSummary, rounds) {
    const typePrompts = {
      interview: `你是一位专业的主持人，正在采访一位IT行业专家。请基于以下新闻内容，进行${rounds}轮深入的访谈对话。主持人应该引导话题，专家应该提供专业的分析和见解。`,
      ceo_interview: `你是一位资深记者，正在采访一位知名企业的CEO。请基于以下新闻内容，进行${rounds}轮专业的采访对话。记者应该提出尖锐的问题，CEO应该给出战略性的回答。`,
      commentary: `你是两位资深的新闻评论员，正在分析最新的新闻热点。请基于以下新闻内容，进行${rounds}轮深入的评论对话。两位评论员应该从不同角度分析问题，提供独到的见解。`,
      chat: `你是两位朋友，正在讨论最新的新闻。请基于以下新闻内容，进行${rounds}轮轻松的聊天对话。对话应该自然、有趣，体现朋友间的交流风格。`
    };

    const basePrompt = typePrompts[dialogueType] || typePrompts.interview;

    return `${basePrompt}

新闻内容：
${newsSummary}

请生成${rounds}轮对话，格式如下：
${character1}: [对话内容]
${character2}: [对话内容]
${character1}: [对话内容]
...

要求：
1. 对话要自然流畅，符合角色设定
2. 内容要基于提供的新闻，但不要直接引用
3. 每轮对话要有深度，体现专业性和见解
4. 对话要有逻辑性，前后呼应
5. 总字数控制在2000字以内`;
  }

  // 调用LLM API
  async callLLMAPI(prompt) {
    try {
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理调用LLM API: ${this.apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的对话生成助手，能够根据新闻内容生成高质量的对话。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.7
      }, axiosConfig);

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('LLM API调用失败:', error);
      throw new Error('LLM服务调用失败');
    }
  }

  // 解析对话响应
  parseDialogueResponse(response, character1, character2) {
    try {
      // 简单的对话解析，按角色分割
      const lines = response.split('\n').filter(line => line.trim());
      const dialogue = [];
      
      for (const line of lines) {
        if (line.startsWith(`${character1}:`)) {
          dialogue.push({
            speaker: character1,
            content: line.substring(character1.length + 1).trim()
          });
        } else if (line.startsWith(`${character2}:`)) {
          dialogue.push({
            speaker: character2,
            content: line.substring(character2.length + 1).trim()
          });
        }
      }
      
      return dialogue;
    } catch (error) {
      logger.error('解析对话响应失败:', error);
      // 如果解析失败，返回原始文本
      return [{
        speaker: '系统',
        content: response
      }];
    }
  }

  // 获取对话类型名称
  getDialogueTypeName(type) {
    const typeNames = {
      interview: '访谈对话',
      ceo_interview: 'CEO采访',
      commentary: '评论对话',
      chat: '聊天对话'
    };
    return typeNames[type] || '对话';
  }

  // 测试LLM连接
  async testConnection() {
    try {
      await this.initialize();
      
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理测试LLM连接: ${this.apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: '你好，请回复"连接成功"'
          }
        ],
        max_tokens: 50
      }, axiosConfig);

      return {
        success: true,
        data: {
          responseTime: 1000, // 模拟响应时间
          message: 'LLM连接测试成功',
          response: response.data.choices[0].message.content
        }
      };
    } catch (error) {
      logger.error('LLM连接测试失败:', error);
      return {
        success: false,
        message: 'LLM连接测试失败',
        data: {
          error: error.message
        }
      };
    }
  }
}

module.exports = new LLMService(); 
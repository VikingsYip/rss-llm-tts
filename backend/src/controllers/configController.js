const configService = require('../services/configService');
const xunfeiTtsService = require('../services/xunfeiTtsService');
const logger = require('../utils/logger');

class ConfigController {
  // 获取所有配置
  async getAllConfigs(req, res) {
    try {
      const configs = await configService.getAllConfigs();
      
      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      logger.error('获取配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: error.message
      });
    }
  }

  // 获取配置分组
  async getConfigGroups(req, res) {
    try {
      const groups = await configService.getConfigGroups();
      
      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      logger.error('获取配置分组失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置分组失败',
        error: error.message
      });
    }
  }

  // 获取单个配置
  async getConfig(req, res) {
    try {
      const { key } = req.params;
      const value = await configService.getConfig(key);
      
      if (value === null) {
        return res.status(404).json({
          success: false,
          message: '配置不存在'
        });
      }
      
      res.json({
        success: true,
        data: { key, value }
      });
    } catch (error) {
      logger.error('获取配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: error.message
      });
    }
  }

  // 保存配置
  async saveConfig(req, res) {
    try {
      const { key, value, description, type, isEncrypted } = req.body;
      
      if (!key) {
        return res.status(400).json({
          success: false,
          message: '配置键是必填项'
        });
      }
      
      const config = await configService.setConfig(
        key, 
        value, 
        description, 
        type || 'string', 
        isEncrypted || false
      );
      
      res.json({
        success: true,
        message: '配置保存成功',
        data: config
      });
    } catch (error) {
      logger.error('保存配置失败:', error);
      res.status(500).json({
        success: false,
        message: '保存配置失败',
        error: error.message
      });
    }
  }

  // 批量保存配置
  async saveConfigs(req, res) {
    try {
      const { configs } = req.body;
      
      if (!configs || typeof configs !== 'object') {
        return res.status(400).json({
          success: false,
          message: '配置数据格式错误'
        });
      }
      
      const results = await configService.setConfigs(configs);
      
      res.json({
        success: true,
        message: '配置保存成功',
        data: results
      });
    } catch (error) {
      logger.error('批量保存配置失败:', error);
      res.status(500).json({
        success: false,
        message: '批量保存配置失败',
        error: error.message
      });
    }
  }

  // 保存系统设置
  async saveSystemSettings(req, res) {
    try {
      const {
        // LLM配置
        llmApiUrl,
        llmApiKey,
        llmModel,
        // TTS配置
        ttsApiUrl,
        ttsAppId,
        ttsApiKey,
        ttsApiSecret,
        ttsVoice,
        // 代理配置
        httpProxy,
        httpsProxy,
        noProxy,
        // RSS配置
        rssFetchInterval,
        newsRetentionHours,
        // 对话配置
        dialogueNewsCount,
        dialogueRounds
      } = req.body;
      
      // 验证必填字段
      const requiredFields = {
        llmApiUrl: 'LLM API地址',
        llmApiKey: 'LLM API密钥',
        llmModel: 'LLM模型',
        ttsApiUrl: 'TTS API地址',
        ttsAppId: 'TTS App ID',
        ttsApiKey: 'TTS API Key',
        ttsApiSecret: 'TTS API Secret',
        ttsVoice: 'TTS发音人'
      };
      
      for (const [field, name] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            message: `${name}是必填项`
          });
        }
      }
      
      const configs = {
        llm_api_url: {
          value: llmApiUrl,
          description: 'LLM API地址',
          type: 'string',
          isEncrypted: false
        },
        llm_api_key: {
          value: llmApiKey,
          description: 'LLM API密钥',
          type: 'string',
          isEncrypted: true
        },
        llm_model: {
          value: llmModel,
          description: 'LLM模型名称',
          type: 'string',
          isEncrypted: false
        },
        tts_api_url: {
          value: 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6',
          description: 'TTS API地址',
          type: 'string',
          isEncrypted: false
        },
        tts_app_id: {
          value: ttsAppId,
          description: 'TTS App ID',
          type: 'string',
          isEncrypted: false
        },
        tts_api_key: {
          value: ttsApiKey,
          description: 'TTS API Key',
          type: 'string',
          isEncrypted: true
        },
        tts_api_secret: {
          value: ttsApiSecret,
          description: 'TTS API Secret',
          type: 'string',
          isEncrypted: true
        },
        tts_voice: {
          value: ttsVoice,
          description: 'TTS发音人',
          type: 'string',
          isEncrypted: false
        },
        http_proxy: {
          value: httpProxy || '',
          description: 'HTTP代理地址 (可选)',
          type: 'string',
          isEncrypted: false
        },
        https_proxy: {
          value: httpsProxy || '',
          description: 'HTTPS代理地址 (可选)',
          type: 'string',
          isEncrypted: false
        },
        no_proxy: {
          value: noProxy || '',
          description: '不使用代理的地址列表 (可选)',
          type: 'string',
          isEncrypted: false
        },
        rss_fetch_interval: {
          value: rssFetchInterval || 3600000,
          description: 'RSS抓取间隔(毫秒)',
          type: 'number',
          isEncrypted: false
        },
        news_retention_hours: {
          value: newsRetentionHours || 24,
          description: '新闻保留时间(小时)',
          type: 'number',
          isEncrypted: false
        },
        dialogue_news_count: {
          value: dialogueNewsCount || 5,
          description: '对话使用的新闻数量',
          type: 'number',
          isEncrypted: false
        },
        dialogue_rounds: {
          value: dialogueRounds || 8,
          description: '对话轮次',
          type: 'number',
          isEncrypted: false
        }
      };
      
      const results = await configService.setConfigs(configs);
      
      res.json({
        success: true,
        message: '系统设置保存成功',
        data: results
      });
    } catch (error) {
      logger.error('保存系统设置失败:', error);
      res.status(500).json({
        success: false,
        message: '保存系统设置失败',
        error: error.message
      });
    }
  }

  // 删除配置
  async deleteConfig(req, res) {
    try {
      const { key } = req.params;
      await configService.deleteConfig(key);
      
      res.json({
        success: true,
        message: '配置删除成功'
      });
    } catch (error) {
      logger.error('删除配置失败:', error);
      res.status(500).json({
        success: false,
        message: '删除配置失败',
        error: error.message
      });
    }
  }

  // 测试LLM连接
  async testLLMConnection(req, res) {
    try {
      const { apiUrl, apiKey, model } = req.body;
      
      if (!apiUrl || !apiKey || !model) {
        return res.status(400).json({
          success: false,
          message: 'API地址、密钥和模型都是必填项'
        });
      }
      
      const result = await configService.testLLMConnection(apiUrl, apiKey, model);
      
      res.json(result);
    } catch (error) {
      logger.error('测试LLM连接失败:', error);
      res.status(500).json({
        success: false,
        message: '测试LLM连接失败',
        error: error.message
      });
    }
  }

  // 测试TTS连接
  async testTTSConnection(req, res) {
    try {
      const { apiUrl, appId, apiKey, apiSecret, voice } = req.body;
      
      if (!apiUrl || !appId || !apiKey || !apiSecret || !voice) {
        return res.status(400).json({
          success: false,
          message: 'apiUrl、appId、apiKey、apiSecret和voice都是必填项'
        });
      }
      
      const result = await xunfeiTtsService.testConnection({
        apiUrl,
        appId,
        apiKey,
        apiSecret,
        voice
      });
      
      res.json(result);
    } catch (error) {
      logger.error('测试TTS连接失败:', error);
      res.status(500).json({
        success: false,
        message: '测试TTS连接失败',
        error: error.message
      });
    }
  }

  // 重置配置为默认值
  async resetToDefaults(req, res) {
    try {
      const defaultConfigs = {
        llm_api_url: {
          value: 'https://api.deepseek.com/v1/chat/completions',
          description: 'LLM API地址',
          type: 'string',
          isEncrypted: false
        },
        llm_api_key: {
          value: '',
          description: 'LLM API密钥',
          type: 'string',
          isEncrypted: true
        },
        llm_model: {
          value: 'deepseek-chat',
          description: 'LLM模型名称',
          type: 'string',
          isEncrypted: false
        },
        tts_api_url: {
          value: 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6',
          description: 'TTS API地址',
          type: 'string',
          isEncrypted: false
        },
        tts_app_id: {
          value: '',
          description: 'TTS App ID',
          type: 'string',
          isEncrypted: false
        },
        tts_api_key: {
          value: '',
          description: 'TTS API Key',
          type: 'string',
          isEncrypted: true
        },
        tts_api_secret: {
          value: '',
          description: 'TTS API Secret',
          type: 'string',
          isEncrypted: true
        },
        tts_voice: {
          value: 'x5_lingfeiyi_flow',
          description: 'TTS发音人',
          type: 'string',
          isEncrypted: false
        },
        http_proxy: {
          value: '',
          description: 'HTTP代理地址 (可选)',
          type: 'string',
          isEncrypted: false
        },
        https_proxy: {
          value: '',
          description: 'HTTPS代理地址 (可选)',
          type: 'string',
          isEncrypted: false
        },
        no_proxy: {
          value: '',
          description: '不使用代理的地址列表 (可选)',
          type: 'string',
          isEncrypted: false
        },
        rss_fetch_interval: {
          value: 3600000,
          description: 'RSS抓取间隔(毫秒)',
          type: 'number',
          isEncrypted: false
        },
        news_retention_hours: {
          value: 24,
          description: '新闻保留时间(小时)',
          type: 'number',
          isEncrypted: false
        },
        dialogue_news_count: {
          value: 5,
          description: '对话使用的新闻数量',
          type: 'number',
          isEncrypted: false
        },
        dialogue_rounds: {
          value: 8,
          description: '对话轮次',
          type: 'number',
          isEncrypted: false
        }
      };
      
      const results = await configService.setConfigs(defaultConfigs);
      
      res.json({
        success: true,
        message: '配置已重置为默认值',
        data: results
      });
    } catch (error) {
      logger.error('重置配置失败:', error);
      res.status(500).json({
        success: false,
        message: '重置配置失败',
        error: error.message
      });
    }
  }
}

module.exports = new ConfigController(); 
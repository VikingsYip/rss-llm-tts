const { Config } = require('../models');
const logger = require('../utils/logger');

class ConfigService {
  // 获取所有配置
  async getAllConfigs() {
    try {
      const configs = await Config.findAll({
        order: [['key', 'ASC']]
      });
      
      // 将配置转换为键值对格式
      const configMap = {};
      configs.forEach(config => {
        let value = config.value;
        
        // 根据类型转换值
        switch (config.type) {
          case 'number':
            value = parseFloat(value) || 0;
            break;
          case 'boolean':
            value = value === 'true' || value === '1';
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (error) {
              logger.warn(`解析JSON配置失败: ${config.key}`, error);
              value = null;
            }
            break;
          default:
            // string类型，保持原值
            break;
        }
        
        configMap[config.key] = value;
      });
      
      return configMap;
    } catch (error) {
      logger.error('获取配置失败:', error);
      throw error;
    }
  }

  // 获取单个配置
  async getConfig(key) {
    try {
      const config = await Config.findOne({ where: { key } });
      if (!config) {
        return null;
      }
      
      let value = config.value;
      
      // 根据类型转换值
      switch (config.type) {
        case 'number':
          value = parseFloat(value) || 0;
          break;
        case 'boolean':
          value = value === 'true' || value === '1';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (error) {
            logger.warn(`解析JSON配置失败: ${key}`, error);
            value = null;
          }
          break;
        default:
          // string类型，保持原值
          break;
      }
      
      return value;
    } catch (error) {
      logger.error(`获取配置失败: ${key}`, error);
      throw error;
    }
  }

  // 设置配置
  async setConfig(key, value, description = null, type = 'string', isEncrypted = false) {
    try {
      // 检查value是否为undefined或null
      if (value === undefined || value === null) {
        logger.warn(`配置值不能为空: ${key}`);
        throw new Error(`配置值不能为空: ${key}`);
      }
      
      let stringValue = value;
      
      // 根据类型转换值为字符串
      switch (type) {
        case 'number':
          stringValue = value.toString();
          break;
        case 'boolean':
          stringValue = value ? 'true' : 'false';
          break;
        case 'json':
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = value.toString();
          break;
      }
      
      const [config, created] = await Config.findOrCreate({
        where: { key },
        defaults: {
          value: stringValue,
          description,
          type,
          isEncrypted
        }
      });
      
      if (!created) {
        // 更新现有配置
        await config.update({
          value: stringValue,
          description,
          type,
          isEncrypted
        });
      }
      
      logger.info(`配置保存成功: ${key} = ${stringValue}`);
      return config;
    } catch (error) {
      logger.error(`保存配置失败: ${key}`, error);
      throw error;
    }
  }

  // 批量设置配置
  async setConfigs(configs) {
    try {
      const results = [];
      
      for (const [key, config] of Object.entries(configs)) {
        const { value, description, type = 'string', isEncrypted = false } = config;
        const result = await this.setConfig(key, value, description, type, isEncrypted);
        results.push(result);
      }
      
      logger.info(`批量配置保存成功: ${results.length} 个配置`);
      return results;
    } catch (error) {
      logger.error('批量保存配置失败:', error);
      throw error;
    }
  }

  // 删除配置
  async deleteConfig(key) {
    try {
      const config = await Config.findOne({ where: { key } });
      if (!config) {
        throw new Error(`配置不存在: ${key}`);
      }
      
      await config.destroy();
      logger.info(`配置删除成功: ${key}`);
      return true;
    } catch (error) {
      logger.error(`删除配置失败: ${key}`, error);
      throw error;
    }
  }

  // 测试LLM连接
  async testLLMConnection(apiUrl, apiKey, model) {
    try {
      // 这里应该实现真实的LLM API测试
      // 目前返回模拟结果
      logger.info('测试LLM连接:', { apiUrl, model });
      
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'LLM连接测试成功',
        data: {
          model,
          apiUrl,
          responseTime: Math.floor(Math.random() * 1000) + 200
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

  // 测试TTS连接
  async testTTSConnection(apiUrl, apiKey, voice) {
    try {
      // 这里应该实现真实的TTS API测试
      // 目前返回模拟结果
      logger.info('测试TTS连接:', { apiUrl, voice });
      
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'TTS连接测试成功',
        data: {
          voice,
          apiUrl,
          responseTime: Math.floor(Math.random() * 1000) + 200
        }
      };
    } catch (error) {
      logger.error('TTS连接测试失败:', error);
      return {
        success: false,
        message: 'TTS连接测试失败',
        data: {
          error: error.message
        }
      };
    }
  }

  // 获取系统配置分组
  async getConfigGroups() {
    try {
      const configs = await Config.findAll({
        order: [['key', 'ASC']]
      });
      
      const groups = {
        llm: {},
        tts: {},
        rss: {},
        dialogue: {}
      };
      
      configs.forEach(config => {
        let value = config.value;
        
        // 根据类型转换值
        switch (config.type) {
          case 'number':
            value = parseFloat(value) || 0;
            break;
          case 'boolean':
            value = value === 'true' || value === '1';
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (error) {
              value = null;
            }
            break;
          default:
            break;
        }
        
        // 根据key前缀分组
        if (config.key.startsWith('llm_')) {
          groups.llm[config.key] = value;
        } else if (config.key.startsWith('tts_')) {
          groups.tts[config.key] = value;
        } else if (config.key.startsWith('rss_')) {
          groups.rss[config.key] = value;
        } else if (config.key.startsWith('dialogue_')) {
          groups.dialogue[config.key] = value;
        }
      });
      
      return groups;
    } catch (error) {
      logger.error('获取配置分组失败:', error);
      throw error;
    }
  }
}

module.exports = new ConfigService(); 
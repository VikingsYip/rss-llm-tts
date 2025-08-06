const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { Config } = require('../models');
const { decrypt } = require('../utils/encryption');

class TTSService {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
    this.voice = null;
    this.uploadPath = null;
  }

  // 初始化配置
  async initialize() {
    try {
      this.apiUrl = await this.getConfigValue('tts_api_url');
      this.apiKey = await this.getConfigValue('tts_api_key');
      this.voice = await this.getConfigValue('tts_voice');
      this.uploadPath = process.env.UPLOAD_PATH || './uploads';
      
      // 确保上传目录存在
      await this.ensureUploadDir();
      
      if (!this.apiUrl || !this.apiKey) {
        throw new Error('TTS API配置不完整');
      }
    } catch (error) {
      logger.error('TTS服务初始化失败:', error);
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

  // 确保上传目录存在
  async ensureUploadDir() {
    try {
      await fs.access(this.uploadPath);
    } catch (error) {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  // 生成语音文件
  async generateSpeech(text, filename, voice = null) {
    try {
      await this.initialize();
      
      const useVoice = voice || this.voice;
      const audioData = await this.callTTSAPI(text, useVoice);
      
      // 保存音频文件
      const filePath = path.join(this.uploadPath, filename);
      await fs.writeFile(filePath, audioData);
      
      logger.info(`语音文件生成成功: ${filename}`);
      return {
        success: true,
        filePath: filePath,
        filename: filename,
        size: audioData.length
      };
    } catch (error) {
      logger.error('生成语音文件失败:', error);
      throw error;
    }
  }

  // 为对话生成语音
  async generateDialogueSpeech(dialogue, dialogueId) {
    try {
      await this.initialize();
      
      const filename = `dialogue_${dialogueId}_${Date.now()}.mp3`;
      const filePath = path.join(this.uploadPath, filename);
      
      // 为不同角色设置不同音色
      const character1Voice = 'alloy'; // 男声
      const character2Voice = 'nova';  // 女声
      
      let allAudioData = Buffer.alloc(0);
      
      for (const turn of dialogue) {
        const voice = turn.speaker === dialogue.character1 ? character1Voice : character2Voice;
        const audioData = await this.callTTSAPI(turn.content, voice);
        allAudioData = Buffer.concat([allAudioData, audioData]);
        
        // 添加短暂停顿
        const silence = Buffer.alloc(44100 * 2); // 2秒静音
        allAudioData = Buffer.concat([allAudioData, silence]);
      }
      
      // 保存完整音频文件
      await fs.writeFile(filePath, allAudioData);
      
      logger.info(`对话语音文件生成成功: ${filename}`);
      return {
        success: true,
        filePath: filePath,
        filename: filename,
        size: allAudioData.length,
        duration: Math.ceil(allAudioData.length / 44100) // 估算时长
      };
    } catch (error) {
      logger.error('生成对话语音失败:', error);
      throw error;
    }
  }

  // 调用TTS API
  async callTTSAPI(text, voice) {
    try {
      const response = await axios.post(this.apiUrl, {
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.0
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('TTS API调用失败:', error);
      throw new Error('TTS服务调用失败');
    }
  }

  // 测试TTS连接
  async testConnection() {
    try {
      await this.initialize();
      
      const testText = '你好，这是TTS连接测试。';
      const audioData = await this.callTTSAPI(testText, this.voice);
      
      return {
        success: true,
        message: 'TTS连接测试成功',
        audioSize: audioData.length
      };
    } catch (error) {
      logger.error('TTS连接测试失败:', error);
      return {
        success: false,
        message: 'TTS连接测试失败',
        error: error.message
      };
    }
  }

  // 获取可用的语音列表
  getAvailableVoices() {
    return [
      { value: 'alloy', label: 'Alloy (男声)', gender: 'male' },
      { value: 'echo', label: 'Echo (男声)', gender: 'male' },
      { value: 'fable', label: 'Fable (男声)', gender: 'male' },
      { value: 'onyx', label: 'Onyx (男声)', gender: 'male' },
      { value: 'nova', label: 'Nova (女声)', gender: 'female' },
      { value: 'shimmer', label: 'Shimmer (女声)', gender: 'female' }
    ];
  }

  // 删除音频文件
  async deleteAudioFile(filename) {
    try {
      const filePath = path.join(this.uploadPath, filename);
      await fs.unlink(filePath);
      logger.info(`音频文件删除成功: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`删除音频文件失败: ${filename}`, error);
      return false;
    }
  }

  // 获取音频文件信息
  async getAudioFileInfo(filename) {
    try {
      const filePath = path.join(this.uploadPath, filename);
      const stats = await fs.stat(filePath);
      
      return {
        filename: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error(`获取音频文件信息失败: ${filename}`, error);
      return null;
    }
  }
}

module.exports = new TTSService(); 
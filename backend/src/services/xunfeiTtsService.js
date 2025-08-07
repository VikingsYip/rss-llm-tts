const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const logger = require('../utils/logger');

class XunfeiTtsService {
  constructor() {
    this.baseUrl = 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6';
  }

  // 获取代理配置
  async getProxyConfig() {
    // 从环境变量获取代理设置
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    
    // 优先使用HTTPS代理，如果没有则使用HTTP代理
    let proxyUrl = httpsProxy || httpProxy;
    
    // 如果没有环境变量代理，尝试从系统配置中获取
    if (!proxyUrl) {
      try {
        const configService = require('./configService');
        const configs = await configService.getAllConfigs();
        
        // 从系统配置中获取代理设置
        const systemHttpsProxy = configs.https_proxy;
        const systemHttpProxy = configs.http_proxy;
        
        if (systemHttpsProxy) {
          proxyUrl = systemHttpsProxy;
          logger.info(`从系统配置获取HTTPS代理: ${proxyUrl}`);
        } else if (systemHttpProxy) {
          proxyUrl = systemHttpProxy;
          logger.info(`从系统配置获取HTTP代理: ${proxyUrl}`);
        }
      } catch (error) {
        logger.debug('无法从系统配置获取代理设置:', error.message);
      }
    }
    
    if (proxyUrl) {
      logger.info(`使用代理: ${proxyUrl}`);
      return new HttpsProxyAgent(proxyUrl);
    }
    
    logger.debug('未配置代理，使用直接连接');
    return null;
  }

  // 生成鉴权URL
  generateAuthUrl(apiKey, apiSecret) {
    const host = 'cbm01.cn-huabei-1.xf-yun.com';
    const path = '/v1/private/mcd9m97e6';
    const date = new Date().toUTCString();
    
    // 生成签名字符串
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    
    // 使用HMAC-SHA256生成签名
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');
    
    // 生成authorization字符串
    const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorizationBase64 = Buffer.from(authorization).toString('base64');
    
    // 生成最终URL
    const url = `${this.baseUrl}?authorization=${encodeURIComponent(authorizationBase64)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
    
    return url;
  }

  // 生成TTS音频
  async generateTTS(config, text, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info('开始科大讯飞TTS音频生成');
        
        // 解析配置
        const { apiKey, apiSecret, appId, voice = 'x5_lingfeiyi_flow' } = config;
        
        if (!apiKey || !apiSecret || !appId) {
          throw new Error('科大讯飞TTS配置不完整，缺少apiKey、apiSecret或appId');
        }

        // 生成鉴权URL
        const wsUrl = this.generateAuthUrl(apiKey, apiSecret);
        
        // 获取代理配置
        let proxyAgent = null;
        try {
          proxyAgent = await this.getProxyConfig();
        } catch (error) {
          logger.warn('获取代理配置失败，使用直接连接:', error.message);
        }
        
        // 创建WebSocket连接
        const wsOptions = {};
        if (proxyAgent) {
          wsOptions.agent = proxyAgent;
        }
        
        const ws = new WebSocket(wsUrl, wsOptions);
        
        // 音频数据缓存
        const audioChunks = [];
        let isConnected = false;
        let hasReceivedData = false;
        
        // 连接超时处理（增加到30秒）
        const connectionTimeout = setTimeout(() => {
          if (!isConnected) {
            logger.error('WebSocket连接超时');
            ws.close();
            reject(new Error('WebSocket连接超时'));
          }
        }, 30000);

        // 数据传输超时处理（60秒）
        const dataTimeout = setTimeout(() => {
          if (!hasReceivedData) {
            logger.error('数据传输超时');
            ws.close();
            reject(new Error('数据传输超时，未接收到音频数据'));
          }
        }, 60000);

        ws.on('open', () => {
          logger.info('WebSocket连接已建立');
          isConnected = true;
          clearTimeout(connectionTimeout);
          
          // 发送TTS请求
          const requestData = {
            common: {
              app_id: appId
            },
            business: {
              aue: 'raw',
              sfl: 1,
              auf: 'audio/L16;rate=16000',
              vcn: voice,
              speed: 50,
              volume: 50,
              pitch: 50,
              bgs: 0,
              tte: 'UTF8'
            },
            data: {
              status: 2,
              text: Buffer.from(text).toString('base64')
            }
          };
          
          ws.send(JSON.stringify(requestData));
        });

        ws.on('message', (data) => {
          hasReceivedData = true;
          clearTimeout(dataTimeout);
          
          try {
            const response = JSON.parse(data);
            
            if (response.code !== 0) {
              logger.error('科大讯飞TTS错误:', response.message);
              ws.close();
              reject(new Error(`科大讯飞TTS错误: ${response.message}`));
              return;
            }
            
            if (response.data && response.data.audio) {
              // 解码音频数据
              const audioData = Buffer.from(response.data.audio, 'base64');
              audioChunks.push(audioData);
            }
            
            if (response.data && response.data.status === 2) {
              // 音频生成完成
              logger.info('科大讯飞TTS音频生成完成');
              ws.close();
              
              // 合并所有音频数据
              const finalAudio = Buffer.concat(audioChunks);
              
              // 保存音频文件
              fs.writeFileSync(outputPath, finalAudio);
              
              resolve({
                success: true,
                audioPath: outputPath,
                audioSize: finalAudio.length,
                duration: this.estimateDuration(text)
              });
            }
          } catch (error) {
            logger.error('解析WebSocket消息失败:', error);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          logger.error('WebSocket连接错误:', error);
          clearTimeout(connectionTimeout);
          clearTimeout(dataTimeout);
          reject(error);
        });

        ws.on('close', (code, reason) => {
          logger.info(`WebSocket连接已关闭: ${code} - ${reason}`);
          clearTimeout(connectionTimeout);
          clearTimeout(dataTimeout);
        });

      } catch (error) {
        logger.error('科大讯飞TTS生成失败:', error);
        reject(error);
      }
    });
  }

  // 生成多发音人TTS音频（用于对话）
  async generateMultiVoiceTTS(config, dialogueContent, outputPath) {
    try {
      logger.info('开始科大讯飞多发音人TTS音频生成');
      
      // 获取配置的主持人和嘉宾发音人
      const configService = require('./configService');
      const configs = await configService.getAllConfigs();
      const hostVoice = configs.tts_voice_host || 'x5_lingfeiyi_flow';
      const guestVoice = configs.tts_voice_guest || 'xiaoyan';

      let allAudioData = Buffer.alloc(0);
      
      // 为每个对话轮次生成音频
      for (const round of dialogueContent.rounds) {
        // 根据说话者选择发音人
        let voice = hostVoice; // 默认使用主持人发音人
        if (round.speaker.includes('嘉宾') || round.speaker.includes('专家') || round.speaker.includes('CEO')) {
          voice = guestVoice;
        }
        
        logger.info(`为 ${round.speaker} 生成音频，使用发音人: ${voice}`);

        // 创建临时文件路径
        const tempPath = `${outputPath}_temp_${Date.now()}.pcm`;
        
        // 生成单个音频
        const result = await this.generateTTS({
          ...config,
          voice: voice
        }, `${round.speaker}：${round.text}`, tempPath);
        
        // 读取音频数据
        const audioData = fs.readFileSync(tempPath);
        allAudioData = Buffer.concat([allAudioData, audioData]);
        
        // 添加短暂停顿（静音）
        const silence = Buffer.alloc(32000); // 2秒静音（16kHz采样率）
        allAudioData = Buffer.concat([allAudioData, silence]);
        
        // 删除临时文件
        fs.unlinkSync(tempPath);
      }

      // 保存完整音频文件
      fs.writeFileSync(outputPath, allAudioData);
      
      logger.info(`科大讯飞多发音人音频生成完成: ${outputPath}`);
      return {
        success: true,
        audioPath: outputPath,
        audioSize: allAudioData.length,
        duration: this.estimateDuration(dialogueContent.rounds.map(r => r.text).join(''))
      };

    } catch (error) {
      logger.error('科大讯飞多发音人TTS生成失败:', error);
      throw error;
    }
  }

  // 估算音频时长（秒）
  estimateDuration(text) {
    const charactersPerMinute = 200;
    const durationMinutes = text.length / charactersPerMinute;
    return Math.ceil(durationMinutes * 60);
  }

  // 测试TTS连接
  async testConnection(config) {
    const testText = '这是一个测试语音合成的文本。';
    const testPath = path.join(__dirname, '../../uploads/test_tts.mp3');
    
    try {
      logger.info('开始TTS连接测试');
      
      const parsedConfig = this.parseTtsConfig(config);
      logger.info('TTS配置验证通过');
      
      const startTime = Date.now();
      const result = await this.generateTTS(parsedConfig, testText, testPath);
      const responseTime = Date.now() - startTime;
      
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
        logger.info('测试音频文件已清理');
      }
      
      logger.info(`TTS连接测试成功，响应时间: ${responseTime}ms`);
      
      return {
        success: true,
        responseTime,
        message: 'TTS连接测试成功'
      };
    } catch (error) {
      logger.error('TTS连接测试失败:', error.message);
      
      if (fs.existsSync(testPath)) {
        try {
          fs.unlinkSync(testPath);
        } catch (cleanupError) {
          logger.warn('清理测试文件失败:', cleanupError.message);
        }
      }
      
      let errorMessage = error.message;
      if (error.message.includes('WebSocket连接超时')) {
        errorMessage = 'TTS连接超时，请检查网络连接和API凭据';
      } else if (error.message.includes('数据传输超时')) {
        errorMessage = 'TTS数据传输超时，可能是文本过长或网络不稳定';
      } else if (error.message.includes('401')) {
        errorMessage = 'TTS认证失败，请检查API凭据是否正确';
      } else if (error.message.includes('403')) {
        errorMessage = 'TTS权限不足，请检查发音人权限是否已开通';
      } else if (error.message.includes('429')) {
        errorMessage = 'TTS请求频率过高，请稍后重试';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: error.message
      };
    }
  }

  // 解析科大讯飞TTS配置
  parseTtsConfig(ttsConfig) {
    let { apiUrl, appId, apiKey, apiSecret, voice } = ttsConfig;
    
    if (!appId || !apiKey || !apiSecret) {
      if (apiKey && apiKey.includes(':')) {
        const parts = apiKey.split(':');
        if (parts.length === 3) {
          [appId, apiKey, apiSecret] = parts;
        } else {
          throw new Error('TTS API密钥格式错误，应为 "appId:apiKey:apiSecret"');
        }
      } else {
        throw new Error('请配置完整的科大讯飞TTS凭据 (appId、apiKey、apiSecret)');
      }
    }
    
    return {
      appId: appId.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      voice: voice || 'x5_lingfeiyi_flow'
    };
  }
}

module.exports = new XunfeiTtsService(); 
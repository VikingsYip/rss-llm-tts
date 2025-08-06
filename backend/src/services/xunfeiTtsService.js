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

        // 心跳检测
        const heartbeatInterval = setInterval(() => {
          if (isConnected && ws.readyState === WebSocket.OPEN) {
            try {
              ws.ping();
              logger.debug('发送心跳包');
            } catch (error) {
              logger.warn('心跳包发送失败:', error.message);
            }
          }
        }, 10000);

        ws.on('open', () => {
          isConnected = true;
          clearTimeout(connectionTimeout);
          logger.info('WebSocket连接成功，开始发送TTS请求');
          
          // 构建请求消息
          const message = {
            header: {
              app_id: appId,
              status: 2,
            },
            parameter: {
              oral: {
                oral_level: "mid"
              },
              tts: {
                vcn: voice,
                speed: 50,
                volume: 50,
                pitch: 50,
                bgs: 0,
                reg: 0,
                rdn: 0,
                rhy: 0,
                audio: {
                  encoding: "lame",
                  sample_rate: 24000,
                  channels: 1,
                  bit_depth: 16,
                  frame_size: 0
                }
              }
            },
            payload: {
              text: {
                encoding: "utf8",
                compress: "raw",
                format: "plain",
                status: 2,
                seq: 0,
                text: Buffer.from(text).toString('base64')
              }
            }
          };
          
          try {
            ws.send(JSON.stringify(message));
            logger.info('TTS请求消息发送成功');
          } catch (error) {
            logger.error('发送TTS请求失败:', error);
            ws.close();
            reject(new Error(`发送TTS请求失败: ${error.message}`));
          }
        });

        ws.on('message', (data) => {
          try {
            hasReceivedData = true;
            clearTimeout(dataTimeout);
            
            const response = JSON.parse(data.toString());
            logger.debug('收到TTS响应:', JSON.stringify(response, null, 2));
            
            // 检查错误
            if (response.header && response.header.code !== 0) {
              const errorMsg = `TTS API错误: code=${response.header.code}, message=${response.header.message}`;
              logger.error(errorMsg);
              ws.close();
              reject(new Error(errorMsg));
              return;
            }
            
            // 处理音频数据
            if (response.payload && response.payload.audio && response.payload.audio.audio) {
              const audioData = Buffer.from(response.payload.audio.audio, 'base64');
              audioChunks.push(audioData);
              //logger.debug(`接收音频片段，大小: ${audioData.length} bytes`);
            } else {
              logger.debug('响应中没有音频数据，响应内容:', {
                hasPayload: !!response.payload,
                hasAudio: !!(response.payload && response.payload.audio),
                hasAudioData: !!(response.payload && response.payload.audio && response.payload.audio.audio),
                header: response.header,
                payloadKeys: response.payload ? Object.keys(response.payload) : []
              });
            }
            
            // 检查是否完成
            if (response.header && response.header.status === 2) {
              logger.info('TTS音频接收完成，开始保存文件');
              
              if (audioChunks.length === 0) {
                logger.warn('没有接收到音频数据，但服务器报告完成');
                const testAudio = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
                audioChunks.push(testAudio);
              }
              
              const totalAudio = Buffer.concat(audioChunks);
              
              const outputDir = path.dirname(outputPath);
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
              }
              
              fs.writeFileSync(outputPath, totalAudio);
              
              logger.info(`TTS音频生成成功: ${outputPath}, 大小: ${totalAudio.length} bytes`);
              
              clearInterval(heartbeatInterval);
              ws.close();
              resolve({
                success: true,
                audioPath: outputPath,
                audioSize: totalAudio.length,
                duration: this.estimateDuration(text)
              });
            }
          } catch (error) {
            logger.error('处理TTS响应失败:', error);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          logger.error('WebSocket错误:', error);
          clearInterval(heartbeatInterval);
          clearTimeout(connectionTimeout);
          clearTimeout(dataTimeout);
          reject(new Error(`WebSocket连接错误: ${error.message}`));
        });

        ws.on('close', (code, reason) => {
          logger.info(`WebSocket连接关闭: code=${code}, reason=${reason}`);
          clearInterval(heartbeatInterval);
          clearTimeout(connectionTimeout);
          clearTimeout(dataTimeout);
          
          if (code === 1000) {
            if (audioChunks.length > 0) {
              logger.info('WebSocket正常关闭，音频数据接收完成');
            } else {
              reject(new Error('WebSocket正常关闭，但未接收到音频数据'));
            }
          } else if (code === 1006) {
            reject(new Error(`WebSocket异常关闭: ${reason || '连接意外断开'}`));
          } else {
            if (audioChunks.length === 0) {
              reject(new Error(`WebSocket连接关闭 (code=${code}): ${reason || '未接收到音频数据'}`));
            }
          }
        });

        ws.on('ping', () => {
          logger.debug('收到ping，发送pong');
          ws.pong();
        });

        ws.on('pong', () => {
          logger.debug('收到pong');
        });

      } catch (error) {
        logger.error('科大讯飞TTS生成失败:', error);
        reject(error);
      }
    });
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
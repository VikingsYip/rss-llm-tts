const xunfeiTtsService = require('./src/services/xunfeiTtsService');
const path = require('path');

async function debugTtsResponse() {
  console.log('TTS响应调试');
  console.log('============\n');
  
  // 测试配置
  const testConfig = {
    apiUrl: 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6',
    appId: '57a8d6ad',
    apiKey: '1617c1acf53abbcd19ed2a17dda7502c',
    apiSecret: 'ZDdlZjVjMDc4ZjYzYmI0OWNiMWJmYzc2',
    voice: 'xiaoyan'
  };
  
  const testText = '你好，这是一个测试。';
  const testPath = path.join(__dirname, 'uploads', 'debug_test.mp3');
  
  try {
    console.log('1. 解析配置...');
    const parsedConfig = xunfeiTtsService.parseTtsConfig(testConfig);
    console.log('✅ 配置解析成功');
    console.log('   配置详情:', {
      appId: parsedConfig.appId,
      apiKey: parsedConfig.apiKey.substring(0, 8) + '****',
      apiSecret: parsedConfig.apiSecret.substring(0, 8) + '****',
      voice: parsedConfig.voice
    });
    
    console.log('\n2. 生成鉴权URL...');
    const authUrl = xunfeiTtsService.generateAuthUrl(parsedConfig.apiKey, parsedConfig.apiSecret);
    console.log('✅ 鉴权URL生成成功');
    console.log('   URL:', authUrl.substring(0, 100) + '...');
    
    console.log('\n3. 发送TTS请求...');
    console.log('   请求文本:', testText);
    console.log('   发音人:', parsedConfig.voice);
    
    // 手动创建WebSocket连接来调试
    const WebSocket = require('ws');
    const crypto = require('crypto');
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(authUrl);
      
      ws.on('open', () => {
        console.log('✅ WebSocket连接成功');
        
        // 构建请求消息
        const message = {
          header: {
            app_id: parsedConfig.appId,
            status: 2,
          },
          parameter: {
            oral: {
              oral_level: "mid"
            },
            tts: {
              vcn: parsedConfig.voice,
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
              text: Buffer.from(testText).toString('base64')
            }
          }
        };
        
        console.log('📤 发送请求消息:');
        console.log(JSON.stringify(message, null, 2));
        
        ws.send(JSON.stringify(message));
      });
      
      ws.on('message', (data) => {
        console.log('\n📥 收到响应:');
        console.log('原始数据长度:', data.length);
        console.log('原始数据:', data.toString());
        
        try {
          const response = JSON.parse(data.toString());
          console.log('\n解析后的响应:');
          console.log(JSON.stringify(response, null, 2));
          
          // 分析响应结构
          console.log('\n📊 响应分析:');
          console.log('- 是否有header:', !!response.header);
          if (response.header) {
            console.log('- header.code:', response.header.code);
            console.log('- header.status:', response.header.status);
            console.log('- header.message:', response.header.message);
          }
          
          console.log('- 是否有payload:', !!response.payload);
          if (response.payload) {
            console.log('- payload键:', Object.keys(response.payload));
            if (response.payload.audio) {
              console.log('- 是否有audio:', !!response.payload.audio);
              console.log('- audio键:', Object.keys(response.payload.audio));
            }
          }
          
          // 检查错误
          if (response.header && response.header.code !== 0) {
            console.log('\n❌ API错误:');
            console.log('错误代码:', response.header.code);
            console.log('错误信息:', response.header.message);
            ws.close();
            reject(new Error(`API错误: ${response.header.code} - ${response.header.message}`));
            return;
          }
          
          // 检查完成状态
          if (response.header && response.header.status === 2) {
            console.log('\n✅ TTS处理完成');
            ws.close();
            resolve(response);
          }
          
        } catch (parseError) {
          console.log('\n❌ 响应解析失败:', parseError.message);
          console.log('原始数据:', data.toString());
        }
      });
      
      ws.on('error', (error) => {
        console.log('\n❌ WebSocket错误:', error.message);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        console.log('\n🔌 WebSocket关闭:');
        console.log('关闭代码:', code);
        console.log('关闭原因:', reason);
        
        if (code === 1000) {
          console.log('✅ 正常关闭');
        } else {
          console.log('❌ 异常关闭');
        }
      });
      
      // 设置超时
      setTimeout(() => {
        console.log('\n⏰ 调试超时');
        ws.close();
        resolve(null);
      }, 10000);
    });
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
debugTtsResponse(); 
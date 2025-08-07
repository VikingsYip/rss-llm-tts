const WebSocket = require('ws');
const crypto = require('crypto');

// 调试科大讯飞TTS响应问题
function debugXunfeiResponse() {
  console.log('科大讯飞TTS响应调试工具');
  console.log('========================\n');
  
  // 测试配置 - 请替换为您的实际配置
  const testConfig = {
    appId: 'your_app_id_here',
    apiKey: 'your_api_key_here', 
    apiSecret: 'your_api_secret_here',
    voice: 'xiaoyan'
  };
  
  // 生成鉴权URL
  function generateAuthUrl(apiKey, apiSecret) {
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
    const baseUrl = 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6';
    const url = `${baseUrl}?authorization=${encodeURIComponent(authorizationBase64)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
    
    return url;
  }
  
  // 调试WebSocket连接
  async function debugWebSocketConnection(wsUrl, appId, voice) {
    return new Promise((resolve, reject) => {
      console.log('开始WebSocket连接调试...');
      console.log('WebSocket URL:', wsUrl.substring(0, 100) + '...');
      
      const ws = new WebSocket(wsUrl);
      
      const connectionTimeout = setTimeout(() => {
        console.log('❌ WebSocket连接超时');
        ws.close();
        reject(new Error('WebSocket连接超时'));
      }, 15000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket连接已建立');
        clearTimeout(connectionTimeout);
        
        // 发送测试TTS请求
        const requestData = {
          header: {
            app_id: appId,
            status: 2
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
              text: Buffer.from('这是一个测试语音合成的文本。').toString('base64')
            }
          }
        };
        
        console.log('发送TTS请求数据:');
        console.log(JSON.stringify(requestData, null, 2));
        ws.send(JSON.stringify(requestData));
      });
      
      ws.on('message', (data) => {
        console.log('\n=== 收到WebSocket消息 ===');
        console.log('原始数据长度:', data.length);
        console.log('数据类型:', typeof data);
        
        // 尝试解析为JSON
        try {
          const response = JSON.parse(data);
          console.log('✅ JSON解析成功');
          console.log('响应结构:');
          console.log(JSON.stringify(response, null, 2));
          
          // 分析响应结构
          console.log('\n=== 响应分析 ===');
          console.log('响应类型:', typeof response);
          console.log('是否为对象:', typeof response === 'object');
          console.log('响应键:', Object.keys(response));
          
          if (response.header && response.header.code !== undefined) {
            console.log('错误代码:', response.header.code);
            console.log('错误消息:', response.header.message || 'undefined');
          }
          
          if (response.payload) {
            console.log('数据字段存在:', !!response.payload);
            console.log('数据字段类型:', typeof response.payload);
            if (response.payload.audio) {
              console.log('音频数据存在:', !!response.payload.audio);
              console.log('音频数据键:', Object.keys(response.payload.audio));
            }
          }
          
          // 检查是否为错误响应
          if (response.header && response.header.code !== undefined && response.header.code !== 0) {
            console.log('❌ 检测到错误响应');
            ws.close();
            reject(new Error(`TTS错误 (${response.header.code}): ${response.header.message || '未知错误'}`));
            return;
          }
          
          // 检查音频生成完成
          if (response.header && response.header.status === 2) {
            console.log('✅ 音频生成完成');
            ws.close();
            resolve('TTS调试成功');
          }
          
        } catch (parseError) {
          console.log('❌ JSON解析失败');
          console.log('解析错误:', parseError.message);
          console.log('原始数据 (前200字符):', data.toString().substring(0, 200));
          console.log('原始数据 (hex):', data.toString('hex').substring(0, 100));
          
          // 检查是否是HTTP响应
          const dataStr = data.toString();
          if (dataStr.includes('HTTP/1.1')) {
            console.log('⚠️  检测到HTTP响应而不是WebSocket消息');
            console.log('这可能表示WebSocket握手失败');
            
            // 解析HTTP响应
            const lines = dataStr.split('\n');
            const statusLine = lines[0];
            console.log('HTTP状态行:', statusLine);
            
            // 提取状态码
            const statusMatch = statusLine.match(/HTTP\/1\.1 (\d+)/);
            if (statusMatch) {
              const statusCode = parseInt(statusMatch[1]);
              console.log('HTTP状态码:', statusCode);
              
              switch (statusCode) {
                case 401:
                  reject(new Error('HTTP 401: 认证失败，请检查API凭据'));
                  break;
                case 403:
                  reject(new Error('HTTP 403: 权限不足，请检查发音人权限'));
                  break;
                case 404:
                  reject(new Error('HTTP 404: 服务地址不存在，请检查API配置'));
                  break;
                case 500:
                  reject(new Error('HTTP 500: 服务器内部错误'));
                  break;
                default:
                  reject(new Error(`HTTP ${statusCode}: 未知错误`));
              }
            } else {
              reject(new Error('无法解析HTTP状态码'));
            }
          } else {
            reject(new Error(`无法解析响应数据: ${parseError.message}`));
          }
          
          ws.close();
        }
      });
      
      ws.on('error', (error) => {
        console.log('\n=== WebSocket错误 ===');
        console.log('错误类型:', error.constructor.name);
        console.log('错误消息:', error.message);
        console.log('错误代码:', error.code);
        console.log('错误编号:', error.errno);
        console.log('系统调用:', error.syscall);
        console.log('地址:', error.address);
        console.log('端口:', error.port);
        
        clearTimeout(connectionTimeout);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        console.log('\n=== WebSocket连接关闭 ===');
        console.log('关闭代码:', code);
        console.log('关闭原因:', reason);
        clearTimeout(connectionTimeout);
      });
    });
  }
  
  // 运行调试
  async function runDebug() {
    try {
      if (testConfig.appId === 'your_app_id_here') {
        console.log('⚠️  请先在脚本中配置您的科大讯飞API凭据');
        console.log('   修改 testConfig 对象中的 appId、apiKey、apiSecret');
        return;
      }
      
      const wsUrl = generateAuthUrl(testConfig.apiKey, testConfig.apiSecret);
      await debugWebSocketConnection(wsUrl, testConfig.appId, testConfig.voice);
      
    } catch (error) {
      console.log('\n❌ 调试失败:', error.message);
      
      // 提供解决建议
      if (error.message.includes('认证失败') || error.message.includes('401')) {
        console.log('\n💡 认证失败解决建议:');
        console.log('   1. 检查API Key和API Secret是否正确');
        console.log('   2. 确认App ID是否正确');
        console.log('   3. 检查账户余额是否充足');
        console.log('   4. 确认TTS服务是否已开通');
      } else if (error.message.includes('权限不足') || error.message.includes('403')) {
        console.log('\n💡 权限不足解决建议:');
        console.log('   1. 检查发音人权限是否已开通');
        console.log('   2. 确认账户权限是否足够');
        console.log('   3. 联系科大讯飞客服确认权限');
      } else if (error.message.includes('连接超时')) {
        console.log('\n💡 连接超时解决建议:');
        console.log('   1. 检查网络连接是否正常');
        console.log('   2. 确认防火墙设置');
        console.log('   3. 尝试使用代理连接');
      } else if (error.message.includes('HTTP')) {
        console.log('\n💡 HTTP错误解决建议:');
        console.log('   1. 检查API地址是否正确');
        console.log('   2. 确认网络连接正常');
        console.log('   3. 检查代理配置');
      }
    }
  }
  
  runDebug();
}

// 运行调试
debugXunfeiResponse(); 
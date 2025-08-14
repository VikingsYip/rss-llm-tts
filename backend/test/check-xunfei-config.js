const configService = require('./src/services/configService');
const xunfeiTtsService = require('./src/services/xunfeiTtsService');
const path = require('path');

async function checkXunfeiConfig() {
  console.log('科大讯飞TTS配置检查工具');
  console.log('======================\n');
  
  try {
    // 1. 获取系统配置
    console.log('1. 检查系统配置...');
    const configs = await configService.getAllConfigs();
    
    const ttsConfig = {
      apiUrl: configs.tts_api_url,
      appId: configs.tts_app_id,
      apiKey: configs.tts_api_key,
      apiSecret: configs.tts_api_secret,
      voice: configs.tts_voice,
      voiceHost: configs.tts_voice_host,
      voiceGuest: configs.tts_voice_guest
    };
    
    console.log('✅ 配置获取成功');
    console.log('   配置详情:');
    console.log(`   - API URL: ${ttsConfig.apiUrl || '未配置'}`);
    console.log(`   - App ID: ${ttsConfig.appId || '未配置'}`);
    console.log(`   - API Key: ${ttsConfig.apiKey ? ttsConfig.apiKey.substring(0, 8) + '****' : '未配置'}`);
    console.log(`   - API Secret: ${ttsConfig.apiSecret ? ttsConfig.apiSecret.substring(0, 8) + '****' : '未配置'}`);
    console.log(`   - 默认发音人: ${ttsConfig.voice || '未配置'}`);
    console.log(`   - 主持人发音人: ${ttsConfig.voiceHost || '未配置'}`);
    console.log(`   - 嘉宾发音人: ${ttsConfig.voiceGuest || '未配置'}`);
    
    // 2. 验证配置完整性
    console.log('\n2. 验证配置完整性...');
    const missingFields = [];
    if (!ttsConfig.appId) missingFields.push('App ID');
    if (!ttsConfig.apiKey) missingFields.push('API Key');
    if (!ttsConfig.apiSecret) missingFields.push('API Secret');
    if (!ttsConfig.voice) missingFields.push('默认发音人');
    if (!ttsConfig.voiceHost) missingFields.push('主持人发音人');
    if (!ttsConfig.voiceGuest) missingFields.push('嘉宾发音人');
    
    if (missingFields.length > 0) {
      console.log('❌ 配置不完整，缺少以下字段:');
      missingFields.forEach(field => console.log(`   - ${field}`));
      console.log('\n💡 请在系统设置中配置完整的科大讯飞TTS参数');
      return;
    }
    
    console.log('✅ 配置完整性检查通过');
    
    // 3. 解析配置
    console.log('\n3. 解析TTS配置...');
    try {
      const parsedConfig = xunfeiTtsService.parseTtsConfig(ttsConfig);
      console.log('✅ 配置解析成功');
      console.log(`   解析后的配置: appId=${parsedConfig.appId}, voice=${parsedConfig.voice}`);
    } catch (error) {
      console.log('❌ 配置解析失败:', error.message);
      return;
    }
    
    // 4. 测试连接
    console.log('\n4. 测试TTS连接...');
    try {
      const testResult = await xunfeiTtsService.testConnection(ttsConfig);
      
      if (testResult.success) {
        console.log('✅ TTS连接测试成功');
        console.log(`   响应时间: ${testResult.responseTime}ms`);
        console.log(`   消息: ${testResult.message}`);
      } else {
        console.log('❌ TTS连接测试失败');
        console.log(`   错误: ${testResult.message}`);
        if (testResult.details) {
          console.log(`   详细信息: ${testResult.details}`);
        }
        
        // 提供解决建议
        if (testResult.message.includes('认证失败')) {
          console.log('\n💡 认证失败解决建议:');
          console.log('   1. 检查API Key和API Secret是否正确');
          console.log('   2. 确认App ID是否正确');
          console.log('   3. 检查账户余额是否充足');
          console.log('   4. 确认TTS服务是否已开通');
        } else if (testResult.message.includes('权限不足')) {
          console.log('\n💡 权限不足解决建议:');
          console.log('   1. 检查发音人权限是否已开通');
          console.log('   2. 确认账户权限是否足够');
          console.log('   3. 联系科大讯飞客服确认权限');
        } else if (testResult.message.includes('连接超时')) {
          console.log('\n💡 连接超时解决建议:');
          console.log('   1. 检查网络连接是否正常');
          console.log('   2. 确认防火墙设置');
          console.log('   3. 尝试使用代理连接');
        }
      }
    } catch (error) {
      console.log('❌ TTS连接测试异常:', error.message);
    }
    
    // 5. 检查代理配置
    console.log('\n5. 检查代理配置...');
    try {
      const proxyConfig = await xunfeiTtsService.getProxyConfig();
      if (proxyConfig) {
        console.log('✅ 检测到代理配置');
        console.log(`   代理地址: ${proxyConfig.host}:${proxyConfig.port}`);
      } else {
        console.log('ℹ️  未配置代理，使用直接连接');
      }
    } catch (error) {
      console.log('⚠️  代理配置检查失败:', error.message);
    }
    
    // 6. 生成测试音频
    console.log('\n6. 生成测试音频...');
    const testText = '这是一个测试语音合成的文本，用于验证科大讯飞TTS服务是否正常工作。';
    const testPath = path.join(__dirname, 'uploads', 'config_test.mp3');
    
    try {
      // 确保uploads目录存在
      const fs = require('fs');
      const uploadsDir = path.dirname(testPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const result = await xunfeiTtsService.generateTTS(ttsConfig, testText, testPath);
      
      if (result.success) {
        console.log('✅ 测试音频生成成功');
        console.log(`   文件路径: ${result.audioPath}`);
        console.log(`   文件大小: ${result.audioSize} 字节`);
        console.log(`   估算时长: ${result.duration} 秒`);
        
        // 清理测试文件
        try {
          fs.unlinkSync(testPath);
          console.log('✅ 测试文件已清理');
        } catch (cleanupError) {
          console.log('⚠️  清理测试文件失败:', cleanupError.message);
        }
      } else {
        console.log('❌ 测试音频生成失败');
      }
    } catch (error) {
      console.log('❌ 测试音频生成异常:', error.message);
    }
    
    console.log('\n配置检查完成！');
    
  } catch (error) {
    console.log('❌ 配置检查失败:', error.message);
  }
}

// 运行检查
checkXunfeiConfig(); 
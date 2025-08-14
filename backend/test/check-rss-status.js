const axios = require('axios');
const logger = require('./src/utils/logger');

// RSS服务状态检查工具
async function checkRSSStatus() {
  console.log('RSS服务状态检查');
  console.log('================\n');
  
  // 测试RSS源列表
  const testFeeds = [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      description: '科技新闻'
    },
    {
      name: 'The Verge',
      url: 'https://www.theverge.com/rss/index.xml',
      description: '科技媒体'
    },
    {
      name: 'Ars Technica',
      url: 'https://feeds.arstechnica.com/arstechnica/index',
      description: '技术新闻'
    }
  ];
  
  console.log('开始检查RSS源状态...\n');
  
  for (const feed of testFeeds) {
    try {
      console.log(`检查 ${feed.name} (${feed.url})...`);
      
      const startTime = Date.now();
      const response = await axios.get(feed.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxContentLength: 5 * 1024 * 1024, // 5MB限制
        maxBodyLength: 5 * 1024 * 1024
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`✅ ${feed.name}: 状态码 ${response.status}, 响应时间 ${responseTime}ms`);
      console.log(`   内容长度: ${response.data.length} 字符`);
      
      // 检查是否是有效的RSS内容
      if (response.data.includes('<rss') || response.data.includes('<feed')) {
        console.log(`   ✅ 有效的RSS/Atom格式`);
      } else {
        console.log(`   ⚠️  可能不是有效的RSS格式`);
      }
      
    } catch (error) {
      console.log(`❌ ${feed.name}: 连接失败`);
      
      if (error.response) {
        console.log(`   状态码: ${error.response.status}`);
        console.log(`   状态文本: ${error.response.statusText}`);
        
        if (error.response.status === 503) {
          console.log(`   🔧 503错误: 服务不可用，可能是临时维护`);
        } else if (error.response.status === 403) {
          console.log(`   🔧 403错误: 访问被拒绝，可能需要特殊请求头`);
        } else if (error.response.status === 404) {
          console.log(`   🔧 404错误: RSS源不存在`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   🔧 连接超时: ${error.message}`);
      } else if (error.code === 'ENOTFOUND') {
        console.log(`   🔧 DNS解析失败: ${error.message}`);
      } else {
        console.log(`   🔧 其他错误: ${error.message}`);
      }
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('💡 503错误解决建议:');
  console.log('   1. 检查网络连接是否正常');
  console.log('   2. 确认RSS源是否正在维护');
  console.log('   3. 尝试使用代理访问');
  console.log('   4. 检查防火墙设置');
  console.log('   5. 稍后重试（可能是临时服务不可用）');
  console.log('');
  console.log('💡 内存优化建议:');
  console.log('   1. 减少RSS抓取频率');
  console.log('   2. 限制同时抓取的RSS源数量');
  console.log('   3. 增加Node.js内存限制');
  console.log('   4. 定期重启应用');
  console.log('   5. 监控内存使用趋势');
}

// 运行检查
checkRSSStatus(); 
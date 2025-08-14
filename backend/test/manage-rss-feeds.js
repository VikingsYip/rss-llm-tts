#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// RSS源管理建议
const RSS_MANAGEMENT_TIPS = {
  memory_optimization: [
    '减少同时活跃的RSS源数量',
    '增加抓取间隔时间',
    '分批启动RSS源',
    '使用内存监控和自动清理',
    '定期重启应用释放内存'
  ],
  feed_prioritization: [
    '优先保留重要的新闻源',
    '将不常用的源设置为非活跃',
    '根据抓取频率调整优先级',
    '监控每个源的内存占用'
  ],
  system_optimization: [
    '增加系统内存',
    '优化Node.js启动参数',
    '使用垃圾回收优化',
    '监控系统资源使用'
  ]
};

// 生成RSS源管理建议
function generateRSSManagementAdvice(feedCount, memoryUsage) {
  const advice = [];
  
  if (feedCount > 100) {
    advice.push({
      level: 'high',
      message: `RSS源数量过多(${feedCount}个)，建议减少到100个以下`,
      actions: [
        '将不重要的源设置为非活跃',
        '增加抓取间隔时间',
        '分批启动源以减少内存峰值'
      ]
    });
  } else if (feedCount > 50) {
    advice.push({
      level: 'medium',
      message: `RSS源数量较多(${feedCount}个)，建议优化配置`,
      actions: [
        '监控内存使用情况',
        '优化抓取策略',
        '考虑分批启动'
      ]
    });
  }
  
  if (memoryUsage > 80) {
    advice.push({
      level: 'critical',
      message: `内存使用率过高(${memoryUsage}%)，需要立即优化`,
      actions: [
        '立即重启应用',
        '减少活跃RSS源数量',
        '检查内存泄漏',
        '增加系统内存'
      ]
    });
  } else if (memoryUsage > 70) {
    advice.push({
      level: 'high',
      message: `内存使用率较高(${memoryUsage}%)，建议优化`,
      actions: [
        '监控内存趋势',
        '优化RSS源配置',
        '考虑分批启动'
      ]
    });
  }
  
  return advice;
}

// 生成RSS源配置优化建议
function generateRSSConfigSuggestions(feedCount) {
  const suggestions = [];
  
  if (feedCount > 100) {
    suggestions.push({
      category: '紧急优化',
      items: [
        '将RSS源数量减少到100个以下',
        '设置最大活跃源数量限制',
        '实现分批启动机制',
        '增加抓取间隔时间'
      ]
    });
  }
  
  suggestions.push({
    category: '性能优化',
    items: [
      '使用内存监控和自动清理',
      '实现智能抓取策略',
      '优化数据库查询',
      '使用缓存减少重复抓取'
    ]
  });
  
  suggestions.push({
    category: '系统优化',
    items: [
      '增加Node.js堆内存限制',
      '启用垃圾回收优化',
      '监控系统资源使用',
      '定期重启应用'
    ]
  });
  
  return suggestions;
}

// 生成配置示例
function generateConfigExamples() {
  return {
    nodemon: {
      description: '开发环境启动配置',
      config: `{
  "scripts": {
    "dev": "nodemon --expose-gc --max-old-space-size=8192 --optimize-for-size src/app.js"
  }
}`
    },
    environment: {
      description: '环境变量配置',
      config: `# .env 文件
NODE_ENV=production
MAX_ACTIVE_FEEDS=100
BATCH_SIZE=10
BATCH_DELAY=2000
MEMORY_THRESHOLD=75`
    },
    rss_optimization: {
      description: 'RSS源优化配置',
      config: `const RSSOptimizer = require('./rss-optimization');
const optimizer = new RSSOptimizer();

// 分批启动RSS源
await optimizer.startRSSFeedsInBatches(feeds, scheduleFunction);

// 优化RSS源配置
const optimizedFeeds = optimizer.optimizeRSSConfig(feeds);`
    }
  };
}

// 主函数
function main() {
  console.log(colorize('📰 RSS源管理工具', 'bright'));
  console.log(colorize('==================', 'cyan'));
  console.log();
  
  // 模拟RSS源数量（实际使用时应该从数据库获取）
  const feedCount = 169; // 根据您的日志
  const memoryUsage = 91; // 根据您的日志
  
  console.log(colorize('📊 当前状态:', 'bright'));
  console.log(`  RSS源数量: ${colorize(feedCount.toString(), 'yellow')}`);
  console.log(`  内存使用率: ${colorize(memoryUsage + '%', 
    memoryUsage > 90 ? 'red' : 
    memoryUsage > 80 ? 'yellow' : 'green')}`);
  console.log();
  
  // 生成管理建议
  const advice = generateRSSManagementAdvice(feedCount, memoryUsage);
  if (advice.length > 0) {
    console.log(colorize('💡 管理建议:', 'bright'));
    advice.forEach((item, index) => {
      const levelIcon = item.level === 'critical' ? '🔴' : item.level === 'high' ? '🟡' : '🟢';
      const levelColor = item.level === 'critical' ? 'red' : item.level === 'high' ? 'yellow' : 'green';
      console.log(`  ${levelIcon} ${colorize(item.message, levelColor)}`);
      
      item.actions.forEach(action => {
        console.log(`     • ${action}`);
      });
      console.log();
    });
  }
  
  // 生成配置优化建议
  const suggestions = generateRSSConfigSuggestions(feedCount);
  console.log(colorize('⚙️  配置优化建议:', 'bright'));
  suggestions.forEach(category => {
    console.log(`  ${colorize(category.category, 'cyan')}:`);
    category.items.forEach(item => {
      console.log(`    • ${item}`);
    });
    console.log();
  });
  
  // 显示内存优化技巧
  console.log(colorize('🛡️  内存优化技巧:', 'bright'));
  RSS_MANAGEMENT_TIPS.memory_optimization.forEach(tip => {
    console.log(`  • ${tip}`);
  });
  console.log();
  
  // 显示RSS源优先级管理
  console.log(colorize('🎯 RSS源优先级管理:', 'bright'));
  RSS_MANAGEMENT_TIPS.feed_prioritization.forEach(tip => {
    console.log(`  • ${tip}`);
  });
  console.log();
  
  // 显示系统优化建议
  console.log(colorize('🔧 系统优化建议:', 'bright'));
  RSS_MANAGEMENT_TIPS.system_optimization.forEach(tip => {
    console.log(`  • ${tip}`);
  });
  console.log();
  
  // 显示配置示例
  const examples = generateConfigExamples();
  console.log(colorize('📝 配置示例:', 'bright'));
  
  Object.entries(examples).forEach(([key, example]) => {
    console.log(`  ${colorize(example.description, 'cyan')}:`);
    console.log(colorize(example.config, 'green'));
    console.log();
  });
  
  // 显示快速修复命令
  console.log(colorize('🚀 快速修复命令:', 'bright'));
  console.log(`  重启应用: ${colorize('npm run dev', 'green')}`);
  console.log(`  内存诊断: ${colorize('node check-memory.js', 'green')}`);
  console.log(`  内存检测: ${colorize('node memory-leak-detector.js', 'green')}`);
  console.log(`  RSS优化: ${colorize('node rss-optimization.js', 'green')}`);
  console.log();
  
  // 显示监控接口
  console.log(colorize('🌐 监控接口:', 'bright'));
  console.log(`  内存状态: ${colorize('GET /api/memory', 'cyan')}`);
  console.log(`  垃圾回收: ${colorize('POST /api/memory/gc', 'cyan')}`);
  console.log(`  RSS源列表: ${colorize('GET /api/rss', 'cyan')}`);
  console.log(`  健康检查: ${colorize('GET /health', 'cyan')}`);
  console.log();
  
  console.log(colorize('✨ RSS源管理分析完成！', 'bright'));
}

// 运行管理工具
if (require.main === module) {
  main();
}

module.exports = {
  generateRSSManagementAdvice,
  generateRSSConfigSuggestions,
  generateConfigExamples
}; 
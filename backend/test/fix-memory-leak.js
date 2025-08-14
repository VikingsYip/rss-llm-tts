#!/usr/bin/env node

const os = require('os');
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

// 获取内存信息
function getMemoryInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = process.memoryUsage();
  
  return {
    system: {
      total: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100,
      free: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100,
      used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100,
      usagePercent: Math.round((usedMem / totalMem) * 100 * 100) / 100
    },
    process: {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    }
  };
}

// 分析内存泄漏
function analyzeMemoryLeak() {
  const memInfo = getMemoryInfo();
  const heapUsagePercent = (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100;
  
  const issues = [];
  
  // 检查堆内存使用率
  if (heapUsagePercent > 90) {
    issues.push({
      level: 'critical',
      type: 'high_heap_usage',
      message: `堆内存使用率过高: ${Math.round(heapUsagePercent)}%`,
      solution: '立即重启应用'
    });
  } else if (heapUsagePercent > 80) {
    issues.push({
      level: 'high',
      type: 'high_heap_usage',
      message: `堆内存使用率较高: ${Math.round(heapUsagePercent)}%`,
      solution: '监控内存趋势，考虑重启'
    });
  }
  
  // 检查系统内存
  if (memInfo.system.usagePercent > 90) {
    issues.push({
      level: 'critical',
      type: 'system_memory_low',
      message: `系统内存不足: ${memInfo.system.usagePercent}%`,
      solution: '关闭其他程序或重启系统'
    });
  }
  
  // 检查堆内存分配
  if (memInfo.process.heapUsed > memInfo.process.heapTotal * 0.9) {
    issues.push({
      level: 'high',
      type: 'heap_allocation_issue',
      message: '堆内存分配接近上限',
      solution: '增加堆内存限制或优化代码'
    });
  }
  
  return { issues, memInfo };
}

// 生成修复建议
function generateFixSuggestions(issues) {
  const suggestions = [];
  
  issues.forEach(issue => {
    switch (issue.type) {
      case 'high_heap_usage':
        suggestions.push({
          priority: issue.level === 'critical' ? 1 : 2,
          action: '重启应用',
          command: 'npm run dev',
          description: '立即重启应用以释放内存'
        });
        suggestions.push({
          priority: 2,
          action: '手动垃圾回收',
          command: 'curl -X POST http://localhost:3001/api/memory/gc',
          description: '通过API触发垃圾回收'
        });
        break;
        
      case 'system_memory_low':
        suggestions.push({
          priority: 1,
          action: '关闭其他程序',
          command: 'tasklist | findstr node',
          description: '检查并关闭不必要的Node.js进程'
        });
        suggestions.push({
          priority: 2,
          action: '重启系统',
          command: 'shutdown /r /t 0',
          description: '彻底清理系统内存'
        });
        break;
        
      case 'heap_allocation_issue':
        suggestions.push({
          priority: 2,
          action: '增加堆内存限制',
          command: '--max-old-space-size=8192',
          description: '将堆内存限制增加到8GB'
        });
        break;
    }
  });
  
  // 按优先级排序
  return suggestions.sort((a, b) => a.priority - b.priority);
}

// 主函数
function main() {
  console.log(colorize('🔧 内存泄漏修复工具', 'bright'));
  console.log(colorize('========================', 'cyan'));
  console.log();
  
  // 分析内存问题
  const { issues, memInfo } = analyzeMemoryLeak();
  
  // 显示当前内存状态
  console.log(colorize('📊 当前内存状态:', 'bright'));
  console.log(`  系统内存: ${colorize(memInfo.system.used + '/' + memInfo.system.total + ' GB', 'yellow')} (${colorize(memInfo.system.usagePercent + '%', 
    memInfo.system.usagePercent > 90 ? 'red' : 
    memInfo.system.usagePercent > 80 ? 'yellow' : 'green')})`);
  console.log(`  应用内存: ${colorize(memInfo.process.heapUsed + '/' + memInfo.process.heapTotal + ' MB', 'yellow')} (${colorize(
    Math.round((memInfo.process.heapUsed / memInfo.process.heapTotal) * 100) + '%',
    (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100 > 90 ? 'red' : 
    (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100 > 80 ? 'yellow' : 'green'
  )})`);
  console.log();
  
  // 显示检测到的问题
  if (issues.length > 0) {
    console.log(colorize('🚨 检测到的问题:', 'bright'));
    issues.forEach((issue, index) => {
      const levelIcon = issue.level === 'critical' ? '🔴' : '🟡';
      const levelColor = issue.level === 'critical' ? 'red' : 'yellow';
      console.log(`  ${levelIcon} ${colorize(issue.message, levelColor)}`);
      console.log(`     解决方案: ${issue.solution}`);
    });
    console.log();
    
    // 生成修复建议
    const suggestions = generateFixSuggestions(issues);
    console.log(colorize('💡 修复建议 (按优先级排序):', 'bright'));
    suggestions.forEach((suggestion, index) => {
      const priorityIcon = suggestion.priority === 1 ? '🔴' : '🟡';
      console.log(`  ${priorityIcon} ${colorize(suggestion.action, 'cyan')}`);
      console.log(`     命令: ${colorize(suggestion.command, 'green')}`);
      console.log(`     说明: ${suggestion.description}`);
      console.log();
    });
  } else {
    console.log(colorize('✅ 未检测到严重的内存问题', 'green'));
    console.log();
  }
  
  // 显示预防措施
  console.log(colorize('🛡️  预防措施:', 'bright'));
  console.log(`  1. ${colorize('定期监控', 'cyan')} - 使用 node check-memory.js`);
  console.log(`  2. ${colorize('内存检测', 'cyan')} - 使用 node memory-leak-detector.js`);
  console.log(`  3. ${colorize('紧急清理', 'cyan')} - 使用 node emergency-memory-cleanup.js`);
  console.log(`  4. ${colorize('API监控', 'cyan')} - 访问 /api/memory 接口`);
  console.log();
  
  // 显示配置优化
  console.log(colorize('⚙️  配置优化:', 'bright'));
  console.log(`  启动参数: ${colorize('--expose-gc --max-old-space-size=8192 --optimize-for-size', 'green')}`);
  console.log(`  监控频率: ${colorize('每2分钟检查一次', 'green')}`);
  console.log(`  重启阈值: ${colorize('90%', 'green')}`);
  console.log(`  清理阈值: ${colorize('85%', 'green')}`);
  console.log();
  
  // 显示快速修复命令
  if (issues.some(i => i.level === 'critical')) {
    console.log(colorize('🚀 紧急修复命令:', 'bright'));
    console.log(`  立即重启: ${colorize('npm run dev', 'green')}`);
    console.log(`  检查状态: ${colorize('node check-memory.js', 'green')}`);
    console.log(`  内存检测: ${colorize('node memory-leak-detector.js', 'green')}`);
    console.log();
  }
  
  console.log(colorize('✨ 分析完成！', 'bright'));
}

// 运行分析
if (require.main === module) {
  main();
}

module.exports = {
  getMemoryInfo,
  analyzeMemoryLeak,
  generateFixSuggestions
}; 
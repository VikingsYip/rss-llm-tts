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

// 强制垃圾回收
function forceGC() {
  if (typeof global.gc === 'function') {
    try {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      const freed = Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024);
      return { success: true, freed, before, after };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: '垃圾回收不可用' };
  }
}

// 清理系统缓存
function clearSystemCache() {
  try {
    // 清理Node.js内部缓存
    if (global.gc) {
      global.gc();
    }
    
    // 清理模块缓存（谨慎使用）
    if (process.env.NODE_ENV === 'development') {
      // 只在开发环境下清理模块缓存
      Object.keys(require.cache).forEach(key => {
        if (key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
    }
    
    return { success: true, message: '系统缓存清理完成' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 生成内存优化建议
function generateOptimizationAdvice(memInfo) {
  const advice = [];
  
  if (memInfo.system.usagePercent > 90) {
    advice.push({
      level: 'critical',
      message: '系统内存严重不足，建议立即重启系统或关闭其他程序'
    });
  } else if (memInfo.system.usagePercent > 80) {
    advice.push({
      level: 'high',
      message: '系统内存不足，建议关闭不必要的程序'
    });
  }
  
  const heapUsagePercent = (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100;
  if (heapUsagePercent > 90) {
    advice.push({
      level: 'critical',
      message: '应用内存使用率过高，建议立即重启应用'
    });
  } else if (heapUsagePercent > 80) {
    advice.push({
      level: 'high',
      message: '应用内存使用率较高，建议监控内存使用趋势'
    });
  }
  
  return advice;
}

// 主函数
function main() {
  console.log(colorize('🚨 紧急内存清理工具', 'bright'));
  console.log(colorize('========================', 'red'));
  console.log();
  
  // 获取当前内存状态
  const memInfo = getMemoryInfo();
  
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
  
  // 检查是否需要紧急处理
  const needsEmergency = memInfo.system.usagePercent > 90 || 
                        (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100 > 90;
  
  if (needsEmergency) {
    console.log(colorize('🚨 检测到内存危机！需要紧急处理', 'red'));
    console.log();
    
    // 立即尝试垃圾回收
    console.log(colorize('🔄 执行紧急垃圾回收...', 'yellow'));
    const gcResult = forceGC();
    
    if (gcResult.success) {
      console.log(colorize(`✅ 垃圾回收成功，释放内存: ${gcResult.freed}MB`, 'green'));
      
      // 显示垃圾回收后的状态
      const afterGC = getMemoryInfo();
      console.log(`  垃圾回收后应用内存: ${colorize(afterGC.process.heapUsed + '/' + afterGC.process.heapTotal + ' MB', 'green')}`);
    } else {
      console.log(colorize(`❌ 垃圾回收失败: ${gcResult.error}`, 'red'));
    }
    console.log();
    
    // 清理系统缓存
    console.log(colorize('🧹 清理系统缓存...', 'yellow'));
    const cacheResult = clearSystemCache();
    
    if (cacheResult.success) {
      console.log(colorize(`✅ ${cacheResult.message}`, 'green'));
    } else {
      console.log(colorize(`❌ 缓存清理失败: ${cacheResult.error}`, 'red'));
    }
    console.log();
  }
  
  // 生成优化建议
  const advice = generateOptimizationAdvice(memInfo);
  if (advice.length > 0) {
    console.log(colorize('💡 优化建议:', 'bright'));
    advice.forEach((item, index) => {
      const levelIcon = item.level === 'critical' ? '🔴' : '🟡';
      const levelColor = item.level === 'critical' ? 'red' : 'yellow';
      console.log(`  ${levelIcon} ${colorize(item.message, levelColor)}`);
    });
    console.log();
  }
  
  // 显示紧急操作选项
  console.log(colorize('🚀 紧急操作选项:', 'bright'));
  console.log(`  1. ${colorize('重启应用', 'cyan')} - 最有效的内存清理方式`);
  console.log(`  2. ${colorize('手动垃圾回收', 'cyan')} - 通过API接口触发`);
  console.log(`  3. ${colorize('检查内存状态', 'cyan')} - 监控内存变化`);
  console.log(`  4. ${colorize('系统重启', 'cyan')} - 彻底解决内存问题`);
  console.log();
  
  // 显示快速命令
  console.log(colorize('⚡ 快速命令:', 'bright'));
  console.log(`  重启应用: ${colorize('npm run dev', 'green')}`);
  console.log(`  内存状态: ${colorize('node check-memory.js', 'green')}`);
  console.log(`  手动GC: ${colorize('curl -X POST http://localhost:3001/api/memory/gc', 'green')}`);
  console.log();
  
  // 显示当前状态
  const finalMemInfo = getMemoryInfo();
  console.log(colorize('📊 清理后内存状态:', 'bright'));
  console.log(`  系统内存: ${colorize(finalMemInfo.system.used + '/' + finalMemInfo.system.total + ' GB', 'yellow')} (${colorize(finalMemInfo.system.usagePercent + '%', 
    finalMemInfo.system.usagePercent > 90 ? 'red' : 
    finalMemInfo.system.usagePercent > 80 ? 'yellow' : 'green')})`);
  console.log(`  应用内存: ${colorize(finalMemInfo.process.heapUsed + '/' + finalMemInfo.process.heapTotal + ' MB', 'yellow')} (${colorize(
    Math.round((finalMemInfo.process.heapUsed / finalMemInfo.process.heapTotal) * 100) + '%',
    (finalMemInfo.process.heapUsed / finalMemInfo.process.heapTotal) * 100 > 90 ? 'red' : 
    (finalMemInfo.process.heapUsed / finalMemInfo.process.heapTotal) * 100 > 80 ? 'yellow' : 'green'
  )})`);
  console.log();
  
  if (needsEmergency) {
    console.log(colorize('⚠️  警告: 内存问题仍然存在，建议立即重启应用！', 'red'));
  } else {
    console.log(colorize('✅ 内存状态正常', 'green'));
  }
  
  console.log();
  console.log(colorize('✨ 紧急清理完成！', 'bright'));
}

// 运行清理
if (require.main === module) {
  main();
}

module.exports = {
  getMemoryInfo,
  forceGC,
  clearSystemCache,
  generateOptimizationAdvice
}; 
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

// 检查垃圾回收是否可用
function checkGC() {
  return typeof global.gc === 'function';
}

// 检查启动参数
function checkStartupParams() {
  const args = process.argv;
  const hasExposeGC = args.includes('--expose-gc');
  const hasMaxOldSpace = args.find(arg => arg.startsWith('--max-old-space-size='));
  const hasOptimizeForSize = args.includes('--optimize-for-size');
  
  return {
    hasExposeGC,
    hasMaxOldSpace: hasMaxOldSpace ? hasMaxOldSpace.split('=')[1] : null,
    hasOptimizeForSize
  };
}

// 生成建议
function generateRecommendations(memInfo, gcAvailable, startupParams) {
  const recommendations = [];
  
  // 系统内存建议
  if (memInfo.system.usagePercent > 90) {
    recommendations.push({
      level: 'high',
      message: '系统内存使用率过高，建议关闭不必要的程序或增加系统内存'
    });
  } else if (memInfo.system.usagePercent > 80) {
    recommendations.push({
      level: 'medium',
      message: '系统内存使用率较高，建议关注内存使用情况'
    });
  }
  
  // 进程内存建议
  const heapUsagePercent = (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100;
  if (heapUsagePercent > 90) {
    recommendations.push({
      level: 'high',
      message: '进程堆内存使用率过高，建议立即检查内存泄漏'
    });
  } else if (heapUsagePercent > 80) {
    recommendations.push({
      level: 'medium',
      message: '进程堆内存使用率较高，建议监控内存使用趋势'
    });
  }
  
  // 启动参数建议
  if (!gcAvailable) {
    recommendations.push({
      level: 'high',
      message: '垃圾回收不可用，建议使用 --expose-gc 启动参数'
    });
  }
  
  if (!startupParams.hasMaxOldSpace) {
    recommendations.push({
      level: 'medium',
      message: '未设置堆内存限制，建议使用 --max-old-space-size 参数'
    });
  }
  
  if (!startupParams.hasOptimizeForSize) {
    recommendations.push({
      level: 'low',
      message: '建议使用 --optimize-for-size 参数优化内存使用'
    });
  }
  
  return recommendations;
}

// 主函数
function main() {
  console.log(colorize('🔍 RSS系统内存诊断工具', 'bright'));
  console.log(colorize('================================', 'cyan'));
  console.log();
  
  // 获取内存信息
  const memInfo = getMemoryInfo();
  const gcAvailable = checkGC();
  const startupParams = checkStartupParams();
  
  // 显示系统内存信息
  console.log(colorize('📊 系统内存信息:', 'bright'));
  console.log(`  总内存: ${colorize(memInfo.system.total + ' GB', 'green')}`);
  console.log(`  已使用: ${colorize(memInfo.system.used + ' GB', 'yellow')}`);
  console.log(`  可用内存: ${colorize(memInfo.system.free + ' GB', 'green')}`);
  console.log(`  使用率: ${colorize(memInfo.system.usagePercent + '%', 
    memInfo.system.usagePercent > 90 ? 'red' : 
    memInfo.system.usagePercent > 80 ? 'yellow' : 'green')}`);
  console.log();
  
  // 显示进程内存信息
  console.log(colorize('📊 进程内存信息:', 'bright'));
  console.log(`  RSS (常驻集): ${colorize(memInfo.process.rss + ' MB', 'blue')}`);
  console.log(`  堆内存总量: ${colorize(memInfo.process.heapTotal + ' MB', 'blue')}`);
  console.log(`  堆内存已用: ${colorize(memInfo.process.heapUsed + ' MB', 'blue')}`);
  console.log(`  外部内存: ${colorize(memInfo.process.external + ' MB', 'blue')}`);
  
  const heapUsagePercent = (memInfo.process.heapUsed / memInfo.process.heapTotal) * 100;
  console.log(`  堆内存使用率: ${colorize(Math.round(heapUsagePercent * 100) / 100 + '%',
    heapUsagePercent > 90 ? 'red' : 
    heapUsagePercent > 80 ? 'yellow' : 'green')}`);
  console.log();
  
  // 显示启动参数信息
  console.log(colorize('⚙️  启动参数检查:', 'bright'));
  console.log(`  垃圾回收: ${colorize(gcAvailable ? '✅ 可用' : '❌ 不可用', 
    gcAvailable ? 'green' : 'red')}`);
  console.log(`  堆内存限制: ${colorize(startupParams.hasMaxOldSpace ? 
    startupParams.hasMaxOldSpace + ' MB' : '❌ 未设置', 
    startupParams.hasMaxOldSpace ? 'green' : 'red')}`);
  console.log(`  内存优化: ${colorize(startupParams.hasOptimizeForSize ? '✅ 启用' : '❌ 未启用', 
    startupParams.hasOptimizeForSize ? 'green' : 'red')}`);
  console.log();
  
  // 生成建议
  const recommendations = generateRecommendations(memInfo, gcAvailable, startupParams);
  if (recommendations.length > 0) {
    console.log(colorize('💡 优化建议:', 'bright'));
    recommendations.forEach((rec, index) => {
      const levelIcon = rec.level === 'high' ? '🔴' : rec.level === 'medium' ? '🟡' : '🟢';
      const levelColor = rec.level === 'high' ? 'red' : rec.level === 'medium' ? 'yellow' : 'green';
      console.log(`  ${levelIcon} ${colorize(rec.message, levelColor)}`);
    });
    console.log();
  }
  
  // 显示API接口信息
  console.log(colorize('🌐 内存监控API:', 'bright'));
  console.log(`  内存状态: ${colorize('GET /api/memory', 'cyan')}`);
  console.log(`  垃圾回收: ${colorize('POST /api/memory/gc', 'cyan')}`);
  console.log(`  健康检查: ${colorize('GET /health', 'cyan')}`);
  console.log();
  
  // 显示快速修复命令
  if (!gcAvailable || !startupParams.hasMaxOldSpace) {
    console.log(colorize('🚀 快速修复命令:', 'bright'));
    console.log(`  开发环境: ${colorize('npm run dev', 'green')}`);
    console.log(`  生产环境: ${colorize('npm start', 'green')}`);
    console.log(`  手动启动: ${colorize('node --expose-gc --max-old-space-size=6144 --optimize-for-size src/app.js', 'green')}`);
    console.log();
  }
  
  // 显示内存泄漏检测器
  console.log(colorize('🔍 内存泄漏检测:', 'bright'));
  console.log(`  独立运行: ${colorize('node memory-leak-detector.js', 'cyan')}`);
  console.log(`  集成监控: ${colorize('已集成到主应用', 'green')}`);
  console.log();
  
  console.log(colorize('✨ 诊断完成！', 'bright'));
}

// 运行诊断
if (require.main === module) {
  main();
}

module.exports = {
  getMemoryInfo,
  checkGC,
  checkStartupParams,
  generateRecommendations
}; 
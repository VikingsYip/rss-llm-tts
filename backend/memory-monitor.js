const os = require('os');

function getMemoryInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = process.memoryUsage();
  
  return {
    system: {
      total: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      free: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      usagePercent: Math.round((usedMem / totalMem) * 100 * 100) / 100 + '%'
    },
    process: {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100 + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100 + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100 + ' MB'
    }
  };
}

function monitorMemory() {
  console.log('内存使用监控');
  console.log('==============\n');
  
  const memInfo = getMemoryInfo();
  
  console.log('系统内存:');
  console.log('  总内存:', memInfo.system.total);
  console.log('  已使用:', memInfo.system.used);
  console.log('  可用内存:', memInfo.system.free);
  console.log('  使用率:', memInfo.system.usagePercent);
  
  console.log('\n进程内存:');
  console.log('  RSS (常驻集):', memInfo.process.rss);
  console.log('  堆内存总量:', memInfo.process.heapTotal);
  console.log('  堆内存已用:', memInfo.process.heapUsed);
  console.log('  外部内存:', memInfo.process.external);
  
  // 检查内存使用情况
  const heapUsedMB = parseFloat(memInfo.process.heapUsed);
  const heapTotalMB = parseFloat(memInfo.process.heapTotal);
  const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
  
  console.log('\n内存使用分析:');
  if (heapUsagePercent > 80) {
    console.log('⚠️  堆内存使用率过高:', Math.round(heapUsagePercent * 100) / 100 + '%');
    console.log('   建议增加Node.js内存限制或优化代码');
  } else if (heapUsagePercent > 60) {
    console.log('⚠️  堆内存使用率较高:', Math.round(heapUsagePercent * 100) / 100 + '%');
    console.log('   建议监控内存使用趋势');
  } else {
    console.log('✅ 堆内存使用正常:', Math.round(heapUsagePercent * 100) / 100 + '%');
  }
  
  if (parseFloat(memInfo.system.usagePercent) > 90) {
    console.log('⚠️  系统内存使用率过高:', memInfo.system.usagePercent);
    console.log('   建议关闭不必要的程序或增加系统内存');
  }
  
  console.log('\n💡 内存优化建议:');
  console.log('   1. 使用 --max-old-space-size=4096 启动Node.js');
  console.log('   2. 定期清理不需要的对象引用');
  console.log('   3. 使用流式处理大文件');
  console.log('   4. 避免内存泄漏');
  console.log('   5. 监控长时间运行的内存使用趋势');
}

// 运行监控
monitorMemory(); 
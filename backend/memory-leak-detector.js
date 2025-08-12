const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.maxSnapshots = 10;
    this.leakThreshold = 20; // MB
    this.interval = 5 * 60 * 1000; // 5分钟
  }

  // 获取内存快照
  getMemorySnapshot() {
    const memUsage = process.memoryUsage();
    const snapshot = {
      timestamp: new Date(),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };
    
    return snapshot;
  }

  // 分析内存趋势
  analyzeMemoryTrend() {
    if (this.snapshots.length < 2) return null;
    
    const latest = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];
    
    const heapUsedDiff = latest.heapUsed - previous.heapUsed;
    const timeDiff = (latest.timestamp - previous.timestamp) / 1000 / 60; // 分钟
    
    return {
      heapUsedDiff,
      timeDiff,
      trend: heapUsedDiff > 0 ? 'increasing' : 'decreasing',
      rate: Math.round((heapUsedDiff / timeDiff) * 100) / 100 // MB/分钟
    };
  }

  // 检测内存泄漏
  detectMemoryLeak() {
    if (this.snapshots.length < 3) return null;
    
    const trends = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const current = this.snapshots[i];
      const previous = this.snapshots[i - 1];
      const diff = current.heapUsed - previous.heapUsed;
      trends.push(diff);
    }
    
    // 检查是否持续增长
    const increasingCount = trends.filter(diff => diff > 0).length;
    const totalCount = trends.length;
    const increasingRatio = increasingCount / totalCount;
    
    if (increasingRatio > 0.7) { // 70%的时间在增长
      const avgGrowth = trends.reduce((sum, diff) => sum + Math.max(0, diff), 0) / totalCount;
      
      if (avgGrowth > this.leakThreshold / 10) { // 平均增长超过阈值
        return {
          type: 'continuous_growth',
          increasingRatio: Math.round(increasingRatio * 100),
          avgGrowth: Math.round(avgGrowth * 100) / 100,
          severity: avgGrowth > this.leakThreshold / 5 ? 'high' : 'medium'
        };
      }
    }
    
    return null;
  }

  // 生成内存报告
  generateMemoryReport() {
    if (this.snapshots.length === 0) return '暂无内存数据';
    
    const latest = this.snapshots[this.snapshots.length - 1];
    const trend = this.analyzeMemoryTrend();
    const leak = this.detectMemoryLeak();
    
    let report = `内存使用报告 (${new Date().toLocaleString()})\n`;
    report += `================================\n`;
    report += `当前内存使用: ${latest.heapUsed}MB / ${latest.heapTotal}MB (${latest.heapUsagePercent}%)\n`;
    report += `外部内存: ${latest.external}MB\n`;
    report += `RSS: ${latest.rss}MB\n`;
    
    if (trend) {
      report += `\n内存趋势分析:\n`;
      report += `  变化: ${trend.heapUsedDiff > 0 ? '+' : ''}${trend.heapUsedDiff}MB\n`;
      report += `  时间间隔: ${Math.round(trend.timeDiff)}分钟\n`;
      report += `  变化率: ${trend.rate}MB/分钟\n`;
      report += `  趋势: ${trend.trend === 'increasing' ? '上升' : '下降'}\n`;
    }
    
    if (leak) {
      report += `\n⚠️  内存泄漏检测:\n`;
      report += `  类型: ${leak.type === 'continuous_growth' ? '持续增长' : '未知'}\n`;
      report += `  增长比例: ${leak.increasingRatio}%\n`;
      report += `  平均增长: ${leak.avgGrowth}MB/次\n`;
      report += `  严重程度: ${leak.severity === 'high' ? '高' : '中'}\n`;
      
      if (leak.severity === 'high') {
        report += `\n建议立即检查:\n`;
        report += `  1. 检查是否有未清理的定时器\n`;
        report += `  2. 检查是否有未关闭的数据库连接\n`;
        report += `  3. 检查是否有未清理的事件监听器\n`;
        report += `  4. 考虑重启应用\n`;
      }
    }
    
    return report;
  }

  // 保存内存快照
  saveSnapshot() {
    const snapshot = this.getMemorySnapshot();
    this.snapshots.push(snapshot);
    
    // 保持快照数量在限制内
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    
    // 记录快照
    logger.debug(`内存快照: ${snapshot.heapUsed}MB / ${snapshot.heapTotal}MB (${snapshot.heapUsagePercent}%)`);
    
    // 每10个快照生成一次报告
    if (this.snapshots.length % 10 === 0) {
      const report = this.generateMemoryReport();
      logger.info('内存使用报告:\n' + report);
      
      // 保存报告到文件
      this.saveReportToFile(report);
    }
  }

  // 保存报告到文件
  saveReportToFile(report) {
    try {
      const logsDir = path.join(__dirname, 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const filename = `memory-report-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(logsDir, filename);
      
      fs.appendFileSync(filepath, `\n${new Date().toISOString()}\n${report}\n`);
    } catch (error) {
      logger.error('保存内存报告失败:', error);
    }
  }

  // 启动监控
  start() {
    logger.info('内存泄漏检测器已启动');
    
    // 立即保存第一个快照
    this.saveSnapshot();
    
    // 定期保存快照
    setInterval(() => {
      this.saveSnapshot();
    }, this.interval);
    
    // 每小时生成一次完整报告
    setInterval(() => {
      const report = this.generateMemoryReport();
      logger.info('定期内存报告:\n' + report);
    }, 60 * 60 * 1000);
  }

  // 停止监控
  stop() {
    logger.info('内存泄漏检测器已停止');
  }

  // 手动触发垃圾回收
  forceGC() {
    if (global.gc) {
      try {
        const before = this.getMemorySnapshot();
        global.gc();
        const after = this.getMemorySnapshot();
        
        const freed = before.heapUsed - after.heapUsed;
        logger.info(`手动垃圾回收完成，释放内存: ${freed}MB`);
        
        return { freed, before, after };
      } catch (error) {
        logger.error('手动垃圾回收失败:', error);
        return null;
      }
    } else {
      logger.warn('垃圾回收不可用，请使用 --expose-gc 启动参数');
      return null;
    }
  }
}

module.exports = MemoryLeakDetector;

// 如果直接运行此文件，启动检测器
if (require.main === module) {
  const detector = new MemoryLeakDetector();
  detector.start();
  
  // 处理退出信号
  process.on('SIGINT', () => {
    detector.stop();
    process.exit(0);
  });
} 
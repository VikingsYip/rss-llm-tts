#!/usr/bin/env node

const logger = require('./src/utils/logger');

class RSSOptimizer {
  constructor() {
    this.batchSize = 10; // 每批启动的RSS源数量
    this.batchDelay = 2000; // 批次间延迟（毫秒）
    this.memoryThreshold = 75; // 内存使用率阈值
    this.maxRetries = 3; // 最大重试次数
  }

  // 分批启动RSS源
  async startRSSFeedsInBatches(feeds, scheduleFunction) {
    try {
      logger.info(`开始分批启动${feeds.length}个RSS源...`);
      
      const batches = Math.ceil(feeds.length / this.batchSize);
      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < batches; i++) {
        const startIndex = i * this.batchSize;
        const endIndex = Math.min(startIndex + this.batchSize, feeds.length);
        const batchFeeds = feeds.slice(startIndex, endIndex);
        
        logger.info(`启动第${i + 1}/${batches}批RSS源 (${startIndex + 1}-${endIndex})`);
        
        // 启动当前批次
        const batchResult = await this.startBatch(batchFeeds, scheduleFunction);
        successCount += batchResult.success;
        skippedCount += batchResult.skipped;
        
        // 检查内存状态
        const memStatus = await this.checkMemoryStatus();
        if (memStatus.needsAttention) {
          logger.warn(`内存状态需要关注: ${memStatus.message}`);
          
          if (memStatus.critical) {
            logger.error('内存状态严重，停止启动更多RSS源');
            break;
          }
        }
        
        // 批次间延迟
        if (i < batches - 1) {
          logger.info(`第${i + 1}批完成，等待${this.batchDelay}ms让系统稳定...`);
          await this.delay(this.batchDelay);
        }
      }
      
      logger.info(`RSS源启动完成: 成功${successCount}个，跳过${skippedCount}个`);
      return { successCount, skippedCount, total: feeds.length };
      
    } catch (error) {
      logger.error('分批启动RSS源失败:', error);
      throw error;
    }
  }

  // 启动单个批次
  async startBatch(feeds, scheduleFunction) {
    let success = 0;
    let skipped = 0;
    
    for (const feed of feeds) {
      try {
        // 检查内存状态
        const memStatus = await this.checkMemoryStatus();
        if (memStatus.critical) {
          logger.warn(`内存状态严重，跳过RSS源: ${feed.name}`);
          skipped++;
          continue;
        }
        
        // 启动RSS源
        await scheduleFunction(feed);
        success++;
        
        // 检查内存使用情况
        const memUsage = process.memoryUsage();
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (heapUsagePercent > this.memoryThreshold) {
          logger.warn(`启动${feed.name}后内存使用率较高: ${Math.round(heapUsagePercent)}%`);
          
          // 尝试垃圾回收
          if (global.gc) {
            try {
              global.gc();
              logger.debug('启动后垃圾回收完成');
            } catch (gcError) {
              logger.debug('启动后垃圾回收失败:', gcError.message);
            }
          }
          
          // 等待内存稳定
          await this.delay(1000);
        }
        
      } catch (error) {
        logger.error(`启动RSS源失败: ${feed.name}`, error);
        skipped++;
      }
    }
    
    return { success, skipped };
  }

  // 检查内存状态
  async checkMemoryStatus() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    if (heapUsagePercent > 90) {
      return {
        needsAttention: true,
        critical: true,
        message: `内存使用率严重过高: ${Math.round(heapUsagePercent)}%`,
        heapUsagePercent
      };
    } else if (heapUsagePercent > 80) {
      return {
        needsAttention: true,
        critical: false,
        message: `内存使用率较高: ${Math.round(heapUsagePercent)}%`,
        heapUsagePercent
      };
    } else if (heapUsagePercent > 70) {
      return {
        needsAttention: true,
        critical: false,
        message: `内存使用率偏高: ${Math.round(heapUsagePercent)}%`,
        heapUsagePercent
      };
    }
    
    return {
      needsAttention: false,
      critical: false,
      message: `内存状态正常: ${Math.round(heapUsagePercent)}%`,
      heapUsagePercent
    };
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 优化RSS源配置
  optimizeRSSConfig(feeds) {
    const optimized = [];
    
    // 按优先级排序：活跃的在前，抓取间隔短的在前
    const sortedFeeds = feeds.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return b.isActive ? 1 : -1;
      }
      return (a.fetchInterval || 0) - (b.fetchInterval || 0);
    });
    
    // 限制同时活跃的RSS源数量
    const maxActiveFeeds = 100; // 最大活跃源数量
    const activeFeeds = sortedFeeds.filter(feed => feed.isActive).slice(0, maxActiveFeeds);
    
    // 为其他源设置较长的抓取间隔
    const inactiveFeeds = sortedFeeds.filter(feed => !feed.isActive);
    
    optimized.push(...activeFeeds);
    optimized.push(...inactiveFeeds);
    
    logger.info(`RSS源优化完成: 活跃${activeFeeds.length}个，非活跃${inactiveFeeds.length}个`);
    
    return optimized;
  }

  // 获取内存使用统计
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    };
  }

  // 生成优化报告
  generateOptimizationReport(feeds) {
    const stats = this.getMemoryStats();
    const activeFeeds = feeds.filter(feed => feed.isActive).length;
    const inactiveFeeds = feeds.filter(feed => !feed.isActive).length;
    
    let report = `RSS源优化报告\n`;
    report += `================\n`;
    report += `总RSS源数量: ${feeds.length}\n`;
    report += `活跃RSS源: ${activeFeeds}\n`;
    report += `非活跃RSS源: ${inactiveFeeds}\n`;
    report += `当前内存使用: ${stats.heapUsed}MB / ${stats.heapTotal}MB (${stats.heapUsagePercent}%)\n`;
    report += `建议批次大小: ${this.batchSize}\n`;
    report += `批次间延迟: ${this.batchDelay}ms\n`;
    
    if (stats.heapUsagePercent > 80) {
      report += `\n⚠️  警告: 内存使用率过高，建议减少活跃RSS源数量\n`;
    }
    
    return report;
  }
}

module.exports = RSSOptimizer;

// 如果直接运行此文件，显示使用说明
if (require.main === module) {
  const optimizer = new RSSOptimizer();
  console.log('RSS优化器使用说明:');
  console.log('1. 在RSSFetchJob中导入此模块');
  console.log('2. 使用 startRSSFeedsInBatches 方法分批启动RSS源');
  console.log('3. 使用 optimizeRSSConfig 方法优化RSS源配置');
  console.log('4. 使用 checkMemoryStatus 方法监控内存状态');
} 
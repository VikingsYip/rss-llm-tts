const cron = require('node-cron');
const logger = require('../utils/logger');
const rssService = require('../services/rssService');
const { RssFeed } = require('../models');

class RSSFetchJob {
  constructor() {
    this.jobs = new Map();
  }

  // 启动所有定时任务
  async startAllJobs() {
    try {
      // 启动RSS抓取任务
      await this.startRSSFetchJob();
      
      // 启动清理任务
      this.startCleanupJob();
      
      logger.info('所有定时任务已启动');
    } catch (error) {
      logger.error('启动定时任务失败:', error);
    }
  }

  // 启动RSS抓取任务
  async startRSSFetchJob() {
    try {
      // 获取所有活跃的RSS源
      const feeds = await RssFeed.findAll({
        where: { isActive: true }
      });

      // 为每个RSS源创建定时任务
      for (const feed of feeds) {
        await this.scheduleFeedFetch(feed);
      }

      logger.info(`RSS抓取任务已启动，共${feeds.length}个源`);
    } catch (error) {
      logger.error('启动RSS抓取任务失败:', error);
    }
  }

  // 为单个RSS源安排定时任务
  async scheduleFeedFetch(feed) {
    try {
      // 停止已存在的任务
      this.stopFeedFetch(feed.id);

      // 如果RSS源被禁用，不安排定时任务
      if (!feed.isActive) {
        logger.info(`RSS源已禁用，不安排定时任务: ${feed.name}`);
        return;
      }

      // 计算执行间隔（分钟）
      const intervalMinutes = Math.max(1, Math.floor(feed.fetchInterval / 60000));
      
      // 创建cron表达式（每分钟执行一次，但内部会检查是否需要抓取）
      const cronExpression = `*/${intervalMinutes} * * * *`;
      
      const job = cron.schedule(cronExpression, async () => {
        try {
          // 检查是否需要抓取
          if (await this.shouldFetchFeed(feed)) {
            logger.info(`开始抓取RSS源: ${feed.name}`);
            
            // 记录内存使用情况
            const memUsage = process.memoryUsage();
            logger.debug(`抓取前内存使用: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
            
            await rssService.fetchFeed(feed.id);
            
            // 强制垃圾回收（仅在开发环境）
            if (process.env.NODE_ENV === 'development') {
              if (global.gc) {
                global.gc();
                logger.debug('执行垃圾回收');
              }
            }
            
            // 记录抓取后内存使用
            const memUsageAfter = process.memoryUsage();
            logger.debug(`抓取后内存使用: ${Math.round(memUsageAfter.heapUsed / 1024 / 1024)}MB`);
            
            logger.info(`RSS源抓取完成: ${feed.name}`);
          }
        } catch (error) {
          logger.error(`RSS源抓取失败: ${feed.name}`, {
            message: error.message,
            status: error.status,
            code: error.code,
            stack: error.stack?.substring(0, 500) // 限制堆栈跟踪长度
          });
          
          // 如果是503错误，增加延迟重试
          if (error.status === 503 || (error.response && error.response.status === 503)) {
            logger.warn(`RSS服务不可用，将在下次调度时重试: ${feed.name}`);
          }
        }
      }, {
        scheduled: false
      });

      // 启动任务
      job.start();
      
      // 保存任务引用
      this.jobs.set(`feed_${feed.id}`, job);
      
      logger.info(`RSS源定时任务已启动: ${feed.name} (${intervalMinutes}分钟间隔)`);
    } catch (error) {
      logger.error(`为RSS源安排定时任务失败: ${feed.name}`, error);
    }
  }

  // 检查是否需要抓取RSS源
  async shouldFetchFeed(feed) {
    try {
      if (!feed.lastFetchTime) {
        return true;
      }

      const now = new Date();
      const lastFetch = new Date(feed.lastFetchTime);
      const timeDiff = now - lastFetch;
      
      return timeDiff >= feed.fetchInterval;
    } catch (error) {
      logger.error(`检查RSS源抓取时间失败: ${feed.name}`, error);
      return true;
    }
  }

  // 停止单个RSS源的定时任务
  stopFeedFetch(feedId) {
    const jobKey = `feed_${feedId}`;
    const job = this.jobs.get(jobKey);
    
    if (job) {
      job.stop();
      this.jobs.delete(jobKey);
      logger.info(`RSS源定时任务已停止: ${feedId}`);
    }
  }

  // 启动清理任务（每天凌晨2点执行）
  startCleanupJob() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('开始清理过期新闻...');
        const deletedCount = await rssService.cleanupOldNews();
        logger.info(`清理完成，删除${deletedCount}条过期新闻`);
      } catch (error) {
        logger.error('清理过期新闻失败:', error);
      }
    }, {
      scheduled: false
    });

    job.start();
    this.jobs.set('cleanup', job);
    
    logger.info('清理任务已启动（每天凌晨2点执行）');
  }

  // 手动触发RSS源抓取
  async triggerFeedFetch(feedId) {
    try {
      const feed = await RssFeed.findByPk(feedId);
      if (!feed) {
        throw new Error('RSS源不存在');
      }

      logger.info(`手动触发RSS源抓取: ${feed.name}`);
      const newsCount = await rssService.fetchFeed(feedId);
      
      return {
        success: true,
        message: `抓取完成，新增${newsCount}条新闻`,
        newsCount
      };
    } catch (error) {
      logger.error(`手动触发RSS源抓取失败: ${feedId}`, error);
      throw error;
    }
  }

  // 手动触发所有RSS源抓取
  async triggerAllFeedsFetch() {
    try {
      const feeds = await RssFeed.findAll({
        where: { isActive: true }
      });

      let totalNewsCount = 0;
      const results = [];

      for (const feed of feeds) {
        try {
          const newsCount = await rssService.fetchFeed(feed.id);
          totalNewsCount += newsCount;
          results.push({
            feedId: feed.id,
            feedName: feed.name,
            success: true,
            newsCount
          });
        } catch (error) {
          results.push({
            feedId: feed.id,
            feedName: feed.name,
            success: false,
            error: error.message
          });
        }
      }

      logger.info(`批量抓取完成，总计新增${totalNewsCount}条新闻`);
      
      return {
        success: true,
        totalNewsCount,
        results
      };
    } catch (error) {
      logger.error('批量抓取RSS源失败:', error);
      throw error;
    }
  }

  // 停止所有任务
  stopAllJobs() {
    for (const [key, job] of this.jobs) {
      job.stop();
      logger.info(`定时任务已停止: ${key}`);
    }
    this.jobs.clear();
  }

  // 获取任务状态
  getJobStatus() {
    const status = {
      totalJobs: this.jobs.size,
      activeJobs: 0,
      jobs: []
    };

    for (const [key, job] of this.jobs) {
      const isActive = job.running;
      if (isActive) status.activeJobs++;
      
      status.jobs.push({
        key,
        active: isActive
      });
    }

    return status;
  }
}

module.exports = new RSSFetchJob(); 
const rssService = require('../services/rssService');
const rssFetchJob = require('../jobs/rssFetchJob');
const logger = require('../utils/logger');

class RSSController {
  // 获取所有RSS源
  async getAllFeeds(req, res) {
    try {
      const { sortBy, sortOrder } = req.query;
      const feeds = await rssService.getAllFeeds(sortBy, sortOrder);
      res.json({
        success: true,
        data: feeds
      });
    } catch (error) {
      logger.error('获取RSS源列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取RSS源列表失败',
        error: error.message
      });
    }
  }

  // 添加RSS源
  async addFeed(req, res) {
    try {
      const { name, url, category, description } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({
          success: false,
          message: '名称和URL是必填项'
        });
      }

      const feed = await rssService.addRssFeed({
        name,
        url,
        category,
        description
      });

      // 为新RSS源启动定时任务
      await rssFetchJob.scheduleFeedFetch(feed);

      res.status(201).json({
        success: true,
        message: 'RSS源添加成功',
        data: feed
      });
    } catch (error) {
      logger.error('添加RSS源失败:', error);
      res.status(500).json({
        success: false,
        message: '添加RSS源失败',
        error: error.message
      });
    }
  }

  // 批量导入OPML文件
  async importOpml(req, res) {
    try {
      const { feeds } = req.body;
      
      if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供有效的RSS源数据'
        });
      }

      logger.info(`开始批量导入 ${feeds.length} 个RSS源`);

      const results = await rssService.batchImportFeeds(feeds);
      
      // 为新增的RSS源启动定时任务
      for (const feed of results.added) {
        await rssFetchJob.scheduleFeedFetch(feed);
      }

      res.json({
        success: true,
        message: `批量导入完成`,
        data: {
          total: feeds.length,
          added: results.added.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
          details: {
            added: results.added.map(f => ({ id: f.id, name: f.name, url: f.url })),
            skipped: results.skipped,
            errors: results.errors
          }
        }
      });
    } catch (error) {
      logger.error('批量导入OPML失败:', error);
      res.status(500).json({
        success: false,
        message: '批量导入失败',
        error: error.message
      });
    }
  }

  // 更新RSS源
  async updateFeed(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const feed = await rssService.updateFeed(id, updateData);

      // 重新安排定时任务
      await rssFetchJob.scheduleFeedFetch(feed);

      res.json({
        success: true,
        message: 'RSS源更新成功',
        data: feed
      });
    } catch (error) {
      logger.error('更新RSS源失败:', error);
      res.status(500).json({
        success: false,
        message: '更新RSS源失败',
        error: error.message
      });
    }
  }

  // 删除RSS源
  async deleteFeed(req, res) {
    try {
      const { id } = req.params;

      await rssService.deleteFeed(id);

      // 停止定时任务
      rssFetchJob.stopFeedFetch(id);

      res.json({
        success: true,
        message: 'RSS源删除成功'
      });
    } catch (error) {
      logger.error('删除RSS源失败:', error);
      res.status(500).json({
        success: false,
        message: '删除RSS源失败',
        error: error.message
      });
    }
  }

  // 验证RSS源
  async validateFeed(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL是必填项'
        });
      }

      const feed = await rssService.validateRssFeed(url);

      res.json({
        success: true,
        message: 'RSS源验证成功',
        data: {
          title: feed.title,
          description: feed.description,
          itemCount: feed.items.length
        }
      });
    } catch (error) {
      logger.error('验证RSS源失败:', error);
      res.status(400).json({
        success: false,
        message: 'RSS源验证失败',
        error: error.message
      });
    }
  }

  // 手动抓取RSS源
  async fetchFeed(req, res) {
    try {
      const { id } = req.params;

      const result = await rssFetchJob.triggerFeedFetch(id);

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      logger.error('手动抓取RSS源失败:', error);
      res.status(500).json({
        success: false,
        message: '手动抓取RSS源失败',
        error: error.message
      });
    }
  }

  // 批量抓取所有RSS源
  async fetchAllFeeds(req, res) {
    try {
      const result = await rssFetchJob.triggerAllFeedsFetch();

      res.json({
        success: true,
        message: '批量抓取完成',
        data: result
      });
    } catch (error) {
      logger.error('批量抓取RSS源失败:', error);
      res.status(500).json({
        success: false,
        message: '批量抓取RSS源失败',
        error: error.message
      });
    }
  }

  // 获取定时任务状态
  async getJobStatus(req, res) {
    try {
      const status = rssFetchJob.getJobStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('获取定时任务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取定时任务状态失败',
        error: error.message
      });
    }
  }

  // 清理过期新闻
  async cleanupOldNews(req, res) {
    try {
      const deletedCount = await rssService.cleanupOldNews();

      res.json({
        success: true,
        message: `清理完成，删除${deletedCount}条过期新闻`,
        data: { deletedCount }
      });
    } catch (error) {
      logger.error('清理过期新闻失败:', error);
      res.status(500).json({
        success: false,
        message: '清理过期新闻失败',
        error: error.message
      });
    }
  }
}

module.exports = new RSSController(); 
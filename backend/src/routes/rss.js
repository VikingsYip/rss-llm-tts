const express = require('express');
const router = express.Router();
const rssController = require('../controllers/rssController');

// RSS源管理
router.get('/feeds', rssController.getAllFeeds);
router.post('/feeds', rssController.addFeed);

// 批量操作 - 必须放在具体ID路由之前
router.put('/feeds/batch-update', rssController.batchUpdateFeeds);

// 具体ID操作 - 放在批量操作之后
router.put('/feeds/:id', rssController.updateFeed);
router.delete('/feeds/:id', rssController.deleteFeed);

// OPML批量导入
router.post('/feeds/import-opml', rssController.importOpml);

// RSS源验证
router.post('/feeds/validate', rssController.validateFeed);

// RSS抓取
router.post('/feeds/:id/fetch', rssController.fetchFeed);
router.post('/feeds/fetch-all', rssController.fetchAllFeeds);

// 定时任务状态
router.get('/jobs/status', rssController.getJobStatus);

// 清理过期新闻
router.post('/cleanup', rssController.cleanupOldNews);

module.exports = router; 
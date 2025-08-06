const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// 新闻列表和搜索
router.get('/', newsController.getNews);

// 新闻详情
router.get('/:id', newsController.getNewsDetail);

// 更新新闻状态
router.put('/:id/status', newsController.updateNewsStatus);

// 新闻统计
router.get('/stats/overview', newsController.getNewsStats);

// 仪表板统计
router.get('/stats/dashboard', newsController.getDashboardStats);

module.exports = router; 
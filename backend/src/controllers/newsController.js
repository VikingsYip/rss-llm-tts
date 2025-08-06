const { News, RssFeed } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

class NewsController {
  // 获取新闻列表
  async getNews(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        source,
        keyword,
        isRead,
        isFavorite,
        isIgnored
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (category) where.category = category;
      if (source) where.sourceName = source;
      if (isRead !== undefined) where.isRead = isRead === 'true';
      if (isFavorite !== undefined) where.isFavorite = isFavorite === 'true';
      if (isIgnored !== undefined) where.isIgnored = isIgnored === 'true';

      if (keyword) {
        where[Op.or] = [
          { title: { [Op.like]: `%${keyword}%` } },
          { content: { [Op.like]: `%${keyword}%` } }
        ];
      }

      const { count, rows } = await News.findAndCountAll({
        where,
        include: [{ model: RssFeed, as: 'rssFeed', attributes: ['name', 'category'] }],
        order: [['publishedAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          news: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      logger.error('获取新闻列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取新闻列表失败',
        error: error.message
      });
    }
  }

  // 获取单条新闻详情
  async getNewsDetail(req, res) {
    try {
      const { id } = req.params;
      const news = await News.findByPk(id, {
        include: [{ model: RssFeed, as: 'rssFeed' }]
      });

      if (!news) {
        return res.status(404).json({
          success: false,
          message: '新闻不存在'
        });
      }

      if (!news.isRead) {
        await news.update({ isRead: true });
      }

      res.json({
        success: true,
        data: news
      });
    } catch (error) {
      logger.error('获取新闻详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取新闻详情失败',
        error: error.message
      });
    }
  }

  // 更新新闻状态
  async updateNewsStatus(req, res) {
    try {
      const { id } = req.params;
      const { isRead, isFavorite, isIgnored } = req.body;

      const news = await News.findByPk(id);
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '新闻不存在'
        });
      }

      const updateData = {};
      if (isRead !== undefined) updateData.isRead = isRead;
      if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
      if (isIgnored !== undefined) updateData.isIgnored = isIgnored;

      await news.update(updateData);

      res.json({
        success: true,
        message: '新闻状态更新成功',
        data: news
      });
    } catch (error) {
      logger.error('更新新闻状态失败:', error);
      res.status(500).json({
        success: false,
        message: '更新新闻状态失败',
        error: error.message
      });
    }
  }

  // 获取新闻统计
  async getNewsStats(req, res) {
    try {
      const totalNews = await News.count();
      const unreadNews = await News.count({ where: { isRead: false } });
      const favoriteNews = await News.count({ where: { isFavorite: true } });

      res.json({
        success: true,
        data: {
          total: totalNews,
          unread: unreadNews,
          favorite: favoriteNews
        }
      });
    } catch (error) {
      logger.error('获取新闻统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取新闻统计失败',
        error: error.message
      });
    }
  }

  // 获取仪表板统计
  async getDashboardStats(req, res) {
    try {
      // 新闻统计
      const totalNews = await News.count();
      const todayNews = await News.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      // RSS源统计
      const { RssFeed } = require('../models');
      const totalFeeds = await RssFeed.count();
      const activeFeeds = await RssFeed.count({ where: { isActive: true } });

      // 对话统计
      const { Dialogue } = require('../models');
      const totalDialogues = await Dialogue.count();
      const todayDialogues = await Dialogue.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      // 分类统计
      const categoryStats = await News.findAll({
        attributes: [
          'category',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['category'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 5
      });

      // 来源统计
      const sourceStats = await News.findAll({
        attributes: [
          'sourceName',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['sourceName'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 5
      });

      res.json({
        success: true,
        data: {
          news: {
            total: totalNews,
            today: todayNews
          },
          feeds: {
            total: totalFeeds,
            active: activeFeeds
          },
          dialogues: {
            total: totalDialogues,
            today: todayDialogues
          },
          categories: categoryStats.map(item => ({
            name: item.category || '其他',
            count: item.getDataValue('count')
          })),
          sources: sourceStats.map(item => ({
            name: item.sourceName || '未知',
            count: item.getDataValue('count')
          }))
        }
      });
    } catch (error) {
      logger.error('获取仪表板统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取仪表板统计失败',
        error: error.message
      });
    }
  }
}

module.exports = new NewsController(); 
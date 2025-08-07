const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('../utils/logger');
const { RssFeed, News, Config } = require('../models');
const { decrypt } = require('../utils/encryption');

class RssService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media'],
          ['enclosure', 'enclosure'],
          ['category', 'category']
        ]
      }
    });
  }

  // 获取代理配置
  async getProxyConfig() {
    try {
      const httpProxyEnabled = await this.getConfigValue('http_proxy_enabled', false);
      const httpProxyUrl = await this.getConfigValue('http_proxy_url', '');
      
      if (httpProxyEnabled && httpProxyUrl) {
        return {
          host: new URL(httpProxyUrl).hostname,
          port: new URL(httpProxyUrl).port || 80,
          protocol: new URL(httpProxyUrl).protocol.replace(':', '')
        };
      }
      
      return null;
    } catch (error) {
      logger.error('获取代理配置失败:', error);
      return null;
    }
  }

  // 使用代理获取RSS内容
  async fetchRssWithProxy(url) {
    try {
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        timeout: 30000, // 增加超时时间到30秒
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxContentLength: 10 * 1024 * 1024, // 限制响应大小为10MB
        maxBodyLength: 10 * 1024 * 1024
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理获取RSS: ${url}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      // 添加重试机制
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.debug(`RSS抓取尝试 ${attempt}/3: ${url}`);
          const response = await axios.get(url, axiosConfig);
          
          // 检查响应状态
          if (response.status === 503) {
            throw new Error(`服务不可用 (503): ${url}`);
          } else if (response.status >= 400) {
            throw new Error(`HTTP错误 ${response.status}: ${url}`);
          }
          
          return response.data;
        } catch (error) {
          lastError = error;
          
          if (error.response && error.response.status === 503) {
            logger.warn(`RSS服务不可用 (503): ${url}, 尝试 ${attempt}/3`);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // 递增延迟
              continue;
            }
          } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            logger.warn(`RSS请求超时: ${url}, 尝试 ${attempt}/3`);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
              continue;
            }
          } else {
            // 其他错误直接抛出
            break;
          }
        }
      }
      
      // 所有重试都失败了
      logger.error(`RSS抓取失败 (已重试3次): ${url}`, lastError);
      throw lastError;
    } catch (error) {
      logger.error(`获取RSS内容失败: ${url}`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        code: error.code
      });
      throw error;
    }
  }

  // 添加RSS源
  async addRssFeed(feedData) {
    try {
      // 验证RSS源是否有效
      await this.validateRssFeed(feedData.url);
      
      const feed = await RssFeed.create({
        name: feedData.name,
        url: feedData.url,
        category: feedData.category,
        description: feedData.description,
        isActive: true
      });

      // 立即抓取一次
      await this.fetchFeed(feed.id);
      
      logger.info(`RSS源添加成功: ${feedData.name}`);
      return feed;
    } catch (error) {
      logger.error('添加RSS源失败:', error);
      throw error;
    }
  }

  // 验证RSS源
  async validateRssFeed(url) {
    try {
      // 使用代理获取RSS内容
      const rssContent = await this.fetchRssWithProxy(url);
      
      // 解析RSS内容
      const feed = await this.parser.parseString(rssContent);
      
      if (!feed.title || !feed.items || feed.items.length === 0) {
        throw new Error('无效的RSS源');
      }
      return feed;
    } catch (error) {
      logger.error(`RSS源验证失败: ${url}`, error);
      throw new Error('RSS源无效或无法访问');
    }
  }

  // 抓取单个RSS源
  async fetchFeed(feedId) {
    try {
      const feed = await RssFeed.findByPk(feedId);
      if (!feed || !feed.isActive) {
        return;
      }

      // 使用代理获取RSS内容
      const rssContent = await this.fetchRssWithProxy(feed.url);
      
      // 解析RSS内容
      const rssData = await this.parser.parseString(rssContent);
      
      const newsCount = await this.processFeedItems(rssData.items, feed);
      
      // 更新最后抓取时间
      await feed.update({ lastFetchTime: new Date() });
      
      logger.info(`RSS源抓取完成: ${feed.name}, 新增新闻: ${newsCount}条`);
      return newsCount;
    } catch (error) {
      logger.error(`RSS源抓取失败: ${feedId}`, error);
      throw error;
    }
  }

  // 处理RSS条目
  async processFeedItems(items, feed) {
    let newCount = 0;
    const retentionHours = await this.getConfigValue('news_retention_hours', 24);
    const cutoffTime = moment().subtract(retentionHours, 'hours').toDate();

    for (const item of items) {
      try {
        // 检查是否已存在
        const existing = await News.findOne({
          where: { guid: item.guid || item.link }
        });

        if (existing) continue;

        // 解析发布时间
        let publishedAt = new Date();
        if (item.pubDate) {
          publishedAt = new Date(item.pubDate);
        } else if (item.isoDate) {
          publishedAt = new Date(item.isoDate);
        }

        // 过滤过期新闻
        if (publishedAt < cutoffTime) continue;

        // 提取内容
        let content = item.content || item['content:encoded'] || item.description || '';
        let summary = item.contentSnippet || item.description || '';

        // 如果有链接，尝试获取完整内容
        if (item.link && !content) {
          try {
            const fullContent = await this.fetchFullContent(item.link);
            if (fullContent) {
              content = fullContent;
            }
          } catch (error) {
            logger.warn(`获取完整内容失败: ${item.link}`, error);
          }
        }

        // 创建新闻记录
        await News.create({
          title: item.title,
          content: content,
          summary: summary,
          link: item.link,
          author: item.creator || item.author,
          publishedAt: publishedAt,
          sourceName: feed.name,
          category: feed.category,
          rssFeedId: feed.id,
          guid: item.guid || item.link || uuidv4()
        });

        newCount++;
      } catch (error) {
        logger.error('处理RSS条目失败:', error);
      }
    }

    return newCount;
  }

  // 获取完整内容
  async fetchFullContent(url) {
    try {
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理获取内容: ${url}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      const response = await axios.get(url, axiosConfig);

      const $ = cheerio.load(response.data);
      
      // 移除脚本和样式
      $('script, style').remove();
      
      // 尝试找到主要内容
      const selectors = [
        'article',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        'main',
        '.main-content'
      ];

      let content = '';
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 100) break;
        }
      }

      // 如果没找到，使用body内容
      if (!content) {
        content = $('body').text().trim();
      }

      return content.substring(0, 5000); // 限制长度
    } catch (error) {
      logger.warn(`获取完整内容失败: ${url}`, error);
      return null;
    }
  }

  // 获取配置值
  async getConfigValue(key, defaultValue = null) {
    try {
      const config = await Config.findOne({ where: { key } });
      if (!config) return defaultValue;
      
      let value = config.value;
      if (config.isEncrypted) {
        value = decrypt(value);
      }
      
      if (config.type === 'number') {
        return parseInt(value) || defaultValue;
      } else if (config.type === 'boolean') {
        return value === 'true';
      } else if (config.type === 'json') {
        return JSON.parse(value);
      }
      
      return value;
    } catch (error) {
      logger.error(`获取配置失败: ${key}`, error);
      return defaultValue;
    }
  }

  // 清理过期新闻
  async cleanupOldNews() {
    try {
      const retentionHours = await this.getConfigValue('news_retention_hours', 24);
      const cutoffTime = moment().subtract(retentionHours, 'hours').toDate();
      
      const deletedCount = await News.destroy({
        where: {
          publishedAt: {
            [require('sequelize').Op.lt]: cutoffTime
          }
        }
      });
      
      logger.info(`清理过期新闻: ${deletedCount}条`);
      return deletedCount;
    } catch (error) {
      logger.error('清理过期新闻失败:', error);
      throw error;
    }
  }

  // 删除RSS源
  async deleteFeed(feedId) {
    try {
      const feed = await RssFeed.findByPk(feedId);
      if (!feed) {
        throw new Error('RSS源不存在');
      }
      
      await feed.destroy();
      logger.info(`RSS源删除成功: ${feed.name}`);
    } catch (error) {
      logger.error('删除RSS源失败:', error);
      throw error;
    }
  }

  // 批量导入RSS源
  async batchImportFeeds(feeds) {
    const results = {
      added: [],
      skipped: [],
      errors: []
    };

    logger.info(`开始批量导入 ${feeds.length} 个RSS源`);

    for (const feedData of feeds) {
      try {
        // 检查必填字段
        if (!feedData.name || !feedData.url) {
          results.errors.push({
            feed: feedData,
            error: '缺少必填字段：name 或 url'
          });
          continue;
        }

        // 检查URL是否已存在
        const existingFeed = await RssFeed.findOne({
          where: { url: feedData.url }
        });

        if (existingFeed) {
          results.skipped.push({
            name: feedData.name,
            url: feedData.url,
            reason: 'URL已存在'
          });
          continue;
        }

        // 验证RSS源（可选，如果验证失败则跳过）
        let isValid = true;
        try {
          await this.validateRssFeed(feedData.url);
        } catch (error) {
          logger.warn(`RSS源验证失败，跳过: ${feedData.url}`, error.message);
          // 可以选择是否跳过验证失败的RSS源
          // isValid = false;
        }

        if (isValid) {
          // 创建RSS源
          const feed = await RssFeed.create({
            name: feedData.name,
            url: feedData.url,
            category: feedData.category || '其他',
            description: feedData.description || '',
            isActive: true,
            fetchInterval: feedData.fetchInterval || 3600000
          });

          results.added.push(feed);
          logger.info(`RSS源导入成功: ${feedData.name}`);
        } else {
          results.skipped.push({
            name: feedData.name,
            url: feedData.url,
            reason: 'RSS源验证失败'
          });
        }
      } catch (error) {
        logger.error(`导入RSS源失败: ${feedData.name}`, error);
        results.errors.push({
          feed: feedData,
          error: error.message
        });
      }
    }

    logger.info(`批量导入完成: 成功 ${results.added.length}, 跳过 ${results.skipped.length}, 错误 ${results.errors.length}`);
    return results;
  }

  // 获取所有RSS源
  async getAllFeeds(sortBy = 'createdAt', sortOrder = 'DESC', category = null) {
    try {
      const whereClause = {};
      
      // 添加分类筛选条件
      if (category) {
        whereClause.category = category;
      }

      const feeds = await RssFeed.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      // 为每个RSS源添加新闻统计
      const feedsWithStats = await Promise.all(
        feeds.map(async (feed) => {
          const newsCount = await News.count({
            where: { rssFeedId: feed.id }
          });
          
          return {
            ...feed.toJSON(),
            articleCount: newsCount
          };
        })
      );

      // 根据排序参数进行排序
      if (sortBy === 'articleCount') {
        feedsWithStats.sort((a, b) => {
          if (sortOrder === 'ASC') {
            return a.articleCount - b.articleCount;
          } else {
            return b.articleCount - a.articleCount;
          }
        });
      } else if (sortBy === 'name') {
        feedsWithStats.sort((a, b) => {
          if (sortOrder === 'ASC') {
            return a.name.localeCompare(b.name);
          } else {
            return b.name.localeCompare(a.name);
          }
        });
      } else if (sortBy === 'lastFetchTime') {
        feedsWithStats.sort((a, b) => {
          const timeA = a.lastFetchTime ? new Date(a.lastFetchTime) : new Date(0);
          const timeB = b.lastFetchTime ? new Date(b.lastFetchTime) : new Date(0);
          if (sortOrder === 'ASC') {
            return timeA - timeB;
          } else {
            return timeB - timeA;
          }
        });
      } else if (sortBy === 'createdAt') {
        feedsWithStats.sort((a, b) => {
          const timeA = new Date(a.createdAt);
          const timeB = new Date(b.createdAt);
          if (sortOrder === 'ASC') {
            return timeA - timeB;
          } else {
            return timeB - timeA;
          }
        });
      }

      return feedsWithStats;
    } catch (error) {
      logger.error('获取RSS源列表失败:', error);
      throw error;
    }
  }

  // 更新RSS源
  async updateFeed(feedId, updateData) {
    const feed = await RssFeed.findByPk(feedId);
    if (!feed) {
      throw new Error('RSS源不存在');
    }

    if (updateData.url && updateData.url !== feed.url) {
      await this.validateRssFeed(updateData.url);
    }

    await feed.update(updateData);
    return feed;
  }

  // 批量更新RSS源状态
  async batchUpdateFeeds(ids, isActive) {
    try {
      const result = {
        updated: 0,
        failed: 0,
        details: []
      };

      // 验证输入参数
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('请提供有效的RSS源ID列表');
      }

      if (typeof isActive !== 'boolean') {
        throw new Error('请提供有效的状态值');
      }

      logger.info(`开始批量${isActive ? '启用' : '禁用'} ${ids.length} 个RSS源`);

      for (const id of ids) {
        try {
          // 验证ID格式
          if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            result.failed++;
            result.details.push({
              id,
              error: '无效的ID格式'
            });
            continue;
          }

          // 尝试转换为数字ID
          const numericId = parseInt(id);
          if (isNaN(numericId)) {
            result.failed++;
            result.details.push({
              id,
              error: 'ID必须是有效的数字'
            });
            continue;
          }

          const feed = await RssFeed.findByPk(numericId);
          if (!feed) {
            result.failed++;
            result.details.push({
              id: numericId,
              error: 'RSS源不存在'
            });
            continue;
          }

          await feed.update({ isActive });
          result.updated++;
          result.details.push({
            id: numericId,
            name: feed.name,
            success: true
          });

          logger.info(`RSS源状态更新成功: ${feed.name} (ID: ${numericId}) -> ${isActive ? '启用' : '禁用'}`);
        } catch (error) {
          result.failed++;
          result.details.push({
            id,
            error: error.message
          });
          logger.error(`更新RSS源状态失败: ${id}`, error);
        }
      }

      logger.info(`批量更新RSS源状态完成: 成功 ${result.updated}, 失败 ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('批量更新RSS源状态失败:', error);
      throw error;
    }
  }

  // 根据ID获取RSS源
  async getFeedById(feedId) {
    try {
      const feed = await RssFeed.findByPk(feedId);
      return feed;
    } catch (error) {
      logger.error(`获取RSS源失败: ${feedId}`, error);
      return null;
    }
  }
}

module.exports = new RssService(); 
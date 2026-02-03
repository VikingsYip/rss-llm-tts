const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { syncDatabase } = require('./models');
const rssFetchJob = require('./jobs/rssFetchJob');
const logger = require('./utils/logger');

// 导入路由
const rssRoutes = require('./routes/rss');
const newsRoutes = require('./routes/news');
const dialogueRoutes = require('./routes/dialogue');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://localhost:3000', 'https://yourdomain.com'] 
    : true,
  credentials: true
}));

// 压缩中间件
app.use(compression());

// 限流中间件
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  }
});
app.use('/api/', limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API路由
app.use('/api/rss', rssRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/dialogue', dialogueRoutes);
app.use('/api/config', configRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  logger.error('应用错误:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 内存监控和自动重启机制
function setupMemoryMonitoring() {
  // 每5分钟检查一次内存使用情况
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    logger.info(`内存使用情况: ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(heapUsagePercent)}%)`);

    // 如果堆内存使用率超过80%，记录警告并自动清理内存
    if (heapUsagePercent > 80) {
      logger.warn(`内存使用率过高: ${Math.round(heapUsagePercent)}%，建议重启应用`);

      // 自动执行内存清理
      logger.info('开始执行自动内存清理...');
      try {
        // 强制垃圾回收（开发环境始终执行，生产环境超过85%时执行）
        if (typeof global.gc === 'function') {
          const beforeGC = process.memoryUsage();
          global.gc();
          const afterGC = process.memoryUsage();
          const freedMB = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
          logger.info(`垃圾回收完成，释放内存: ${freedMB}MB`);
        } else {
          logger.warn('垃圾回收不可用，请启用 --expose-gc 参数');
        }

        // 清理模块缓存（仅在开发环境）
        if (process.env.NODE_ENV === 'development') {
          const modulesBefore = Object.keys(require.cache).length;
          Object.keys(require.cache).forEach(key => {
            if (key.includes('node_modules')) {
              delete require.cache[key];
            }
          });
          const modulesAfter = Object.keys(require.cache).length;
          logger.info(`清理模块缓存: ${modulesBefore - modulesAfter} 个模块`);
        }
      } catch (error) {
        logger.error('自动内存清理失败:', error);
      }

      // 如果内存使用率超过95%，自动重启（生产环境也执行）
      if (heapUsagePercent > 95) {
        logger.error('内存使用率过高，准备重启应用...');
        setTimeout(() => {
          process.exit(1);
        }, 5000);
      }
    }
  }, 5 * 60 * 1000); // 5分钟

  // 预防性垃圾回收：每30分钟执行一次（如果GC可用）
  if (typeof global.gc === 'function') {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // 如果堆内存使用超过1.5GB，执行预防性GC
      if (heapUsedMB > 1500) {
        logger.info(`预防性内存清理: 当前使用 ${heapUsedMB}MB`);
        global.gc();
        const afterGC = process.memoryUsage();
        const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024);
        logger.info(`预防性GC完成，释放到 ${afterMB}MB`);
      }
    }, 30 * 60 * 1000); // 30分钟
  }
  
  // 监听未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    process.exit(1);
  });
  
  // 监听未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', reason);
    process.exit(1);
  });
  
  // 监听内存警告
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      logger.warn('事件监听器过多:', warning.message);
    }
  });
}

// 启动内存监控
setupMemoryMonitoring();

// 启动服务器
async function startServer() {
  try {
    // 同步数据库
    await syncDatabase();
    
    // 启动定时任务
    await rssFetchJob.startAllJobs();
    
    // 启动服务器
    app.listen(PORT, () => {
      logger.info(`服务器启动成功，端口: ${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/health`);
      logger.info(`API文档: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  rssFetchJob.stopAllJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  rssFetchJob.stopAllJobs();
  process.exit(0);
});

// 启动服务器
startServer();

module.exports = app; 
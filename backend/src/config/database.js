const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'rss_llm_tts',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,           // 增加最大连接数
      min: 2,            // 增加最小连接数
      acquire: 60000,    // 增加获取连接超时时间到60秒
      idle: 30000        // 增加空闲连接超时时间到30秒
    },
    timezone: '+08:00',
    // 增加查询超时设置
    query: {
      timeout: 30000     // 查询超时30秒
    },
    // 增加连接重试设置
    retry: {
      max: 3,            // 最大重试次数
      timeout: 10000     // 重试间隔
    },
    // 增加事务设置
    transactionType: 'IMMEDIATE',
    isolationLevel: 'READ_COMMITTED'
  }
);

module.exports = sequelize; 
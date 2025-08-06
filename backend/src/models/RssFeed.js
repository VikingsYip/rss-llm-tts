const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RssFeed = sequelize.define('RssFeed', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'RSS源名称'
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'RSS源URL'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '分类标签'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '描述'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  lastFetchTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后抓取时间'
  },
  fetchInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 3600000, // 1小时
    comment: '抓取间隔(毫秒)'
  }
}, {
  tableName: 'rss_feeds',
  timestamps: true,
  indexes: [
    {
      fields: ['category']
    },
    {
      fields: ['isActive']
    }
  ]
});

module.exports = RssFeed; 
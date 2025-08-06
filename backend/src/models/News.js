const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const News = sequelize.define('News', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '新闻标题'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '新闻内容'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '新闻摘要'
  },
  link: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '原始链接'
  },
  author: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '作者'
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '发布时间'
  },
  sourceName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '来源名称'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '分类'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已读'
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否收藏'
  },
  isIgnored: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否忽略'
  },
  rssFeedId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'RSS源ID'
  },
  guid: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: '唯一标识符'
  }
}, {
  tableName: 'news',
  timestamps: true,
  indexes: [
    {
      fields: ['rssFeedId']
    },
    {
      fields: ['publishedAt']
    },
    {
      fields: ['category']
    },
    {
      fields: ['isRead']
    },
    {
      fields: ['isFavorite']
    },
    {
      fields: ['guid']
    }
  ]
});

module.exports = News; 
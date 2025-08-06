const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dialogue = sequelize.define('Dialogue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '对话标题'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '对话内容(JSON格式)'
  },
  dialogueType: {
    type: DataTypes.ENUM('interview', 'ceo_interview', 'commentary', 'chat'),
    defaultValue: 'interview',
    comment: '对话类型'
  },
  character1: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '角色1名称'
  },
  character2: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '角色2名称'
  },
  rounds: {
    type: DataTypes.INTEGER,
    defaultValue: 8,
    comment: '对话轮次'
  },
  newsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: '使用的新闻数量'
  },
  status: {
    type: DataTypes.ENUM('generating', 'completed', 'failed'),
    defaultValue: 'generating',
    comment: '生成状态'
  },
  audioFile: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '音频文件路径'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '音频时长(秒)'
  }
}, {
  tableName: 'dialogues',
  timestamps: true,
  indexes: [
    {
      fields: ['dialogueType']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Dialogue; 
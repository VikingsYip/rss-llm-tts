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
  dialogueType: {
    type: DataTypes.ENUM('interview', 'ceo_interview', 'commentary', 'chat'),
    allowNull: false,
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
  status: {
    type: DataTypes.ENUM('generating', 'completed', 'failed'),
    defaultValue: 'generating',
    comment: '对话状态'
  },
  rounds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 8,
    comment: '对话轮次'
  },
  newsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    comment: '使用的新闻数量'
  },
  audioFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '音频文件路径'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '音频时长（秒）'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '对话内容（JSON格式）',
    get() {
      const value = this.getDataValue('content');
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    },
    set(value) {
      if (value === null || value === undefined) {
        this.setDataValue('content', null);
      } else {
        this.setDataValue('content', JSON.stringify(value));
      }
    }
  },
  newsIds: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '使用的新闻ID列表（JSON格式）',
    get() {
      const value = this.getDataValue('newsIds');
      if (!value) return [];
      try {
        return JSON.parse(value);
      } catch (error) {
        return [];
      }
    },
    set(value) {
      if (!value || !Array.isArray(value)) {
        this.setDataValue('newsIds', JSON.stringify([]));
      } else {
        this.setDataValue('newsIds', JSON.stringify(value));
      }
    }
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  }
}, {
  tableName: 'dialogues',
  timestamps: true,
  comment: '对话记录表'
});

module.exports = Dialogue; 
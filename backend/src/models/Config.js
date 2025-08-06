const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Config = sequelize.define('Config', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '配置键'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '配置值'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '配置描述'
  },
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
    defaultValue: 'string',
    comment: '值类型'
  },
  isEncrypted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否加密存储'
  }
}, {
  tableName: 'configs',
  timestamps: true,
  indexes: [
    {
      fields: ['key']
    }
  ]
});

module.exports = Config; 
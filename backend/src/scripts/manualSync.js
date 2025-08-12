const sequelize = require('../config/database');
const logger = require('../utils/logger');

async function manualSync() {
  try {
    logger.info('开始手动数据库同步...');
    
    // 检查并添加新字段，但不修改现有索引
    const connection = await sequelize.getConnection();
    
    // 检查news表是否有guid字段的UNIQUE约束
    const [newsIndexes] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = 'rss_llm_tts' 
      AND TABLE_NAME = 'news' 
      AND COLUMN_NAME = 'guid'
    `);
    
    const hasUniqueGuid = newsIndexes.some(index => index.NON_UNIQUE === 0);
    
    if (!hasUniqueGuid) {
      logger.info('为news表的guid字段添加UNIQUE约束...');
      await connection.query(`
        ALTER TABLE news 
        ADD UNIQUE INDEX guid_unique (guid)
      `);
      logger.info('guid字段UNIQUE约束添加成功');
    } else {
      logger.info('news表的guid字段已有UNIQUE约束');
    }
    
    // 检查configs表是否有key字段的UNIQUE约束
    const [configIndexes] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = 'rss_llm_tts' 
      AND TABLE_NAME = 'configs' 
      AND COLUMN_NAME = 'key'
    `);
    
    const hasUniqueKey = configIndexes.some(index => index.NON_UNIQUE === 0);
    
    if (!hasUniqueKey) {
      logger.info('为configs表的key字段添加UNIQUE约束...');
      await connection.query(`
        ALTER TABLE configs 
        ADD UNIQUE INDEX key_unique (key)
      `);
      logger.info('key字段UNIQUE约束添加成功');
    } else {
      logger.info('configs表的key字段已有UNIQUE约束');
    }
    
    // 检查并添加新字段
    const [newsColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'rss_llm_tts' 
      AND TABLE_NAME = 'news'
    `);
    
    const existingNewsColumns = newsColumns.map(col => col.COLUMN_NAME);
    
    // 添加缺失的字段
    if (!existingNewsColumns.includes('guid')) {
      logger.info('添加news表的guid字段...');
      await connection.query(`
        ALTER TABLE news 
        ADD COLUMN guid VARCHAR(255) NOT NULL DEFAULT ''
      `);
    }
    
    if (!existingNewsColumns.includes('isIgnored')) {
      logger.info('添加news表的isIgnored字段...');
      await connection.query(`
        ALTER TABLE news 
        ADD COLUMN isIgnored BOOLEAN NOT NULL DEFAULT FALSE
      `);
    }
    
    if (!existingNewsColumns.includes('status')) {
      logger.info('添加news表的status字段...');
      await connection.query(`
        ALTER TABLE news 
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'published'
      `);
    }
    
    // 检查configs表字段
    const [configColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'rss_llm_tts' 
      AND TABLE_NAME = 'configs'
    `);
    
    const existingConfigColumns = configColumns.map(col => col.COLUMN_NAME);
    
    // 添加新的配置字段
    const newConfigFields = [
      { name: 'tts_voice_host', type: 'VARCHAR(255) NOT NULL DEFAULT "alloy"' },
      { name: 'tts_voice_guest', type: 'VARCHAR(255) NOT NULL DEFAULT "nova"' },
      { name: 'http_proxy_enabled', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'http_proxy_url', type: 'VARCHAR(500) NOT NULL DEFAULT ""' }
    ];
    
    for (const field of newConfigFields) {
      if (!existingConfigColumns.includes(field.name)) {
        logger.info(`添加configs表的${field.name}字段...`);
        await connection.query(`
          ALTER TABLE configs 
          ADD COLUMN ${field.name} ${field.type}
        `);
      }
    }
    
    await connection.release();
    logger.info('手动数据库同步完成');
    
  } catch (error) {
    logger.error('手动数据库同步失败:', error);
    throw error;
  }
}

module.exports = manualSync; 
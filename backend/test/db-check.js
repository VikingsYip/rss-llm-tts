const sequelize = require('./src/config/database');
const logger = require('./src/utils/logger');

async function checkDatabaseConnection() {
  console.log('数据库连接检查');
  console.log('================\n');
  
  try {
    console.log('1. 检查数据库配置...');
    console.log('   主机:', process.env.DB_HOST || 'localhost');
    console.log('   端口:', process.env.DB_PORT || 3306);
    console.log('   数据库:', process.env.DB_NAME || 'rss_llm_tts');
    console.log('   用户:', process.env.DB_USER || 'root');
    console.log('   密码:', process.env.DB_PASSWORD ? '***已设置***' : '***未设置***');
    
    console.log('\n2. 测试数据库连接...');
    const startTime = Date.now();
    
    await sequelize.authenticate();
    
    const endTime = Date.now();
    console.log(`✅ 数据库连接成功！响应时间: ${endTime - startTime}ms`);
    
    console.log('\n3. 检查数据库表...');
    const tables = await sequelize.showAllSchemas();
    console.log('   可用数据库:', tables.map(t => t.name).join(', '));
    
    console.log('\n4. 测试查询...');
    const result = await sequelize.query('SELECT 1 as test');
    console.log('✅ 查询测试成功:', result[0][0]);
    
    console.log('\n✅ 数据库连接检查完成，一切正常！');
    
  } catch (error) {
    console.log('\n❌ 数据库连接失败:', error.message);
    
    if (error.name === 'SequelizeConnectionError') {
      console.log('\n💡 连接错误解决建议:');
      console.log('   1. 检查MySQL服务是否正在运行');
      console.log('   2. 确认数据库主机地址和端口是否正确');
      console.log('   3. 检查用户名和密码是否正确');
      console.log('   4. 确认数据库是否存在');
      console.log('   5. 检查防火墙设置');
    } else if (error.name === 'SequelizeConnectionAcquireTimeoutError') {
      console.log('\n💡 连接超时解决建议:');
      console.log('   1. 检查数据库服务器负载');
      console.log('   2. 增加连接池大小');
      console.log('   3. 检查网络连接');
      console.log('   4. 重启数据库服务');
    } else if (error.name === 'SequelizeAccessDeniedError') {
      console.log('\n💡 访问被拒绝解决建议:');
      console.log('   1. 检查用户名和密码');
      console.log('   2. 确认用户权限');
      console.log('   3. 检查数据库访问权限');
    }
    
    console.log('\n🔧 环境变量检查:');
    console.log('   DB_HOST:', process.env.DB_HOST || '未设置');
    console.log('   DB_PORT:', process.env.DB_PORT || '未设置');
    console.log('   DB_NAME:', process.env.DB_NAME || '未设置');
    console.log('   DB_USER:', process.env.DB_USER || '未设置');
    console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? '已设置' : '未设置');
  } finally {
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

// 运行检查
checkDatabaseConnection(); 
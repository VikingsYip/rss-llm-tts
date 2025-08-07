const axios = require('axios');

// 测试批量更新RSS源功能
async function testBatchUpdate() {
  console.log('测试批量更新RSS源功能');
  console.log('========================\n');
  
  try {
    // 1. 首先获取所有RSS源
    console.log('1. 获取RSS源列表...');
    const feedsResponse = await axios.get('http://localhost:3001/api/rss/feeds');
    
    if (!feedsResponse.data.success) {
      console.log('❌ 获取RSS源列表失败:', feedsResponse.data.message);
      return;
    }
    
    const feeds = feedsResponse.data.data;
    console.log(`✅ 获取到 ${feeds.length} 个RSS源`);
    
    if (feeds.length === 0) {
      console.log('⚠️  没有RSS源可供测试');
      return;
    }
    
    // 2. 选择前3个RSS源进行测试
    const testIds = feeds.slice(0, 3).map(feed => feed.id);
    console.log(`2. 选择测试RSS源: ${testIds.join(', ')}`);
    
    // 3. 测试批量禁用
    console.log('\n3. 测试批量禁用...');
    const disableResponse = await axios.put('http://localhost:3001/api/rss/feeds/batch-update', {
      ids: testIds,
      isActive: false
    });
    
    if (disableResponse.data.success) {
      console.log('✅ 批量禁用成功');
      console.log(`   成功禁用: ${disableResponse.data.data.updated} 个`);
      console.log(`   失败: ${disableResponse.data.data.failed} 个`);
      if (disableResponse.data.data.details) {
        console.log('   详细信息:');
        disableResponse.data.data.details.forEach(detail => {
          if (detail.success) {
            console.log(`     ✅ ID ${detail.id}: ${detail.name}`);
          } else {
            console.log(`     ❌ ID ${detail.id}: ${detail.error}`);
          }
        });
      }
    } else {
      console.log('❌ 批量禁用失败:', disableResponse.data.message);
    }
    
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. 测试批量启用
    console.log('\n4. 测试批量启用...');
    const enableResponse = await axios.put('http://localhost:3001/api/rss/feeds/batch-update', {
      ids: testIds,
      isActive: true
    });
    
    if (enableResponse.data.success) {
      console.log('✅ 批量启用成功');
      console.log(`   成功启用: ${enableResponse.data.data.updated} 个`);
      console.log(`   失败: ${enableResponse.data.data.failed} 个`);
      if (enableResponse.data.data.details) {
        console.log('   详细信息:');
        enableResponse.data.data.details.forEach(detail => {
          if (detail.success) {
            console.log(`     ✅ ID ${detail.id}: ${detail.name}`);
          } else {
            console.log(`     ❌ ID ${detail.id}: ${detail.error}`);
          }
        });
      }
    } else {
      console.log('❌ 批量启用失败:', enableResponse.data.message);
    }
    
    // 5. 测试错误情况
    console.log('\n5. 测试错误情况...');
    
    // 测试无效ID
    console.log('   测试无效ID...');
    const invalidResponse = await axios.put('http://localhost:3001/api/rss/feeds/batch-update', {
      ids: ['invalid-id', 'not-a-number'],
      isActive: false
    });
    
    if (invalidResponse.data.success) {
      console.log('✅ 无效ID处理正确');
      console.log(`   失败: ${invalidResponse.data.data.failed} 个`);
    } else {
      console.log('❌ 无效ID处理失败:', invalidResponse.data.message);
    }
    
    // 测试空数组
    console.log('   测试空数组...');
    try {
      const emptyResponse = await axios.put('http://localhost:3001/api/rss/feeds/batch-update', {
        ids: [],
        isActive: false
      });
      console.log('❌ 空数组应该返回错误');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ 空数组正确处理');
      } else {
        console.log('❌ 空数组处理异常:', error.message);
      }
    }
    
    console.log('\n✅ 批量更新功能测试完成');
    
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message);
    
    if (error.response) {
      console.log('   响应状态:', error.response.status);
      console.log('   响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行测试
testBatchUpdate(); 
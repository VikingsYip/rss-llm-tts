# RSS源管理 - OPML批量导入功能

## 功能概述

RSS聚合新闻系统现在支持通过OPML文件批量导入RSS源，并自动保存到数据库。这个功能大大简化了RSS源的配置过程。

## 新增功能

### ✅ 后端功能
1. **批量导入API**: `/api/rss/feeds/import-opml`
2. **数据库存储**: 自动保存到MySQL数据库
3. **重复检查**: 避免重复导入相同的RSS源
4. **错误处理**: 详细的导入结果反馈
5. **定时任务**: 自动为新RSS源启动抓取任务

### ✅ 前端功能
1. **OPML文件上传**: 支持.opml和.xml格式
2. **实时反馈**: 显示导入进度和结果
3. **数据同步**: 自动刷新RSS源列表
4. **错误提示**: 详细的错误信息显示

## 使用方法

### 1. 启动后端服务
```bash
cd rss-llm-tts/backend
npm install
npm start
```

### 2. 启动前端服务
```bash
cd rss-llm-tts/frontend
npm install
npm run dev
```

### 3. 导入OPML文件
1. 打开浏览器访问前端应用
2. 进入"RSS源管理"页面
3. 点击"导入OPML"按钮
4. 选择您的OPML文件（如 `feeds-zh.opml`）
5. 系统自动解析并导入RSS源

## API接口

### 批量导入RSS源
```
POST /api/rss/feeds/import-opml
Content-Type: application/json

{
  "feeds": [
    {
      "name": "RSS源名称",
      "url": "RSS Feed URL",
      "category": "分类",
      "fetchInterval": 3600000
    }
  ]
}
```

### 响应格式
```json
{
  "success": true,
  "message": "批量导入完成",
  "data": {
    "total": 204,
    "added": 200,
    "skipped": 4,
    "errors": 0,
    "details": {
      "added": [
        {"id": 1, "name": "36氪", "url": "https://www.36kr.com/feed"}
      ],
      "skipped": [
        {"name": "重复RSS源", "url": "https://example.com/feed", "reason": "URL已存在"}
      ],
      "errors": []
    }
  }
}
```

## 数据库结构

### RSS源表 (rss_feeds)
```sql
CREATE TABLE rss_feeds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL COMMENT 'RSS源名称',
  url TEXT NOT NULL COMMENT 'RSS源URL',
  category VARCHAR(100) COMMENT '分类标签',
  description TEXT COMMENT '描述',
  isActive BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  lastFetchTime DATETIME COMMENT '最后抓取时间',
  fetchInterval INT DEFAULT 3600000 COMMENT '抓取间隔(毫秒)',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 测试功能

### 运行测试脚本
```bash
cd rss-llm-tts/backend
node test-opml-import.js
```

### 测试结果示例
```
开始测试OPML导入功能...
导入结果: {
  success: true,
  message: "批量导入完成",
  data: {
    total: 3,
    added: 3,
    skipped: 0,
    errors: 0
  }
}
✅ 测试成功！
- 总数: 3
- 成功导入: 3
- 跳过: 0
- 错误: 0
```

## 错误处理

### 常见错误及解决方案

1. **RSS源验证失败**
   - 原因: RSS Feed URL无效或无法访问
   - 解决: 检查URL是否正确，确认RSS源是否可用

2. **重复导入**
   - 原因: RSS源URL已存在于数据库中
   - 解决: 系统自动跳过重复项，无需手动处理

3. **网络连接问题**
   - 原因: 无法连接到RSS源服务器
   - 解决: 检查网络连接，稍后重试

4. **数据库连接失败**
   - 原因: 数据库服务未启动或配置错误
   - 解决: 检查数据库配置，确保服务正常运行

## 性能优化

### 批量导入优化
- 使用事务处理确保数据一致性
- 批量插入减少数据库操作
- 异步处理避免阻塞

### 内存管理
- 流式处理大文件
- 及时释放内存
- 错误恢复机制

## 监控和日志

### 日志记录
- 导入开始和完成时间
- 成功/失败/跳过的RSS源数量
- 详细的错误信息

### 监控指标
- 导入成功率
- 处理时间
- 错误率统计

## 下一步计划

1. **增量导入**: 支持增量更新RSS源
2. **导入历史**: 记录导入历史记录
3. **导入模板**: 提供更多OPML模板
4. **导出功能**: 支持导出当前RSS源为OPML
5. **批量操作**: 支持批量启用/禁用RSS源

## 技术支持

如果遇到问题，请：
1. 检查后端服务是否正常运行
2. 查看后端日志文件
3. 确认数据库连接正常
4. 验证OPML文件格式正确 
# RSS源统计功能 - 完整指南

## 功能概述

RSS聚合新闻系统现在支持RSS源文章统计功能，可以实时显示每个RSS源抓取的文章数量。

## 新增功能

### ✅ 后端功能
1. **文章统计**: 为每个RSS源计算文章数量
2. **实时更新**: 抓取后自动更新文章统计
3. **批量抓取**: 支持批量抓取所有RSS源

### ✅ 前端功能
1. **文章数显示**: 在RSS源列表中显示文章数量
2. **实时刷新**: 抓取后自动刷新统计信息
3. **批量抓取**: 一键抓取所有RSS源

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

### 3. 查看RSS源统计
1. 打开浏览器访问前端应用
2. 进入"RSS源管理"页面
3. 在表格中查看"文章数"列
4. 点击"抓取"按钮更新单个RSS源
5. 点击"批量抓取"按钮更新所有RSS源

## API接口

### 获取RSS源列表（包含统计）
```
GET /api/rss/feeds
```

**响应格式:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "36氪",
      "url": "https://www.36kr.com/feed",
      "category": "科技",
      "isActive": true,
      "lastFetchTime": "2024-01-01T12:00:00Z",
      "fetchInterval": 3600000,
      "articleCount": 150
    }
  ]
}
```

### 手动抓取RSS源
```
POST /api/rss/feeds/:id/fetch
```

### 批量抓取所有RSS源
```
POST /api/rss/feeds/fetch-all
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

### 新闻表 (news)
```sql
CREATE TABLE news (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL COMMENT '新闻标题',
  content TEXT COMMENT '新闻内容',
  summary TEXT COMMENT '新闻摘要',
  link VARCHAR(1000) COMMENT '原文链接',
  author VARCHAR(100) COMMENT '作者',
  publishedAt DATETIME COMMENT '发布时间',
  sourceName VARCHAR(100) COMMENT '来源名称',
  category VARCHAR(100) COMMENT '分类',
  rssFeedId INT COMMENT 'RSS源ID',
  guid VARCHAR(255) UNIQUE COMMENT '唯一标识',
  isRead BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  isFavorite BOOLEAN DEFAULT FALSE COMMENT '是否收藏',
  isIgnored BOOLEAN DEFAULT FALSE COMMENT '是否忽略',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rssFeedId) REFERENCES rss_feeds(id) ON DELETE SET NULL
);
```

## 前端功能详解

### RSS源列表页面功能

1. **文章数显示**
   - 实时显示每个RSS源的文章数量
   - 抓取后自动更新统计信息

2. **单个抓取**
   - 点击"抓取"按钮更新单个RSS源
   - 显示抓取进度和结果

3. **批量抓取**
   - 点击"批量抓取"按钮更新所有RSS源
   - 显示批量抓取进度

4. **统计信息**
   - 总RSS源数量
   - 每个RSS源的文章数量
   - 最后抓取时间

## 测试功能

### 运行测试脚本
```bash
cd rss-llm-tts/backend
node test-rss-stats.js
```

### 测试结果示例
```
开始测试RSS源统计功能...

1. 测试获取RSS源列表...
RSS源列表响应: { success: true, totalFeeds: 3 }
RSS源统计信息:
  1. 36氪: 150 篇文章
  2. 机器之心: 89 篇文章
  3. 虎嗅网: 234 篇文章

2. 测试手动抓取RSS源: 36氪...
抓取响应: { success: true, message: '抓取成功' }

3. 检查抓取后的文章数更新...
抓取前文章数: 150
抓取后文章数: 155
新增文章数: 5

4. 测试批量抓取所有RSS源...
批量抓取响应: { success: true, message: '批量抓取完成' }

✅ RSS源统计功能测试完成！
```

## 性能优化

### 数据库优化
- 使用索引优化文章统计查询
- 缓存统计结果减少重复计算
- 批量更新减少数据库操作

### 前端优化
- 实时更新统计信息
- 显示抓取进度
- 错误处理和重试机制

### API优化
- 异步处理抓取任务
- 返回详细的抓取结果
- 支持部分失败处理

## 错误处理

### 常见错误及解决方案

1. **文章统计为0**
   - 原因: RSS源尚未抓取或抓取失败
   - 解决: 手动抓取RSS源

2. **抓取失败**
   - 原因: RSS源URL无效或网络问题
   - 解决: 检查RSS源配置和网络连接

3. **统计不准确**
   - 原因: 数据库同步问题
   - 解决: 重新抓取RSS源

4. **批量抓取超时**
   - 原因: RSS源数量过多或网络慢
   - 解决: 分批抓取或增加超时时间

## 监控和日志

### 日志记录
- RSS源抓取日志
- 文章统计更新日志
- 错误和异常日志

### 监控指标
- 抓取成功率
- 文章数量变化
- 抓取时间统计

## 下一步计划

1. **定时抓取**: 自动定时抓取RSS源
2. **增量抓取**: 只抓取新文章
3. **抓取历史**: 记录抓取历史
4. **统计图表**: 显示文章数量趋势
5. **抓取配置**: 自定义抓取参数

## 技术支持

如果遇到问题，请：
1. 检查后端服务是否正常运行
2. 查看后端日志文件
3. 确认数据库连接正常
4. 验证RSS源URL是否有效
5. 检查网络连接状态 
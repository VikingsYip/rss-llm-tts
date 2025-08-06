# 新闻管理功能 - 完整指南

## 功能概述

RSS聚合新闻系统现在支持完整的新闻管理功能，包括从数据库读取新闻、搜索筛选、状态管理等。

## 新增功能

### ✅ 后端功能
1. **新闻列表API**: `GET /api/news` - 支持分页、搜索、筛选
2. **新闻详情API**: `GET /api/news/:id` - 获取单条新闻详情
3. **状态管理API**: `PUT /api/news/:id/status` - 更新阅读、收藏、忽略状态
4. **统计API**: `GET /api/news/stats/overview` - 获取新闻统计信息
5. **数据库集成**: 从MySQL数据库读取真实新闻数据

### ✅ 前端功能
1. **新闻列表页面**: 支持搜索、筛选、分页
2. **新闻详情页面**: 完整显示新闻内容
3. **状态管理**: 已读/未读、收藏、忽略功能
4. **统计展示**: 实时显示新闻统计信息
5. **响应式设计**: 适配不同屏幕尺寸

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

### 3. 访问新闻功能
1. 打开浏览器访问前端应用
2. 点击侧边栏"新闻列表"进入新闻页面
3. 使用搜索和筛选功能查找新闻
4. 点击新闻标题查看详情

## API接口

### 获取新闻列表
```
GET /api/news?page=1&limit=20&keyword=科技&category=科技&source=36氪&isRead=false&isFavorite=true
```

**参数说明:**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20)
- `keyword`: 搜索关键词
- `category`: 分类筛选
- `source`: 来源筛选
- `isRead`: 阅读状态 (true/false)
- `isFavorite`: 收藏状态 (true/false)
- `isIgnored`: 忽略状态 (true/false)

**响应格式:**
```json
{
  "success": true,
  "data": {
    "news": [
      {
        "id": 1,
        "title": "新闻标题",
        "summary": "新闻摘要",
        "content": "新闻内容",
        "link": "原文链接",
        "author": "作者",
        "publishedAt": "2024-01-01T12:00:00Z",
        "sourceName": "36氪",
        "category": "科技",
        "isRead": false,
        "isFavorite": false,
        "isIgnored": false,
        "rssFeed": {
          "name": "36氪",
          "category": "科技"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### 获取新闻详情
```
GET /api/news/:id
```

**响应格式:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "新闻标题",
    "summary": "新闻摘要",
    "content": "完整的新闻内容",
    "link": "原文链接",
    "author": "作者",
    "publishedAt": "2024-01-01T12:00:00Z",
    "sourceName": "36氪",
    "category": "科技",
    "isRead": true,
    "isFavorite": false,
    "isIgnored": false,
    "rssFeed": {
      "id": 1,
      "name": "36氪",
      "category": "科技"
    }
  }
}
```

### 更新新闻状态
```
PUT /api/news/:id/status
Content-Type: application/json

{
  "isRead": true,
  "isFavorite": true,
  "isIgnored": false
}
```

### 获取新闻统计
```
GET /api/news/stats/overview
```

**响应格式:**
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "unread": 150,
    "favorite": 25
  }
}
```

## 数据库结构

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

### 新闻列表页面功能

1. **统计信息展示**
   - 总新闻数
   - 未读新闻数
   - 收藏新闻数
   - 今日新增数

2. **搜索和筛选**
   - 关键词搜索（标题和内容）
   - 分类筛选
   - 来源筛选
   - 阅读状态筛选
   - 收藏状态筛选

3. **新闻卡片展示**
   - 新闻标题（可点击进入详情）
   - 新闻摘要
   - 分类和来源标签
   - 发布时间（相对时间显示）
   - 状态操作按钮

4. **状态管理**
   - 已读/未读切换
   - 收藏/取消收藏
   - 忽略/取消忽略

5. **分页功能**
   - 支持页码跳转
   - 显示总数和当前范围

### 新闻详情页面功能

1. **面包屑导航**
   - 返回新闻列表

2. **操作按钮**
   - 返回列表
   - 已读/未读切换
   - 收藏/取消收藏
   - 忽略/取消忽略
   - 查看原文

3. **新闻内容展示**
   - 新闻标题
   - 元信息（时间、作者、分类、来源）
   - 新闻摘要
   - 完整新闻内容
   - 原文链接

## 测试功能

### 运行测试脚本
```bash
cd rss-llm-tts/backend
node test-news-api.js
```

### 测试结果示例
```
开始测试新闻API功能...

1. 测试获取新闻列表...
新闻列表响应: { success: true, total: 150, newsCount: 5 }
第一条新闻: { id: 1, title: '36氪首发 | 某公司完成A轮融资...', source: '36氪', category: '科技' }

2. 测试获取新闻详情...
新闻详情响应: { success: true, title: '36氪首发 | 某公司完成A轮融资...', hasContent: true, hasSummary: true }

3. 测试更新新闻状态...
更新状态响应: { success: true, message: '新闻状态更新成功' }

4. 测试获取新闻统计...
新闻统计响应: { success: true, total: 150, unread: 45, favorite: 12 }

5. 测试搜索功能...
搜索响应: { success: true, total: 25, newsCount: 5 }

6. 测试分类筛选...
分类筛选响应: { success: true, total: 30, newsCount: 5 }

✅ 新闻API测试完成！
```

## 性能优化

### 数据库优化
- 索引优化：在常用查询字段上建立索引
- 分页查询：避免一次性加载大量数据
- 关联查询：使用JOIN减少查询次数

### 前端优化
- 虚拟滚动：处理大量新闻数据
- 懒加载：图片和内容按需加载
- 缓存策略：缓存常用数据

### API优化
- 响应压缩：减少传输数据量
- 缓存头：设置合适的缓存策略
- 错误处理：优雅处理异常情况

## 错误处理

### 常见错误及解决方案

1. **新闻不存在**
   - 原因: 新闻ID无效或已被删除
   - 解决: 检查新闻ID，返回404页面

2. **数据库连接失败**
   - 原因: 数据库服务未启动
   - 解决: 检查数据库配置和连接

3. **搜索无结果**
   - 原因: 关键词不匹配或数据为空
   - 解决: 显示空状态页面

4. **状态更新失败**
   - 原因: 新闻ID无效或权限不足
   - 解决: 检查权限和ID有效性

## 监控和日志

### 日志记录
- API访问日志
- 错误日志
- 性能监控日志

### 监控指标
- API响应时间
- 错误率统计
- 用户行为分析

## 下一步计划

1. **高级搜索**: 支持全文搜索和高级筛选
2. **新闻推荐**: 基于用户行为的智能推荐
3. **离线阅读**: 支持离线缓存新闻
4. **分享功能**: 支持分享新闻到社交媒体
5. **评论系统**: 支持新闻评论和讨论
6. **推送通知**: 重要新闻推送通知

## 技术支持

如果遇到问题，请：
1. 检查后端服务是否正常运行
2. 查看后端日志文件
3. 确认数据库连接正常
4. 验证API接口是否可访问
5. 检查前端控制台错误信息 
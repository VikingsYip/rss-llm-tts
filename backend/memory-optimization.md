# 内存优化配置指南

## 概述

本文档介绍了RSS系统的内存优化配置，帮助解决内存使用率过高的问题。

## 当前配置

### 启动参数
- `--expose-gc`: 启用手动垃圾回收
- `--max-old-space-size=8192`: 设置堆内存最大值为8GB
- `--optimize-for-size`: 优化内存使用而非性能
- `--max-semi-space-size=512`: 设置半空间大小为512MB

### 内存监控阈值
- **警告阈值**: 75% - 记录建议
- **清理阈值**: 80% - 主动触发垃圾回收
- **重启阈值**: 90% - 强制重启应用

## 内存管理策略

### 1. 自动垃圾回收
- 每15分钟自动触发一次垃圾回收
- 内存使用率超过70%时主动触发
- 内存使用率超过80%时强制触发

### 2. 智能监控
- 每2分钟检查一次内存使用情况
- 减少监控频率，降低系统开销
- 提供内存状态API接口

### 3. 内存泄漏检测
- 持续监控内存使用趋势
- 检测持续增长模式
- 生成详细的内存报告

### 4. RSS源分批启动
- 每批启动10个RSS源
- 批次间延迟2秒
- 内存状态监控和自动调整

## 启动脚本

### 开发环境
```bash
# 使用优化启动脚本
start-optimized.bat

# 或直接使用npm
npm run dev
```

### 生产环境
```bash
# 使用生产环境启动脚本
start-production.bat

# 或直接使用npm
npm start
```

### 手动启动
```bash
# 开发环境
nodemon --expose-gc --max-old-space-size=8192 --optimize-for-size --max-semi-space-size=512 src/app.js

# 生产环境
node --expose-gc --max-old-space-size=8192 --optimize-for-size --max-semi-space-size=512 src/app.js
```

## API接口

### 内存状态检查
```
GET /api/memory
```

返回当前内存使用情况：
```json
{
  "success": true,
  "data": {
    "heapUsed": 1500,
    "heapTotal": 2000,
    "heapUsagePercent": 75,
    "external": 200,
    "rss": 2500,
    "timestamp": "2025-08-11T09:50:04.000Z"
  }
}
```

### 手动垃圾回收
```
POST /api/memory/gc
```

手动触发垃圾回收，返回释放的内存大小。

## 优化建议

### 1. 系统级别
- 确保系统有足够的内存（建议16GB以上）
- 关闭不必要的后台程序
- 定期重启系统

### 2. 应用级别
- 使用 `--expose-gc` 启动参数
- 监控内存使用趋势
- 定期检查内存报告
- 使用分批启动RSS源

### 3. 代码级别
- 避免内存泄漏
- 及时清理定时器
- 关闭数据库连接
- 清理事件监听器

## 故障排除

### 内存使用率过高
1. 检查 `/api/memory` 接口
2. 手动触发垃圾回收
3. 查看内存泄漏检测报告
4. 考虑重启应用

### 频繁重启
1. 检查内存使用趋势
2. 调整监控阈值
3. 优化代码逻辑
4. 增加系统内存

### 性能问题
1. 监控内存使用情况
2. 检查垃圾回收频率
3. 优化数据处理逻辑
4. 使用流式处理

## 监控工具

### 内置监控
- 内存使用率监控
- 垃圾回收监控
- 内存泄漏检测
- 自动重启机制
- RSS源分批启动

### 外部监控
- 系统资源监控
- 应用性能监控
- 日志分析工具
- 告警系统

## 配置示例

### 生产环境
```bash
node --expose-gc --max-old-space-size=8192 --optimize-for-size --max-semi-space-size=512 src/app.js
```

### 开发环境
```bash
nodemon --expose-gc --max-old-space-size=8192 --optimize-for-size --max-semi-space-size=512 src/app.js
```

### 测试环境
```bash
node --expose-gc --max-old-space-size=4096 --optimize-for-size src/app.js
```

## 注意事项

1. **不要在生产环境中频繁触发垃圾回收**
2. **监控内存使用趋势，而非单次使用率**
3. **定期检查内存泄漏检测报告**
4. **根据实际使用情况调整阈值**
5. **保持系统有足够的可用内存**
6. **使用分批启动减少内存峰值**

## 联系支持

如果遇到内存问题，请：
1. 查看应用日志
2. 检查内存状态API
3. 生成内存报告
4. 联系技术支持团队 
# RSS聚合新闻系统 - 构建故障排除指南

## 网络连接问题 (ECONNRESET)

如果您在构建过程中遇到 `ECONNRESET` 错误，这通常是由于网络连接不稳定导致的。以下是解决方案：

### 方案1: 使用改进的构建脚本

运行改进后的构建脚本：
```bash
build-desktop.bat
```

这个脚本包含：
- 自动重试机制
- 国内镜像源配置
- 更好的错误处理

### 方案2: 使用Yarn构建

如果npm持续出现问题，可以尝试使用Yarn：
```bash
build-desktop-yarn.bat
```

### 方案3: 网络故障排除

运行网络故障排除工具：
```bash
fix-network.bat
```

这个工具会：
- 检查网络连接
- 配置npm设置
- 清理缓存
- 测试网络下载

## 常见解决方案

### 1. 使用国内镜像源
```bash
npm config set registry https://registry.npmmirror.com
```

### 2. 增加超时时间
```bash
npm config set timeout 60000
npm config set fetch-retries 5
```

### 3. 清理缓存
```bash
npm cache clean --force
```

### 4. 使用代理（如果需要）
```bash
npm config set proxy http://your-proxy-server:port
npm config set https-proxy http://your-proxy-server:port
```

### 5. 禁用SSL严格模式
```bash
npm config set strict-ssl false
```

## 手动解决步骤

如果自动脚本仍然失败，请按以下步骤手动解决：

1. **检查网络连接**
   ```bash
   ping registry.npmjs.org
   ```

2. **配置npm**
   ```bash
   npm config set registry https://registry.npmmirror.com
   npm config set fetch-retries 5
   npm config set timeout 60000
   ```

3. **清理缓存**
   ```bash
   npm cache clean --force
   ```

4. **重新安装依赖**
   ```bash
   npm install --no-optional
   ```

5. **构建应用**
   ```bash
   npm run dist:win
   ```

## 其他建议

- 使用VPN或代理服务器
- 更换DNS服务器（如8.8.8.8或114.114.114.114）
- 检查防火墙设置
- 确保有足够的磁盘空间
- 在网络稳定的时间段进行构建

## 联系支持

如果问题仍然存在，请：
1. 检查完整的错误日志
2. 确认网络环境
3. 尝试在不同的网络环境下构建 
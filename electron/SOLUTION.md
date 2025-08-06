# RSS聚合新闻系统 - 网络问题完整解决方案

## 问题描述
在构建过程中遇到 `ECONNRESET` 错误，这是由于网络连接不稳定导致的。

## 解决方案列表

### 方案1: 使用代理服务器
```bash
# 设置HTTP代理
npm config set proxy http://your-proxy-server:port
npm config set https-proxy http://your-proxy-server:port

# 设置SOCKS代理
npm config set proxy socks5://your-proxy-server:port
npm config set https-proxy socks5://your-proxy-server:port
```

### 方案2: 使用VPN
1. 连接VPN服务器
2. 重新运行构建脚本

### 方案3: 手动下载Electron
```bash
# 设置Electron镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir "{{ version }}"

# 或者使用环境变量
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_CUSTOM_DIR={{ version }}
```

### 方案4: 使用离线安装
1. 在有网络的机器上下载electron包
2. 复制到目标机器
3. 使用 `npm install --offline`

### 方案5: 使用Yarn替代npm
```bash
# 安装Yarn
npm install -g yarn

# 配置Yarn镜像
yarn config set registry https://registry.npmmirror.com
yarn config set electron_mirror https://npmmirror.com/mirrors/electron/

# 安装依赖
yarn install
```

### 方案6: 使用cnpm
```bash
# 安装cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com

# 使用cnpm安装
cnpm install
```

### 方案7: 修改DNS设置
```bash
# 使用Google DNS
netsh interface ip set dns "以太网" static 8.8.8.8
netsh interface ip add dns "以太网" 8.8.4.4 index=2

# 或使用阿里DNS
netsh interface ip set dns "以太网" static 223.5.5.5
netsh interface ip add dns "以太网" 223.6.6.6 index=2
```

### 方案8: 禁用防火墙/杀毒软件
临时禁用Windows防火墙和杀毒软件，然后重试。

### 方案9: 使用不同的网络
尝试使用手机热点或其他网络连接。

### 方案10: 手动构建步骤
```bash
# 1. 配置npm
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# 2. 清理缓存
npm cache clean --force

# 3. 分步安装
npm install electron-builder --save-dev
npm install concurrently wait-on --save-dev
npm install electron-store electron-updater --save

# 4. 最后安装electron（可能需要多次重试）
npm install electron --save

# 5. 构建前端
cd ../frontend
npm install
npm run build
cd ../electron

# 6. 构建桌面应用
npm run dist:win
```

## 推荐的解决顺序

1. **首先尝试方案3** - 设置Electron镜像
2. **然后尝试方案1** - 使用代理服务器
3. **接着尝试方案2** - 使用VPN
4. **最后尝试方案10** - 手动构建步骤

## 预防措施

1. 在网络稳定的时间段进行构建
2. 使用有线网络而不是WiFi
3. 关闭不必要的网络应用
4. 确保有足够的磁盘空间

## 联系支持

如果所有方案都失败，请：
1. 检查完整的错误日志
2. 确认网络环境
3. 尝试在不同的网络环境下构建
4. 考虑使用云服务器进行构建 
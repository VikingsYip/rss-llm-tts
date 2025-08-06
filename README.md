# RSS聚合新闻+LLM对话生成+语音合成系统

一个基于Node.js和React的智能新闻聚合系统，支持RSS源管理、AI对话生成和语音合成。

## 功能特性

### RSS新闻管理
- ✅ 添加/编辑/删除RSS源
- ✅ 定时抓取新闻（可配置间隔）
- ✅ 新闻搜索与过滤
- ✅ 标记已读、收藏、忽略
- ✅ 自动清理过期新闻

### AI对话生成
- ✅ 支持多种对话模式（访谈、CEO采访、评论、聊天）
- ✅ 可配置对话轮次和新闻数量
- ✅ 基于最新新闻生成智能对话
- ✅ 支持OpenAI、本地LLM等

### 语音合成
- ✅ 支持多种TTS服务（OpenAI TTS、Azure等）
- ✅ 为不同角色设置不同音色
- ✅ 生成MP3音频文件
- ✅ 在线播放与下载

## 快速开始

### 环境要求
- Node.js 16+
- MySQL 8.0+
- Windows 10/11

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <项目地址>
   cd rss-llm-tts
   ```

2. **配置数据库**
   - 创建MySQL数据库：`rss_llm_tts`
   - 复制环境配置：`copy backend\env.example backend\.env`
   - 编辑 `backend\.env` 文件，配置数据库连接信息

3. **配置API密钥**
   编辑 `backend\.env` 文件，配置以下API密钥：
   ```env
   LLM_API_KEY=your_openai_api_key_here
   TTS_API_KEY=your_openai_tts_key_here
   ```

4. **启动服务**
   ```bash
   # 双击运行 start.bat
   # 或者在命令行中运行：
   start.bat
   ```

### 使用批处理文件

项目提供了三个批处理文件来简化操作：

#### `start.bat` - 启动服务
- 自动检查Node.js和MySQL
- 自动安装依赖
- 启动后端服务（端口3001）
- 启动前端服务（端口3000）

#### `stop.bat` - 停止服务
- 停止所有Node.js进程
- 释放端口3000和3001

#### `restart.bat` - 重启服务
- 先停止现有服务
- 等待3秒后重新启动

### 访问地址

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:3001
- **健康检查**: http://localhost:3001/health

## 项目结构

```
rss-llm-tts/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务服务
│   │   ├── utils/          # 工具函数
│   │   └── jobs/           # 定时任务
│   ├── uploads/            # 上传文件目录
│   ├── logs/               # 日志目录
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   └── package.json
├── start.bat              # 启动脚本
├── stop.bat               # 停止脚本
├── restart.bat            # 重启脚本
└── README.md
```

## API接口

### RSS源管理
- `GET /api/rss/feeds` - 获取RSS源列表
- `POST /api/rss/feeds` - 添加RSS源
- `PUT /api/rss/feeds/:id` - 更新RSS源
- `DELETE /api/rss/feeds/:id` - 删除RSS源
- `POST /api/rss/feeds/validate` - 验证RSS源

### 新闻管理
- `GET /api/news` - 获取新闻列表
- `GET /api/news/:id` - 获取新闻详情
- `PUT /api/news/:id/status` - 更新新闻状态
- `GET /api/news/stats/overview` - 获取新闻统计

### 对话生成
- `GET /api/dialogue` - 获取对话列表
- `POST /api/dialogue` - 生成新对话
- `GET /api/dialogue/:id` - 获取对话详情
- `POST /api/dialogue/:id/speech` - 生成语音
- `DELETE /api/dialogue/:id` - 删除对话

## 配置说明

### 环境变量配置

在 `backend\.env` 文件中配置以下参数：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rss_llm_tts
DB_USER=root
DB_PASSWORD=your_password

# LLM API配置
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-3.5-turbo

# TTS API配置
TTS_API_URL=https://api.openai.com/v1/audio/speech
TTS_API_KEY=your_openai_tts_key_here
TTS_VOICE=alloy

# 系统配置
RSS_FETCH_INTERVAL=3600000    # RSS抓取间隔(毫秒)
NEWS_RETENTION_HOURS=24       # 新闻保留时间(小时)
DIALOGUE_NEWS_COUNT=5         # 对话使用的新闻数量
DIALOGUE_ROUNDS=8             # 对话轮次
```

### 对话类型

系统支持以下对话类型：
- `interview` - 主持人访谈IT大佬
- `ceo_interview` - 新闻从业者采访CEO
- `commentary` - 两位评论员分析新闻热点
- `chat` - 两位朋友聊天讨论

## 故障排除

### 常见问题

1. **MySQL连接失败**
   - 确保MySQL服务正在运行
   - 检查数据库连接配置
   - 确保数据库用户有足够权限

2. **API密钥错误**
   - 检查LLM和TTS API密钥是否正确
   - 确保API密钥有足够的使用额度

3. **端口被占用**
   - 使用 `stop.bat` 停止现有服务
   - 检查端口3000和3001是否被其他程序占用

4. **依赖安装失败**
   - 确保Node.js版本为16+
   - 清除npm缓存：`npm cache clean --force`
   - 删除node_modules目录重新安装

### 日志查看

- 后端日志：`backend/logs/`
- 错误日志：`backend/logs/error.log`
- 完整日志：`backend/logs/combined.log`

## 开发说明

### 开发模式启动
```bash
# 后端开发模式
cd backend
npm run dev

# 前端开发模式
cd frontend
npm run dev
```

### 构建生产版本
```bash
# 构建前端
cd frontend
npm run build

# 启动后端生产模式
cd backend
npm start
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。 
# AIEffect 脚本使用说明

本目录包含 AIEffect 项目的开发和构建脚本。

## 📋 前置要求

- **Python 3.12+**
- **Node.js 18+**
- **Windows 10/11** (脚本仅支持 Windows)

## 🚀 开发环境启动

### 使用 PowerShell 脚本（推荐）

```powershell
# 在项目根目录执行
.\script\start-dev.ps1
```

该脚本会：

1. 自动检查并安装 Python 虚拟环境
2. 安装 Python 依赖
3. 安装 npm 依赖
4. 同时启动后端（端口 8500）和前端（端口 5173）
5. 显示实时日志输出

### 手动启动

如果不想使用脚本，也可以手动启动：

**启动后端：**

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

**启动前端（新开一个终端）：**

```bash
cd frontend
npm install
npm run dev
```

## 📦 打包构建

### 使用打包脚本

```powershell
# 在项目根目录执行
.\script\build.ps1
```

该脚本会：

1. 清理旧的构建文件
2. 构建后端（复制源码到 dist）
3. 构建前端（Vite 生产构建）
4. 创建启动脚本 `start.bat`
5. 输出到 `dist/` 目录

### 运行打包后的应用

```bash
cd dist
start.bat
```

或者双击 `dist/start.bat` 文件。

## 📊 服务端口

| 服务        | 端口      | 说明             |
| ----------- | --------- | ---------------- |
| 前端开发    | 8500      | Vite 开发服务器  |
| API Gateway | 8501      | 统一 API 入口    |
| WebSocket   | 8502      | 实时对话服务     |
| 日志服务    | 8505      | 独立日志收集服务 |
| 前端预览    | 8500      | Vite 预览服务器  |
| API 文档    | 8501/docs | Swagger UI       |

## 🛠️ 故障排除

### PowerShell 执行策略问题

如果遇到 `无法加载，因为在此系统上禁止运行脚本` 错误：

```powershell
# 临时允许（当前会话）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 或者永久允许（需要管理员权限）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 端口被占用

如果 8500 或 5173 端口被占用，可以：

1. 修改 `.env` 文件中的端口配置
2. 或者关闭占用端口的程序

### 依赖安装失败

- 确保网络连接正常
- 尝试使用国内镜像源
- 手动执行 `pip install` 或 `npm install` 查看详细错误

## 📝 注意事项

1. **开发环境**：使用 `start-dev.ps1`，支持热重载
2. **生产构建**：使用 `build.ps1`，构建优化版本
3. **配置文件**： `.env` 文件不会被提交到 Git，请自行配置
4. **数据目录**： `data/` 目录用于存储配置和记忆文件

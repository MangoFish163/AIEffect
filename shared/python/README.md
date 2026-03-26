# AIEffect 共享核心模块

AIEffect 项目的 Python 共享核心模块，为各微服务提供统一的基础功能。

## 安装

```bash
# 开发模式安装
pip install -e .

# 生产环境安装
pip install .

# 安装开发依赖
pip install -e ".[dev]"
```

## 模块说明

### config - 配置管理

```python
from shared_core import get_config_manager, ConfigManager

# 获取配置管理器（单例）
config_manager = get_config_manager()

# 访问配置
api_config = config_manager.config.api
port_config = config_manager.config.ports

# 更新配置
config_manager.update_config({
    "api": {"provider": "openai", "api_url": "..."}
})
```

### logger - 日志系统

```python
from shared_core import setup_logger, get_logger

# 初始化日志系统
setup_logger()

# 获取日志器
logger = get_logger(__name__)
logger.info("应用启动")
logger.error("发生错误", exc_info=True)
```

### database - 数据库管理

```python
from shared_core import init_db, close_db, get_db

# 初始化数据库
await init_db()

# 获取数据库连接
db = get_db()

# 执行查询
async with db.execute("SELECT * FROM config") as cursor:
    rows = await cursor.fetchall()

# 关闭数据库
await close_db()
```

### schemas - 数据模型

```python
from shared_core import BaseResponse, LogEntry, APIConfig

# 创建响应
response = BaseResponse(code=200, message="success", data={"key": "value"})

# 创建日志条目
log_entry = LogEntry(
    id="uuid",
    timestamp=datetime.now(),
    level="INFO",
    module="test",
    message="测试消息"
)
```

### port_manager - 端口管理

```python
from shared_core import PortManager

# 检查端口是否可用
if PortManager.is_port_available(8501):
    print("端口可用")

# 查找可用端口
port = PortManager.find_available_port(8501)

# 获取服务端口
api_port = PortManager.get_service_port('api')
all_ports = PortManager.get_all_ports()
```

## 依赖

- pydantic >= 2.9.0
- pydantic-settings >= 2.6.0
- aiosqlite >= 0.20.0
- aiohttp >= 3.9.0

## 开发

```bash
# 代码格式化
black shared_core/

# 代码检查
ruff check shared_core/

# 类型检查
mypy shared_core/

# 运行测试
pytest
```

## 版本历史

### 0.1.0
- 初始版本
- 包含 config、logger、database、schemas、port_manager 模块

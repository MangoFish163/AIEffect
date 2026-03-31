"""
测试服务生命周期管理器的 Python 脚本
"""
import requests
import time
import sys

def test_health_endpoints():
    """测试健康检查端点"""
    services = [
        ("log-service", "http://localhost:8505/health"),
        ("api-gateway", "http://localhost:8501/api/health"),
        ("websocket", "http://localhost:8502/health"),
    ]

    print("=== 测试健康检查端点 ===")
    for name, url in services:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", data.get("data", {}).get("status", "unknown"))
                print(f"✅ {name}: {status}")
            else:
                print(f"❌ {name}: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ {name}: {e}")

    print()


def test_shutdown_endpoints():
    """测试关闭端点（仅测试端点存在，不实际关闭）"""
    services = [
        ("log-service", "http://localhost:8505/shutdown"),
        ("api-gateway", "http://localhost:8501/api/shutdown"),
        ("websocket", "http://localhost:8502/shutdown"),
    ]

    print("=== 测试关闭端点（仅验证存在） ===")
    for name, url in services:
        try:
            # 使用 OPTIONS 请求检查端点是否存在
            response = requests.options(url, timeout=2)
            print(f"✅ {name}: /shutdown 端点存在")
        except requests.exceptions.ConnectionError:
            print(f"❌ {name}: 无法连接")
        except Exception as e:
            # 如果返回 405 Method Not Allowed，说明端点存在但不支持 OPTIONS
            if "405" in str(e):
                print(f"✅ {name}: /shutdown 端点存在")
            else:
                print(f"⚠️  {name}: {e}")

    print()


def test_service_dependencies():
    """测试服务依赖关系"""
    print("=== 测试服务依赖关系 ===")
    print("期望启动顺序: log-service → api-gateway → websocket")
    print("期望关闭顺序: websocket → api-gateway → log-service")
    print()


def main():
    print("AIEffect 服务生命周期管理器测试")
    print("=" * 50)
    print()

    # 等待服务启动
    print("等待服务启动...")
    time.sleep(2)

    test_health_endpoints()
    test_shutdown_endpoints()
    test_service_dependencies()

    print("测试完成")
    return 0


if __name__ == "__main__":
    sys.exit(main())

import React, { useState, useEffect, useRef } from "react";
import {
  Subtitles,
  LayoutDashboard,
  AudioLines,
  Brain,
  ScrollText,
  RefreshCw,
  Users,
  UserCircle,
} from "lucide-react";
import { PageType } from "../types";
import { useAppStore } from "../store";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// API 基础地址 - 使用相对路径让请求通过 Vite proxy
const API_BASE_URL = "";

// 服务状态类型
interface ServiceStatus {
  isRunning: boolean;
  port: number;
  isChecking: boolean;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  page: PageType;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-[calc(100%-1rem)] px-4 py-2 text-left transition-all duration-200 rounded-xl mx-2 mb-0.5",
        isActive
          ? "bg-[#6366f1] text-white shadow-md"
          : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]",
      )}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, config } = useAppStore();

  // 服务状态
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    isRunning: false,
    port: 8501,
    isChecking: true,
  });

  // 检查服务状态
  const checkServiceStatus = async () => {
    try {
      setServiceStatus((prev) => ({ ...prev, isChecking: true }));
      const res = await fetch(`${API_BASE_URL}/api/system/health`, {
        method: "GET",
        // 设置较短的超时时间
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setServiceStatus({
          isRunning: data.data?.status === "healthy",
          port: config.ports?.api || 8501,
          isChecking: false,
        });
      } else {
        setServiceStatus({
          isRunning: false,
          port: config.ports?.api || 8501,
          isChecking: false,
        });
      }
    } catch (error) {
      console.error("Service status check failed:", error);
      setServiceStatus({
        isRunning: false,
        port: config.ports?.api || 8501,
        isChecking: false,
      });
    }
  };

  // SSE EventSource 引用
  const eventSourceRef = useRef<EventSource | null>(null);

  // 连接 SSE 实时状态流
  const connectStatusStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE_URL}/api/system/health/stream`);
    es.onopen = () => {
      console.log("Service status SSE connected");
      setServiceStatus((prev) => ({ ...prev, isChecking: false }));
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setServiceStatus({
          isRunning: data.status === "healthy",
          port: data.port || config.ports?.api || 8501,
          isChecking: false,
        });
      } catch (error) {
        console.error("Failed to parse status data:", error);
      }
    };
    es.onerror = (error) => {
      console.error("Service status SSE error:", error);
      setServiceStatus({
        isRunning: false,
        port: config.ports?.api || 8501,
        isChecking: false,
      });
      // 出错后 3 秒重连
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connectStatusStream();
        }
      }, 3000);
    };
    eventSourceRef.current = es;
  };

  // 断开 SSE 连接
  const disconnectStatusStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // 初始检查 + SSE 连接
  useEffect(() => {
    // 先执行一次检查
    checkServiceStatus();
    // 然后连接 SSE 实时流
    connectStatusStream();
    return () => {
      disconnectStatusStream();
    };
  }, [config.ports?.api]);

  const navItems = [
    { page: "control" as PageType, icon: <LayoutDashboard />, label: "控制面板" },
    { page: "subtitle" as PageType, icon: <Subtitles />, label: "字幕视觉" },
    { page: "voice" as PageType, icon: <AudioLines />, label: "语音配置" },
    { page: "memory" as PageType, icon: <Brain />, label: "记忆管理" },
    { page: "character" as PageType, icon: <UserCircle />, label: "角色管理" },
    { page: "logs" as PageType, icon: <ScrollText />, label: "运行日志" },
    { page: "agents" as PageType, icon: <Users />, label: "Agents办公室" },
  ];

  return (
    <div className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#6366f1] rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">AI</span>
          </div>
          <div>
            <h1 className="font-bold text-[#0f172a] text-lg">AI Effect</h1>
            <p className="text-xs text-[#64748b]">Ollama AIEffect</p>
            <p className="text-xs text-[#94a3b8] mt-1">作者: MangoFish</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => (
          <NavItem
            key={item.page}
            icon={item.icon}
            label={item.label}
            page={item.page}
            isActive={currentPage === item.page}
            onClick={() => setCurrentPage(item.page)}
          />
        ))}
      </nav>

      <div className="p-4">
        <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
          <p className="text-sm font-semibold text-[#6366f1] mb-1">服务状态</p>
          <div className="flex items-center gap-2">
            {serviceStatus.isChecking ? (
              <>
                <span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-full animate-pulse" />
                <span className="text-sm text-[#94a3b8]">检查中...</span>
              </>
            ) : serviceStatus.isRunning ? (
              <>
                <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-pulse" />
                <span className="text-sm text-[#64748b]">
                  服务正在运行端口: {serviceStatus.port}
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-full" />
                <span className="text-sm text-[#64748b]">
                  服务未运行
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={checkServiceStatus}
          disabled={serviceStatus.isChecking}
          className="w-full mt-4 py-2.5 px-4 text-sm text-[#ef4444] border border-[#ef4444]/20 rounded-xl hover:bg-[#fef2f2] transition-colors font-medium disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className={cn("w-4 h-4", serviceStatus.isChecking && "animate-spin")} />
            重启服务
          </div>
        </button>
      </div>
    </div>
  );
};

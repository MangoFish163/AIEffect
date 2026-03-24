import React from 'react';
import { Settings, Subtitles, Mic, ClipboardList, FileText, Zap, RefreshCw, Users } from 'lucide-react';
import { PageType } from '../types';
import { useAppStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  page: PageType;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-[calc(100%-1rem)] px-4 py-3 text-left transition-all duration-200 rounded-xl mx-2',
        isActive
          ? 'bg-[#6366f1] text-white shadow-md'
          : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
      )}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage } = useAppStore();

  const navItems = [
    { page: 'control' as PageType, icon: <Zap />, label: '服务连接' },
    { page: 'subtitle' as PageType, icon: <Subtitles />, label: '字幕视觉' },
    { page: 'voice' as PageType, icon: <Mic />, label: '语音配置' },
    { page: 'memory' as PageType, icon: <ClipboardList />, label: '记忆管理' },
    { page: 'logs' as PageType, icon: <FileText />, label: '运行日志' },
    { page: 'agents' as PageType, icon: <Users />, label: 'Agents办公室' },
  ];

  return (
    <div className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#6366f1] rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">AI</span>
          </div>
          <div>
            <h1 className="font-bold text-[#0f172a] text-lg">O2O Adapter</h1>
            <p className="text-xs text-[#64748b]">Ollama to OpenAI</p>
            <p className="text-xs text-[#94a3b8] mt-1">作者: 杰</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1">
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

      <div className="p-4 border-t border-[#e2e8f0]">
        <div className="bg-white rounded-xl p-4 border border-[#e2e8f0]">
          <p className="text-sm font-semibold text-[#6366f1] mb-1">服务状态</p>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-pulse" />
            <span className="text-sm text-[#64748b]">服务正在运行端口: 8500</span>
          </div>
        </div>
        <button className="w-full mt-4 py-2.5 px-4 text-sm text-[#ef4444] border border-[#ef4444]/20 rounded-xl hover:bg-[#fef2f2] transition-colors font-medium">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            重启服务
          </div>
        </button>
      </div>
    </div>
  );
};

function Power({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
    </svg>
  );
}

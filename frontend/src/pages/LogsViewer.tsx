import React, { useState } from 'react';
import { Search, Filter, Download, RefreshCw, Trash2, Pause, Play, Terminal, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Switch } from '../components';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LogsViewer: React.FC = () => {
  const [isLive, setIsLive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const logs = [
    { time: '21:48:39', level: 'INFO', module: '[app.lib.a]', message: '获取日志列表: level=None, module=None, search=None, page=1, limit=50' },
    { time: '21:48:29', level: 'INFO', module: '[app.lib.a]', message: 'New SSE subscriber for stream events' },
    { time: '21:47:27', level: 'INFO', module: '[app.lib.s]', message: 'New SSE subscriber for stream events' },
    { time: '21:47:20', level: 'INFO', module: '[app.lib.a]', message: 'GET /api/config' },
    { time: '21:46:19', level: 'INFO', module: '[app.lib.a]', message: 'New SSE subscriber for stream events' },
    { time: '21:46:19', level: 'INFO', module: '[app.lib.a]', message: 'GET /api/config' },
    { time: '21:45:06', level: 'INFO', module: '[app.lib.a]', message: 'New SSE subscriber for stream events' },
    { time: '21:45:06', level: 'INFO', module: '[app.lib.a]', message: 'GET /api/config' },
    { time: '21:44:25', level: 'INFO', module: '[app.lib.s]', message: 'New SSE subscriber for stream events' },
    { time: '21:43:45', level: 'INFO', module: '[app.lib.s]', message: 'Health check requested' },
    { time: '21:42:24', level: 'INFO', module: '[app.lib.a]', message: 'New SSE subscriber for stream events' },
  ];

  const totalPages = 2;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
            系统日志
          </h1>
          <p className="text-[#64748b] text-sm">
            监控系统运行状态与调试信息。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              isLive
                ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5] shadow-md hover:shadow-lg hover:-translate-y-0.5'
                : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#e2e8f0] hover:translate-y-0'
            )}
          >
            {isLive ? <><Play className="w-4 h-4" /> 实时</> : <><Pause className="w-4 h-4" /> 暂停</>}
          </button>
          <button className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200">
              <Download className="w-4 h-4" />
            </button>
            <select className="bg-white text-[#64748b] text-sm rounded-xl px-3 py-2 border border-[#e2e8f0] hover:border-[#94a3b8] transition-all duration-200">
              <option>导出</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
            placeholder="搜索日志内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">级别</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
          </select>
          <select className="px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
            <option>模块筛选...</option>
          </select>
          <button className="px-4 py-2.5 text-[#6366f1] bg-[#f0f4ff] border border-[#6366f1]/20 rounded-xl text-sm font-medium hover:bg-[#e0e7ff] hover:border-[#6366f1]/30 transition-all duration-200 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            测试日志
          </button>
        </div>

        <div className="ml-auto flex items-center gap-6 text-sm">
          <span className="text-[#64748b]">总计: <span className="font-bold text-[#6366f1]">147</span></span>
          <span className="text-[#64748b]">错误: <span className="font-bold text-[#ef4444]">0</span></span>
          <span className="text-[#64748b]">警告: <span className="font-bold text-[#f59e0b]">1</span></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <Terminal className="w-4 h-4 text-[#94a3b8]" />
          <span className="text-sm font-mono text-[#64748b]">console_output.log</span>
          {isLive && (
            <span className="flex items-center gap-1.5 ml-auto text-xs text-[#22c55e]">
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
              实时监听中
            </span>
          )}
        </div>

        <div className="max-h-[500px] overflow-y-auto font-mono text-sm">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-4 px-4 py-2 hover:bg-[#f8fafc] transition-colors duration-150',
                idx % 2 === 0 && 'bg-[#f0f4ff]/30'
              )}
            >
              <span className="text-[#94a3b8] w-20 shrink-0">{log.time}</span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-bold shrink-0',
                log.level === 'INFO' && 'bg-[#dbeafe] text-[#1e40af]',
                log.level === 'WARN' && 'bg-[#fef3c7] text-[#92400e]',
                log.level === 'ERROR' && 'bg-[#fee2e2] text-[#991b1b]'
              )}>
                {log.level}
              </span>
              <span className="text-[#6366f1] shrink-0">{log.module}</span>
              <span className="text-[#334155]">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748b]">每页</span>
          <select className="px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
            <option>50</option>
          </select>
          <span className="text-sm text-[#64748b]">条</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748b]">第 {currentPage} / {totalPages} 页</span>
          <div className="flex items-center gap-1">
            <button 
              className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
                  currentPage === page
                    ? 'bg-[#6366f1] text-white shadow-md'
                    : 'text-[#64748b] hover:bg-[#f8fafc]'
                )}
              >
                {page}
              </button>
            ))}
            <button 
              className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

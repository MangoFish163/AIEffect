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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
            系统日志
          </h1>
          <p className="text-gray-500 text-sm">
            监控系统运行状态与调试信息。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              isLive
                ? 'bg-pink-500 text-white hover:bg-pink-600 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:translate-y-0'
            )}
          >
            {isLive ? <><Play className="w-4 h-4" /> 实时</> : <><Pause className="w-4 h-4" /> 暂停</>}
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
              <Download className="w-4 h-4" />
            </button>
            <select className="bg-white text-gray-600 text-sm rounded-xl px-3 py-2 border border-gray-200 hover:border-gray-300 transition-all duration-200">
              <option>导出</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200"
            placeholder="搜索日志内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">级别</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
          </select>
          <select className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
            <option>模块筛选...</option>
          </select>
          <button className="px-4 py-2.5 text-purple-600 bg-purple-50 border border-purple-100 rounded-xl text-sm font-medium hover:bg-purple-100 hover:border-purple-200 transition-all duration-200 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            测试日志
          </button>
        </div>

        <div className="ml-auto flex items-center gap-6 text-sm">
          <span className="text-gray-500">总计: <span className="font-bold text-indigo-600">147</span></span>
          <span className="text-gray-500">错误: <span className="font-bold text-red-500">0</span></span>
          <span className="text-gray-500">警告: <span className="font-bold text-amber-500">1</span></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-mono text-gray-600">console_output.log</span>
          {isLive && (
            <span className="flex items-center gap-1.5 ml-auto text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              实时监听中
            </span>
          )}
        </div>

        <div className="max-h-[500px] overflow-y-auto font-mono text-sm">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-4 px-4 py-2 hover:bg-gray-50 transition-colors duration-150',
                idx % 2 === 0 && 'bg-blue-50/30'
              )}
            >
              <span className="text-gray-400 w-20 shrink-0">{log.time}</span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-bold shrink-0',
                log.level === 'INFO' && 'bg-blue-100 text-blue-700',
                log.level === 'WARN' && 'bg-amber-100 text-amber-700',
                log.level === 'ERROR' && 'bg-red-100 text-red-700'
              )}>
                {log.level}
              </span>
              <span className="text-purple-600 shrink-0">{log.module}</span>
              <span className="text-gray-700">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">每页</span>
          <select className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
            <option>50</option>
          </select>
          <span className="text-sm text-gray-500">条</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">第 {currentPage} / {totalPages} 页</span>
          <div className="flex items-center gap-1">
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
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
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {page}
              </button>
            ))}
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
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

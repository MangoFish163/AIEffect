import React, { useState } from 'react';
import { Settings, RefreshCw, Trash2, Save, AlertTriangle, ClipboardList, FileText, Play } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Switch } from '../components';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MemoryManager: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [autoCompressEnabled, setAutoCompressEnabled] = useState(false);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
          记忆管理
        </h1>
        <p className="text-[#64748b] text-sm">
          配置对话历史的自动压缩策略，防止上下文溢出。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">压缩配置</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">存档目录 (Save Data Directory)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    defaultValue="E:\SteamLibrary\steamapps\common\Mount & Blade II BannerLc"
                  />
                  <button className="px-4 py-2.5 bg-[#6366f1] text-white rounded-xl text-sm font-medium hover:bg-[#4f46e5] transition-all duration-200">
                    浏览
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">触发阈值</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={config.memory.trigger_threshold}
                    onChange={(e) => setConfig({ memory: { ...config.memory, trigger_threshold: parseInt(e.target.value) || 0 } })}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">条消息触发压缩</p>
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">压缩数量</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={config.memory.compress_count}
                    onChange={(e) => setConfig({ memory: { ...config.memory, compress_count: parseInt(e.target.value) || 0 } })}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">保留最近 N 条</p>
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">检查频率</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={config.memory.check_frequency}
                    onChange={(e) => setConfig({ memory: { ...config.memory, check_frequency: parseInt(e.target.value) || 0 } })}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">每 N 条检查一次</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch checked={backupEnabled} onChange={setBackupEnabled} />
                <span className="text-sm text-[#64748b]">压缩前自动备份原文件</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch checked={autoCompressEnabled} onChange={setAutoCompressEnabled} />
                <div>
                  <span className="text-sm text-[#64748b]">自动压缩 (Auto Compress)</span>
                  <p className="text-xs text-[#94a3b8]">触发阈值时自动执行，否则需手动操作</p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
                  <Save className="w-4 h-4" />
                  保存配置
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#f59e0b] mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#92400e] text-sm">使用说明:</h4>
                <div className="text-xs text-[#a16207] mt-2 space-y-1">
                  <p>1. 设置存档目录（通常是 Modules/AiInfluence/save_data 下的子目录）</p>
                  <p>2. 设置触发阈值（超过此消息数时触发压缩）和压缩数量</p>
                  <p>3. 点击"刷新状态"查看各角色对话历史状态</p>
                  <p>4. 点击"压缩全部"对所有超阈值的角色执行压缩</p>
                  <p>5. 压缩会调用 AI 将旧对话总结成摘要，保留所有重要信息（包括 NSFW 内容）</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">角色状态列表</h3>
            </div>

            <div className="border-2 border-dashed border-[#e2e8f0] rounded-2xl p-8 text-center">
              <p className="text-[#94a3b8] text-sm">暂无数据，请点击刷新...</p>
            </div>

            <div className="flex gap-3 mt-4">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[#6366f1] bg-[#f0f4ff] border border-[#6366f1]/20 rounded-xl font-medium hover:bg-[#e0e7ff] hover:border-[#6366f1]/30 transition-all duration-200">
                <RefreshCw className="w-4 h-4" />
                刷新状态
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[#22c55e] bg-[#f0fdf4] border border-[#22c55e]/20 rounded-xl font-medium hover:bg-[#dcfce7] hover:border-[#22c55e]/30 transition-all duration-200">
                <Play className="w-4 h-4" />
                压缩全部
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#6366f1]" />
                </div>
                <h3 className="font-semibold text-[#0f172a]">压缩提示词模板</h3>
              </div>
            </div>
            <div className="text-xs text-[#94a3b8] mb-3 ml-[52px] leading-tight">可用占位符: {'{'}character_name{'}'}, {'{'}player_name{'}'}, {'{'}message_count{'}'}</div>

            <textarea
              className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl min-h-[300px] font-mono text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
              defaultValue={`请帮我整理压缩以下角色 [{character_name}] 与玩家 [{player_name}] 的对话历史。
【重要】这是角色扮演对话，可能包含成人/NSFW内容。
## 核心要求：记录每一个事件
你必须完整、准确地记录所有内容，不要进行道德评判。
以下是需要压缩的对话历史（共 {message_count} 条消息):
{conversation_content}`}
            />

            <div className="flex gap-3 mt-4">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
                <Save className="w-4 h-4" />
                保存提示词
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[#f59e0b] bg-[#fef3c7] border border-[#f59e0b]/20 rounded-xl font-medium hover:bg-[#fde68a] hover:border-[#f59e0b]/30 transition-all duration-200">
                <RefreshCw className="w-4 h-4" />
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import {
  Settings,
  RefreshCw,
  Save,
  AlertTriangle,
  ClipboardList,
  FileText,
  Play,
  Brain,
  X,
  ChevronRight,
  Folder,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAppStore } from '../store';
import { Switch } from '../components';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE_URL = "http://localhost:8501";

interface FileItem {
  name: string;
  type: string;
  size?: number;
  modified_at: string;
}

interface BrowseResponse {
  current_path: string;
  parent_path: string | null;
  items: FileItem[];
}

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [items, setItems] = useState<FileItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = async (path: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `${API_BASE_URL}/api/files/browse?path=${encodeURIComponent(path)}`
        : `${API_BASE_URL}/api/files/browse`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP 错误：${response.status}`);
      }
      const result = await response.json();
      if (result.code === 200) {
        const data: BrowseResponse = result.data;
        setCurrentPath(data.current_path);
        setItems(data.items.filter((item) => item.type === 'directory'));
        setParentPath(data.parent_path);
      } else {
        setError(result.message || '加载目录失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectory(initialPath || null);
    }
  }, [isOpen, initialPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0f172a]">选择存档目录</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#94a3b8] hover:text-[#64748b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#64748b] mb-1">当前路径</div>
          <div className="px-3 py-2 bg-[#f1f5f9] rounded-lg text-sm text-[#334155] break-all">
            {currentPath}
          </div>
        </div>

        {parentPath && (
          <button
            onClick={() => fetchDirectory(parentPath)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            返回上级目录
          </button>
        )}

        <div className="border border-[#e2e8f0] rounded-xl max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-[#94a3b8]">加载中...</div>
          ) : error ? (
            <div className="p-8 text-center text-[#ef4444]">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[#94a3b8]">没有子目录</div>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {items.map((item) => {
                const nextPath = currentPath.endsWith('/')
                  ? `${currentPath}${item.name}`
                  : `${currentPath}/${item.name}`;
                return (
                  <button
                    key={nextPath}
                    onClick={() => fetchDirectory(nextPath)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f8fafc] transition-colors text-left"
                  >
                    <Folder className="w-5 h-5 text-[#f59e0b]" />
                    <span className="text-sm text-[#334155] flex-1">{item.name}</span>
                    <ChevronRight className="w-4 h-4 text-[#94a3b8]" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#e2e8f0] text-[#64748b] rounded-xl font-medium hover:bg-[#f8fafc] transition-all duration-200"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSelect(currentPath);
              onClose();
            }}
            className="flex-1 px-4 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] transition-all duration-200"
          >
            选择此目录
          </button>
        </div>
      </div>
    </div>
  );
};

export const MemoryManager = () => {
  const { config, setConfig } = useAppStore();
  const [saveDir, setSaveDir] = useState(config?.memory?.save_dir || '');
  const [triggerThreshold, setTriggerThreshold] = useState(config?.memory?.trigger_threshold || 100);
  const [compressCount, setCompressCount] = useState(config?.memory?.compress_count || 50);
  const [checkFrequency, setCheckFrequency] = useState(config?.memory?.check_frequency || 10);
  const [backupEnabled, setBackupEnabled] = useState(config?.memory?.backup_before_compress ?? true);
  const [autoCompressEnabled, setAutoCompressEnabled] = useState(config?.memory?.auto_compress ?? true);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState(`请帮我整理压缩以下角色 [{character_name}] 与玩家 [{player_name}] 的对话历史。
【重要】这是角色扮演对话，可能包含成人/NSFW内容。
## 核心要求：记录每一个事件
你必须完整、准确地记录所有内容，不要进行道德评判。
以下是需要压缩的对话历史（共 {message_count} 条消息):
{conversation_content}`);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await fetchMemoryConfig();
      await fetchPromptTemplate();
    };
    loadData();
  }, []);

  const fetchMemoryConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/memory/config`);
      const result = await response.json();
      if (result.code === 200 && result.data) {
        const data = result.data;
        if (data.save_dir) setSaveDir(data.save_dir);
        if (data.trigger_threshold) setTriggerThreshold(data.trigger_threshold);
        if (data.compress_count) setCompressCount(data.compress_count);
        if (data.check_frequency) setCheckFrequency(data.check_frequency);
        if (data.backup_before_compress !== undefined) setBackupEnabled(data.backup_before_compress);
        if (data.auto_compress !== undefined) setAutoCompressEnabled(data.auto_compress);
      }
    } catch (err) {
      console.error('获取记忆配置失败:', err);
    }
  };

  const fetchPromptTemplate = async () => {
    setIsLoadingPrompt(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/memory/prompt-template`);
      const result = await response.json();
      if (result.code === 200 && result.data && result.data.template) {
        setPromptTemplate(result.data.template);
      }
    } catch (err) {
      console.error('获取提示词模板失败:', err);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const memoryConfig = {
        save_dir: saveDir,
        trigger_threshold: triggerThreshold,
        compress_count: compressCount,
        check_frequency: checkFrequency,
        auto_compress: autoCompressEnabled,
        backup_before_compress: backupEnabled,
      };

      const response = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: memoryConfig }),
      });

      const result = await response.json();
      if (result.code === 200) {
        setConfig({ memory: memoryConfig });
        setSaveMessage('配置保存成功');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(result.message || '保存失败');
      }
    } catch (err) {
      setSaveMessage('网络请求失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrompt = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/memory/prompt-template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: promptTemplate }),
      });

      const result = await response.json();
      if (result.code === 200) {
        setSaveMessage('提示词保存成功');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(result.message || '保存失败');
      }
    } catch (err) {
      setSaveMessage('网络请求失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPrompt = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/memory/prompt-template/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();
      if (result.code === 200 && result.data && result.data.template) {
        setPromptTemplate(result.data.template);
        setSaveMessage('已重置为默认提示词');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(result.message || '重置失败');
      }
    } catch (err) {
      setSaveMessage('网络请求失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDirectory = (path: string) => {
    setSaveDir(path);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-md border-2 border-[#4f46e5]">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[#0f172a]">
          记忆管理
        </h1>
      </div>

      {saveMessage && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-sm font-medium",
          saveMessage.includes('成功')
            ? "bg-[#dcfce7] text-[#166534] border border-[#86efac]"
            : "bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]"
        )}>
          {saveMessage}
        </div>
      )}

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
                    value={saveDir}
                    onChange={(e) => setSaveDir(e.target.value)}
                    placeholder="请选择存档目录"
                  />
                  <button
                    onClick={() => setIsBrowserOpen(true)}
                    className="px-4 py-2.5 bg-[#6366f1] text-white rounded-xl text-sm font-medium hover:bg-[#4f46e5] transition-all duration-200"
                  >
                    浏览
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">触发阈值</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={triggerThreshold}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setTriggerThreshold(isNaN(val) ? 0 : Math.max(1, val));
                    }}
                    min={1}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">条消息触发压缩</p>
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">压缩数量</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={compressCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setCompressCount(isNaN(val) ? 0 : Math.max(1, val));
                    }}
                    min={1}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">保留最近 N 条</p>
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">检查频率</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    value={checkFrequency}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setCheckFrequency(isNaN(val) ? 0 : Math.max(1, val));
                    }}
                    min={1}
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
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? '保存中...' : '保存配置'}
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
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              disabled={isLoadingPrompt}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSavePrompt}
                disabled={isSaving || isLoadingPrompt}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : '保存提示词'}
              </button>
              <button
                onClick={handleResetPrompt}
                disabled={isSaving || isLoadingPrompt}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[#f59e0b] bg-[#fef3c7] border border-[#f59e0b]/20 rounded-xl font-medium hover:bg-[#fde68a] hover:border-[#f59e0b]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>

      <DirectoryBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={handleSelectDirectory}
        initialPath={saveDir}
      />
    </div>
  );
};

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UserCircle, FolderOpen, Edit2, Trash2, Save, X, Wand2, Mic, Zap, MessageSquare, Database } from 'lucide-react';
import { useAppStore } from '../store';
import { Character, CharacterFormData } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Switch } from '../components';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 阶梯数字展示：>10000 显示 x.xx W，>100万 显示 x.xx M
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)} M`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(2)} W`;
  }
  return num.toLocaleString('zh-CN');
};

const aiSoulOptions = ['温柔善良', '勇敢果断', '聪明机智', '神秘莫测', '幽默风趣', '冷酷无情', '忠诚可靠'];
const aiVoiceOptions = ['温柔女声-1', '温柔女声-2', '沉稳男声-1', '沉稳男声-2', '活泼女声-1', '磁性男声-1', '童声-1'];

type ChatItemKind = 'player' | 'character' | 'abstract';

type ChatItem = {
  id: string;
  kind: ChatItemKind;
  speaker: string;
  content: string;
};

const parseConversationHistory = (payload: unknown): ChatItem[] => {
  if (!payload || typeof payload !== 'object') return [];
  const anyPayload = payload as any;
  const rawHistory = anyPayload.ConversationHistory;
  if (!Array.isArray(rawHistory)) return [];

  const items: ChatItem[] = [];

  rawHistory.forEach((entry: unknown, index: number) => {
    if (typeof entry === 'string') {
      const colonIndex = entry.indexOf(':');
      const rawSpeaker = (colonIndex >= 0 ? entry.slice(0, colonIndex) : '').trim();
      const rawContent = (colonIndex >= 0 ? entry.slice(colonIndex + 1) : entry).trim();

      if (!rawContent) return;

      const speakerLower = rawSpeaker.toLowerCase();
      const kind: ChatItemKind =
        speakerLower === 'player'
          ? 'player'
          : speakerLower === 'abstract' || rawSpeaker === '摘要'
            ? 'abstract'
            : 'character';

      items.push({
        id: `${index}-${rawSpeaker || kind}`,
        kind,
        speaker: rawSpeaker || (kind === 'player' ? 'Player' : kind === 'abstract' ? 'Abstract' : '角色'),
        content: rawContent,
      });
      return;
    }

    if (entry && typeof entry === 'object') {
      const anyEntry = entry as any;
      const role = String(anyEntry.role ?? anyEntry.Role ?? '').toLowerCase();
      const content = String(anyEntry.content ?? anyEntry.Content ?? anyEntry.text ?? anyEntry.Text ?? '').trim();
      const speaker = String(anyEntry.speaker ?? anyEntry.Speaker ?? anyEntry.name ?? anyEntry.Name ?? '').trim();
      if (!content) return;

      const kind: ChatItemKind =
        role === 'player' || role === 'user'
          ? 'player'
          : role === 'abstract' || role === 'summary'
            ? 'abstract'
            : 'character';

      items.push({
        id: `${index}-${speaker || role || kind}`,
        kind,
        speaker: speaker || (kind === 'player' ? 'Player' : kind === 'abstract' ? 'Abstract' : '角色'),
        content,
      });
    }
  });

  return items;
};

const ChatPreview: React.FC<{ items: ChatItem[]; heightClassName?: string }> = ({ items, heightClassName }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingAdjustRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const lastActionRef = useRef<'init' | 'loadMore'>('init');

  useEffect(() => {
    setVisibleCount(10);
    lastActionRef.current = 'init';
  }, [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (lastActionRef.current === 'loadMore') return;
    requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    });
  }, [items.length]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const pending = pendingAdjustRef.current;
    if (!el || !pending) return;
    const newScrollHeight = el.scrollHeight;
    el.scrollTop = newScrollHeight - pending.prevScrollHeight + pending.prevScrollTop;
    pendingAdjustRef.current = null;
    lastActionRef.current = 'init';
  }, [visibleCount, items.length]);

  const subset = items.slice(Math.max(0, items.length - visibleCount));
  const canLoadMore = visibleCount < items.length;

  return (
    <div className={cn('bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden', heightClassName ?? 'h-44')}>
      <div
        ref={containerRef}
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          if (el.scrollTop > 16) return;
          if (!canLoadMore) return;
          pendingAdjustRef.current = { prevScrollHeight: el.scrollHeight, prevScrollTop: el.scrollTop };
          lastActionRef.current = 'loadMore';
          setVisibleCount((prev) => Math.min(items.length, prev + 10));
        }}
        className="h-full overflow-y-auto px-2 py-2 space-y-2"
      >
        {canLoadMore && <div className="text-[10px] text-[#94a3b8] text-center">向上滚动加载更多...</div>}

        {subset.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[#94a3b8]">
            暂无聊天记录
          </div>
        ) : (
          subset.map((item) => {
            if (item.kind === 'abstract') {
              return (
                <div key={item.id} className="flex justify-center">
                  <details className="w-full max-w-[92%] bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[#334155]">
                      摘要
                    </summary>
                    <div className="px-3 pb-3 text-xs text-[#334155] whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </div>
                  </details>
                </div>
              );
            }

            const isPlayer = item.kind === 'player';
            return (
              <div key={item.id} className={cn('flex', isPlayer ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[88%]')}>
                  <div className={cn('text-[10px] mb-1', isPlayer ? 'text-right text-[#94a3b8]' : 'text-left text-[#94a3b8]')}>
                    {isPlayer ? 'Player' : item.speaker}
                  </div>
                  <div
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs whitespace-pre-wrap leading-relaxed border',
                      isPlayer
                        ? 'bg-[#6366f1] text-white border-[#4f46e5] rounded-br-sm'
                        : 'bg-white text-[#334155] border-[#e2e8f0] rounded-bl-sm'
                    )}
                  >
                    {item.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// 24小时 Token 消耗柱状图组件
const TokenChart: React.FC<{ tokenUsage: number }> = ({ tokenUsage }) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // 生成24小时的模拟数据（基于总使用量生成随机分布）
  const generateHourlyData = () => {
    const hours = 24;
    const baseValue = Math.floor(tokenUsage * 0.15 / hours); // 24小时约占15%的总使用
    const data = [];
    for (let i = 0; i < hours; i++) {
      // 生成随机波动 (0.5 - 2.5倍)
      const randomFactor = 0.5 + Math.random() * 2;
      data.push(Math.floor(baseValue * randomFactor));
    }
    return data;
  };

  const hourlyData = generateHourlyData();
  const maxValue = Math.max(...hourlyData);

  // 获取当前小时
  const currentHour = new Date().getHours();

  return (
    <div className="bg-[#f8fafc] rounded-xl p-4">
      {/* 柱状图 */}
      <div className="flex items-end gap-[2px] h-32 mb-2">
        {hourlyData.map((value, index) => {
          const isHovered = hoveredHour === index;
          const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center group"
              onMouseEnter={() => setHoveredHour(index)}
              onMouseLeave={() => setHoveredHour(null)}
            >
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all duration-200 cursor-pointer',
                  isHovered ? 'bg-[#4f46e5]' : 'bg-[#6366f1]'
                )}
                style={{ height: `${Math.max(heightPercent, 5)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X轴时间标签 - 每6小时显示一个 */}
      <div className="flex justify-between text-[10px] text-[#94a3b8] px-1">
        {[0, 6, 12, 18, 24].map((offset) => {
          const hour = (currentHour - 23 + offset + 24) % 24;
          const hourStr = hour.toString().padStart(2, '0');
          return <span key={offset}>{offset === 24 ? '现在' : `${hourStr}:00`}</span>;
        })}
      </div>

      {/* 悬停提示 */}
      {hoveredHour !== null && (
        <div className="mt-3 p-2 bg-white rounded-lg border border-[#e2e8f0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              {(currentHour - 23 + hoveredHour + 24) % 24}:00 - {(currentHour - 23 + hoveredHour + 25) % 24}:00
            </span>
            <span className="text-sm font-semibold text-[#6366f1]">
              {formatNumber(hourlyData[hoveredHour])} tokens
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const CharacterManager: React.FC = () => {
  const { characters, addCharacter, updateCharacter, deleteCharacter } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatImportTargetIdRef = useRef<string | null>(null);
  const roleFileInputRef = useRef<HTMLInputElement>(null);
  const roleImportTargetIdRef = useRef<string | null>(null);
  const pendingImportedChatRef = useRef<{ characterId: string; items: ChatItem[] } | null>(null);
  const [chatByCharacterId, setChatByCharacterId] = useState<Record<string, ChatItem[]>>({});

  // 弹窗状态
  const [tokenModal, setTokenModal] = useState<{ isOpen: boolean; character: Character | null }>({ isOpen: false, character: null });
  const [chatModal, setChatModal] = useState<{ isOpen: boolean; character: Character | null }>({ isOpen: false, character: null });
  const [compressModal, setCompressModal] = useState<{ isOpen: boolean; character: Character | null }>({ isOpen: false, character: null });

  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    saveId: '',
    aiSoul: '',
    aiVoice: '',
    compressionEnabled: false,
    interactionOps: [],
  });

  const handleSwitchSave = () => {
    alert('切换存档功能');
  };

  const handleEdit = (character: Character) => {
    setIsEditing(true);
    setEditingId(character.id);
    setFormData({
      name: character.name,
      saveId: character.saveId,
      aiSoul: character.aiSoul,
      aiVoice: character.aiVoice,
      compressionEnabled: character.compressionEnabled,
      interactionOps: character.interactionOps,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个角色吗？')) {
      deleteCharacter(id);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('请输入角色名称');
      return;
    }
    if (editingId) {
      const pending = pendingImportedChatRef.current;
      if (pending && pending.characterId === editingId) {
        updateCharacter(editingId, { ...formData, chatCount: pending.items.length } as Partial<CharacterFormData>);
        setChatByCharacterId((prev) => ({ ...prev, [editingId]: pending.items }));
        pendingImportedChatRef.current = null;
      } else {
        updateCharacter(editingId, formData);
      }
    }
    setIsEditing(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    pendingImportedChatRef.current = null;
  };

  // 处理头像点击
  const handleAvatarClick = (character: Character) => {
    fileInputRef.current?.click();
    // 临时存储当前点击的角色ID，用于后续更新
    (fileInputRef.current as any).__characterId = character.id;
  };

  // 处理头像文件选择
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const characterId = (fileInputRef.current as any).__characterId;
    if (!characterId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const avatarUrl = event.target?.result as string;
      updateCharacter(characterId, { avatar: avatarUrl } as Partial<CharacterFormData>);
    };
    reader.readAsDataURL(file);

    // 清空input以便可以再次选择同一文件
    e.target.value = '';
  };

  // 处理Token统计点击
  const handleTokenClick = (character: Character) => {
    setTokenModal({ isOpen: true, character });
  };

  // 处理聊天统计点击
  const handleChatClick = (character: Character) => {
    setChatModal({ isOpen: true, character });
  };

  const handleChatImportClick = (character: Character) => {
    chatImportTargetIdRef.current = character.id;
    chatFileInputRef.current?.click();
  };

  const handleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const characterId = chatImportTargetIdRef.current;
    if (!characterId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? '');
        const parsed = JSON.parse(text);
        const items = parseConversationHistory(parsed);
        setChatByCharacterId((prev) => ({ ...prev, [characterId]: items }));
        updateCharacter(characterId, { chatCount: items.length } as Partial<CharacterFormData>);
      } catch {
        alert('聊天记录导入失败：JSON 格式不正确');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleRoleImportClick = () => {
    if (!editingId) return;
    roleImportTargetIdRef.current = editingId;
    roleFileInputRef.current?.click();
  };

  const handleRoleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const characterId = roleImportTargetIdRef.current;
    if (!characterId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? '');
        const parsed = JSON.parse(text);
        const anyParsed = parsed as any;

        const nextName = String(anyParsed.Name ?? anyParsed.name ?? '').trim();
        const nextSaveId = String(anyParsed.StringId ?? anyParsed.saveId ?? '').trim();
        const nextAiSoul = String(anyParsed.AIGeneratedPersonality ?? anyParsed.CharacterDescription ?? anyParsed.aiSoul ?? '').trim();
        const nextAiVoice = String(anyParsed.AssignedTTSVoice ?? anyParsed.aiVoice ?? '').trim();

        setFormData((prev) => ({
          ...prev,
          name: nextName || prev.name,
          saveId: nextSaveId || prev.saveId,
          aiSoul: nextAiSoul || prev.aiSoul,
          aiVoice: nextAiVoice || prev.aiVoice,
        }));

        const items = parseConversationHistory(parsed);
        pendingImportedChatRef.current = { characterId, items };
      } catch {
        alert('角色文件导入失败：JSON 格式不正确');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // 处理压缩统计点击
  const handleCompressClick = (character: Character) => {
    setCompressModal({ isOpen: true, character });
  };

  // 执行压缩
  const doCompress = () => {
    if (compressModal.character) {
      // 这里调用实际的压缩API
      alert(`已为角色 "${compressModal.character.name}" 执行对话压缩`);
      setCompressModal({ isOpen: false, character: null });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-md border-2 border-[#4f46e5]">
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0f172a]">角色管理</h1>
        </div>
        <button
          onClick={handleSwitchSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200"
        >
          <FolderOpen className="w-4 h-4" />
          切换存档
        </button>
      </div>

  {isEditing && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleCancel}
          />
          {/* 弹窗内容 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <Database className="w-5 h-5 text-[#6366f1]" />
                </div>
                <h3 className="font-semibold text-[#0f172a]">编辑角色</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">角色名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="输入角色名称"
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">AI灵魂</label>
                  <select
                    value={formData.aiSoul}
                    onChange={(e) => setFormData({ ...formData, aiSoul: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                  >
                    <option value="">使用主模型</option>
                    {aiSoulOptions.map((soul) => (
                      <option key={soul} value={soul}>
                        {soul}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">AI声优</label>
                  <select
                    value={formData.aiVoice}
                    onChange={(e) => setFormData({ ...formData, aiVoice: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                  >
                    <option value="">使用默认语音</option>
                    {aiVoiceOptions.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">角色文件</label>
                  <button
                    type="button"
                    onClick={handleRoleImportClick}
                    className="w-full px-4 py-2.5 bg-[#f0f4ff] text-[#6366f1] rounded-xl text-sm font-medium hover:bg-[#e0e7ff] transition-all duration-200 border border-[#6366f1]/20"
                  >
                    导入角色文件（JSON）
                  </button>
                  <p className="text-xs text-[#94a3b8] mt-2">导入后将填充角色信息，保存后同步聊天记录</p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.compressionEnabled}
                      onChange={(checked) => setFormData({ ...formData, compressionEnabled: checked })}
                    />
                    <div>
                      <span className="text-sm text-[#64748b]">启用会话压缩</span>
                      <p className="text-xs text-[#94a3b8]">自动压缩历史会话以节省Token</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[#e2e8f0]">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-5 py-2.5 text-[#64748b] hover:bg-[#f8fafc] rounded-xl font-medium transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {characters.map((character) => (
          <div
            key={character.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                onClick={() => handleAvatarClick(character)}
                className="w-10 h-10 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {character.avatar ? (
                  <img src={character.avatar} alt={character.name} className="w-full h-full rounded-lg object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">{character.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#0f172a] text-sm truncate">{character.name}</h3>
                <p className="text-[10px] text-[#94a3b8] font-mono truncate">{character.saveId}</p>
              </div>
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleEdit(character)}
                  className="p-1.5 text-[#94a3b8] hover:text-[#6366f1] hover:bg-[#f0f4ff] rounded-lg transition-all duration-200"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(character.id)}
                  className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-lg transition-all duration-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-xs">
                <Wand2 className="w-3 h-3 text-[#6366f1] flex-shrink-0" />
                <span className="text-[#94a3b8] flex-shrink-0">AI灵魂:</span>
                <span className="text-[#334155] truncate min-w-0">{character.aiSoul || '主模型'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Mic className="w-3 h-3 text-[#8b5cf6] flex-shrink-0" />
                <span className="text-[#94a3b8] flex-shrink-0">AI声优:</span>
                <span className="text-[#334155] truncate min-w-0">{character.aiVoice || '默认'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div
                onClick={() => handleTokenClick(character)}
                className="text-center p-2 bg-[#f0f4ff] rounded-lg cursor-pointer hover:bg-[#e0e7ff] transition-colors"
              >
                <p className="text-sm font-bold text-[#6366f1]">{formatNumber(character.tokenUsage)}</p>
                <p className="text-[10px] text-[#64748b]">Token</p>
              </div>
              <div
                onClick={() => handleChatClick(character)}
                className="text-center p-2 bg-[#f0fdf4] rounded-lg cursor-pointer hover:bg-[#dcfce7] transition-colors"
              >
                <p className="text-sm font-bold text-[#22c55e]">{formatNumber(character.chatCount)}</p>
                <p className="text-[10px] text-[#64748b]">聊天</p>
              </div>
              <div
                onClick={() => handleCompressClick(character)}
                className="text-center p-2 bg-[#fef3c7] rounded-lg cursor-pointer hover:bg-[#fde68a] transition-colors"
              >
                <p className="text-xs font-bold text-[#f59e0b] leading-5">
                  {character.compressionEnabled ? '已启用' : '未启用'}
                </p>
                <p className="text-[10px] text-[#64748b]">压缩</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#334155]">聊天记录</span>
                <button
                  onClick={() => handleChatImportClick(character)}
                  className="px-2 py-1 text-[10px] font-medium text-[#22c55e] bg-[#f0fdf4] hover:bg-[#dcfce7] rounded-lg transition-colors"
                >
                  导入 JSON
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 隐藏的文件输入框 - 用于头像上传 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      <input
        ref={chatFileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleChatFileChange}
        className="hidden"
      />

      <input
        ref={roleFileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleRoleFileChange}
        className="hidden"
      />

      {/* Token 消耗弹窗 */}
      {tokenModal.isOpen && tokenModal.character && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setTokenModal({ isOpen: false, character: null })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] w-full max-w-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#6366f1]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a]">Token 消耗</h3>
                  <p className="text-xs text-[#94a3b8]">{tokenModal.character.name}</p>
                </div>
              </div>

              {/* 24小时柱状图 */}
              <div className="mb-6">
                <p className="text-sm text-[#64748b] mb-3">最近 24 小时消耗分布</p>
                <TokenChart tokenUsage={tokenModal.character.tokenUsage} />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#f8fafc] rounded-xl">
                  <span className="text-sm text-[#64748b]">最近 7 天</span>
                  <span className="text-sm font-semibold text-[#6366f1]">{formatNumber(tokenModal.character.tokenUsage)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#f0f4ff] rounded-xl">
                  <span className="text-sm text-[#334155] font-medium">总计消耗</span>
                  <span className="text-lg font-bold text-[#6366f1]">{formatNumber(tokenModal.character.tokenUsage * 3)}</span>
                </div>
              </div>
              <button
                onClick={() => setTokenModal({ isOpen: false, character: null })}
                className="w-full mt-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] transition-all duration-200"
              >
                关闭
              </button>
            </div>
          </div>
        </>
      )}

      {/* 聊天记录弹窗 */}
      {chatModal.isOpen && chatModal.character && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setChatModal({ isOpen: false, character: null })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] w-full max-w-lg max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f0fdf4] rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#22c55e]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0f172a]">最近聊天记录</h3>
                    <p className="text-xs text-[#94a3b8]">{chatModal.character.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setChatModal({ isOpen: false, character: null })}
                  className="p-2 text-[#94a3b8] hover:bg-[#f8fafc] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <ChatPreview items={chatByCharacterId[chatModal.character.id] ?? []} heightClassName="h-[52vh]" />
                {(chatByCharacterId[chatModal.character.id] ?? []).length === 0 && (
                  <div className="text-[10px] text-[#94a3b8] text-center mt-3">
                    请在角色卡片中点击“导入 JSON”加载 ConversationHistory
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 压缩确认弹窗 */}
      {compressModal.isOpen && compressModal.character && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCompressModal({ isOpen: false, character: null })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] w-full max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#fef3c7] rounded-xl flex items-center justify-center">
                  <Database className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a]">压缩对话记录</h3>
                  <p className="text-xs text-[#94a3b8]">{compressModal.character.name}</p>
                </div>
              </div>
              <p className="text-sm text-[#64748b] mb-6">
                确定要立即压缩该角色的对话记录吗？<br />
                压缩后将生成摘要，释放部分存储空间。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCompressModal({ isOpen: false, character: null })}
                  className="flex-1 py-2.5 text-[#64748b] hover:bg-[#f8fafc] rounded-xl font-medium transition-all duration-200"
                >
                  取消
                </button>
                <button
                  onClick={doCompress}
                  className="flex-1 py-2.5 bg-[#f59e0b] text-white rounded-xl font-medium hover:bg-[#d97706] transition-all duration-200"
                >
                  立即压缩
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

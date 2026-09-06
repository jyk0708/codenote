"use client";

import { useAppStore } from "@/store/useAppStore";
import {
  X,
  FileCode,
  ChevronLeft,
  ChevronRight,
  FileText,
  CircleDot,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function EditorTabs() {
  const {
    openTabs,
    activeTabId,
    snippets,
    languages,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useAppStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    snippetId: string;
  } | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  // 活跃 tab 变化时滚动到可视区域
  useEffect(() => {
    if (!activeTabId || !tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  const handleContextMenu = (e: React.MouseEvent, snippetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, snippetId });
  };

  const getLangLabel = (langValue: string) => {
    const lang = languages.find((l) => l.value === langValue);
    return lang?.name || langValue;
  };

  const canBack = canGoBack();
  const canFwd = canGoForward();

  return (
    <div className="flex items-stretch h-9 bg-slate-100 border-b border-slate-200 select-none">
      {/* 导航箭头 */}
      <div className="flex items-center px-1 gap-0.5 border-r border-slate-200 flex-shrink-0">
        <button
          onClick={goBack}
          disabled={!canBack}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            canBack
              ? "text-slate-600 hover:bg-slate-200"
              : "text-slate-300 cursor-default"
          }`}
          title="后退 (Alt+←)"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={goForward}
          disabled={!canFwd}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            canFwd
              ? "text-slate-600 hover:bg-slate-200"
              : "text-slate-300 cursor-default"
          }`}
          title="前进 (Alt+→)"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tab 列表 */}
      <div
        ref={tabsRef}
        className="flex-1 flex items-stretch overflow-x-auto scrollbar-thin"
      >
        {openTabs.map((tabId) => {
          const snippet = snippets.find((s) => s.id === tabId);
          if (!snippet) return null;
          const isActive = activeTabId === tabId;

          return (
            <div
              key={tabId}
              data-tab-id={tabId}
              onClick={() => setActiveTab(tabId)}
              onContextMenu={(e) => handleContextMenu(e, tabId)}
              className={`group flex items-center gap-1.5 px-3 pr-2 h-full border-r border-slate-200 cursor-pointer transition-colors flex-shrink-0 max-w-[200px] ${
                isActive
                  ? "bg-white text-slate-800 border-b-2 border-b-primary-500"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
              title={snippet.title}
            >
              <FileCode size={14} className="flex-shrink-0 text-primary-400" />
              <span className="text-xs font-medium truncate flex-1">
                {snippet.title}
              </span>
              <span
                className={`text-[10px] px-1 rounded flex-shrink-0 ${
                  isActive ? "bg-primary-50 text-primary-500" : "bg-slate-200 text-slate-500"
                }`}
              >
                {getLangLabel(snippet.language)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tabId);
                }}
                className={`w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  isActive ? "hover:bg-slate-200" : "hover:bg-slate-300"
                }`}
                title="关闭"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        {openTabs.length === 0 && (
          <div className="flex items-center px-3 text-xs text-slate-400">
            暂无打开的文件
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              closeTab(contextMenu.snippetId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <X size={14} className="text-slate-400" />
            关闭
          </button>
          <button
            onClick={() => {
              closeOtherTabs(contextMenu.snippetId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <CircleDot size={14} className="text-slate-400" />
            关闭其他
          </button>
          <button
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <FileText size={14} className="text-slate-400" />
            关闭全部
          </button>
        </div>
      )}
    </div>
  );
}

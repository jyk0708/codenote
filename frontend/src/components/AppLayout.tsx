"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import CategoryTree from "./CategoryTree";
import CodeEditor from "./CodeEditor";
import AnnotationPanel from "./AnnotationPanel";
import AuthModal from "./AuthModal";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import {
ChevronLeft,
ChevronRight,
WifiOff,
Wifi,
X,
} from "lucide-react";

export default function AppLayout() {
  const {
    layout,
    selectedSnippetId,
    toggleLeftPanel,
    toggleRightPanel,
    toggleFocusMode,
    goBack,
    goForward,
    isLoggedIn,
    checkAuth,
    isLoading,
    revealSnippet,
  } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // 心跳检测
  const { isOnline, showWarning, dismissWarning, recheck } = useHeartbeat(15000);

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
    // 检查完后，如果未登录，自动弹出登录框
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!state.isLoading && !state.isLoggedIn) {
        setShowAuth(true);
      }
    });
    return unsubscribe;
  }, [checkAuth]);

  // 初始化右侧面板宽度为屏幕的 1/3
  useEffect(() => {
    const oneThird = Math.floor(window.innerWidth / 3);
    useAppStore.getState().setRightPanelWidth(oneThird);
  }, []);

  // 左侧拖拽
  const handleLeftDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging("left");
  }, []);

  // 右侧拖拽
  const handleRightDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging("right");
  }, []);

  // 全局鼠标移动
  useEffect(() => {
    if (!dragging) return;

    const setLeftPanelWidth = useAppStore.getState().setLeftPanelWidth;
    const setRightPanelWidth = useAppStore.getState().setRightPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (dragging === "left") {
        const width = e.clientX - rect.left;
        setLeftPanelWidth(width);
      } else if (dragging === "right") {
        const width = rect.right - e.clientX;
        setRightPanelWidth(width);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleLeftPanel();
      }
      if (e.altKey && e.key === "/") {
        e.preventDefault();
        toggleRightPanel();
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFocusMode();
      }
      // Alt + 左箭头：后退
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
      // Alt + 右箭头：前进
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
      // Alt + L：定位到文件（在左侧树中显示当前片段）
      if (e.altKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        if (selectedSnippetId) {
          revealSnippet(selectedSnippetId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeftPanel, toggleRightPanel, toggleFocusMode, goBack, goForward, revealSnippet, selectedSnippetId]);

  const handleAuthSuccess = () => {
    setShowAuth(false);
    // 登录成功后重新检查认证状态，加载真实数据
    checkAuth();
  };

  const showLeft = !layout.leftPanelCollapsed && !layout.focusMode;
  const showRight = !layout.rightPanelCollapsed && !layout.focusMode && selectedSnippetId !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full bg-slate-50 select-none flex-col"
    >
      {/* 断连警告横幅 */}
      {showWarning && (
        <div
          className={`${
            isOnline
              ? "bg-emerald-500 text-white"
              : "bg-amber-500 text-white"
          } px-4 py-2 flex items-center justify-between flex-shrink-0 z-50`}
        >
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi size={16} />
                <span className="text-sm font-medium">连接已恢复</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="animate-pulse" />
                <span className="text-sm font-medium">
                  服务器连接已断开！请及时保存您的内容，避免数据丢失。
                </span>
                <button
                  onClick={recheck}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
                >
                  立即重连
                </button>
              </>
            )}
          </div>
          <button
            onClick={dismissWarning}
            className="hover:bg-white/20 p-1 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* 登录弹窗 */}
        <AuthModal isOpen={showAuth} onSuccess={handleAuthSuccess} />

      {/* 左侧面板 */}
      {showLeft && (
        <div
          className="flex flex-col bg-white border-r border-slate-200"
          style={{ width: layout.leftPanelWidth, flexShrink: 0 }}
        >
          <CategoryTree />
        </div>
      )}

      {/* 左侧拖拽条 */}
      {showLeft && (
        <div
          className={`resizer ${dragging === "left" ? "dragging" : ""}`}
          onMouseDown={handleLeftDragStart}
        />
      )}

      {/* 左侧折叠按钮 */}
      {!showLeft && !layout.focusMode && (
        <button
          onClick={toggleLeftPanel}
          className="w-6 flex-shrink-0 flex items-center justify-center bg-white border-r border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
          title="展开分类栏 (Ctrl+B)"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* 中间代码区 */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <CodeEditor />
      </div>

      {/* 右侧拖拽条 */}
      {showRight && (
        <div
          className={`resizer ${dragging === "right" ? "dragging" : ""}`}
          onMouseDown={handleRightDragStart}
        />
      )}

      {/* 右侧面板 */}
      {showRight && (
        <div
          className="flex flex-col bg-white border-l border-slate-200"
          style={{ width: layout.rightPanelWidth, flexShrink: 0 }}
        >
          <AnnotationPanel />
        </div>
      )}

      {/* 右侧折叠按钮 - 仅在选中代码片段时显示 */}
      {!showRight && !layout.focusMode && selectedSnippetId !== null && (
        <button
          onClick={toggleRightPanel}
          className="w-6 flex-shrink-0 flex items-center justify-center bg-white border-l border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
          title="展开注释栏 (Ctrl+/)"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      </div>
    </div>
  );
}

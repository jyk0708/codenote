"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import CategoryTree from "./CategoryTree";
import CodeEditor from "./CodeEditor";
import AnnotationPanel from "./AnnotationPanel";
import AuthModal from "./AuthModal";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  User,
  LogOut,
} from "lucide-react";

export default function AppLayout() {
  const {
    layout,
    toggleLeftPanel,
    toggleRightPanel,
    toggleFocusMode,
    isLoggedIn,
    userNickname,
    userEmail,
    logout,
    checkAuth,
    isLoading,
  } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
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
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleLeftPanel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        toggleRightPanel();
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFocusMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeftPanel, toggleRightPanel, toggleFocusMode]);

  // 点击空白关闭用户菜单
  useEffect(() => {
    const handleClick = () => setShowUserMenu(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  const showLeft = !layout.leftPanelCollapsed && !layout.focusMode;
  const showRight = !layout.rightPanelCollapsed && !layout.focusMode;

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
      className="flex h-full w-full bg-slate-50 select-none"
    >
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
        {/* 顶部用户按钮 */}
        <div className="absolute top-3 right-3 z-10">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isLoggedIn) {
                  setShowUserMenu(!showUserMenu);
                } else {
                  setShowAuth(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-white transition-all text-sm text-slate-600"
            >
              <User size={14} />
              <span className="max-w-[100px] truncate">
                {isLoggedIn ? userNickname || userEmail : "登录"}
              </span>
            </button>

            {/* 用户菜单 */}
            {showUserMenu && isLoggedIn && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {userNickname || "用户"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={14} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>

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

      {/* 右侧折叠按钮 */}
      {!showRight && !layout.focusMode && (
        <button
          onClick={toggleRightPanel}
          className="w-6 flex-shrink-0 flex items-center justify-center bg-white border-l border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
          title="展开注释栏 (Ctrl+/)"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* 专注模式切换按钮 */}
      <button
        onClick={toggleFocusMode}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-primary-500 hover:border-primary-300 transition-all z-50"
        title={layout.focusMode ? "退出专注模式 (F11)" : "专注模式 (F11)"}
      >
        {layout.focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  );
}

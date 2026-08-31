"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { buildCategoryTree, LANGUAGE_OPTIONS } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  FileCode,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Search,
  FolderPlus,
  Star,
} from "lucide-react";
import type { Category, Snippet } from "@/types";
import Modal from "@/components/ui/Modal";

type ViewMode = "all" | "favorites";

export default function CategoryTree() {
  const {
    categories,
    snippets,
    selectedCategoryId,
    selectedSnippetId,
    addCategory,
    updateCategory,
    deleteCategory,
    selectCategory,
    selectSnippet,
    addSnippet,
    deleteSnippet,
    toggleFavorite,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(categories.filter((c) => c.parentId).map((c) => c.parentId!))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    type: "category" | "snippet";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [plusDropdownId, setPlusDropdownId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 搜索
  const [searchQuery, setSearchQuery] = useState("");

  // 新建分类弹窗
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  // 新建片段弹窗
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [newSnippetCategoryId, setNewSnippetCategoryId] = useState<string | null>(null);
  const [newSnippetTitle, setNewSnippetTitle] = useState("");
  const [newSnippetDescription, setNewSnippetDescription] = useState("");
  const [newSnippetLanguage, setNewSnippetLanguage] = useState("javascript");

  const tree = useMemo(() => buildCategoryTree(categories, null), [categories]);

  // 收藏的片段
  const favoriteSnippets = useMemo(() => {
    let result = snippets.filter((s) => s.favorite);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [snippets, searchQuery]);

  // 切换展开/折叠
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 开始重命名
  const startRename = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 完成重命名
  const finishRename = () => {
    if (editingId && editingName.trim()) {
      updateCategory(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  // 打开新建分类弹窗
  const openCategoryModal = (parentId: string | null) => {
    setNewCategoryParentId(parentId);
    setNewCategoryName("");
    setShowCategoryModal(true);
    setContextMenu(null);
  };

  // 提交新建分类
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    addCategory(newCategoryName.trim(), newCategoryParentId);
    if (newCategoryParentId) {
      setExpandedIds((prev) => new Set(prev).add(newCategoryParentId));
    }
    setShowCategoryModal(false);
  };

  // 删除分类
  const handleDeleteCategory = (id: string) => {
    if (confirm("确定要删除此分类及其所有子分类和代码片段吗？")) {
      deleteCategory(id);
    }
    setContextMenu(null);
  };

  // 打开新建片段弹窗
  const openSnippetModal = (categoryId: string | null) => {
    setNewSnippetCategoryId(categoryId);
    setNewSnippetTitle("");
    setNewSnippetDescription("");
    setNewSnippetLanguage("javascript");
    setShowSnippetModal(true);
    setContextMenu(null);
  };

  // 提交新建片段
  const handleCreateSnippet = async () => {
    const title = newSnippetTitle.trim() || "未命名片段";
    await addSnippet(newSnippetCategoryId);
    // 更新新建片段的标题、描述和语言
    const state = useAppStore.getState();
    if (state.selectedSnippetId) {
      await state.updateSnippet(state.selectedSnippetId, {
        title,
        description: newSnippetDescription.trim(),
        language: newSnippetLanguage,
      });
    }
    setShowSnippetModal(false);
    // 展开父分类
    if (newSnippetCategoryId) {
      setExpandedIds((prev) => new Set(prev).add(newSnippetCategoryId));
    }
  };

  // 右键菜单
  const handleContextMenu = (
    e: React.MouseEvent,
    type: "category" | "snippet",
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  };

  // 点击空白关闭右键菜单和下拉菜单
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setPlusDropdownId(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // 获取分类下的片段
  const getCategorySnippets = (categoryId: string): Snippet[] => {
    let result = snippets.filter((s) => s.categoryId === categoryId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return result;
  };

  // 递归获取所有子分类的片段数
  const getAllSnippetsCount = (categoryId: string): number => {
    let count = snippets.filter((s) => s.categoryId === categoryId).length;
    categories
      .filter((c) => c.parentId === categoryId)
      .forEach((c) => {
        count += getAllSnippetsCount(c.id);
      });
    return count;
  };

  // 渲染片段列表项（名称 + 描述 + 收藏按钮）
  const renderSnippetItem = (snippet: Snippet, depth: number = 1) => {
    const isSelected = selectedSnippetId === snippet.id;
    return (
      <div
        key={snippet.id}
        className={`group cursor-pointer rounded-md transition-colors ${
          isSelected ? "bg-primary-50" : "hover:bg-slate-100"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px`, paddingRight: "8px" }}
        onClick={() => {
          if (snippet.categoryId) {
            selectCategory(snippet.categoryId);
          } else {
            selectCategory(null);
          }
          selectSnippet(snippet.id);
        }}
        onContextMenu={(e) => handleContextMenu(e, "snippet", snippet.id)}
      >
        <div className="flex items-start py-2 gap-2">
          <FileCode
            size={14}
            className={`mt-0.5 flex-shrink-0 ${
              isSelected ? "text-primary-500" : "text-slate-400"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-sm font-medium truncate ${
                  isSelected ? "text-primary-700" : "text-slate-700"
                }`}
              >
                {snippet.title}
              </span>
              <span className="text-xs text-slate-400 flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                {snippet.language}
              </span>
            </div>
            {snippet.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                {snippet.description}
              </p>
            )}
          </div>
          <button
            className={`flex-shrink-0 p-0.5 rounded transition-opacity ${
              snippet.favorite
                ? "opacity-100 text-amber-400 hover:text-amber-500"
                : "opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-400"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(snippet.id);
            }}
            title={snippet.favorite ? "取消收藏" : "收藏"}
          >
            <Star size={14} fill={snippet.favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    );
  };

  // 渲染分类节点
  const renderCategory = (category: Category, depth: number = 0) => {
    const isExpanded = expandedIds.has(category.id);
    const isSelected = selectedCategoryId === category.id && !selectedSnippetId;
    const children = (category as any).children || [];
    const catSnippets = getCategorySnippets(category.id);
    const allSnippetsCount = getAllSnippetsCount(category.id);

    return (
      <div key={category.id}>
        <div
          className={`flex items-center px-2 py-1.5 cursor-pointer rounded-md group hover:bg-slate-100 ${
            isSelected ? "bg-primary-50 text-primary-600" : "text-slate-700"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            selectCategory(category.id);
            selectSnippet(null);
            // 点击分类时自动展开
            if (!expandedIds.has(category.id)) {
              setExpandedIds((prev) => new Set(prev).add(category.id));
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, "category", category.id)}
        >
          <button
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(category.id);
            }}
          >
            {children.length > 0 ? (
              isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </button>

          <span className="mr-1.5 flex-shrink-0">
            {isExpanded ? (
              <FolderOpen size={16} className="text-amber-500" />
            ) : (
              <Folder size={16} className="text-amber-500" />
            )}
          </span>

          {editingId === category.id ? (
            <input
              ref={inputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishRename();
                if (e.key === "Escape") setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-white border border-primary-300 rounded px-1 py-0.5 text-sm outline-none"
            />
          ) : (
            <>
              <span className="flex-1 min-w-0 truncate text-sm font-medium">
                {category.name}
              </span>
              <span className="text-xs text-slate-400 ml-1 flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {allSnippetsCount}
              </span>
              {/* 悬停显示操作按钮 */}
              <div className="relative flex-shrink-0">
                <button
                  className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlusDropdownId(plusDropdownId === category.id ? null : category.id);
                  }}
                  title="新建"
                >
                  <Plus size={14} />
                </button>
                {/* 下拉菜单 */}
                {plusDropdownId === category.id && (
                  <div
                    className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-36"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      onClick={() => {
                        openCategoryModal(category.id);
                        setPlusDropdownId(null);
                      }}
                    >
                      <FolderPlus size={14} />
                      新建子分类
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      onClick={() => {
                        openSnippetModal(category.id);
                        setPlusDropdownId(null);
                      }}
                    >
                      <FileCode size={14} />
                      新建代码片段
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 子分类和片段 */}
        {isExpanded && (
          <div>
            {children.map((child: Category) =>
              renderCategory(child, depth + 1)
            )}

            {/* 该分类下的片段 */}
            {catSnippets.map((snippet) =>
              renderSnippetItem(snippet, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200">
        <span className="font-semibold text-sm text-slate-700">代码库</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openSnippetModal(selectedCategoryId)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary-50 text-slate-500 hover:text-primary-500 transition-colors"
            title="新建代码片段"
          >
            <FileCode size={15} />
          </button>
          <button
            onClick={() => openCategoryModal(null)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary-50 text-slate-500 hover:text-primary-500 transition-colors"
            title="新建分类"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 视图切换：全部 / 收藏 */}
      <div className="flex px-2 py-1.5 border-b border-slate-100 gap-1">
        <button
          onClick={() => setViewMode("all")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            viewMode === "all"
              ? "bg-slate-100 text-slate-700"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setViewMode("favorites")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
            viewMode === "favorites"
              ? "bg-amber-50 text-amber-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Star size={12} fill={viewMode === "favorites" ? "currentColor" : "none"} />
          收藏
          {favoriteSnippets.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded-full">
              {favoriteSnippets.length}
            </span>
          )}
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === "favorites" ? "搜索收藏..." : "搜索片段..."}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
          />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {viewMode === "favorites" ? (
          // 收藏视图
          <div>
            {favoriteSnippets.length > 0 ? (
              favoriteSnippets.map((snippet) => renderSnippetItem(snippet, 0))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Star size={32} className="mb-2 opacity-30" />
                <p className="text-xs">暂无收藏的片段</p>
                <p className="text-[11px] mt-1">点击片段旁的星标添加收藏</p>
              </div>
            )}
          </div>
        ) : (
          // 全部视图：分类树
          <>
            {tree.map((cat) => renderCategory(cat))}

            {/* 未分类的片段 */}
            {snippets.filter((s) => !s.categoryId).length > 0 && (
              <div className="mt-2">
                <div className="px-2 py-1 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  未分类
                </div>
                {snippets
                  .filter((s) => !s.categoryId)
                  .filter((s) =>
                    searchQuery.trim()
                      ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (s.description &&
                          s.description.toLowerCase().includes(searchQuery.toLowerCase()))
                      : true
                  )
                  .map((snippet) => renderSnippetItem(snippet, 0))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "category" && (
            <>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => openCategoryModal(contextMenu.id)}
              >
                <Folder size={14} />
                新建子分类
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => openSnippetModal(contextMenu.id)}
              >
                <FileCode size={14} />
                新建代码片段
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => {
                  const cat = categories.find(
                    (c) => c.id === contextMenu.id
                  );
                  if (cat) startRename(cat);
                }}
              >
                <Pencil size={14} />
                重命名
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                onClick={() => handleDeleteCategory(contextMenu.id)}
              >
                <Trash2 size={14} />
                删除分类
              </button>
            </>
          )}
          {contextMenu.type === "snippet" && (
            <>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => {
                  const snippet = snippets.find((s) => s.id === contextMenu.id);
                  if (snippet) {
                    toggleFavorite(snippet.id);
                  }
                  setContextMenu(null);
                }}
              >
                <Star size={14} />
                {snippets.find((s) => s.id === contextMenu.id)?.favorite
                  ? "取消收藏"
                  : "添加收藏"}
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                onClick={() => {
                  if (confirm("确定删除此代码片段？")) {
                    deleteSnippet(contextMenu.id);
                  }
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} />
                删除片段
              </button>
            </>
          )}
        </div>
      )}

      {/* 新建分类弹窗 */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="新建分类"
        footer={
          <>
            <button
              onClick={() => setShowCategoryModal(false)}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim()}
              className="px-4 py-1.5 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              创建
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              分类名称
            </label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCategory();
              }}
              placeholder="请输入分类名称"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
          {newCategoryParentId && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md">
              父分类：{categories.find((c) => c.id === newCategoryParentId)?.name}
            </div>
          )}
        </div>
      </Modal>

      {/* 新建代码片段弹窗 */}
      <Modal
        isOpen={showSnippetModal}
        onClose={() => setShowSnippetModal(false)}
        title="新建代码片段"
        width="w-[460px]"
        footer={
          <>
            <button
              onClick={() => setShowSnippetModal(false)}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateSnippet}
              className="px-4 py-1.5 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              创建
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              片段名称
            </label>
            <input
              value={newSnippetTitle}
              onChange={(e) => setNewSnippetTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSnippet();
              }}
              placeholder="未命名片段"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              描述
              <span className="text-slate-400 font-normal ml-1">（可选）</span>
            </label>
            <textarea
              value={newSnippetDescription}
              onChange={(e) => setNewSnippetDescription(e.target.value)}
              placeholder="简要描述这个代码片段的用途..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              语言类型
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setNewSnippetLanguage(lang.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                    newSnippetLanguage === lang.value
                      ? "border-primary-400 bg-primary-50 text-primary-600 font-medium"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          {newSnippetCategoryId && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md flex items-center gap-2">
              <Folder size={12} className="text-amber-500" />
              所属分类：{categories.find((c) => c.id === newSnippetCategoryId)?.name}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

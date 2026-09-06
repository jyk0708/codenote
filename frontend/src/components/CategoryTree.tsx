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
  Upload,
  Settings,
  Languages,
  Copy,
  FileText,
  Link2,
  PanelLeftClose,
} from "lucide-react";
import type { Category, Snippet } from "@/types";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type ViewMode = "all" | "favorites";

export default function CategoryTree() {
  const {
    categories,
    snippets,
    selectedCategoryId,
    selectedSnippetId,
    languages,
    addCategory,
    updateCategory,
    deleteCategory,
    selectCategory,
    selectSnippet,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    toggleFavorite,
    reorderSnippet,
    moveSnippetToCategory,
    moveCategory,
    getSnippetPath,
    toggleLeftPanel,
    addCategoryTree,
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
  const [searchResults, setSearchResults] = useState<{
    snippets: Snippet[];
    annotations: any[];
    categories: Category[];
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // 防抖搜索
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { searchAll } = useAppStore.getState();
      const res = await searchAll(searchQuery);
      setSearchResults(res);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  const [newSnippetTags, setNewSnippetTags] = useState("");

  // 编辑片段弹窗
  const [editSnippetId, setEditSnippetId] = useState<string | null>(null);
  const [editSnippetTitle, setEditSnippetTitle] = useState("");
  const [editSnippetDescription, setEditSnippetDescription] = useState("");
  const [editSnippetLanguage, setEditSnippetLanguage] = useState("javascript");
  const [editSnippetTags, setEditSnippetTags] = useState("");
  const [editSnippetSortOrder, setEditSnippetSortOrder] = useState(0);

  // 拖拽排序
  const [draggingSnippetId, setDraggingSnippetId] = useState<string | null>(null);
  const [dragOverSnippetId, setDragOverSnippetId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<"before" | "after">("after");
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category" | "snippet";
    id: string;
    name: string;
  } | null>(null);

  // 获取语言选项列表（优先使用服务端配置，回退到内置默认）
  const languageOptions = useMemo(() => {
    if (languages.length > 0) {
      return languages
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({ value: l.value, label: l.name, mode: l.mode }));
    }
    return LANGUAGE_OPTIONS;
  }, [languages]);

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
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
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
      updateCategory(editingId, { name: editingName.trim() });
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
  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await addCategoryTree(name, newCategoryParentId);
    if (newCategoryParentId) {
      setExpandedIds((prev) => new Set(prev).add(newCategoryParentId));
    }
    setShowCategoryModal(false);
  };

  // 删除分类
  const handleDeleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    setDeleteTarget({
      type: "category",
      id,
      name: cat?.name || "此分类",
    });
    setContextMenu(null);
  };

  // 打开新建片段弹窗
  const openSnippetModal = (categoryId: string | null) => {
    setNewSnippetCategoryId(categoryId);
    setNewSnippetTitle("");
    setNewSnippetDescription("");
    setNewSnippetLanguage("javascript");
    setNewSnippetTags("");
    setShowSnippetModal(true);
    setContextMenu(null);
  };

  // 提交新建片段
  const handleCreateSnippet = async () => {
    const title = newSnippetTitle.trim() || "未命名片段";
    const tags = newSnippetTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await addSnippet(newSnippetCategoryId);
    // 更新新建片段的标题、描述和语言
    const state = useAppStore.getState();
    if (state.selectedSnippetId) {
      await state.updateSnippet(state.selectedSnippetId, {
        title,
        description: newSnippetDescription.trim(),
        language: newSnippetLanguage,
        tags,
      });
    }
    setShowSnippetModal(false);
    // 展开父分类
    if (newSnippetCategoryId) {
      setExpandedIds((prev) => new Set(prev).add(newSnippetCategoryId));
    }
  };

  // 打开编辑片段弹窗
  const openEditSnippetModal = (snippetId: string) => {
    const s = snippets.find((sn) => sn.id === snippetId);
    if (!s) return;
    setEditSnippetId(snippetId);
    setEditSnippetTitle(s.title);
    setEditSnippetDescription(s.description || "");
    setEditSnippetLanguage(s.language);
    setEditSnippetTags(s.tags.join(", "));
    setEditSnippetSortOrder(s.sortOrder || 0);
    setContextMenu(null);
  };

  // 提交编辑片段
  const handleEditSnippet = async () => {
    if (!editSnippetId) return;
    const tags = editSnippetTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateSnippet(editSnippetId, {
      title: editSnippetTitle.trim() || "未命名片段",
      description: editSnippetDescription.trim(),
      language: editSnippetLanguage,
      tags,
      sortOrder: editSnippetSortOrder,
    });
    setEditSnippetId(null);
  };

  // 右键菜单
  const handleContextMenu = (
    e: React.MouseEvent,
    type: "category" | "snippet",
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 180;
    const menuHeight = type === "category" ? 200 : 180;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
    setContextMenu({ type, id, x, y });
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
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
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

  // 获取分类的绝对路径
  const getCategoryPath = (categoryId: string): string => {
    const parts: string[] = [];
    let catId: string | null = categoryId;
    let safety = 0;
    while (catId && safety < 50) {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) break;
      parts.unshift(cat.name);
      catId = cat.parentId;
      safety++;
    }
    return "/" + parts.join("/");
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setContextMenu(null);
  };

  // 渲染片段列表项（名称 + 描述 + 收藏按钮）
  const renderSnippetItem = (snippet: Snippet, depth: number = 1) => {
    const isSelected = selectedSnippetId === snippet.id;
    const isDragging = draggingSnippetId === snippet.id;
    const isDragOver = dragOverSnippetId === snippet.id;
    const showLineBefore = isDragOver && dragPosition === "before";
    const showLineAfter = isDragOver && dragPosition === "after";
    return (
      <div
        key={snippet.id}
        draggable
        onDragStart={(e) => {
          setDraggingSnippetId(snippet.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDraggingSnippetId(null);
          setDragOverSnippetId(null);
        }}
        onDragOver={(e) => {
          if (draggingSnippetId && draggingSnippetId !== snippet.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            // 根据鼠标在 item 上的位置决定插入前还是后
            const rect = e.currentTarget.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            setDragPosition(e.clientY < midY ? "before" : "after");
            setDragOverSnippetId(snippet.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverSnippetId === snippet.id) {
            setDragOverSnippetId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggingSnippetId && draggingSnippetId !== snippet.id) {
            reorderSnippet(draggingSnippetId, snippet.id, dragPosition);
          }
          setDraggingSnippetId(null);
          setDragOverSnippetId(null);
        }}
        className={`group cursor-pointer rounded-md transition-all relative ${
          isSelected ? "bg-primary-50" : "hover:bg-slate-100"
        } ${isDragging ? "opacity-40" : ""}`}
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
        {showLineBefore && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-400 z-10" />
        )}
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
        {showLineAfter && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400 z-10" />
        )}
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
    const isCatDragOver = dragOverCategoryId === category.id;

    return (
      <div key={category.id}>
        <div
          draggable
          onDragStart={(e) => {
            setDraggingCategoryId(category.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDraggingCategoryId(null);
            setDragOverCategoryId(null);
          }}
          onDragOver={(e) => {
            // 接受 snippet 拖拽（跨分类）或 category 拖拽
            if (draggingSnippetId || (draggingCategoryId && draggingCategoryId !== category.id)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverCategoryId(category.id);
            }
          }}
          onDragLeave={() => {
            if (dragOverCategoryId === category.id) {
              setDragOverCategoryId(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            // 拖拽 snippet 到分类上 → 移动 snippet 到该分类
            if (draggingSnippetId) {
              moveSnippetToCategory(draggingSnippetId, category.id);
            }
            // 拖拽 category 到分类上 → 移动 category 到该分类下
            if (draggingCategoryId && draggingCategoryId !== category.id) {
              moveCategory(draggingCategoryId, category.id);
              setExpandedIds((prev) => new Set(prev).add(category.id));
            }
            setDraggingSnippetId(null);
            setDraggingCategoryId(null);
            setDragOverCategoryId(null);
          }}
          className={`flex items-center px-2 py-1.5 cursor-pointer rounded-md group hover:bg-slate-100 transition-all ${
            isSelected ? "bg-primary-50 text-primary-600" : "text-slate-700"
          } ${isCatDragOver ? "ring-2 ring-primary-300 bg-primary-50" : ""} ${
            draggingCategoryId === category.id ? "opacity-40" : ""
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
            {children.length > 0 || catSnippets.length > 0 ? (
              isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </button>

          <span className="mr-1.5 flex-shrink-0 relative">
            {isExpanded ? (
              <FolderOpen size={16} className="text-amber-500" />
            ) : (
              <Folder size={16} className="text-amber-500" />
            )}
            {/* 有描述时的标记 */}
            {category.description && category.description.trim().length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" title="有分类描述" />
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
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            onClick={toggleLeftPanel}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="隐藏代码库 (Alt+B)"
          >
            <PanelLeftClose size={16} />
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
            placeholder="搜索（代码、注释、分类）..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
          />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* 全文搜索结果 */}
        {searchResults && (
          <div className="space-y-3">
            {searchLoading && (
              <div className="px-3 py-2 text-xs text-slate-400">搜索中...</div>
            )}
            {/* 代码片段结果 */}
            {searchResults.snippets.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-50 rounded mb-1">
                  代码片段 ({searchResults.snippets.length})
                </div>
                {searchResults.snippets.slice(0, 20).map((snippet) => (
                  <div key={snippet.id}>{renderSnippetItem(snippet, 0)}</div>
                ))}
              </div>
            )}
            {/* 注释结果 */}
            {searchResults.annotations.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-50 rounded mb-1">
                  注释 ({searchResults.annotations.length})
                </div>
                {searchResults.annotations.slice(0, 20).map((annot: any) => {
                  const snippet = snippets.find((s) => s.id === annot.snippetId);
                  if (!snippet) return null;
                  return (
                    <div
                      key={annot.id}
                      onClick={() => {
                        if (snippet.categoryId) selectCategory(snippet.categoryId);
                        selectSnippet(snippet.id);
                        setSearchQuery("");
                      }}
                      className="px-2 py-1.5 rounded cursor-pointer hover:bg-slate-100 text-xs flex items-start gap-2"
                    >
                      <FileCode size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-700 truncate">{snippet.title}</div>
                        <div className="text-slate-500 truncate">{annot.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* 分类结果 */}
            {searchResults.categories.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-50 rounded mb-1">
                  分类 ({searchResults.categories.length})
                </div>
                {searchResults.categories.slice(0, 10).map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      selectCategory(cat.id);
                      setSearchQuery("");
                    }}
                    className="px-2 py-1.5 rounded cursor-pointer hover:bg-slate-100 text-xs flex items-center gap-2"
                  >
                    <Folder size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-slate-700 truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            )}
            {!searchLoading &&
              searchResults.snippets.length === 0 &&
              searchResults.annotations.length === 0 &&
              searchResults.categories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Search size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">未找到相关结果</p>
                </div>
              )}
          </div>
        )}

        {!searchResults && viewMode === "favorites" ? (
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
        ) : !searchResults ? (
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
        ) : null}
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
                  const cat = categories.find((c) => c.id === contextMenu.id);
                  if (cat) {
                    copyToClipboard(cat.name);
                  }
                }}
              >
                <Copy size={14} />
                复制分类名
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => {
                  const path = getCategoryPath(contextMenu.id);
                  copyToClipboard(path);
                }}
              >
                <Link2 size={14} />
                复制绝对路径
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
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => {
                  const s = snippets.find((sn) => sn.id === contextMenu.id);
                  if (s) copyToClipboard(s.title);
                }}
              >
                <Copy size={14} />
                复制文件名
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => {
                  const path = getSnippetPath(contextMenu.id);
                  copyToClipboard(path);
                }}
              >
                <FileText size={14} />
                复制文件绝对路径
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                onClick={() => openEditSnippetModal(contextMenu.id)}
              >
                <Pencil size={14} />
                编辑片段
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                onClick={() => {
                  const s = snippets.find((sn) => sn.id === contextMenu.id);
                  setDeleteTarget({
                    type: "snippet",
                    id: contextMenu.id,
                    name: s?.title || "此片段",
                  });
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
              placeholder="输入分类名称，用 / 创建多级分类"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              支持多级分类，例如：pages/Dapp/Home 将创建 pages → Dapp → Home 三级分类
            </p>
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
              {languageOptions.map((lang) => (
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              标签
              <span className="text-slate-400 font-normal ml-1">（可选，用逗号分隔）</span>
            </label>
            <input
              value={newSnippetTags}
              onChange={(e) => setNewSnippetTags(e.target.value)}
              placeholder="例如：solidity, defi, uniswap"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
          {newSnippetCategoryId && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md flex items-center gap-2">
              <Folder size={12} className="text-amber-500" />
              所属分类：{categories.find((c) => c.id === newSnippetCategoryId)?.name}
            </div>
          )}
        </div>
      </Modal>

      {/* 编辑片段弹窗 */}
      <Modal
        isOpen={!!editSnippetId}
        onClose={() => setEditSnippetId(null)}
        title="编辑片段"
        width="w-[460px]"
        footer={
          <>
            <button
              onClick={() => setEditSnippetId(null)}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleEditSnippet}
              className="px-4 py-1.5 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              保存
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
              value={editSnippetTitle}
              onChange={(e) => setEditSnippetTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSnippet();
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
              value={editSnippetDescription}
              onChange={(e) => setEditSnippetDescription(e.target.value)}
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
              {languageOptions.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setEditSnippetLanguage(lang.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                    editSnippetLanguage === lang.value
                      ? "border-primary-400 bg-primary-50 text-primary-600 font-medium"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              标签
              <span className="text-slate-400 font-normal ml-1">（可选，用逗号分隔）</span>
            </label>
            <input
              value={editSnippetTags}
              onChange={(e) => setEditSnippetTags(e.target.value)}
              placeholder="例如：solidity, defi, uniswap"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              排序序号
              <span className="text-slate-400 font-normal ml-1">（数字越小越靠前）</span>
            </label>
            <input
              type="number"
              value={editSnippetSortOrder}
              onChange={(e) => setEditSnippetSortOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === "category" ? "删除分类" : "删除片段"}
        message={
          deleteTarget?.type === "category"
            ? `确定要删除「${deleteTarget.name}」吗？\n\n此操作将删除该分类及其所有子分类和代码片段，且不可撤销。`
            : `确定要删除「${deleteTarget?.name}」吗？\n\n此操作不可撤销。`
        }
        confirmText="删除"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "category") {
            await deleteCategory(deleteTarget.id);
          } else {
            await deleteSnippet(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  );
}

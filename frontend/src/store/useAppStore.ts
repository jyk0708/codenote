import { create } from "zustand";
import type {
  Category,
  Snippet,
  Annotation,
  AnnotationColor,
  LayoutState,
  LanguageConfig,
} from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  categoryApi,
  snippetApi,
  annotationApi,
  fileApi,
  languageApi,
  importApi,
  authApi,
  searchApi,
} from "@/lib/api";
import { getCategoryDescendants } from "@/lib/utils";

const ANNOTATION_COLORS: AnnotationColor[] = [
  "indigo",
  "amber",
  "emerald",
  "rose",
  "sky",
  "fuchsia",
  "lime",
  "orange",
];

interface AppState {
  // 认证
  isLoggedIn: boolean;
  userEmail: string;
  userNickname: string;
  isLoading: boolean;

  // 数据
  categories: Category[];
  snippets: Snippet[];
  annotations: Annotation[];
  languages: LanguageConfig[];

  // 当前选中
  selectedCategoryId: string | null;
  selectedSnippetId: string | null;
  selectedAnnotationId: string | null;

  // 定位功能
  revealSnippetId: string | null;
  pendingScrollLine: number | null;

  // Tab 管理
  openTabs: string[];
  activeTabId: string | null;

  // 导航历史
  navHistory: string[];
  navHistoryIndex: number;

  // 布局
  layout: LayoutState;

  // ===== 方法 =====

  // 认证
  checkAuth: () => void;
  logout: () => void;

  // 分类
  addCategory: (name: string, parentId: string | null) => Promise<Category | null>;
  updateCategory: (id: string, data: { name?: string; description?: string; parentId?: string | null; sortOrder?: number }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectCategory: (id: string | null) => void;
  addCategoryTree: (path: string, parentId: string | null) => Promise<Category | null>;
  moveCategory: (categoryId: string, targetParentId: string) => Promise<void>;
  getCurrentCategory: () => Category | null;

  // 片段
  addSnippet: (categoryId: string | null) => Promise<Snippet | null>;
  updateSnippet: (id: string, data: any) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  selectSnippet: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  reorderSnippet: (sourceId: string, targetId: string, position: "before" | "after") => Promise<void>;
  moveSnippetToCategory: (snippetId: string, categoryId: string) => Promise<void>;
  getCurrentSnippet: () => Snippet | null;
  getSnippetPath: (snippetId: string) => string;
  findSnippetByPath: (path: string) => Snippet | null;
  navigateToSnippet: (targetPath: string, lineNumber?: number) => boolean;
  revealSnippet: (snippetId: string) => void;

  // 注释
  addAnnotation: (snippetId: string, startOffset: number, endOffset: number) => Promise<Annotation | null>;
  updateAnnotation: (id: string, data: any) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  selectAnnotation: (id: string | null) => void;
  getSnippetAnnotations: (snippetId: string) => Annotation[];

  // Tab 管理
  setActiveTab: (snippetId: string) => void;
  closeTab: (snippetId: string) => void;
  closeOtherTabs: (snippetId: string) => void;
  closeAllTabs: () => void;

  // 导航历史
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;

  // 布局
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFocusMode: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;

  // 搜索
  searchAll: (query: string) => Promise<{ snippets: Snippet[]; annotations: Annotation[]; categories: Category[] }>;

  // 语言配置
  addLanguageConfig: (data: { name: string; value: string; mode: string; extensions: string }) => Promise<LanguageConfig | null>;
  updateLanguageConfig: (id: string, data: { name?: string; value?: string; mode?: string; extensions?: string }) => Promise<void>;
  deleteLanguageConfig: (id: string) => Promise<void>;

  // 导入
  importFolder: (files: File[], paths: string[], parentCategoryId: string | null) => Promise<{ importedSnippets: number; createdCategories: number; skippedFiles: number }>;

  // 文件清理
  cleanupOrphanedFiles: () => Promise<number>;

  // 滚动
  clearPendingScrollLine: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ===== 初始状态 =====
  isLoggedIn: false,
  userEmail: "",
  userNickname: "",
  isLoading: true,

  categories: [],
  snippets: [],
  annotations: [],
  languages: [],

  selectedCategoryId: null,
  selectedSnippetId: null,
  selectedAnnotationId: null,

  revealSnippetId: null,
  pendingScrollLine: null,

  openTabs: [],
  activeTabId: null,

  navHistory: [],
  navHistoryIndex: -1,

  layout: {
    leftPanelWidth: 280,
    rightPanelWidth: 360,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    focusMode: false,
  },

  // ===== 认证 =====
  checkAuth: async () => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("userEmail") || "";
    const nickname = localStorage.getItem("userNickname") || "";

    if (!token) {
      set({
        isLoggedIn: false,
        userEmail: "",
        userNickname: "",
        isLoading: false,
      });
      return;
    }

    set({ isLoggedIn: true, userEmail: email, userNickname: nickname });

    try {
      // 并行加载所有数据
      const [cats, snips, langs] = await Promise.all([
        categoryApi.getAll(),
        snippetApi.list(),
        languageApi.getAll(),
      ]);

      // 加载所有注释（按片段逐个加载）
      const allAnnotations: Annotation[] = [];
      for (const snippet of snips) {
        try {
          const annots = await annotationApi.list(snippet.id);
          allAnnotations.push(...annots);
        } catch {
          // 忽略单个片段的注释加载失败
        }
      }

      set({
        categories: cats,
        snippets: snips,
        annotations: allAnnotations,
        languages: langs,
        isLoading: false,
      });
    } catch (e) {
      console.error("Failed to load data:", e);
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userNickname");
    set({
      isLoggedIn: false,
      userEmail: "",
      userNickname: "",
      categories: [],
      snippets: [],
      annotations: [],
      languages: [],
      selectedCategoryId: null,
      selectedSnippetId: null,
      selectedAnnotationId: null,
      openTabs: [],
      activeTabId: null,
      navHistory: [],
      navHistoryIndex: -1,
    });
  },

  // ===== 分类 =====
  addCategory: async (name, parentId) => {
    const { isLoggedIn } = get();
    const id = uuidv4();
    const now = new Date().toISOString();
    const newCategory: Category = {
      id,
      name,
      parentId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 乐观更新
    set((state) => ({
      categories: [...state.categories, newCategory],
    }));

    if (!isLoggedIn) return newCategory;

    try {
      const created = await categoryApi.create({ name, parentId });
      // 用服务端返回的 id 替换本地 id
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? { ...created, children: undefined, snippetCount: undefined } : c
        ),
      }));
      return { ...created, children: undefined, snippetCount: undefined };
    } catch (e) {
      console.error("Failed to add category:", e);
      // 回滚
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
      return null;
    }
  },

  updateCategory: async (id, data) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await categoryApi.update(id, data);
    } catch (e) {
      console.error("Failed to update category:", e);
    }
  },

  deleteCategory: async (id) => {
    const { isLoggedIn, categories, snippets, annotations, openTabs, activeTabId } = get();

    // 获取所有后代分类 ID
    const descendantIds = getCategoryDescendants(categories, id);
    const allCategoryIds = [id, ...descendantIds];

    // 找到所有将被删除的片段 ID
    const deletedSnippetIds = snippets
      .filter((s) => s.categoryId && allCategoryIds.includes(s.categoryId))
      .map((s) => s.id);

    // 乐观更新
    set((state) => {
      const nextCategories = state.categories.filter(
        (c) => !allCategoryIds.includes(c.id)
      );
      const nextSnippets = state.snippets.filter(
        (s) => !s.categoryId || !allCategoryIds.includes(s.categoryId)
      );
      const nextAnnotations = state.annotations.filter(
        (a) => !deletedSnippetIds.includes(a.snippetId)
      );

      // 处理 Tab：移除被删除的片段
      const newTabs = state.openTabs.filter(
        (tabId) => !deletedSnippetIds.includes(tabId)
      );
      let newActiveTabId = state.activeTabId;
      let newSelectedSnippetId = state.selectedSnippetId;
      let newSelectedAnnotationId = state.selectedAnnotationId;

      if (state.activeTabId && deletedSnippetIds.includes(state.activeTabId)) {
        if (newTabs.length > 0) {
          newActiveTabId = newTabs[0];
          newSelectedSnippetId = newTabs[0];
        } else {
          newActiveTabId = null;
          newSelectedSnippetId = null;
        }
      }

      if (state.selectedSnippetId && deletedSnippetIds.includes(state.selectedSnippetId)) {
        newSelectedSnippetId = nextSnippets[0]?.id || null;
        if (newSelectedSnippetId) {
          newActiveTabId = newSelectedSnippetId;
        }
      }

      // 如果选中的分类被删除，选中第一个可用分类或 null
      let newSelectedCategoryId = state.selectedCategoryId;
      if (state.selectedCategoryId && allCategoryIds.includes(state.selectedCategoryId)) {
        newSelectedCategoryId = nextCategories[0]?.id || null;
      }

      // 清除被删除注释的选中状态
      if (
        state.selectedAnnotationId &&
        state.annotations.some(
          (a) => a.id === state.selectedAnnotationId && deletedSnippetIds.includes(a.snippetId)
        )
      ) {
        newSelectedAnnotationId = null;
      }

      return {
        categories: nextCategories,
        snippets: nextSnippets,
        annotations: nextAnnotations,
        selectedCategoryId: newSelectedCategoryId,
        selectedSnippetId: newSelectedSnippetId,
        selectedAnnotationId: newSelectedAnnotationId,
        openTabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });

    if (!isLoggedIn) return;
    try {
      await categoryApi.delete(id);
    } catch (e) {
      console.error("Failed to delete category:", e);
    }
  },

  selectCategory: (id) => {
    set({
      selectedCategoryId: id,
      selectedAnnotationId: null,
    });
  },

  addCategoryTree: async (path, parentId) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    let currentParentId = parentId;
    let result: Category | null = null;

    for (const part of parts) {
      const { categories, addCategory } = get();
      // 检查是否已存在同名同级分类
      const existing = categories.find(
        (c) => c.name === part && c.parentId === currentParentId
      );
      if (existing) {
        currentParentId = existing.id;
        result = existing;
      } else {
        const created = await addCategory(part, currentParentId);
        if (created) {
          currentParentId = created.id;
          result = created;
        } else {
          return null;
        }
      }
    }

    return result;
  },

  moveCategory: async (categoryId, targetParentId) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === categoryId
          ? { ...c, parentId: targetParentId, updatedAt: new Date().toISOString() }
          : c
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await categoryApi.update(categoryId, { parentId: targetParentId });
    } catch (e) {
      console.error("Failed to move category:", e);
    }
  },

  getCurrentCategory: () => {
    const { selectedCategoryId, categories, selectedSnippetId, snippets } = get();
    if (selectedCategoryId) {
      return categories.find((c) => c.id === selectedCategoryId) || null;
    }
    if (selectedSnippetId) {
      const snippet = snippets.find((s) => s.id === selectedSnippetId);
      if (snippet?.categoryId) {
        return categories.find((c) => c.id === snippet.categoryId) || null;
      }
    }
    return null;
  },

  // ===== 片段 =====
  addSnippet: async (categoryId) => {
    const { isLoggedIn } = get();
    const id = uuidv4();
    const now = new Date().toISOString();
    const newSnippet: Snippet = {
      id,
      title: "未命名片段",
      language: "javascript",
      content: "",
      tags: [],
      categoryId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 乐观更新：添加到列表并选中
    set((state) => {
      const newTabs = [...state.openTabs, id];
      return {
        snippets: [...state.snippets, newSnippet],
        selectedSnippetId: id,
        selectedCategoryId: categoryId,
        selectedAnnotationId: null,
        openTabs: newTabs,
        activeTabId: id,
        navHistory: [...state.navHistory.slice(0, state.navHistoryIndex + 1), id],
        navHistoryIndex: state.navHistoryIndex + 1,
      };
    });

    if (!isLoggedIn) return newSnippet;

    try {
      const created = await snippetApi.create({
        title: newSnippet.title,
        language: newSnippet.language,
        content: newSnippet.content,
        categoryId,
        tags: [],
      });
      // 用服务端返回的 id 替换本地 id
      set((state) => ({
        snippets: state.snippets.map((s) => (s.id === id ? created : s)),
        selectedSnippetId: created.id,
        openTabs: state.openTabs.map((t) => (t === id ? created.id : t)),
        activeTabId: state.activeTabId === id ? created.id : state.activeTabId,
        navHistory: state.navHistory.map((h) => (h === id ? created.id : h)),
      }));
      return created;
    } catch (e) {
      console.error("Failed to add snippet:", e);
      // 回滚
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== id),
        openTabs: state.openTabs.filter((t) => t !== id),
        activeTabId: state.activeTabId === id ? null : state.activeTabId,
        selectedSnippetId: state.selectedSnippetId === id ? null : state.selectedSnippetId,
      }));
      return null;
    }
  },

  updateSnippet: async (id, data) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await snippetApi.update(id, data);
    } catch (e) {
      console.error("Failed to update snippet:", e);
    }
  },

  deleteSnippet: async (id) => {
    const { isLoggedIn } = get();
    // 乐观更新：先从本地移除，并处理 Tab 管理
    set((state) => {
      const nextSnippets = state.snippets.filter((s) => s.id !== id);
      const nextAnnotations = state.annotations.filter((a) => a.snippetId !== id);

      // 处理 Tab：从 openTabs 中移除
      const newTabs = state.openTabs.filter((tabId) => tabId !== id);

      let newActiveTabId = state.activeTabId;
      let newSelectedSnippetId = state.selectedSnippetId;
      let newSelectedAnnotationId = state.selectedAnnotationId;

      // 如果被删除的是当前激活的 tab，需要切换到相邻 tab
      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          const idx = state.openTabs.indexOf(id);
          const nextIdx = Math.min(idx, newTabs.length - 1);
          const nextId = newTabs[nextIdx];
          newActiveTabId = nextId;
          newSelectedSnippetId = nextId;
        } else {
          newActiveTabId = null;
          newSelectedSnippetId = null;
        }
      }

      // 如果被删除的是当前选中的片段
      if (state.selectedSnippetId === id) {
        if (newActiveTabId) {
          newSelectedSnippetId = newActiveTabId;
        } else {
          newSelectedSnippetId = nextSnippets[0]?.id || null;
        }
      }

      // 清除被删除注释的选中状态
      if (
        state.selectedAnnotationId &&
        state.annotations.some(
          (a) => a.id === state.selectedAnnotationId && a.snippetId === id
        )
      ) {
        newSelectedAnnotationId = null;
      }

      return {
        snippets: nextSnippets,
        annotations: nextAnnotations,
        selectedSnippetId: newSelectedSnippetId,
        selectedAnnotationId: newSelectedAnnotationId,
        openTabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });

    if (!isLoggedIn) return;
    try {
      await snippetApi.delete(id);
    } catch (e) {
      console.error("Failed to delete snippet:", e);
    }
  },

  selectSnippet: (id) => {
    if (!id) {
      set({ selectedSnippetId: null, selectedAnnotationId: null });
      return;
    }

    set((state) => {
      // 添加到 tab（如果不存在）
      const newTabs = state.openTabs.includes(id)
        ? state.openTabs
        : [...state.openTabs, id];

      // 添加到导航历史
      const newHistory = [
        ...state.navHistory.slice(0, state.navHistoryIndex + 1),
        id,
      ];
      const newIndex = newHistory.length - 1;

      return {
        selectedSnippetId: id,
        selectedAnnotationId: null,
        openTabs: newTabs,
        activeTabId: id,
        navHistory: newHistory,
        navHistoryIndex: newIndex,
      };
    });
  },

  toggleFavorite: async (id) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id ? { ...s, favorite: !s.favorite } : s
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await snippetApi.toggleFavorite(id);
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
      // 回滚
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id ? { ...s, favorite: !s.favorite } : s
        ),
      }));
    }
  },

  reorderSnippet: async (sourceId, targetId, position) => {
    const { isLoggedIn, snippets } = get();
    const source = snippets.find((s) => s.id === sourceId);
    const target = snippets.find((s) => s.id === targetId);
    if (!source || !target) return;

    // 乐观更新
    set((state) => {
      const newSnippets = [...state.snippets];
      const sourceIdx = newSnippets.findIndex((s) => s.id === sourceId);
      const targetIdx = newSnippets.findIndex((s) => s.id === targetId);
      if (sourceIdx < 0 || targetIdx < 0) return state;

      const [removed] = newSnippets.splice(sourceIdx, 1);
      const insertIdx = newSnippets.findIndex((s) => s.id === targetId);
      const actualInsertIdx = position === "after" ? insertIdx + 1 : insertIdx;
      newSnippets.splice(actualInsertIdx, 0, removed);

      // 更新同一分类下所有片段的 sortOrder
      const categoryId = removed.categoryId;
      const categorySnippets = newSnippets.filter((s) => s.categoryId === categoryId);
      categorySnippets.forEach((s, i) => {
        s.sortOrder = i;
      });

      return { snippets: newSnippets };
    });

    if (!isLoggedIn) return;
    try {
      // 获取更新后的 sortOrder
      const updatedSnippets = get().snippets;
      const updatedSource = updatedSnippets.find((s) => s.id === sourceId);
      if (updatedSource) {
        await snippetApi.update(sourceId, { sortOrder: updatedSource.sortOrder });
      }
    } catch (e) {
      console.error("Failed to reorder snippet:", e);
    }
  },

  moveSnippetToCategory: async (snippetId, categoryId) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === snippetId
          ? { ...s, categoryId, updatedAt: new Date().toISOString() }
          : s
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await snippetApi.update(snippetId, { categoryId });
    } catch (e) {
      console.error("Failed to move snippet:", e);
    }
  },

  getCurrentSnippet: () => {
    const { selectedSnippetId, snippets } = get();
    if (!selectedSnippetId) return null;
    return snippets.find((s) => s.id === selectedSnippetId) || null;
  },

  getSnippetPath: (snippetId) => {
    const { snippets, categories } = get();
    const snippet = snippets.find((s) => s.id === snippetId);
    if (!snippet) return "";

    const parts: string[] = [snippet.title];
    let catId = snippet.categoryId;
    let safety = 0;
    while (catId && safety < 50) {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) break;
      parts.unshift(cat.name);
      catId = cat.parentId;
      safety++;
    }
    return "/" + parts.join("/");
  },

  findSnippetByPath: (path) => {
    const { snippets, categories } = get();
    const trimmed = path.replace(/^\/+|\/+$/g, "");
    const parts = trimmed.split("/");
    if (parts.length === 0) return null;

    const title = parts[parts.length - 1];
    const categoryPath = parts.slice(0, -1).join("/");

    // 先尝试精确匹配（标题 + 分类路径）
    for (const snippet of snippets) {
      if (snippet.title !== title) continue;

      // 构建该片段的分类路径
      const catParts: string[] = [];
      let catId = snippet.categoryId;
      let safety = 0;
      while (catId && safety < 50) {
        const cat = categories.find((c) => c.id === catId);
        if (!cat) break;
        catParts.unshift(cat.name);
        catId = cat.parentId;
        safety++;
      }

      if (catParts.join("/") === categoryPath) {
        return snippet;
      }
    }

    // 如果没有找到精确匹配，尝试只按标题匹配
    const byTitle = snippets.filter((s) => s.title === title);
    if (byTitle.length === 1) return byTitle[0];
    if (byTitle.length > 1) return byTitle[0];

    return null;
  },

  navigateToSnippet: (targetPath, lineNumber) => {
    const { findSnippetByPath, selectSnippet, snippets, categories } = get();
    const snippet = findSnippetByPath(targetPath);
    if (!snippet) return false;

    // 选中该片段
    selectSnippet(snippet.id);

    // 如果指定了行号，设置待滚动行
    if (lineNumber !== undefined) {
      set({ pendingScrollLine: lineNumber });
    }

    return true;
  },

  revealSnippet: (snippetId) => {
    set({ revealSnippetId: snippetId });
    // 1.5 秒后清除
    setTimeout(() => {
      set((state) =>
        state.revealSnippetId === snippetId
          ? { revealSnippetId: null }
          : state
      );
    }, 1500);
  },

  // ===== 注释 =====
  addAnnotation: async (snippetId, startOffset, endOffset) => {
    const { isLoggedIn, annotations } = get();
    const id = uuidv4();
    const now = new Date().toISOString();

    // 选择颜色：循环使用颜色列表
    const snippetAnnots = annotations.filter((a) => a.snippetId === snippetId);
    const colorIndex = snippetAnnots.length % ANNOTATION_COLORS.length;
    const color = ANNOTATION_COLORS[colorIndex];

    const newAnnotation: Annotation = {
      id,
      snippetId,
      title: "新注释",
      contentMarkdown: "",
      startOffset,
      endOffset,
      color,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 乐观更新
    set((state) => ({
      annotations: [...state.annotations, newAnnotation],
    }));

    if (!isLoggedIn) return newAnnotation;

    try {
      const created = await annotationApi.create(snippetId, {
        title: newAnnotation.title,
        contentMarkdown: newAnnotation.contentMarkdown,
        startOffset,
        endOffset,
        color,
      });
      // 用服务端返回的 id 替换本地 id
      set((state) => ({
        annotations: state.annotations.map((a) => (a.id === id ? created : a)),
      }));
      return created;
    } catch (e) {
      console.error("Failed to add annotation:", e);
      // 回滚
      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== id),
      }));
      return null;
    }
  },

  updateAnnotation: async (id, data) => {
    const { isLoggedIn, annotations } = get();
    const annot = annotations.find((a) => a.id === id);
    if (!annot) return;

    // 乐观更新
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await annotationApi.update(annot.snippetId, id, data);
    } catch (e) {
      console.error("Failed to update annotation:", e);
    }
  },

  deleteAnnotation: async (id) => {
    const { isLoggedIn, annotations } = get();
    const annot = annotations.find((a) => a.id === id);
    if (!annot) return;

    // 乐观更新
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    }));

    if (!isLoggedIn) return;
    try {
      await annotationApi.delete(annot.snippetId, id);
    } catch (e) {
      console.error("Failed to delete annotation:", e);
    }
  },

  selectAnnotation: (id) => {
    set({ selectedAnnotationId: id });
  },

  getSnippetAnnotations: (snippetId) => {
    const { annotations } = get();
    return annotations
      .filter((a) => a.snippetId === snippetId)
      .sort((a, b) => a.startOffset - b.startOffset);
  },

  // ===== Tab 管理 =====
  setActiveTab: (snippetId) => {
    set((state) => {
      if (!state.openTabs.includes(snippetId)) return state;

      // 添加到导航历史
      const newHistory = [
        ...state.navHistory.slice(0, state.navHistoryIndex + 1),
        snippetId,
      ];

      return {
        activeTabId: snippetId,
        selectedSnippetId: snippetId,
        selectedAnnotationId: null,
        navHistory: newHistory,
        navHistoryIndex: newHistory.length - 1,
      };
    });
  },

  closeTab: (snippetId) => {
    const { openTabs, activeTabId } = get();
    const idx = openTabs.indexOf(snippetId);
    if (idx < 0) return;
    const newTabs = openTabs.filter((id) => id !== snippetId);
    if (activeTabId === snippetId) {
      if (newTabs.length > 0) {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        const nextId = newTabs[nextIdx];
        set({
          openTabs: newTabs,
          activeTabId: nextId,
          selectedSnippetId: nextId,
          selectedAnnotationId: null,
        });
      } else {
        set({
          openTabs: [],
          activeTabId: null,
          selectedSnippetId: null,
          selectedAnnotationId: null,
        });
      }
    } else {
      set({ openTabs: newTabs });
    }
  },

  closeOtherTabs: (snippetId) => {
    set((state) => ({
      openTabs: [snippetId],
      activeTabId: snippetId,
      selectedSnippetId: snippetId,
      selectedAnnotationId: null,
    }));
  },

  closeAllTabs: () => {
    set({
      openTabs: [],
      activeTabId: null,
      selectedSnippetId: null,
      selectedAnnotationId: null,
    });
  },

  // ===== 导航历史 =====
  goBack: () => {
    const { navHistory, navHistoryIndex } = get();
    if (navHistoryIndex <= 0) return;
    const newIndex = navHistoryIndex - 1;
    const snippetId = navHistory[newIndex];
    set({
      navHistoryIndex: newIndex,
      selectedSnippetId: snippetId,
      activeTabId: snippetId,
      selectedAnnotationId: null,
    });
  },

  goForward: () => {
    const { navHistory, navHistoryIndex } = get();
    if (navHistoryIndex >= navHistory.length - 1) return;
    const newIndex = navHistoryIndex + 1;
    const snippetId = navHistory[newIndex];
    set({
      navHistoryIndex: newIndex,
      selectedSnippetId: snippetId,
      activeTabId: snippetId,
      selectedAnnotationId: null,
    });
  },

  canGoBack: () => {
    const { navHistoryIndex } = get();
    return navHistoryIndex > 0;
  },

  canGoForward: () => {
    const { navHistory, navHistoryIndex } = get();
    return navHistoryIndex < navHistory.length - 1;
  },

  // ===== 布局 =====
  toggleLeftPanel: () => {
    set((state) => ({
      layout: { ...state.layout, leftPanelCollapsed: !state.layout.leftPanelCollapsed },
    }));
  },

  toggleRightPanel: () => {
    set((state) => ({
      layout: { ...state.layout, rightPanelCollapsed: !state.layout.rightPanelCollapsed },
    }));
  },

  toggleFocusMode: () => {
    set((state) => ({
      layout: { ...state.layout, focusMode: !state.layout.focusMode },
    }));
  },

  setLeftPanelWidth: (width) => {
    set((state) => ({
      layout: { ...state.layout, leftPanelWidth: Math.max(200, Math.min(600, width)) },
    }));
  },

  setRightPanelWidth: (width) => {
    set((state) => ({
      layout: { ...state.layout, rightPanelWidth: Math.max(240, Math.min(800, width)) },
    }));
  },

  // ===== 搜索 =====
  searchAll: async (query) => {
    const { isLoggedIn, snippets, annotations, categories } = get();

    if (!isLoggedIn) {
      // 本地搜索
      const q = query.toLowerCase();
      const snippetResults = snippets.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
      const annotationResults = annotations.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.contentMarkdown.toLowerCase().includes(q)
      );
      const categoryResults = categories.filter((c) =>
        c.name.toLowerCase().includes(q)
      );
      return {
        snippets: snippetResults,
        annotations: annotationResults,
        categories: categoryResults,
      };
    }

    try {
      const result = await searchApi.search(query);
      return result;
    } catch (e) {
      console.error("Search failed:", e);
      return { snippets: [], annotations: [], categories: [] };
    }
  },

  // ===== 语言配置 =====
  addLanguageConfig: async (data) => {
    const { isLoggedIn, languages } = get();
    const id = uuidv4();
    const now = new Date().toISOString();
    const newLang: LanguageConfig = {
      id,
      name: data.name,
      value: data.value,
      mode: data.mode,
      extensions: data.extensions,
      sortOrder: languages.length,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };

    // 乐观更新
    set((state) => ({
      languages: [...state.languages, newLang],
    }));

    if (!isLoggedIn) return newLang;

    try {
      const created = await languageApi.create(data);
      set((state) => ({
        languages: state.languages.map((l) => (l.id === id ? created : l)),
      }));
      return created;
    } catch (e) {
      console.error("Failed to add language:", e);
      set((state) => ({
        languages: state.languages.filter((l) => l.id !== id),
      }));
      return null;
    }
  },

  updateLanguageConfig: async (id, data) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      languages: state.languages.map((l) =>
        l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l
      ),
    }));

    if (!isLoggedIn) return;
    try {
      await languageApi.update(id, data);
    } catch (e) {
      console.error("Failed to update language:", e);
    }
  },

  deleteLanguageConfig: async (id) => {
    const { isLoggedIn } = get();
    // 乐观更新
    set((state) => ({
      languages: state.languages.filter((l) => l.id !== id),
    }));

    if (!isLoggedIn) return;
    try {
      await languageApi.delete(id);
    } catch (e) {
      console.error("Failed to delete language:", e);
    }
  },

  // ===== 导入 =====
  importFolder: async (files, paths, parentCategoryId) => {
    const { isLoggedIn } = get();

    if (!isLoggedIn) {
      // 本地模式：模拟导入
      return { importedSnippets: 0, createdCategories: 0, skippedFiles: files.length };
    }

    const result = await importApi.importFolder(files, paths, parentCategoryId);

    // 导入成功后重新加载数据
    try {
      const [cats, snips] = await Promise.all([
        categoryApi.getAll(),
        snippetApi.list(),
      ]);

      // 加载所有注释
      const allAnnotations: Annotation[] = [];
      for (const snippet of snips) {
        try {
          const annots = await annotationApi.list(snippet.id);
          allAnnotations.push(...annots);
        } catch {
          // 忽略
        }
      }

      set({
        categories: cats,
        snippets: snips,
        annotations: allAnnotations,
      });
    } catch (e) {
      console.error("Failed to reload data after import:", e);
    }

    return result;
  },

  // ===== 文件清理 =====
  cleanupOrphanedFiles: async () => {
    const { isLoggedIn } = get();
    if (!isLoggedIn) return 0;
    try {
      const result = await fileApi.cleanup();
      return result.deletedCount;
    } catch (e) {
      console.error("Failed to cleanup files:", e);
      throw e;
    }
  },

  // ===== 滚动 =====
  clearPendingScrollLine: () => {
    set({ pendingScrollLine: null });
  },
}));

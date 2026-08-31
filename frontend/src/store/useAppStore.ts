import { create } from "zustand";
import type {
  Category,
  Snippet,
  Annotation,
  AnnotationColor,
  LayoutState,
} from "@/types";
import {
  mockCategories,
  mockSnippets,
  mockAnnotations,
} from "@/lib/mockData";
import { v4 as uuidv4 } from "uuid";
import {
  categoryApi,
  snippetApi,
  annotationApi,
  fileApi,
} from "@/lib/api";

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
  userEmail: string | null;
  userNickname: string | null;
  isLoading: boolean;

  // 数据
  categories: Category[];
  snippets: Snippet[];
  annotations: Annotation[];

  // 当前选中
  selectedCategoryId: string | null;
  selectedSnippetId: string | null;
  selectedAnnotationId: string | null;

  // 布局
  layout: LayoutState;

  // 认证操作
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;

  // 数据加载
  loadAllData: () => Promise<void>;

  // 操作 - 分类
  addCategory: (name: string, parentId: string | null) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectCategory: (id: string | null) => void;

  // 操作 - 片段
  addSnippet: (categoryId: string | null) => Promise<void>;
  updateSnippet: (id: string, updates: Partial<Snippet>) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  selectSnippet: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;

  // 操作 - 注释
  addAnnotation: (
    snippetId: string,
    startOffset: number,
    endOffset: number
  ) => Promise<Annotation | null>;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  selectAnnotation: (id: string | null) => void;

  // 布局操作
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFocusMode: () => void;

  // 工具
  getSnippetAnnotations: (snippetId: string) => Annotation[];
  getCurrentSnippet: () => Snippet | null;
  getCurrentCategory: () => Category | null;
  getNextAnnotationColor: (snippetId: string) => AnnotationColor;
  cleanupOrphanedFiles: () => Promise<number>;
}

// 将后端数据转换为前端类型
function mapCategory(data: any): Category {
  return {
    id: String(data.id),
    name: data.name,
    parentId: data.parentId ? String(data.parentId) : null,
    sortOrder: data.sortOrder || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapSnippet(data: any): Snippet {
  return {
    id: String(data.id),
    title: data.title,
    language: data.language,
    content: data.content,
    description: data.description || "",
    tags: data.tags || [],
    categoryId: data.categoryId ? String(data.categoryId) : null,
    favorite: data.favorite || false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapAnnotation(data: any): Annotation {
  return {
    id: String(data.id),
    snippetId: String(data.snippetId),
    title: data.title,
    contentMarkdown: data.contentMarkdown || data.content || "",
    startOffset: data.startOffset || 0,
    endOffset: data.endOffset || 0,
    color: (data.color as AnnotationColor) || "indigo",
    sortOrder: data.sortOrder || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  // 认证状态
  isLoggedIn: false,
  userEmail: null,
  userNickname: null,
  isLoading: true,

  // 初始数据为空，等 checkAuth 确定登录状态后再加载
  categories: [],
  snippets: [],
  annotations: [],
  selectedCategoryId: null,
  selectedSnippetId: null,
  selectedAnnotationId: null,

  layout: {
    leftPanelWidth: 240,
    rightPanelWidth: 320,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    focusMode: false,
  },

  // --- 认证 ---
  checkAuth: () => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("userEmail");
    const nickname = localStorage.getItem("userNickname");
    if (token && email) {
      // 已登录：保持 isLoading=true，加载真实数据
      set({ isLoggedIn: true, userEmail: email, userNickname: nickname, isLoading: true });
      get().loadAllData();
    } else {
      // 未登录：加载 mock 演示数据
      set({
        isLoggedIn: false,
        isLoading: false,
        categories: mockCategories,
        snippets: mockSnippets,
        annotations: mockAnnotations,
        selectedCategoryId: mockCategories[0]?.id || null,
        selectedSnippetId: mockSnippets[0]?.id || null,
        selectedAnnotationId: null,
      });
    }
  },

  login: async (email, password) => {
    const result = await (await import("@/lib/api")).authApi.login({ email, password });
    localStorage.setItem("token", result.token);
    localStorage.setItem("userEmail", result.email);
    localStorage.setItem("userNickname", result.nickname || "");
    set({
      isLoggedIn: true,
      userEmail: result.email,
      userNickname: result.nickname || null,
    });
    await get().loadAllData();
  },

  register: async (email, password, nickname) => {
    const result = await (await import("@/lib/api")).authApi.register({ email, password, nickname });
    localStorage.setItem("token", result.token);
    localStorage.setItem("userEmail", result.email);
    localStorage.setItem("userNickname", result.nickname || "");
    set({
      isLoggedIn: true,
      userEmail: result.email,
      userNickname: result.nickname || null,
    });
    await get().loadAllData();
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userNickname");
    set({
      isLoggedIn: false,
      userEmail: null,
      userNickname: null,
      categories: mockCategories,
      snippets: mockSnippets,
      annotations: mockAnnotations,
      selectedCategoryId: mockCategories[0]?.id || null,
      selectedSnippetId: mockSnippets[0]?.id || null,
      selectedAnnotationId: null,
    });
  },

  // --- 加载所有数据 ---
  loadAllData: async () => {
    set({ isLoading: true });
    try {
      const [cats, snips] = await Promise.all([
        categoryApi.getAll(),
        snippetApi.list(),
      ]);

      const categories = cats.map(mapCategory);
      const snippets = snips.map(mapSnippet);

      // 加载所有片段的注释（并行）
      const annotationPromises = snippets.map(async (s) => {
        try {
          const anns = await annotationApi.list(s.id);
          return anns.map(mapAnnotation);
        } catch {
          return [];
        }
      });
      const annotationResults = await Promise.all(annotationPromises);
      const annotations = annotationResults.flat();

      set({
        categories,
        snippets,
        annotations,
        selectedCategoryId: categories[0]?.id || null,
        selectedSnippetId: snippets[0]?.id || null,
        selectedAnnotationId: null,
        isLoading: false,
      });
    } catch (err: any) {
      console.error("Failed to load data:", err);
      // Token 过期或无效，清除登录状态回到登录页
      if (err?.status === 401 || err?.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userNickname");
        set({
          isLoggedIn: false,
          userEmail: null,
          userNickname: null,
          isLoading: false,
          categories: mockCategories,
          snippets: mockSnippets,
          annotations: mockAnnotations,
          selectedCategoryId: mockCategories[0]?.id || null,
          selectedSnippetId: mockSnippets[0]?.id || null,
          selectedAnnotationId: null,
        });
        return;
      }
      set({ isLoading: false });
    }
  },

  // --- 分类操作 ---
  addCategory: async (name, parentId) => {
    const { isLoggedIn } = get();
    const tempId = uuidv4();
    const newCategory: Category = {
      id: tempId,
      name,
      parentId,
      sortOrder: get().categories.filter((c) => c.parentId === parentId).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 乐观更新：立即添加到本地状态
    set((state) => ({
      categories: [...state.categories, newCategory],
    }));

    if (!isLoggedIn) {
      return;
    }

    try {
      const data = await categoryApi.create({ name, parentId });
      const serverCategory = mapCategory(data);
      // 用服务器返回的真实数据替换临时记录
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === tempId ? serverCategory : c
        ),
      }));
    } catch (e) {
      // API 失败：回滚
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== tempId),
      }));
      throw e;
    }
  },

  updateCategory: async (id, name) => {
    const { isLoggedIn } = get();
    if (!isLoggedIn) {
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c
        ),
      }));
      return;
    }

    await categoryApi.update(id, { name });
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },

  deleteCategory: async (id) => {
    const { isLoggedIn, categories, snippets } = get();
    const idsToDelete = new Set<string>();
    const collectChildren = (parentId: string) => {
      idsToDelete.add(parentId);
      categories
        .filter((c) => c.parentId === parentId)
        .forEach((c) => collectChildren(c.id));
    };
    collectChildren(id);

    if (!isLoggedIn) {
      set((state) => ({
        categories: state.categories.filter((c) => !idsToDelete.has(c.id)),
        snippets: state.snippets.filter((s) => !idsToDelete.has(s.categoryId!)),
        selectedCategoryId:
          state.selectedCategoryId && idsToDelete.has(state.selectedCategoryId)
            ? null
            : state.selectedCategoryId,
      }));
      return;
    }

    await categoryApi.delete(id);
    set((state) => ({
      categories: state.categories.filter((c) => !idsToDelete.has(c.id)),
      snippets: state.snippets.filter((s) => !idsToDelete.has(s.categoryId!)),
      annotations: state.annotations.filter(
        (a) => !state.snippets.some(
          (s) => s.id === a.snippetId && idsToDelete.has(s.categoryId!)
        )
      ),
      selectedCategoryId:
        state.selectedCategoryId && idsToDelete.has(state.selectedCategoryId)
          ? null
          : state.selectedCategoryId,
    }));
  },

  selectCategory: (id) => set({ selectedCategoryId: id }),

  // --- 片段操作 ---
  addSnippet: async (categoryId) => {
    const { isLoggedIn } = get();
    const tempId = uuidv4();
    const newSnippet: Snippet = {
      id: tempId,
      title: "未命名片段",
      language: "javascript",
      content: "// 在这里编写代码\n",
      description: "",
      tags: [],
      categoryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 乐观更新：立即添加到本地状态
    set((state) => ({
      snippets: [...state.snippets, newSnippet],
      selectedSnippetId: tempId,
    }));

    if (!isLoggedIn) {
      return;
    }

    try {
      const data = await snippetApi.create({
        title: "未命名片段",
        language: "javascript",
        content: "// 在这里编写代码\n",
        categoryId,
        tags: [],
      });
      const serverSnippet = mapSnippet(data);
      // 用服务器返回的真实数据替换临时记录
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === tempId ? serverSnippet : s
        ),
        selectedSnippetId: serverSnippet.id,
      }));
    } catch (e) {
      // API 失败：回滚
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== tempId),
        selectedSnippetId: null,
      }));
      throw e;
    }
  },

  updateSnippet: async (id, updates) => {
    const { isLoggedIn } = get();
    if (!isLoggedIn) {
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id
            ? { ...s, ...updates, updatedAt: new Date().toISOString() }
            : s
        ),
      }));
      return;
    }

    // 乐观更新
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s
      ),
    }));

    try {
      await snippetApi.update(id, updates);
    } catch (err) {
      // 失败回滚可以在这里处理
      console.error("Failed to update snippet:", err);
    }
  },

  deleteSnippet: async (id) => {
    const { isLoggedIn } = get();
    if (!isLoggedIn) {
      set((state) => {
        const nextSnippets = state.snippets.filter((s) => s.id !== id);
        const nextAnnotations = state.annotations.filter((a) => a.snippetId !== id);
        return {
          snippets: nextSnippets,
          annotations: nextAnnotations,
          selectedSnippetId:
            state.selectedSnippetId === id
              ? nextSnippets[0]?.id || null
              : state.selectedSnippetId,
        };
      });
      return;
    }

    await snippetApi.delete(id);
    set((state) => {
      const nextSnippets = state.snippets.filter((s) => s.id !== id);
      const nextAnnotations = state.annotations.filter((a) => a.snippetId !== id);
      return {
        snippets: nextSnippets,
        annotations: nextAnnotations,
        selectedSnippetId:
          state.selectedSnippetId === id
            ? nextSnippets[0]?.id || null
            : state.selectedSnippetId,
      };
    });
  },

  selectSnippet: (id) =>
    set({ selectedSnippetId: id, selectedAnnotationId: null }),

  toggleFavorite: async (id) => {
    const { isLoggedIn, snippets } = get();
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet) return;

    // 乐观更新
    const newFavorite = !snippet.favorite;
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id ? { ...s, favorite: newFavorite } : s
      ),
    }));

    if (!isLoggedIn) {
      return;
    }

    try {
      const data = await snippetApi.toggleFavorite(id);
      const serverSnippet = mapSnippet(data);
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id ? serverSnippet : s
        ),
      }));
    } catch (err) {
      // 失败回滚
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id ? { ...s, favorite: snippet.favorite } : s
        ),
      }));
      console.error("Failed to toggle favorite:", err);
      throw err;
    }
  },

  // --- 注释操作 ---
  addAnnotation: async (snippetId, startOffset, endOffset) => {
    const { isLoggedIn, getNextAnnotationColor } = get();
    const color = getNextAnnotationColor(snippetId);
    const tempId = uuidv4();

    const snippetAnnotations = get().annotations.filter(
      (a) => a.snippetId === snippetId
    );
    const newAnnotation: Annotation = {
      id: tempId,
      snippetId,
      title: "新注释",
      contentMarkdown: "在这里添加注释...",
      startOffset,
      endOffset,
      color,
      sortOrder: snippetAnnotations.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 乐观更新：立即添加到本地状态，让高亮立即显示
    set((state) => ({
      annotations: [...state.annotations, newAnnotation],
      selectedAnnotationId: tempId,
    }));

    if (!isLoggedIn) {
      return newAnnotation;
    }

    try {
      const data = await annotationApi.create(snippetId, {
        title: "新注释",
        contentMarkdown: "在这里添加注释...",
        startOffset,
        endOffset,
        color,
      });
      const serverAnnotation = mapAnnotation(data);
      // 用服务器返回的真实数据替换临时记录
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === tempId ? serverAnnotation : a
        ),
        selectedAnnotationId: serverAnnotation.id,
      }));
      return serverAnnotation;
    } catch (e) {
      // API 失败：回滚移除临时注释
      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== tempId),
        selectedAnnotationId: null,
      }));
      throw e;
    }
  },

  updateAnnotation: async (id, updates) => {
    const { isLoggedIn, annotations } = get();
    const annot = annotations.find((a) => a.id === id);
    if (!annot) return;

    if (!isLoggedIn) {
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === id
            ? { ...a, ...updates, updatedAt: new Date().toISOString() }
            : a
        ),
      }));
      return;
    }

    // 乐观更新
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id
          ? { ...a, ...updates, updatedAt: new Date().toISOString() }
          : a
      ),
    }));

    try {
      await annotationApi.update(annot.snippetId, id, updates);
    } catch (err) {
      console.error("Failed to update annotation:", err);
    }
  },

  deleteAnnotation: async (id) => {
    const { isLoggedIn, annotations, selectedAnnotationId } = get();
    const annot = annotations.find((a) => a.id === id);

    // 先乐观更新本地状态
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    }));

    if (!isLoggedIn || !annot) {
      return;
    }

    try {
      await annotationApi.delete(annot.snippetId, id);
    } catch (e) {
      console.error("Delete annotation error:", e);
      // 删除失败时回滚（把注释加回来）
      set((state) => ({
        annotations: [...state.annotations, annot],
        selectedAnnotationId: selectedAnnotationId,
      }));
      throw e;
    }
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),

  // --- 布局操作 ---
  setLeftPanelWidth: (width) =>
    set((state) => ({
      layout: { ...state.layout, leftPanelWidth: Math.max(180, Math.min(500, width)) },
    })),

  setRightPanelWidth: (width) =>
    set((state) => ({
      layout: { ...state.layout, rightPanelWidth: Math.max(240, Math.min(window.innerWidth * 0.6, width)) },
    })),

  toggleLeftPanel: () =>
    set((state) => ({
      layout: {
        ...state.layout,
        leftPanelCollapsed: !state.layout.leftPanelCollapsed,
      },
    })),

  toggleRightPanel: () =>
    set((state) => ({
      layout: {
        ...state.layout,
        rightPanelCollapsed: !state.layout.rightPanelCollapsed,
      },
    })),

  toggleFocusMode: () =>
    set((state) => ({
      layout: { ...state.layout, focusMode: !state.layout.focusMode },
    })),

  // --- 工具函数 ---
  getSnippetAnnotations: (snippetId) =>
    get()
      .annotations.filter((a) => a.snippetId === snippetId)
      .sort((a, b) => a.startOffset - b.startOffset),

  getCurrentSnippet: () => {
    const { snippets, selectedSnippetId } = get();
    return snippets.find((s) => s.id === selectedSnippetId) || null;
  },

  getCurrentCategory: () => {
    const { categories, selectedCategoryId } = get();
    return categories.find((c) => c.id === selectedCategoryId) || null;
  },

  getNextAnnotationColor: (snippetId) => {
    const count = get().annotations.filter(
      (a) => a.snippetId === snippetId
    ).length;
    return ANNOTATION_COLORS[count % ANNOTATION_COLORS.length];
  },

  cleanupOrphanedFiles: async () => {
    const { isLoggedIn } = get();
    if (!isLoggedIn) {
      throw new Error("请先登录");
    }
    const result = await fileApi.cleanup();
    return result.deletedCount;
  },
}));

// 分类
export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
  snippetCount?: number;
}

// 代码片段
export interface Snippet {
  id: string;
  title: string;
  language: string;
  content: string;
  description?: string;
  tags: string[];
  categoryId: string | null;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 注释
export interface Annotation {
  id: string;
  snippetId: string;
  title: string;
  contentMarkdown: string;
  contentHtml?: string;
  startOffset: number;
  endOffset: number;
  color: AnnotationColor;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 注释颜色枚举
export type AnnotationColor =
  | "indigo"
  | "amber"
  | "emerald"
  | "rose"
  | "sky"
  | "fuchsia"
  | "lime"
  | "orange";

// 支持的语言列表
export interface LanguageOption {
  value: string;
  label: string;
  mode: string; // CodeMirror mode
}

// 布局状态
export interface LayoutState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  focusMode: boolean;
}

// 创建分类的 DTO
export interface CreateCategoryDto {
  name: string;
  parentId: string | null;
}

// 更新分类的 DTO
export interface UpdateCategoryDto {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
}

// 创建片段的 DTO
export interface CreateSnippetDto {
  title: string;
  language: string;
  content: string;
  description?: string;
  tags?: string[];
  categoryId?: string | null;
}

// 更新片段的 DTO
export interface UpdateSnippetDto {
  title?: string;
  language?: string;
  content?: string;
  description?: string;
  tags?: string[];
  categoryId?: string | null;
}

// 创建注释的 DTO
export interface CreateAnnotationDto {
  snippetId: string;
  title: string;
  contentMarkdown: string;
  startOffset: number;
  endOffset: number;
  color?: AnnotationColor;
}

// 更新注释的 DTO
export interface UpdateAnnotationDto {
  title?: string;
  contentMarkdown?: string;
  startOffset?: number;
  endOffset?: number;
  color?: AnnotationColor;
}

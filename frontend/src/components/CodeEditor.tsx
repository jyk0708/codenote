"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { EditorState, StateField, StateEffect, RangeSet } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration, DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput, foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { rust } from "@codemirror/lang-rust";
import { markdown } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { useAppStore } from "@/store/useAppStore";
import { getLanguageLabel, LANGUAGE_OPTIONS, offsetToLine, renderMarkdown, renderMermaidInContainer, rerenderMermaidInContainer } from "@/lib/utils";
import {
  handleImagePaste,
  handleImageDrop,
  handleMarkdownShortcut,
  handleTabKey,
  handleEnterKey,
  uploadImage,
  makeMarkdownImage,
} from "@/lib/markdownEditor";
import {
  Copy,
  ChevronDown,
  Plus,
  Edit3,
  Eye,
  Code,
  FolderOpen,
  Download,
  FileText,
  FileCode,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  User,
  LogOut,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Crosshair,
} from "lucide-react";
import type { Annotation } from "@/types";
import {
  downloadMarkdown,
  downloadHTML,
} from "@/lib/export";
import EditorTabs from "@/components/EditorTabs";

// 语言映射
const languageExtensions: Record<string, () => any> = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  solidity: () => javascript(),
  python: () => python(),
  java: () => java(),
  rust: () => rust(),
  css: () => css(),
  html: () => html(),
  json: () => json(),
  sql: () => sql(),
  markdown: () => markdown(),
  xml: () => xml(),
};

// 定义设置注释装饰的 Effect
const setAnnotationsEffect = StateEffect.define<{
  annotations: Annotation[];
  activeId: string | null;
  docLength: number;
}>();

// CodeMirror Typora 风格 Markdown 快捷键
function createMarkdownKeymap(): any[] {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "Cmd" : "Ctrl";

  const wrapSelection = (view: EditorView, before: string, after: string = before) => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
    return true;
  };

  const prefixLine = (view: EditorView, prefix: string, toggle = true) => {
    const { from, to } = view.state.selection.main;
    const lineFrom = view.state.doc.lineAt(from).from;
    const lineTo = view.state.doc.lineAt(to).to;
    const lineText = view.state.sliceDoc(lineFrom, lineTo);
    const hasPrefix = lineText.startsWith(prefix);

    if (hasPrefix && toggle) {
      view.dispatch({
        changes: { from: lineFrom, to: lineTo, insert: lineText.slice(prefix.length) },
      });
    } else {
      view.dispatch({
        changes: { from: lineFrom, to: lineTo, insert: prefix + lineText },
      });
    }
    return true;
  };

  const setHeading = (view: EditorView, level: number) => {
    const { from, to } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const lineContent = line.text;
    const cleaned = lineContent.replace(/^#{1,6}\s*/, "");
    const prefix = level > 0 ? "#".repeat(level) + " " : "";
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: prefix + cleaned },
    });
    return true;
  };

  const insertLink = (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to) || "链接文字";
    view.dispatch({
      changes: { from, to, insert: `[${selected}](url)` },
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
    return true;
  };

  const insertCodeBlock = (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    if (selected.includes("\n")) {
      view.dispatch({
        changes: { from, to, insert: "```\n" + selected + "\n```" },
        selection: { anchor: from + 4, head: from + 4 + selected.length },
      });
    } else {
      wrapSelection(view, "`");
    }
    return true;
  };

  const insertMath = (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    if (selected.includes("\n")) {
      wrapSelection(view, "$$", "$$");
    } else {
      wrapSelection(view, "$");
    }
    return true;
  };

  return [
    { key: `${mod}-b`, run: (v: EditorView) => wrapSelection(v, "**") },
    { key: `${mod}-i`, run: (v: EditorView) => wrapSelection(v, "*") },
    { key: `${mod}-k`, run: insertLink },
    { key: `${mod}-Shift-K`, run: insertCodeBlock },
    { key: `${mod}-Shift-M`, run: insertMath },
    { key: `${mod}-Shift-Q`, run: (v: EditorView) => prefixLine(v, "> ") },
    { key: `${mod}-Shift-U`, run: (v: EditorView) => prefixLine(v, "- ") },
    { key: `${mod}-Shift-O`, run: (v: EditorView) => prefixLine(v, "1. ") },
    { key: `${mod}-1`, run: (v: EditorView) => setHeading(v, 1) },
    { key: `${mod}-2`, run: (v: EditorView) => setHeading(v, 2) },
    { key: `${mod}-3`, run: (v: EditorView) => setHeading(v, 3) },
    { key: `${mod}-4`, run: (v: EditorView) => setHeading(v, 4) },
    { key: `${mod}-5`, run: (v: EditorView) => setHeading(v, 5) },
    { key: `${mod}-6`, run: (v: EditorView) => setHeading(v, 6) },
    { key: `${mod}-0`, run: (v: EditorView) => setHeading(v, 0) },
  ];
}

// 构建注释装饰集
function buildDecorations(
  annotations: Annotation[],
  activeId: string | null,
  docLength: number
): DecorationSet {
  const ranges: any[] = [];

  annotations.forEach((annot) => {
    const from = Math.max(0, Math.min(annot.startOffset, docLength));
    const to = Math.max(from, Math.min(annot.endOffset, docLength));
    if (from >= to) return;

    const isActive = activeId === annot.id;
    const deco = Decoration.mark({
      class: `cm-annotation cm-annotation-${annot.color}${isActive ? " cm-annotation-active" : ""}`,
      attributes: { "data-annotation-id": annot.id },
    });
    ranges.push(deco.range(from, to));
  });

  // 按 from 排序
  ranges.sort((a, b) => a.from - b.from);

  return RangeSet.of(ranges);
}

// 注释状态字段
const annotationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, tr) => {
    // 处理代码变更，映射装饰位置
    if (tr.docChanged) {
      decorations = decorations.map(tr.changes);
    }
    // 处理设置注释的 effect
    for (const effect of tr.effects) {
      if (effect.is(setAnnotationsEffect)) {
        decorations = buildDecorations(
          effect.value.annotations,
          effect.value.activeId,
          effect.value.docLength
        );
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// 分类描述编辑器
function CategoryDescriptionEditor() {
  const { selectedCategoryId, getCurrentCategory, updateCategory, layout, toggleLeftPanel, toggleFocusMode, isLoggedIn, userNickname, userEmail, logout, cleanupOrphanedFiles } = useAppStore();
  const category = getCurrentCategory();
  const [editMode, setEditMode] = useState<"edit" | "split" | "preview">("split");
  const [localContent, setLocalContent] = useState("");
  const [debouncedContent, setDebouncedContent] = useState("");
  const [showCatExportMenu, setShowCatExportMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 同步分类描述到本地
  useEffect(() => {
    if (category) {
      setLocalContent(category.description || "");
    }
  }, [category?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // debounce 内容变化
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(localContent);
    }, 300);
    return () => clearTimeout(timer);
  }, [localContent]);

  // 保存到 store
  useEffect(() => {
    if (!category || localContent === (category.description || "")) return;
    updateCategory(category.id, { description: localContent });
  }, [debouncedContent]);  // eslint-disable-line react-hooks/exhaustive-deps

  // 预览 HTML
  const previewHtml = useMemo(() => {
    if (!debouncedContent) return "";
    return renderMarkdown(debouncedContent);
  }, [debouncedContent]);

  // 渲染 Mermaid
  useEffect(() => {
    if (previewRef.current && previewHtml) {
      const timer = setTimeout(() => {
        if (previewRef.current) {
          renderMermaidInContainer(previewRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [previewHtml, editMode]);

  // 窗口大小变化时重新渲染 Mermaid
  useEffect(() => {
    if (!previewRef.current) return;
    const ro = new ResizeObserver(() => {
      if (previewRef.current) {
        rerenderMermaidInContainer(previewRef.current);
      }
    });
    ro.observe(previewRef.current);
    return () => ro.disconnect();
  }, []);

  // 自动调整 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || editMode !== "edit") return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [localContent, editMode]);

  if (!category) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 bg-white">
        <div className="text-center">
          <p className="mb-2">选择一个分类或代码片段开始编辑</p>
          <p className="text-sm">或从左侧分类树新建</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <FolderOpen size={15} className="text-primary-500" />
          <span className="font-medium text-sm text-slate-700">{category.name}</span>
          <span className="text-xs text-slate-400">分类描述</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 专注模式 */}
          <button
            onClick={toggleFocusMode}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            title={layout.focusMode ? "退出专注模式 (F11)" : "专注模式 (F11)"}
          >
            {layout.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {/* 导出按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowCatExportMenu(!showCatExportMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
              title="导出分类描述"
            >
              <Download size={13} />
              导出
              <ChevronDown size={10} />
            </button>
            {showCatExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50 min-w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100">
                  导出为
                </div>
                <button
                  onClick={() => {
                    const mdContent = `# ${category.name}\n\n${localContent || ""}`;
                    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${category.name}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setShowCatExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText size={14} className="text-slate-400" />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => {
                    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${category.name}</title>
<style>
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.8; color: #334155; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
h1 { color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
.markdown-body img { max-width: 100%; }
.markdown-body pre { background: #1e293b; padding: 16px; border-radius: 8px; overflow-x: auto; color: #e2e8f0; }
.markdown-body code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
.markdown-body pre code { background: transparent; padding: 0; }
.markdown-body blockquote { border-left: 4px solid #6366f1; padding-left: 16px; color: #64748b; margin: 16px 0; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body th, .markdown-body td { border: 1px solid #e2e8f0; padding: 8px 12px; }
.markdown-body th { background: #f8fafc; }
.markdown-body ul { list-style: disc; padding-left: 24px; }
.markdown-body ol { list-style: decimal; padding-left: 24px; }
</style></head>
<body><h1>${category.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>
<div class="markdown-body">${renderMarkdown(localContent || "")}</div>
</body></html>`;
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${category.name}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setShowCatExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCode size={14} className="text-slate-400" />
                  HTML (.html)
                </button>
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* 用户按钮 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <User size={14} />
              <span className="max-w-[80px] truncate text-xs">
                {isLoggedIn ? userNickname || userEmail : "登录"}
              </span>
            </button>
            {showUserMenu && isLoggedIn && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-700 truncate">{userNickname || "用户"}</p>
                  <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={async () => {
                    setCleaningUp(true);
                    try {
                      const count = await cleanupOrphanedFiles();
                      alert(`清理完成！共删除了 ${count} 个失效文件。`);
                    } catch (err: any) {
                      alert("清理失败：" + (err.message || err));
                    } finally {
                      setCleaningUp(false);
                    }
                    setShowUserMenu(false);
                  }}
                  disabled={cleaningUp}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <ImageIcon size={14} />
                  {cleaningUp ? "清理中..." : "清理失效图片"}
                </button>
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
      </div>

      {/* 编辑模式切换 */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-100 bg-white">
        <button
          onClick={() => setEditMode("edit")}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
            editMode === "edit"
              ? "bg-white text-slate-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Code size={12} />
          编辑
        </button>
        <button
          onClick={() => setEditMode("split")}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
            editMode === "split"
              ? "bg-white text-slate-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Edit3 size={12} />
          分屏
        </button>
        <button
          onClick={() => setEditMode("preview")}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
            editMode === "preview"
              ? "bg-white text-slate-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Eye size={12} />
          预览
        </button>
      </div>

      {/* 编辑区 + 预览区 */}
      <div className="flex-1 flex overflow-hidden">
        {(editMode === "edit" || editMode === "split") && (
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onPaste={async (e) => {
              await handleImagePaste(e, () => localContent, setLocalContent);
            }}
            onDrop={async (e) => {
              await handleImageDrop(e, () => localContent, setLocalContent);
            }}
            onDragOver={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              const ta = e.currentTarget;
              const selection = { start: ta.selectionStart, end: ta.selectionEnd };
              const handlers = [
                handleMarkdownShortcut(e, localContent, selection),
                handleTabKey(e, localContent, selection),
                handleEnterKey(e, localContent, selection),
              ];
              for (const result of handlers) {
                if (result.handled && result.text !== undefined) {
                  setLocalContent(result.text);
                  requestAnimationFrame(() => {
                    if (result.selection) {
                      ta.setSelectionRange(result.selection.start, result.selection.end);
                    }
                  });
                  break;
                }
              }
            }}
            className={`${
              editMode === "split" ? "w-1/2 border-r border-slate-200" : "w-full"
            } h-full p-4 text-sm font-mono text-slate-700 resize-none outline-none bg-white overflow-y-auto`}
            placeholder="用 Markdown 编写分类描述...&#10;例如：该分类包含哪些内容、学习路线、相关链接等"
          />
        )}
        {(editMode === "preview" || editMode === "split") && (
          <div
            ref={previewRef}
            className={`${editMode === "split" ? "w-1/2" : "w-full"} overflow-y-auto bg-slate-50/30`}
            style={{ userSelect: "text" }}
          >
            {debouncedContent ? (
              <div
                className="markdown-body text-sm p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                预览区
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <span>{localContent ? `${localContent.length} 字` : "暂无描述"}</span>
        <span>已自动保存</span>
      </div>
    </div>
  );
}

export default function CodeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const [mdEditMode, setMdEditMode] = useState<"edit" | "split" | "preview">("split");
  const [debouncedContent, setDebouncedContent] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const annotationsRef = useRef<Annotation[]>([]);
  const activeAnnotRef = useRef<string | null>(null);
  const isAddingAnnotationRef = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const {
    selectedSnippetId,
    getCurrentSnippet,
    updateSnippet,
    selectedAnnotationId,
    selectAnnotation,
    addAnnotation,
    selectedCategoryId,
    getCurrentCategory,
    updateCategory,
    layout,
    languages,
    toggleLeftPanel,
    toggleRightPanel,
    toggleFocusMode,
    isLoggedIn,
    userNickname,
    userEmail,
    logout,
    cleanupOrphanedFiles,
    pendingScrollLine,
    clearPendingScrollLine,
    revealSnippet,
  } = useAppStore();

  // 语言选项（优先使用服务端配置）
  const languageOptions = useMemo(() => {
    if (languages.length > 0) {
      return languages
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({ value: l.value, label: l.name, mode: l.mode }));
    }
    return LANGUAGE_OPTIONS;
  }, [languages]);

  // 根据语言值获取 CodeMirror 模式
  const getLanguageMode = useCallback((langValue: string): string => {
    const lang = languageOptions.find((l) => l.value === langValue);
    return lang?.mode || "javascript";
  }, [languageOptions]);

  // 直接订阅 annotations 数组（原始引用）
  const allAnnotations = useAppStore((state) => state.annotations);

  const snippet = getCurrentSnippet();
  const isMarkdown = snippet?.language === "markdown";

  // 使用 useMemo 缓存注释列表，避免每次渲染创建新数组导致无限重渲染
  const annotations = useMemo(() => {
    if (!selectedSnippetId) return [];
    return allAnnotations
      .filter((a) => a.snippetId === selectedSnippetId)
      .sort((a, b) => a.startOffset - b.startOffset);
  }, [allAnnotations, selectedSnippetId]);

  // 更新注释装饰
  const updateDecorations = useCallback((annots: Annotation[], activeId: string | null) => {
    const view = viewRef.current;
    if (!view) return;
    annotationsRef.current = annots;
    activeAnnotRef.current = activeId;
    view.dispatch({
      effects: setAnnotationsEffect.of({
        annotations: annots,
        activeId: activeId,
        docLength: view.state.doc.length,
      }),
    });
  }, []);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current || !snippet) return;

    // 根据语言配置获取 CodeMirror 语言扩展
    const getLangExtension = () => {
      // 先按语言值查找（内置语言精确匹配）
      if (languageExtensions[snippet.language]) {
        return languageExtensions[snippet.language]();
      }
      // 再按 mode 查找（自定义语言可能使用内置 mode）
      const mode = getLanguageMode(snippet.language);
      if (languageExtensions[mode]) {
        return languageExtensions[mode]();
      }
      // 默认使用 javascript
      return javascript();
    };
    const langExt = getLangExtension();

    // 点击注释区域的事件处理
    const domEventHandlers = EditorView.domEventHandlers({
      click: (e, view) => {
        const target = e.target as HTMLElement;
        const annotEl = target.closest("[data-annotation-id]");
        if (annotEl) {
          const id = annotEl.getAttribute("data-annotation-id");
          if (id) {
            useAppStore.getState().selectAnnotation(id);
            return true;
          }
        }
        return false;
      },
      paste: (e, view) => {
        if (snippet.language !== "markdown") return false;
        const ev = e as ClipboardEvent;
        const items = ev.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            ev.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              uploadImage(file).then((result) => {
                const md = makeMarkdownImage(result);
                const pos = view.state.selection.main.from;
                view.dispatch({
                  changes: { from: pos, insert: md },
                  selection: { anchor: pos + md.length },
                });
              }).catch((err) => console.error("Image upload failed:", err));
            }
            return true;
          }
        }
        return false;
      },
      drop: (e, view) => {
        if (snippet.language !== "markdown") return false;
        const ev = e as DragEvent;
        const files = ev.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (imageFiles.length === 0) return false;

        ev.preventDefault();
        const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY });
        if (pos == null) return true;
        let insertText = "";
        let pending = imageFiles.length;

        imageFiles.forEach((file) => {
          uploadImage(file).then((result) => {
            insertText += makeMarkdownImage(result);
            pending--;
            if (pending === 0) {
              view.dispatch({
                changes: { from: pos, insert: insertText },
                selection: { anchor: pos + insertText.length },
              });
            }
          }).catch((err) => console.error("Image upload failed:", err));
        });
        return true;
      },
      dragover: (e, view) => {
        if (snippet.language !== "markdown") return false;
        const ev = e as DragEvent;
        if (ev.dataTransfer?.types.includes("Files")) {
          ev.preventDefault();
          return true;
        }
        return false;
      },
    });

    // 选区变化监听
    const selectionListener = EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
        // 添加注释时忽略选区变化，防止工具栏重新弹出
        if (isAddingAnnotationRef.current) return;
        const { from, to } = update.state.selection.main;
        if (from !== to) {
          setSelectionRange({ from, to });
          // 计算工具栏位置
          const coords = update.view.coordsAtPos(from);
          const editorRect = containerRef.current?.getBoundingClientRect();
          if (coords && editorRect) {
            setToolbarPos({
              top: coords.top - editorRect.top - 36,
              left: coords.left - editorRect.left,
            });
            setShowSelectionToolbar(true);
          }
        } else {
          setShowSelectionToolbar(false);
          setSelectionRange(null);
        }
      }
    });

    // 内容变化监听 - 更新 store 和注释偏移
    const changeListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString();
        const currentSnippetId = useAppStore.getState().selectedSnippetId;
        if (!currentSnippetId) return;

        // 更新片段内容
        useAppStore.getState().updateSnippet(currentSnippetId, {
          content: newContent,
        });

        // 更新注释偏移量
        const state = useAppStore.getState();
        const snippetAnnots = state.annotations.filter(
          (a) => a.snippetId === currentSnippetId
        );

        snippetAnnots.forEach((annot) => {
          let newStart = annot.startOffset;
          let newEnd = annot.endOffset;

          update.changes.iterChanges(
            (fromA, toA, fromB, toB, inserted) => {
              const insertLen = inserted.length;
              const deleteLen = toA - fromA;
              const delta = insertLen - deleteLen;

              if (toA <= annot.startOffset) {
                // 变化在注释之前，整体移动
                newStart += delta;
                newEnd += delta;
              } else if (fromA < annot.startOffset) {
                // 从注释前开始
                if (toA <= annot.endOffset) {
                  // 到注释内部
                  newEnd += delta;
                } else {
                  // 覆盖整个注释
                  newEnd = annot.endOffset + delta;
                }
              } else if (fromA < annot.endOffset) {
                // 在注释内部
                newEnd += delta;
              }
              // 变化在注释之后，不影响
            }
          );

          if (newStart !== annot.startOffset || newEnd !== annot.endOffset) {
            useAppStore.getState().updateAnnotation(annot.id, {
              startOffset: Math.max(0, newStart),
              endOffset: Math.max(newStart, newEnd),
            });
          }
        });
      }
    });

    const state = EditorState.create({
      doc: snippet.content,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        langExt,
        annotationField,
        domEventHandlers,
        selectionListener,
        changeListener,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...(snippet.language === "markdown" ? createMarkdownKeymap() : []),
        ]),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "13px",
            fontFamily:
              '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          ".cm-content": {
            padding: "12px 0",
          },
          ".cm-gutters": {
            backgroundColor: "#f8fafc",
            color: "#94a3b8",
            border: "none",
            borderRight: "1px solid #e2e8f0",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "#f1f5f9",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(99, 102, 241, 0.04)",
          },
          ".cm-selectionBackground, ::selection": {
            backgroundColor: "rgba(99, 102, 241, 0.2) !important",
          },
          ".cm-cursor": {
            borderLeftColor: "#6366f1",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // 初始设置注释
    const initialAnnots = useAppStore
      .getState()
      .getSnippetAnnotations(snippet.id);
    const initialActive = useAppStore.getState().selectedAnnotationId;
    annotationsRef.current = initialAnnots;
    activeAnnotRef.current = initialActive;
    view.dispatch({
      effects: setAnnotationsEffect.of({
        annotations: initialAnnots,
        activeId: initialActive,
        docLength: view.state.doc.length,
      }),
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnippetId, snippet?.language]);

  // 注释变化时更新装饰
  useEffect(() => {
    updateDecorations(annotations, selectedAnnotationId);
    // 同步更新 annotationsRef 供滚动定位使用
    annotationsRef.current = annotations;
  }, [annotations, selectedAnnotationId, updateDecorations]);

  // 选中注释时滚动到对应位置（仅当 selectedAnnotationId 变化时执行）
  const prevSelectedAnnotRef = useRef<string | null>(null);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // 只在 selectedAnnotationId 实际变化时才滚动定位
    if (selectedAnnotationId === prevSelectedAnnotRef.current) return;
    prevSelectedAnnotRef.current = selectedAnnotationId;

    if (!selectedAnnotationId) return;

    const annot = annotationsRef.current.find((a) => a.id === selectedAnnotationId);
    if (annot) {
      view.dispatch({
        selection: { anchor: annot.startOffset, head: annot.endOffset },
        scrollIntoView: true,
      });
    }
  }, [selectedAnnotationId]);

  // Wiki 链接跳转：滚动到指定行号
  useEffect(() => {
    if (pendingScrollLine == null) return;
    const view = viewRef.current;
    if (!view) return;

    const line = Math.max(1, pendingScrollLine);
    const doc = view.state.doc;
    const targetLine = Math.min(line, doc.lines);

    if (targetLine > 0) {
      const lineObj = doc.line(targetLine);
      view.dispatch({
        selection: { anchor: lineObj.from },
        scrollIntoView: true,
      });
    }

    // 清除待滚动状态
    clearPendingScrollLine();
  }, [pendingScrollLine, clearPendingScrollLine]);

  // Markdown 预览：debounce 内容变化
  useEffect(() => {
    if (!isMarkdown) return;
    const timer = setTimeout(() => {
      setDebouncedContent(snippet?.content || "");
    }, 200);
    return () => clearTimeout(timer);
  }, [snippet?.content, isMarkdown]);

  // Markdown 预览 HTML
  const previewHtml = useMemo(() => {
    if (!isMarkdown) return "";
    return renderMarkdown(debouncedContent);
  }, [debouncedContent, isMarkdown]);

  // Markdown 预览：渲染 Mermaid 图表
  useEffect(() => {
    if (previewRef.current && isMarkdown && previewHtml) {
      // 延迟一帧确保 DOM 已完全挂载和可见
      const timer = setTimeout(() => {
        if (previewRef.current) {
          renderMermaidInContainer(previewRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [previewHtml, isMarkdown, mdEditMode]);

  // 窗口大小变化时重新渲染 Mermaid
  useEffect(() => {
    if (!previewRef.current) return;
    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (previewRef.current) {
          rerenderMermaidInContainer(previewRef.current);
        }
      }, 200);
    });
    ro.observe(previewRef.current);
    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
    };
  }, []);

  // 切换编辑模式时刷新 CodeMirror 布局
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !isMarkdown) return;
    requestAnimationFrame(() => {
      view.dispatch({});
    });
  }, [mdEditMode, isMarkdown]);

  // 添加注释
  const handleAddAnnotation = async () => {
    if (!selectionRange || !selectedSnippetId) return;
    const view = viewRef.current;
    // 设置标志，防止选区变化重新触发工具栏
    isAddingAnnotationRef.current = true;
    setShowSelectionToolbar(false);

    // 保存当前选区，用于后续恢复
    const savedFrom = selectionRange.from;
    const savedTo = selectionRange.to;

    const newAnnot = await addAnnotation(
      selectedSnippetId,
      savedFrom,
      savedTo
    );
    if (newAnnot) {
      selectAnnotation(newAnnot.id);
    }

    // 恢复编辑器选区，防止装饰更新导致选区丢失或变化
    if (view) {
      view.dispatch({
        selection: { anchor: savedFrom, head: savedTo },
      });
    }

    // 延迟清除标志，让 CodeMirror 的选择事件和装饰更新都处理完
    // 使用双重 rAF + 延迟确保所有渲染和状态更新都已稳定
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          isAddingAnnotationRef.current = false;
        }, 300);
      });
    });
  };

  // 复制代码
  const handleCopy = async () => {
    if (!snippet || typeof snippet.content !== "string") return;
    try {
      await navigator.clipboard.writeText(snippet.content);
    } catch (e) {
      console.error("Copy failed:", e);
      // fallback
      try {
        const textarea = document.createElement("textarea");
        textarea.value = snippet.content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (e2) {
        console.error("Fallback copy also failed:", e2);
      }
    }
  };

  // 切换语言
  const handleLanguageChange = (lang: string) => {
    if (!snippet) return;
    updateSnippet(snippet.id, { language: lang });
    setShowLangMenu(false);
  };

  if (!snippet) {
    return (
      <>
        <CategoryDescriptionEditor />
      </>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full bg-white relative">
      {/* Tab 栏 */}
      <EditorTabs />
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          {/* 标题 */}
          <input
            value={snippet.title}
            onChange={(e) => updateSnippet(snippet.id, { title: e.target.value })}
            className="bg-transparent border-none outline-none font-medium text-sm text-slate-700 w-48 focus:bg-white focus:border focus:border-slate-200 focus:rounded px-1 py-0.5"
          />

          {/* 语言选择器 */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
            >
              {languageOptions.find((l) => l.value === snippet.language)?.label || snippet.language}
              <ChevronDown size={12} />
            </button>
            {showLangMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-20 min-w-36 max-h-64 overflow-y-auto">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      snippet.language === lang.value
                        ? "text-primary-600 bg-primary-50"
                        : "text-slate-700"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 导出按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
              title="导出代码片段及注释"
            >
              <Download size={13} />
              导出
              <ChevronDown size={10} />
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30 min-w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100">
                  导出为
                </div>
                <button
                  onClick={() => {
                    downloadMarkdown(snippet, annotations);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText size={14} className="text-slate-400" />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => {
                    downloadHTML(snippet, annotations);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCode size={14} className="text-slate-400" />
                  HTML (.html)
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleCopy}
            disabled={!snippet || typeof snippet.content !== "string"}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="复制代码"
          >
            <Copy size={16} />
          </button>
          {/* 定位到文件 */}
          <button
            onClick={() => selectedSnippetId && revealSnippet(selectedSnippetId)}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            title="定位到文件 (Alt+L)"
          >
            <Crosshair size={16} />
          </button>
          {/* 专注模式 */}
          <button
            onClick={toggleFocusMode}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            title={layout.focusMode ? "退出专注模式 (F11)" : "专注模式 (F11)"}
          >
            {layout.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {/* 分隔线 */}
          <div className="w-px h-5 bg-slate-200 mx-1" />
          {/* 用户按钮 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <User size={14} />
              <span className="max-w-[80px] truncate text-xs">
                {isLoggedIn ? userNickname || userEmail : "登录"}
              </span>
            </button>
            {showUserMenu && isLoggedIn && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-700 truncate">{userNickname || "用户"}</p>
                  <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={async () => {
                    setCleaningUp(true);
                    try {
                      const count = await cleanupOrphanedFiles();
                      alert(`清理完成！共删除了 ${count} 个失效文件。`);
                    } catch (err: any) {
                      alert("清理失败：" + (err.message || err));
                    } finally {
                      setCleaningUp(false);
                    }
                    setShowUserMenu(false);
                  }}
                  disabled={cleaningUp}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <ImageIcon size={14} />
                  {cleaningUp ? "清理中..." : "清理失效图片"}
                </button>
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
      </div>

      {/* 标签栏 */}
      {snippet.tags.length > 0 && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-100 bg-white">
          {snippet.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Markdown 编辑模式切换 */}
      {isMarkdown && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-100 bg-white">
          <button
            onClick={() => setMdEditMode("edit")}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              mdEditMode === "edit"
                ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Code size={12} />
            编辑
          </button>
          <button
            onClick={() => setMdEditMode("split")}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              mdEditMode === "split"
                ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Edit3 size={12} />
            分屏
          </button>
          <button
            onClick={() => setMdEditMode("preview")}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              mdEditMode === "preview"
                ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Eye size={12} />
            预览
          </button>
        </div>
      )}

      {/* 代码编辑器容器 + Markdown 预览 */}
      <div className="flex-1 relative overflow-hidden flex">
        <div
          ref={containerRef}
          className={`h-full ${
            isMarkdown && mdEditMode === "preview"
              ? "hidden"
              : isMarkdown && mdEditMode === "split"
              ? "w-1/2 border-r border-slate-200"
              : "w-full"
          }`}
        />

        {/* Markdown 预览面板 */}
        {isMarkdown && (mdEditMode === "preview" || mdEditMode === "split") && (
          <div
            ref={previewRef}
            className={`${mdEditMode === "split" ? "w-1/2" : "w-full"} overflow-y-auto bg-slate-50/30`}
          >
            <div
              className="markdown-body text-sm p-4"
              style={{ userSelect: "text" }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}

        {/* 选区浮动工具栏 */}
        {showSelectionToolbar && selectionRange && (
          <div
            className="selection-toolbar"
            style={{ top: toolbarPos.top, left: toolbarPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleAddAnnotation}>
              <Plus size={12} style={{ display: "inline-block", marginRight: 3, verticalAlign: "middle" }} />
              添加注释
            </button>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>{annotations.length} 条注释</span>
          <span>{snippet.content.split("\n").length} 行</span>
        </div>
        <div className="flex items-center gap-2">
          <span>已自动保存</span>
        </div>
      </div>
    </div>
    </>
  );
}

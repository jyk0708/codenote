"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { EditorState, StateField, StateEffect, RangeSet } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration, DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
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
import { getLanguageLabel, LANGUAGE_OPTIONS, offsetToLine } from "@/lib/utils";
import {
  Copy,
  ChevronDown,
  Plus,
} from "lucide-react";
import type { Annotation } from "@/types";

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

export default function CodeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const annotationsRef = useRef<Annotation[]>([]);
  const activeAnnotRef = useRef<string | null>(null);

  const {
    selectedSnippetId,
    getCurrentSnippet,
    updateSnippet,
    selectedAnnotationId,
    selectAnnotation,
    addAnnotation,
  } = useAppStore();

  // 直接订阅 annotations 数组（原始引用）
  const allAnnotations = useAppStore((state) => state.annotations);

  const snippet = getCurrentSnippet();

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

    const langExt = languageExtensions[snippet.language]
      ? languageExtensions[snippet.language]()
      : javascript();

    // 点击注释区域的事件处理
    const clickHandler = EditorView.domEventHandlers({
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
    });

    // 选区变化监听
    const selectionListener = EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
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
        clickHandler,
        selectionListener,
        changeListener,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
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
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedAnnotationId || !snippet) return;

    const annot = annotationsRef.current.find((a) => a.id === selectedAnnotationId);
    if (annot) {
      view.dispatch({
        selection: { anchor: annot.startOffset, head: annot.endOffset },
        scrollIntoView: true,
      });
    }
  }, [selectedAnnotationId, snippet]);

  // 添加注释
  const handleAddAnnotation = async () => {
    if (!selectionRange || !selectedSnippetId) return;
    setShowSelectionToolbar(false);
    const newAnnot = await addAnnotation(
      selectedSnippetId,
      selectionRange.from,
      selectionRange.to
    );
    if (newAnnot) {
      selectAnnotation(newAnnot.id);
    }
  };

  // 复制代码
  const handleCopy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet.content);
    } catch (e) {
      console.error("Copy failed:", e);
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
      <div className="flex-1 flex items-center justify-center text-slate-400 bg-white">
        <div className="text-center">
          <p className="mb-2">选择一个代码片段开始编辑</p>
          <p className="text-sm">或从左侧分类树新建片段</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
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
              {getLanguageLabel(snippet.language)}
              <ChevronDown size={12} />
            </button>
            {showLangMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-20 min-w-36 max-h-64 overflow-y-auto">
                {LANGUAGE_OPTIONS.map((lang) => (
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
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            title="复制代码"
          >
            <Copy size={16} />
          </button>
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

      {/* 代码编辑器容器 */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />

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
  );
}

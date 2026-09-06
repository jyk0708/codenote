"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { renderMarkdown, offsetToLine, renderMermaidInContainer } from "@/lib/utils";
import {
  uploadImage,
  makeMarkdownImage,
  handleMarkdownShortcut,
  handleTabKey,
  handleEnterKey,
} from "@/lib/markdownEditor";
import {
  MessageSquare,
  Trash2,
  Edit3,
  Eye,
  Code,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Image as ImageIcon,
  PanelRightClose,
} from "lucide-react";
import type { Annotation, AnnotationColor } from "@/types";
import Modal from "@/components/ui/Modal";
import FloatingPanel from "@/components/ui/FloatingPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const ANNOTATION_COLOR_MAP: Record<AnnotationColor, string> = {
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  fuchsia: "bg-fuchsia-500",
  lime: "bg-lime-500",
  orange: "bg-orange-500",
};

export default function AnnotationPanel() {
  const {
    selectedSnippetId,
    selectedAnnotationId,
    selectAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getCurrentSnippet,
    navigateToSnippet,
    toggleRightPanel,
  } = useAppStore();

  // 直接订阅 annotations 数组
  const allAnnotations = useAppStore((state) => state.annotations);

  const snippet = getCurrentSnippet();

  // 使用 useMemo 缓存，避免每次渲染新数组引用
  const annotations = useMemo(() => {
    if (!selectedSnippetId) return [];
    return allAnnotations
      .filter((a) => a.snippetId === selectedSnippetId)
      .sort((a, b) => a.startOffset - b.startOffset);
  }, [allAnnotations, selectedSnippetId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"split" | "edit" | "preview">("split");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 弹窗放大注释
  const [popupAnnotId, setPopupAnnotId] = useState<string | null>(null);
  const [popupEditMode, setPopupEditMode] = useState<"split" | "edit" | "preview">("preview");

  // 图片上传状态
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // 删除确认弹窗
  const [deleteAnnotId, setDeleteAnnotId] = useState<string | null>(null);

  const selectedAnnot = annotations.find((a) => a.id === selectedAnnotationId);
  const popupAnnot = annotations.find((a) => a.id === popupAnnotId);

  // 注释卡片 DOM 引用，用于自动滚动定位
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 选中注释时自动滚动到对应卡片
  useEffect(() => {
    if (selectedAnnotationId) {
      const el = cardRefs.current.get(selectedAnnotationId);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    }
  }, [selectedAnnotationId]);

  // 选中注释时自动展开并进入编辑
  if (
    selectedAnnotationId &&
    selectedAnnotationId !== expandedId &&
    annotations.some((a) => a.id === selectedAnnotationId)
  ) {
    setExpandedId(selectedAnnotationId);
    setEditingId(selectedAnnotationId);
  }

  const handleDelete = (id: string) => {
    setDeleteAnnotId(id);
  };

  const confirmDelete = async () => {
    if (!deleteAnnotId) return;
    const id = deleteAnnotId;
    await deleteAnnotation(id);
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) setEditingId(null);
    setDeleteAnnotId(null);
  };

  const handleCardClick = (annot: Annotation) => {
    selectAnnotation(annot.id);
    setExpandedId(annot.id);
    setEditingId(annot.id);
  };

  // 处理粘贴图片
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent, annotId: string) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          setUploadingId(annotId);
          try {
            const result = await uploadImage(file);
            const annot = allAnnotations.find((a) => a.id === annotId);
            if (annot) {
              const newContent = annot.contentMarkdown + makeMarkdownImage(result);
              updateAnnotation(annotId, { contentMarkdown: newContent });
            }
          } catch (err) {
            console.error("图片上传失败:", err);
            alert("图片上传失败");
          } finally {
            setUploadingId(null);
          }
          break;
        }
      }
    },
    [allAnnotations, updateAnnotation]
  );

  // 处理拖拽图片
  const handleDrop = useCallback(
    async (e: React.DragEvent, annotId: string) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      e.preventDefault();
      setUploadingId(annotId);

      try {
        const annot = allAnnotations.find((a) => a.id === annotId);
        if (!annot) return;

        let newContent = annot.contentMarkdown;
        for (const file of imageFiles) {
          const result = await uploadImage(file);
          newContent += makeMarkdownImage(result);
        }
        updateAnnotation(annotId, { contentMarkdown: newContent });
      } catch (err) {
        console.error("图片上传失败:", err);
        alert("图片上传失败");
      } finally {
        setUploadingId(null);
      }
    },
    [allAnnotations, updateAnnotation]
  );

  // 处理 Wiki 链接点击
  const handleWikiLinkClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest(".wiki-link") as HTMLElement | null;
    if (!link) return;

    e.preventDefault();
    e.stopPropagation();

    const wikiTarget = link.dataset.wikiTarget;
    const wikiAnchor = link.dataset.wikiAnchor;
    const wikiAnchorType = link.dataset.wikiAnchorType;

    if (!wikiTarget) return;

    const targetTitle = decodeURIComponent(wikiTarget);
    let lineNumber: number | undefined;

    if (wikiAnchor && wikiAnchorType === "line") {
      const n = parseInt(decodeURIComponent(wikiAnchor), 10);
      if (!isNaN(n)) lineNumber = n;
    }
    // 注：heading 类型暂通过行号匹配，后续可支持按标题文本查找

    const success = navigateToSnippet(targetTitle, lineNumber);
    if (!success) {
      // 链接不存在时的视觉反馈
      link.classList.add("missing");
      setTimeout(() => link.classList.remove("missing"), 1500);
    }
  }, [navigateToSnippet]);

  // 渲染 Markdown（带图片尺寸语法 + mermaid 支持 + Wiki 链接）
  const MarkdownPreview = ({ markdown, annotId }: { markdown: string; annotId: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const html = useMemo(() => renderMarkdown(markdown), [markdown]);

    useEffect(() => {
      if (containerRef.current) {
        const timer = setTimeout(() => {
          if (containerRef.current) {
            renderMermaidInContainer(containerRef.current);
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [html, annotId]);

    return (
      <div
        ref={containerRef}
        className="markdown-body text-sm select-text"
        style={{ userSelect: "text" }}
        onClick={handleWikiLinkClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  const getLineRange = (annot: Annotation) => {
    if (!snippet) return "";
    const startLine = offsetToLine(snippet.content, annot.startOffset);
    const endLine = offsetToLine(snippet.content, annot.endOffset);
    if (startLine === endLine) return `L${startLine}`;
    return `L${startLine}-L${endLine}`;
  };

  if (!snippet) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <p className="text-sm">选择代码片段查看注释</p>
      </div>
    );
  }

  // 渲染注释编辑区（可复用在面板和弹窗中）
  // 注意：此函数内不使用 hooks，因为它在 map 中被调用
  const renderAnnotationEditor = (annot: Annotation, isPopup = false) => {
    return (
      <div className="border-t border-slate-100">
        {/* 编辑模式切换 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setEditMode("edit")}
              className={`px-2 py-1 text-xs rounded ${
                editMode === "edit"
                  ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Code size={12} className="inline mr-1" />
              编辑
            </button>
            <button
              onClick={() => setEditMode("split")}
              className={`px-2 py-1 text-xs rounded ${
                editMode === "split"
                  ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Edit3 size={12} className="inline mr-1" />
              分屏
            </button>
            <button
              onClick={() => setEditMode("preview")}
              className={`px-2 py-1 text-xs rounded ${
                editMode === "preview"
                  ? "bg-white text-slate-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Eye size={12} className="inline mr-1" />
              预览
            </button>
          </div>
          <div className="flex items-center gap-1">
            {isPopup && (
              <span className="text-xs text-slate-400 mr-2">
                Alt+滚轮缩放图片
              </span>
            )}
            <button
              onClick={() => handleDelete(annot.id)}
              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded"
              title="删除注释"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* 正文编辑区域 - 自适应高度 */}
        <div
          className={`${
            editMode === "split" ? "grid grid-cols-2 min-h-[240px]" : "min-h-[200px]"
          }`}
        >
          {(editMode === "edit" || editMode === "split") && (
            <div
              className={
                editMode === "split"
                  ? "border-r border-slate-100 relative h-full flex flex-col"
                  : "relative h-full flex flex-col"
              }
            >
              <textarea
                value={annot.contentMarkdown}
                onChange={(e) =>
                  updateAnnotation(annot.id, {
                    contentMarkdown: e.target.value,
                  })
                }
                onPaste={(e) => handlePaste(e, annot.id)}
                onDrop={(e) => handleDrop(e, annot.id)}
                onDragOver={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  const ta = e.currentTarget;
                  const sel = { start: ta.selectionStart, end: ta.selectionEnd };
                  const results = [
                    handleMarkdownShortcut(e, annot.contentMarkdown, sel),
                    handleTabKey(e, annot.contentMarkdown, sel),
                    handleEnterKey(e, annot.contentMarkdown, sel),
                  ];
                  for (const result of results) {
                    if (result.handled && result.text !== undefined) {
                      updateAnnotation(annot.id, { contentMarkdown: result.text });
                      requestAnimationFrame(() => {
                        if (result.selection) {
                          ta.setSelectionRange(result.selection.start, result.selection.end);
                        }
                      });
                      break;
                    }
                  }
                }}
                className="flex-1 w-full min-h-[200px] p-3 bg-white text-sm font-mono text-slate-700 resize-y outline-none"
                placeholder="用 Markdown 编写注释...&#10;可直接粘贴截图或拖拽图片上传"
              />
              {uploadingId === annot.id && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    上传中...
                  </div>
                </div>
              )}
              {/* 粘贴图片提示 */}
              <div className="absolute bottom-2 right-2 text-xs text-slate-400 pointer-events-none">
                <ImageIcon size={12} className="inline mr-1" />
                粘贴/拖拽图片
              </div>
            </div>
          )}
          {(editMode === "preview" || editMode === "split") && (
            <div className="p-3 min-h-[200px] h-full bg-slate-50/30 overflow-y-auto">
              <MarkdownPreview markdown={annot.contentMarkdown} annotId={annot.id} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-slate-500" />
          <span className="font-semibold text-sm text-slate-700">注释</span>
          <span className="text-xs px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded-full font-medium">
            {annotations.length}
          </span>
        </div>
        <button
          onClick={toggleRightPanel}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="隐藏注释栏 (Alt+/)"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* 注释列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {annotations.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare
              size={32}
              className="mx-auto mb-2 opacity-50"
            />
            <p className="text-sm">暂无注释</p>
            <p className="text-xs mt-1">选中代码后点击"添加注释"</p>
          </div>
        ) : (
          annotations.map((annot) => (
            <div
              key={annot.id}
              ref={(el) => {
                if (el) cardRefs.current.set(annot.id, el);
                else cardRefs.current.delete(annot.id);
              }}
              className={`rounded-lg border transition-all cursor-pointer ${
                selectedAnnotationId === annot.id
                  ? "border-primary-300 bg-primary-50/50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() => handleCardClick(annot)}
            >
              {/* 卡片头部 */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ANNOTATION_COLOR_MAP[annot.color]}`}
                  />
                  <input
                    value={annot.title}
                    onChange={(e) =>
                      updateAnnotation(annot.id, { title: e.target.value })
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-sm text-slate-700 flex-1 min-w-0 bg-transparent border-none outline-none hover:bg-slate-50 focus:bg-slate-50 rounded px-1 py-0.5"
                    placeholder="注释标题"
                  />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-slate-400 font-mono">
                    {getLineRange(annot)}
                  </span>
                  {/* 弹窗放大按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopupAnnotId(annot.id);
                      setPopupEditMode("preview");
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                    title="放大查看"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === annot.id ? null : annot.id);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400"
                  >
                    {expandedId === annot.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* 预览（折叠状态） */}
              {expandedId !== annot.id && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {annot.contentMarkdown.replace(/[#*`>\[\]]/g, "").slice(0, 80)}
                    {annot.contentMarkdown.length > 80 ? "..." : ""}
                  </p>
                </div>
              )}

              {/* 展开内容 */}
              {expandedId === annot.id && renderAnnotationEditor(annot)}
            </div>
          ))
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400">
        <p>选中代码后按 Ctrl+Shift+M 添加注释</p>
      </div>

      {/* 注释放大浮动面板 */}
      <FloatingPanel
        isOpen={!!popupAnnot}
        onClose={() => setPopupAnnotId(null)}
        title={popupAnnot?.title || "注释详情"}
        initialWidth={750}
        initialHeight={550}
      >
        {popupAnnot && (
          <div className="h-full flex flex-col p-4 space-y-3">
            {/* 颜色和行号信息 */}
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${ANNOTATION_COLOR_MAP[popupAnnot.color]}`} />
                代码位置
              </span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                {getLineRange(popupAnnot)}
              </span>
            </div>

            {/* 模式切换 */}
            <div className="flex items-center gap-1 border-b border-slate-100 pb-2 flex-shrink-0">
              <button
                onClick={() => setPopupEditMode("edit")}
                className={`px-3 py-1.5 text-xs rounded-md ${
                  popupEditMode === "edit"
                    ? "bg-primary-50 text-primary-600 font-medium"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Code size={12} className="inline mr-1" />
                编辑
              </button>
              <button
                onClick={() => setPopupEditMode("split")}
                className={`px-3 py-1.5 text-xs rounded-md ${
                  popupEditMode === "split"
                    ? "bg-primary-50 text-primary-600 font-medium"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Edit3 size={12} className="inline mr-1" />
                分屏
              </button>
              <button
                onClick={() => setPopupEditMode("preview")}
                className={`px-3 py-1.5 text-xs rounded-md ${
                  popupEditMode === "preview"
                    ? "bg-primary-50 text-primary-600 font-medium"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Eye size={12} className="inline mr-1" />
                预览
              </button>
              <div className="flex-1" />
              <span className="text-xs text-slate-400 flex items-center gap-1">
                图片尺寸：![描述|宽x高](url)
              </span>
            </div>

            {/* 编辑/预览区域 */}
            <div
              className={`flex-1 overflow-hidden ${
                popupEditMode === "split" ? "grid grid-cols-2 gap-3" : ""
              }`}
            >
              {(popupEditMode === "edit" || popupEditMode === "split") && (
                <div className="relative h-full">
                  <textarea
                    value={popupAnnot.contentMarkdown}
                    onChange={(e) =>
                      updateAnnotation(popupAnnot.id, {
                        contentMarkdown: e.target.value,
                      })
                    }
                    onPaste={(e) => handlePaste(e, popupAnnot.id)}
                    onDrop={(e) => handleDrop(e, popupAnnot.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      const ta = e.currentTarget;
                      const sel = { start: ta.selectionStart, end: ta.selectionEnd };
                      const results = [
                        handleMarkdownShortcut(e, popupAnnot.contentMarkdown, sel),
                        handleTabKey(e, popupAnnot.contentMarkdown, sel),
                        handleEnterKey(e, popupAnnot.contentMarkdown, sel),
                      ];
                      for (const result of results) {
                        if (result.handled && result.text !== undefined) {
                          updateAnnotation(popupAnnot.id, { contentMarkdown: result.text });
                          requestAnimationFrame(() => {
                            if (result.selection) {
                              ta.setSelectionRange(result.selection.start, result.selection.end);
                            }
                          });
                          break;
                        }
                      }
                    }}
                    className="w-full h-full p-3 bg-slate-50 text-sm font-mono text-slate-700 resize-none outline-none rounded-lg border border-slate-200 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
                    placeholder="用 Markdown 编写注释...&#10;可直接粘贴截图或拖拽图片上传&#10;图片尺寸：![描述|宽x高](url)"
                  />
                  {uploadingId === popupAnnot.id && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        图片上传中...
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(popupEditMode === "preview" || popupEditMode === "split") && (
                <div className="h-full overflow-y-auto p-3 bg-white border border-slate-200 rounded-lg">
                  <MarkdownPreview markdown={popupAnnot.contentMarkdown} annotId={popupAnnot.id + "-popup"} />
                </div>
              )}
            </div>
          </div>
        )}
      </FloatingPanel>

      {/* 删除注释确认弹窗 */}
      <ConfirmDialog
        isOpen={!!deleteAnnotId}
        title="删除注释"
        message="确定要删除这条注释吗？此操作不可撤销。"
        confirmText="删除"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteAnnotId(null)}
      />
    </div>
  );
}

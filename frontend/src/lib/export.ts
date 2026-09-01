import type { Snippet, Annotation } from "@/types";
import { renderMarkdown } from "./utils";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 计算注释所在行号
function getAnnotationLine(snippet: Snippet, annot: Annotation): number {
  const beforeText = snippet.content.slice(0, annot.startOffset);
  return beforeText.split("\n").length;
}

// 触发下载
function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// === Markdown 导出 ===
export function exportMarkdown(snippet: Snippet, annotations: Annotation[]): string {
  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.startOffset - b.startOffset
  );

  let md = `# ${snippet.title}\n\n`;
  if (snippet.description) {
    md += `${snippet.description}\n\n`;
  }
  if (snippet.tags && snippet.tags.length > 0) {
    md += `**标签：** ${snippet.tags.join(", ")}\n\n`;
  }
  md += `**语言：** ${snippet.language}\n\n`;
  md += `---\n\n`;
  md += "## 代码\n\n";
  md += "```" + snippet.language + "\n";
  md += snippet.content + "\n";
  md += "```\n\n";

  if (sortedAnnotations.length > 0) {
    md += "---\n\n";
    md += "## 注释\n\n";
    sortedAnnotations.forEach((annot, idx) => {
      const lineNum = getAnnotationLine(snippet, annot);
      const codeSnippet = snippet.content.slice(annot.startOffset, annot.endOffset);
      md += `### ${idx + 1}. ${annot.title || `注释 ${idx + 1}`}（第 ${lineNum} 行）\n\n`;
      md += "```" + snippet.language + "\n";
      md += codeSnippet + "\n";
      md += "```\n\n";
      md += `${annot.contentMarkdown}\n\n`;
      const imgCount = (annot.contentMarkdown.match(/!\[.*?\]/g) || []).length;
      if (imgCount > 0) {
        md += `> 💡 本文档包含 ${imgCount} 张图片，请确保图片可正常加载。\n\n`;
      }
      md += "---\n\n";
    });
  }

  return md;
}

export function downloadMarkdown(snippet: Snippet, annotations: Annotation[]) {
  const content = exportMarkdown(snippet, annotations);
  triggerDownload(content, `${snippet.title}.md`, "text/markdown;charset=utf-8");
}

// === HTML 导出（左右分栏，所见即所得） ===
export function downloadHTML(snippet: Snippet, annotations: Annotation[]) {
  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.startOffset - b.startOffset
  );

  const codeLines = snippet.content.split("\n");

  // 构建注释映射：行号 -> 注释索引列表
  const lineAnnotMap = new Map<number, number[]>();
  sortedAnnotations.forEach((annot, idx) => {
    const lineNum = getAnnotationLine(snippet, annot);
    if (!lineAnnotMap.has(lineNum)) {
      lineAnnotMap.set(lineNum, []);
    }
    lineAnnotMap.get(lineNum)!.push(idx);
  });

  // 构建代码行 HTML
  let codeLinesHTML = "";
  for (let i = 0; i < codeLines.length; i++) {
    const lineNum = i + 1;
    const annotIndices = lineAnnotMap.get(lineNum) || [];
    const hasAnnot = annotIndices.length > 0;
    const annotIds = annotIndices.map((idx) => `annot-${idx}`).join(" ");
    const lineContent = escapeHtml(codeLines[i]) || "&nbsp;";

    codeLinesHTML += `
      <div class="code-line ${hasAnnot ? "has-annotation" : ""}" id="line-${lineNum}" data-annot-ids="${annotIds}">
        <span class="line-number">${lineNum}</span>
        <span class="line-code"><span class="code-text">${lineContent}</span></span>
      </div>
    `;
  }

  // 构建右侧注释列表 HTML
  let annotationsHTML = "";
  sortedAnnotations.forEach((annot, idx) => {
    const lineNum = getAnnotationLine(snippet, annot);
    const codeSnippet = escapeHtml(snippet.content.slice(annot.startOffset, annot.endOffset));
    const contentHTML = renderMarkdown(annot.contentMarkdown);
    const title = escapeHtml(annot.title || `注释 ${idx + 1}`);

    annotationsHTML += `
      <div class="annot-card" id="annot-${idx}" data-line="${lineNum}" onclick="scrollToLine(${lineNum}, ${idx})">
        <div class="annot-card-header">
          <span class="annot-line-badge">第 ${lineNum} 行</span>
          <span class="annot-title" title="${title}">${title}</span>
        </div>
        <div class="annot-code-preview">
          <pre><code class="language-${escapeHtml(snippet.language || "plaintext")}">${codeSnippet}</code></pre>
        </div>
        <div class="annot-content markdown-body">
          ${contentHTML}
        </div>
      </div>
    `;
  });

  const descriptionHTML = snippet.description
    ? renderMarkdown(snippet.description)
    : "";

  const tagsHTML =
    snippet.tags && snippet.tags.length > 0
      ? snippet.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")
      : "";

  const lang = escapeHtml(snippet.language || "plaintext");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(snippet.title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      line-height: 1.6;
      color: #334155;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
    }

    /* 顶部栏 */
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 14px 20px;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 100;
    }
    .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .header-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; opacity: 0.9; flex-wrap: wrap; }
    .header .lang-badge {
      display: inline-block;
      padding: 2px 10px;
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      font-size: 11px;
    }
    .header .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .header .tag {
      padding: 2px 8px;
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
      font-size: 11px;
    }

    /* 描述区 */
    .description {
      padding: 8px 20px;
      color: #64748b;
      font-size: 13px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      max-height: 80px;
      overflow-y: auto;
    }
    .description p { margin: 2px 0; }

    /* 主体布局 - 占满剩余空间 */
    .main-container {
      display: flex;
      flex: 1;
      min-height: 0;
      background: white;
      overflow: hidden;
    }

    /* 左侧代码区 */
    .code-section {
      flex: 1 1 60%;
      min-width: 0;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .code-section-header {
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      flex-shrink: 0;
    }
    .code-block {
      font-family: "Fira Code", "Consolas", "Monaco", monospace;
      font-size: 13px;
      line-height: 1.7;
      background: #282c34;
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
      min-height: 0;
    }
    .code-line {
      display: flex;
      position: relative;
      transition: background 0.15s;
    }
    .code-line:hover { background: rgba(255,255,255,0.04); }
    .code-line.has-annotation {
      background: rgba(99,102,241,0.15);
    }
    .code-line.has-annotation::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: #6366f1;
    }
    .code-line.active {
      background: rgba(99,102,241,0.3) !important;
    }
    .line-number {
      width: 48px;
      flex-shrink: 0;
      padding: 6px 10px;
      text-align: right;
      color: #5c6370;
      user-select: none;
      font-size: 12px;
      border-right: 1px solid #3e4451;
    }
    .line-code {
      flex: 1;
      padding: 6px 14px;
      color: #abb2bf;
      white-space: pre;
    }
    .line-code code { background: transparent !important; padding: 0 !important; }

    /* 右侧注释区 */
    .annotations-section {
      width: 420px;
      flex-shrink: 0;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .annotations-header {
      padding: 10px 16px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      flex-shrink: 0;
    }
    .annotations-header span { color: #6366f1; }
    .annotations-list {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      min-height: 0;
    }

    /* 注释卡片 */
    .annot-card {
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 3px solid #6366f1;
      flex-shrink: 0;
    }
    .annot-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }
    .annot-card.active {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
    }
    .annot-card-header {
      padding: 10px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .annot-line-badge {
      font-size: 11px;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 10px;
      font-weight: 500;
      flex-shrink: 0;
    }
    .annot-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .annot-code-preview {
      background: #282c34;
      font-size: 11px;
      line-height: 1.5;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .annot-code-preview pre {
      margin: 0;
      padding: 8px 12px !important;
      background: transparent !important;
      border-radius: 0 !important;
    }
    .annot-code-preview code {
      font-family: "Fira Code", "Consolas", monospace;
      font-size: 11px !important;
      background: transparent !important;
      color: #abb2bf !important;
      padding: 0 !important;
    }
    .annot-content {
      padding: 12px;
      font-size: 13px;
      color: #374151;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .annot-content p { margin-bottom: 8px; }
    .annot-content p:last-child { margin-bottom: 0; }
    .annot-content pre {
      background: #1e293b;
      padding: 10px 12px;
      border-radius: 6px;
      overflow-x: auto;
      color: #e2e8f0;
      font-size: 12px;
    }
    .annot-content code {
      background: #e0e7ff;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #4338ca;
    }
    .annot-content pre code {
      background: transparent;
      padding: 0;
      color: #e2e8f0;
    }
    .annot-content blockquote {
      border-left: 3px solid #a5b4fc;
      padding-left: 12px;
      color: #6b7280;
      margin: 8px 0;
    }
    .annot-content img { max-width: 100%; border-radius: 6px; }
    .annot-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    .annot-content th, .annot-content td {
      border: 1px solid #c7d2fe;
      padding: 6px 10px;
      text-align: left;
    }
    .annot-content th { background: #e0e7ff; }

    /* Markdown 列表样式 */
    .markdown-body ul { list-style: disc; padding-left: 20px; margin: 8px 0; }
    .markdown-body ol { list-style: decimal; padding-left: 20px; margin: 8px 0; }
    .markdown-body li { margin: 4px 0; }
    .markdown-body h1 { font-size: 20px; margin: 14px 0 8px; color: #1e293b; }
    .markdown-body h2 { font-size: 17px; margin: 12px 0 6px; color: #1e293b; }
    .markdown-body h3 { font-size: 15px; margin: 10px 0 4px; color: #334155; }
    .markdown-body a { color: #6366f1; }
    .markdown-body hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .markdown-body p { margin: 6px 0; }

    /* 页脚 */
    .footer {
      text-align: center;
      padding: 6px 20px;
      font-size: 11px;
      color: #94a3b8;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    /* 隐藏占位用的代码块 */
    #main-code { display: none !important; }

    @media print {
      html, body { height: auto; overflow: visible; }
      .header { box-shadow: none; }
      .code-block { overflow: visible; }
      .annotations-section { max-height: none; }
      .annotations-list { overflow: visible; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(snippet.title)}</h1>
    <div class="header-meta">
      <span class="lang-badge">${lang}</span>
      <span>${sortedAnnotations.length} 条注释</span>
      ${tagsHTML ? `<span class="tags">${tagsHTML}</span>` : ""}
    </div>
  </div>

  ${descriptionHTML ? `<div class="description markdown-body">${descriptionHTML}</div>` : ""}

  <div class="main-container">
    <!-- 左侧代码 -->
    <div class="code-section">
      <div class="code-section-header">代码</div>
      <div class="code-block">
        <pre><code class="language-${lang}" id="main-code">${escapeHtml(snippet.content)}</code></pre>
        <div id="code-lines">
          ${codeLinesHTML}
        </div>
      </div>
    </div>

    <!-- 右侧注释 -->
    <div class="annotations-section">
      <div class="annotations-header">
        注释列表 <span>(${sortedAnnotations.length})</span>
      </div>
      <div class="annotations-list">
        ${annotationsHTML || '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">暂无注释</div>'}
      </div>
    </div>
  </div>

  <div class="footer">由 CodeNote 生成 · ${new Date().toLocaleDateString("zh-CN")}</div>

  <script>
    // 代码高亮
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof hljs !== 'undefined') {
        // 高亮主代码块
        var mainCode = document.getElementById('main-code');
        if (mainCode) {
          try {
            hljs.highlightElement(mainCode);
          } catch(e) {
            // 高亮失败时保持原样
          }
          // 将高亮后的内容按行分配到 code-lines 中的每一行
          var highlightedHtml = mainCode.innerHTML;
          var lines = highlightedHtml.split('\\n');
          var lineSpans = document.querySelectorAll('.line-code .code-text');
          lines.forEach(function(line, i) {
            if (lineSpans[i]) {
              lineSpans[i].innerHTML = line || '&nbsp;';
            }
          });
        }
        // 高亮注释中的代码预览
        document.querySelectorAll('.annot-code-preview pre code').forEach(function(block) {
          try { hljs.highlightElement(block); } catch(e) {}
        });
      }

      // 绑定代码行点击事件
      document.querySelectorAll('.code-line.has-annotation').forEach(function(lineEl) {
        lineEl.style.cursor = 'pointer';
        lineEl.addEventListener('click', function() {
          var annotIds = this.getAttribute('data-annot-ids');
          if (!annotIds) return;

          document.querySelectorAll('.code-line').forEach(function(el) {
            el.classList.remove('active');
          });
          this.classList.add('active');

          var firstId = annotIds.split(' ')[0];
          var annotEl = document.getElementById(firstId);
          if (annotEl) {
            document.querySelectorAll('.annot-card').forEach(function(el) {
              el.classList.remove('active');
            });
            annotEl.classList.add('active');
            // 滚动到可视区域
            var listEl = document.querySelector('.annotations-list');
            if (listEl) {
              var listRect = listEl.getBoundingClientRect();
              var annotRect = annotEl.getBoundingClientRect();
              if (annotRect.top < listRect.top || annotRect.bottom > listRect.bottom) {
                annotEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          }
        });
      });
    });

    // 点击注释跳转到对应代码行
    function scrollToLine(lineNum, annotIdx) {
      document.querySelectorAll('.code-line').forEach(function(el) {
        el.classList.remove('active');
      });
      var lineEl = document.getElementById('line-' + lineNum);
      if (lineEl) {
        lineEl.classList.add('active');
        var codeBlock = document.querySelector('.code-block');
        if (codeBlock) {
          var blockRect = codeBlock.getBoundingClientRect();
          var lineRect = lineEl.getBoundingClientRect();
          if (lineRect.top < blockRect.top || lineRect.bottom > blockRect.bottom) {
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }

      document.querySelectorAll('.annot-card').forEach(function(el) {
        el.classList.remove('active');
      });
      var annotEl = document.getElementById('annot-' + annotIdx);
      if (annotEl) {
        annotEl.classList.add('active');
      }
    }
  </script>
</body>
</html>`;

  triggerDownload(html, `${snippet.title}.html`, "text/html;charset=utf-8");
}

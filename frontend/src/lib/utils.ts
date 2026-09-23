import { marked } from "marked";
import hljs from "highlight.js";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "Inter, system-ui, sans-serif",
});

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

// 自定义渲染器，为代码块添加高亮 + mermaid 支持 + 图片尺寸支持
const renderer = new marked.Renderer();
let mermaidCounter = 0;

renderer.code = function (code: string, infostring: string | undefined): string {
  const lang = (infostring || "").trim().toLowerCase();

  // Mermaid 图表
  if (lang === "mermaid") {
    const id = `mermaid-${Date.now()}-${mermaidCounter++}`;
    // 用 pre 标签包裹，标记 mermaid 类，前端再用 JS 渲染
    return `<pre class="mermaid-diagram" id="${id}"><code class="language-mermaid">${escapeHtml(code)}</code></pre>`;
  }

  // 代码高亮
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

// 图片渲染：支持 ![alt|宽x高](url) 语法
renderer.image = function (
  href: string | null,
  title: string | null,
  text: string
): string {
  const url = href || "";
  let alt = text || "";
  let width: string | null = null;
  let height: string | null = null;

  // 解析 alt 中的尺寸语法：![描述|800x600](url)
  const sizeMatch = alt.match(/^(.*?)\|(\d+)x(\d+)$/);
  if (sizeMatch) {
    alt = sizeMatch[1];
    width = sizeMatch[2] + "px";
    height = sizeMatch[3] + "px";
  } else {
    // 也支持 ![描述|800](url) 只指定宽度
    const widthMatch = alt.match(/^(.*?)\|(\d+)$/);
    if (widthMatch) {
      alt = widthMatch[1];
      width = widthMatch[2] + "px";
    }
  }

  const styleParts: string[] = [];
  if (width) styleParts.push(`width: ${width}`);
  if (height) styleParts.push(`height: ${height}`);
  const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join("; ")}"` : "";
  const titleAttr = title ? ` title="${title}"` : "";
  const altAttr = alt ? ` alt="${alt}"` : "";

  return `<img src="${url}"${altAttr}${titleAttr}${styleAttr} class="md-image" />`;
};

marked.use({ renderer });

// HTML 转义
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// KaTeX 宏定义：确保常见 LaTeX 命令可用
const KATEX_MACROS = {
  "\\implies": "\\;\\Longrightarrow\\;",
  "\\impliedby": "\\;\\Longleftarrow\\;",
  "\\to": "\\rightarrow",
  "\\gets": "\\leftarrow",
  "\\iff": "\\;\\Longleftrightarrow\\;",
  "\\square": "\\square",
  "\\blacksquare": "\\blacksquare",
};

/**
 * 渲染 LaTeX 数学公式 + Wiki 链接 + Markdown
 * 统一的占位符机制，避免多次解析
 */
function renderMarkdownCore(markdown: string): string {
  const placeholders: string[] = [];
  const makeKey = (id: number) => `<!--PH${id}-->`;

  let result = markdown;

  // ============== 第一步：Wiki 链接 ==============
  result = result.replace(
    /\[\[([^\]\n]+?)\]\]/g,
    (match, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return match;

      // 分离别名： target|alias
      let alias: string | null = null;
      const pipeIdx = trimmed.indexOf("|");
      let target = trimmed;
      if (pipeIdx > 0) {
        target = trimmed.substring(0, pipeIdx).trim();
        alias = trimmed.substring(pipeIdx + 1).trim();
      }

      // 解析目标：文件#标题 或 文件^行号
      let fileName = target;
      let anchor = "";
      let anchorType: "heading" | "line" | null = null;

      const hashIdx = target.indexOf("#");
      const caretIdx = target.indexOf("^");

      if (hashIdx > 0) {
        fileName = target.substring(0, hashIdx).trim();
        anchor = target.substring(hashIdx + 1).trim();
        anchorType = "heading";
      } else if (caretIdx > 0) {
        fileName = target.substring(0, caretIdx).trim();
        anchor = target.substring(caretIdx + 1).trim();
        anchorType = "line";
      }

      const displayText = alias || fileName;
      const dataTarget = encodeURIComponent(fileName);
      const dataAnchor = anchor ? encodeURIComponent(anchor) : "";
      const dataAnchorType = anchorType || "";

      const html = `<a class="wiki-link" href="javascript:void(0)" 
        data-wiki-target="${dataTarget}"
        data-wiki-anchor="${dataAnchor}"
        data-wiki-anchor-type="${dataAnchorType}"
      ><span class="wiki-link-alias">${escapeHtml(displayText)}</span>${
        anchor
          ? `<span class="wiki-link-target">${anchorType === "line" ? "^" : "#"}${escapeHtml(anchor)}</span>`
          : ""
      }</a>`;

      const id = placeholders.length;
      placeholders.push(html);
      return makeKey(id);
    }
  );

  // ============== 第二步：块级公式 $$...$$ ==============
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const trimmed = math.trim();
    if (!trimmed) return match;
    try {
      const html = katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: KATEX_MACROS,
      });
      const id = placeholders.length;
      placeholders.push(`<div class="math-block">${html}</div>`);
      return `\n\n${makeKey(id)}\n\n`;
    } catch {
      return match;
    }
  });

  // ============== 第三步：行内公式 $...$ ==============
  // 注意：使用 (?![{]) 排除 JavaScript 模板字符串 ${...} 模式，避免误匹配
  result = result.replace(/(?<!\\)\$(?![{])([^\$\s][^\$\n]*?[^\$\s])\$/g, (match, math) => {
    if (!math.trim()) return match;
    try {
      const html = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: KATEX_MACROS,
      });
      const id = placeholders.length;
      placeholders.push(`<span class="math-inline">${html}</span>`);
      return makeKey(id);
    } catch {
      return match;
    }
  });

  // ============== 第四步：渲染 Markdown ==============
  let html = "";
  try {
    html = marked.parse(result) as string;
  } catch {
    html = `<p>${result}</p>`;
  }

  // ============== 第五步：还原所有占位符 ==============
  placeholders.forEach((phHtml, id) => {
    const key = makeKey(id);
    const pWrapped = `<p>${key}</p>`;
    if (html.includes(pWrapped)) {
      html = html.split(pWrapped).join(phHtml);
    } else {
      html = html.split(key).join(phHtml);
    }
  });

  return html;
}

/**
 * 渲染 Mermaid 图表
 * 在 Markdown 渲染后，找到 .mermaid-diagram 元素并渲染
 * 渲染后将原始代码保存在 data-mermaid-code 属性中，以便后续重新渲染
 */
export function renderMermaidInContainer(container: HTMLElement) {
  const diagrams = container.querySelectorAll(".mermaid-diagram");
  if (diagrams.length === 0) return;

  diagrams.forEach(async (el, index) => {
    const codeEl = el.querySelector("code");
    if (!codeEl) return;
    const code = codeEl.textContent || "";
    const id = `mermaid-svg-${Date.now()}-${index}`;
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-container";
      wrapper.setAttribute("data-mermaid-code", encodeURIComponent(code));
      wrapper.innerHTML = svg;
      el.replaceWith(wrapper);
      initMermaidViewer(wrapper);
    } catch (err) {
      console.error("Mermaid render error:", err);
      el.outerHTML = `<div class="mermaid-error" style="color:#ef4444;padding:1em;background:#fef2f2;border-radius:6px;">
        <strong>Mermaid 渲染失败</strong><br/>
        <pre style="margin-top:0.5em;font-size:0.85em;white-space:pre-wrap;">${escapeHtml(String(err))}</pre>
      </div>`;
    }
  });
}

/**
 * 重新渲染已有的 Mermaid 图表
 * 找到 .mermaid-container[data-mermaid-code] 元素并重新渲染
 * 用于窗口大小变化时重新适配
 */
export function rerenderMermaidInContainer(container: HTMLElement) {
  const rendered = container.querySelectorAll(".mermaid-container[data-mermaid-code]");
  if (rendered.length === 0) {
    // 没有已渲染的，检查是否有未渲染的
    renderMermaidInContainer(container);
    return;
  }

  rendered.forEach(async (el, index) => {
    const code = decodeURIComponent(el.getAttribute("data-mermaid-code") || "");
    if (!code) return;
    const id = `mermaid-svg-${Date.now()}-${index}`;
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      initMermaidViewer(el as HTMLElement);
    } catch (err) {
      console.error("Mermaid re-render error:", err);
    }
  });
}

/**
 * 将 Markdown 渲染为 HTML
 * 支持数学公式、Mermaid、Wiki 链接等扩展语法
 */
export function renderMarkdown(markdown: string): string {
  try {
    return renderMarkdownCore(markdown);
  } catch (e) {
    console.error("Markdown render error:", e);
    return `<p>${markdown}</p>`;
  }
}

/**
 * 支持的语言列表
 */
export const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript", mode: "javascript" },
  { value: "typescript", label: "TypeScript", mode: "typescript" },
  { value: "solidity", label: "Solidity", mode: "javascript" },
  { value: "python", label: "Python", mode: "python" },
  { value: "java", label: "Java", mode: "java" },
  { value: "rust", label: "Rust", mode: "rust" },
  { value: "go", label: "Go", mode: "go" },
  { value: "css", label: "CSS", mode: "css" },
  { value: "html", label: "HTML", mode: "html" },
  { value: "json", label: "JSON", mode: "json" },
  { value: "sql", label: "SQL", mode: "sql" },
  { value: "markdown", label: "Markdown", mode: "markdown" },
  { value: "xml", label: "XML", mode: "xml" },
  { value: "bash", label: "Bash", mode: "shell" },
  { value: "powershell", label: "PowerShell", mode: "powershell" },
  { value: "yaml", label: "YAML", mode: "yaml" },
];

/**
 * 获取语言的显示名称
 */
export function getLanguageLabel(value: string): string {
  const lang = LANGUAGE_OPTIONS.find((l) => l.value === value);
  return lang?.label || value;
}

/**
 * 根据偏移量计算行号（从 1 开始）
 */
export function offsetToLine(content: string, offset: number): number {
  const sub = content.slice(0, Math.min(offset, content.length));
  return sub.split("\n").length;
}

/**
 * 构建分类树
 */
export function buildCategoryTree(
  categories: any[],
  parentId: string | null = null
): any[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      ...c,
      children: buildCategoryTree(categories, c.id),
    }));
}

/**
 * 获取分类的所有后代 ID
 */
export function getCategoryDescendants(
  categories: any[],
  id: string
): string[] {
  const result: string[] = [];
  const collect = (parentId: string) => {
    categories
      .filter((c) => c.parentId === parentId)
      .forEach((c) => {
        result.push(c.id);
        collect(c.id);
      });
  };
  collect(id);
  return result;
}

// ===== Mermaid Viewer 交互控件 =====

function initMermaidViewer(container: HTMLElement) {
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;
  if (container.querySelector(".mermaid-toolbar")) return; // 防止重复初始化
  const svg = svgEl as SVGElement & { style: CSSStyleDeclaration };

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 5;

  // 设置 SVG 可变换
  svg.style.transformOrigin = "center center";
  svg.style.transition = "transform 0.15s ease-out";
  svg.style.cursor = "grab";

  function updateTransform() {
    svg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    const label = container.querySelector(".mermaid-zoom-label");
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
  }

  // 工具栏（右上角）
  const toolbar = document.createElement("div");
  toolbar.className = "mermaid-toolbar";
  toolbar.innerHTML = `
    <button class="mermaid-btn" title="复制图片" data-action="copy">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    </button>
    <button class="mermaid-btn" title="放大" data-action="zoomin">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <button class="mermaid-btn" title="缩小" data-action="zoomout">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <button class="mermaid-btn" title="重置" data-action="reset">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    </button>
    <button class="mermaid-btn" title="最大化" data-action="fullscreen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
    </button>
    <button class="mermaid-btn" title="下载 SVG" data-action="download">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
  `;
  container.appendChild(toolbar);

  // 底部缩放控制条
  const zoomBar = document.createElement("div");
  zoomBar.className = "mermaid-zoom-bar";
  zoomBar.innerHTML = `
    <button class="mermaid-zoom-btn" title="缩小" data-action="zoomout">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <span class="mermaid-zoom-label">100%</span>
    <button class="mermaid-zoom-btn" title="放大" data-action="zoomin">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <span class="mermaid-zoom-divider"></span>
    <button class="mermaid-zoom-btn" title="重置" data-action="reset">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    </button>
    <button class="mermaid-zoom-btn" title="最大化" data-action="fullscreen">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
    </button>
  `;
  container.appendChild(zoomBar);

  function setScale(newScale: number) {
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    updateTransform();
  }

  function reset() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  }

  function openFullscreen() {
    const overlay = document.createElement("div");
    overlay.className = "mermaid-fullscreen-overlay";

    const closeBtn = document.createElement("button");
    closeBtn.className = "mermaid-fullscreen-close";
    closeBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    `;
    overlay.appendChild(closeBtn);

    const content = document.createElement("div");
    content.className = "mermaid-fullscreen-content";

    const svgClone = svg.cloneNode(true) as SVGElement;
    svgClone.style.maxWidth = "none";
    svgClone.style.width = "";
    svgClone.style.height = "";
    svgClone.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    svgClone.style.transformOrigin = "center center";
    svgClone.style.transition = "transform 0.15s ease-out";
    svgClone.style.cursor = "grab";
    content.appendChild(svgClone);
    overlay.appendChild(content);

    // 全屏中的缩放控制
    const fsZoomBar = document.createElement("div");
    fsZoomBar.className = "mermaid-zoom-bar mermaid-zoom-bar-fs";
    fsZoomBar.innerHTML = `
      <button class="mermaid-zoom-btn" title="缩小" data-action="zoomout"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
      <span class="mermaid-zoom-label">${Math.round(scale * 100)}%</span>
      <button class="mermaid-zoom-btn" title="放大" data-action="zoomin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
      <span class="mermaid-zoom-divider"></span>
      <button class="mermaid-zoom-btn" title="重置" data-action="reset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
    `;
    overlay.appendChild(fsZoomBar);

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    let fsScale = scale;
    let fsOffsetX = offsetX;
    let fsOffsetY = offsetY;
    let fsIsDragging = false;
    let fsStartX = 0;
    let fsStartY = 0;
    let fsStartOffsetX = 0;
    let fsStartOffsetY = 0;

    function updateFsTransform() {
      svgClone.style.transform = `translate(${fsOffsetX}px, ${fsOffsetY}px) scale(${fsScale})`;
      const label = fsZoomBar.querySelector(".mermaid-zoom-label");
      if (label) label.textContent = `${Math.round(fsScale * 100)}%`;
    }

    fsZoomBar.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "zoomin") fsScale = Math.min(MAX_SCALE, fsScale + 0.2);
      else if (action === "zoomout") fsScale = Math.max(MIN_SCALE, fsScale - 0.2);
      else if (action === "reset") { fsScale = 1; fsOffsetX = 0; fsOffsetY = 0; }
      updateFsTransform();
    });

    overlay.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      fsScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fsScale + delta));
      updateFsTransform();
    }, { passive: false });

    svgClone.addEventListener("mousedown", (e) => {
      fsIsDragging = true;
      fsStartX = e.clientX;
      fsStartY = e.clientY;
      fsStartOffsetX = fsOffsetX;
      fsStartOffsetY = fsOffsetY;
      svgClone.style.cursor = "grabbing";
      e.preventDefault();
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!fsIsDragging) return;
      fsOffsetX = fsStartOffsetX + (e.clientX - fsStartX);
      fsOffsetY = fsStartOffsetY + (e.clientY - fsStartY);
      updateFsTransform();
    });

    overlay.addEventListener("mouseup", () => {
      fsIsDragging = false;
      svgClone.style.cursor = "grab";
    });

    overlay.addEventListener("dblclick", () => {
      fsScale = 1;
      fsOffsetX = 0;
      fsOffsetY = 0;
      updateFsTransform();
    });

    const closeHandler = () => {
      overlay.remove();
      document.body.style.overflow = "";
    };
    closeBtn.addEventListener("click", closeHandler);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeHandler();
    });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        closeHandler();
        document.removeEventListener("keydown", escHandler);
      }
    });
  }

  function downloadSvg() {
    const svgData = new XMLSerializer().serializeToString(svg as Node);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySvg() {
    try {
      const svgData = new XMLSerializer().serializeToString(svg as Node);
      await navigator.clipboard.writeText(svgData);
    } catch {}
  }

  // 事件委托：工具栏 + 缩放条
  const onClick = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === "zoomin") setScale(scale + 0.2);
    else if (action === "zoomout") setScale(scale - 0.2);
    else if (action === "reset") reset();
    else if (action === "fullscreen") openFullscreen();
    else if (action === "download") downloadSvg();
    else if (action === "copy") copySvg();
  };
  toolbar.addEventListener("click", onClick);
  zoomBar.addEventListener("click", onClick);

  // 滚轮缩放
  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(scale + delta);
  }, { passive: false });

  // 拖拽平移
  svgEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    svg.style.cursor = "grabbing";
    svg.style.transition = "none";
    e.preventDefault();
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    offsetX = startOffsetX + (e.clientX - startX);
    offsetY = startOffsetY + (e.clientY - startY);
    updateTransform();
  });

  container.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    svg.style.cursor = "grab";
    svg.style.transition = "transform 0.15s ease-out";
  });

  container.addEventListener("mouseleave", () => {
    if (!isDragging) return;
    isDragging = false;
    svg.style.cursor = "grab";
    svg.style.transition = "transform 0.15s ease-out";
  });

  // 双击重置
  svgEl.addEventListener("dblclick", (e) => {
    e.preventDefault();
    reset();
  });
}

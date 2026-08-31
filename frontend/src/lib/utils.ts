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
 * 渲染 LaTeX 数学公式
 * 支持 $...$ 行内公式 和 $$...$$ 块级公式
 */
function renderMath(markdown: string): string {
  const placeholders: string[] = [];
  // 使用不会被 Markdown 解析的占位符（HTML 注释形式）
  const makeKey = (id: number) => `<!--MATH${id}-->`;

  // 先处理块级公式 $$...$$（匹配多行，非贪婪）
  let result = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
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
      // 块级公式前后加空行，确保 Markdown 独立成段
      return `\n\n${makeKey(id)}\n\n`;
    } catch {
      return match;
    }
  });

  // 再处理行内公式 $...$
  // 规则：$ 后不能是空格/换行，$ 前不能是反斜杠，中间不能有换行
  result = result.replace(/(?<!\\)\$([^\$\s][^\$\n]*?[^\$\s])\$/g, (match, math) => {
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

  // 渲染 Markdown
  let html = "";
  try {
    html = marked.parse(result) as string;
  } catch {
    html = `<p>${result}</p>`;
  }

  // 替换回数学公式占位符（HTML 注释不会被 Markdown 修改）
  placeholders.forEach((mathHtml, id) => {
    const key = makeKey(id);
    // marked 可能会给块级占位符套 <p> 标签
    const pWrapped = `<p>${key}</p>`;
    if (html.includes(pWrapped)) {
      html = html.split(pWrapped).join(mathHtml);
    } else {
      html = html.split(key).join(mathHtml);
    }
  });

  return html;
}

/**
 * 渲染 Mermaid 图表
 * 在 Markdown 渲染后，找到 .mermaid-diagram 元素并渲染
 */
export function renderMermaidInContainer(container: HTMLElement) {
  const diagrams = container.querySelectorAll(".mermaid-diagram");
  diagrams.forEach(async (el, index) => {
    const codeEl = el.querySelector("code");
    if (!codeEl) return;
    const code = codeEl.textContent || "";
    const id = `mermaid-svg-${Date.now()}-${index}`;
    try {
      const { svg } = await mermaid.render(id, code);
      el.outerHTML = `<div class="mermaid-container">${svg}</div>`;
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
 * 将 Markdown 渲染为 HTML
 */
export function renderMarkdown(markdown: string): string {
  try {
    return renderMath(markdown);
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

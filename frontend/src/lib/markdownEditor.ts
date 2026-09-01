import type React from "react";
import { fileApi } from "@/lib/api";

// 统一的图片上传函数
export async function uploadImage(
  file: File
): Promise<{ url: string; width: number; height: number; name: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = async () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);

        try {
          const result = await fileApi.upload(file);
          resolve({
            url: result.url,
            width,
            height,
            name: result.name || file.name,
          });
        } catch (err) {
          console.warn("图片上传失败，使用 base64:", err);
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              url: reader.result as string,
              width,
              height,
              name: file.name,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片加载失败"));
      };
      img.src = objectUrl;
    } catch (err) {
      reject(err);
    }
  });
}

// 生成 Markdown 图片语法
export function makeMarkdownImage(
  result: { url: string; width: number; height: number; name: string }
): string {
  const w = Math.round(result.width * 0.6);
  const h = Math.round(result.height * 0.6);
  return `\n![${result.name}|${w}x${h}](${result.url})\n`;
}

// 处理 textarea 的粘贴图片事件
export async function handleImagePaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  getText: () => string,
  setText: (text: string) => void
): Promise<boolean> {
  const items = e.clipboardData?.items;
  if (!items) return false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;

      try {
        const result = await uploadImage(file);
        const mdImage = makeMarkdownImage(result);
        const newText = getText() + mdImage;
        setText(newText);
      } catch (err) {
        console.error("图片上传失败:", err);
        alert("图片上传失败");
      }
      return true;
    }
  }
  return false;
}

// 处理 textarea 的拖拽图片事件
export async function handleImageDrop(
  e: React.DragEvent<HTMLTextAreaElement>,
  getText: () => string,
  setText: (text: string) => void
): Promise<boolean> {
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return false;

  const imageFiles = Array.from(files).filter((f) =>
    f.type.startsWith("image/")
  );
  if (imageFiles.length === 0) return false;

  e.preventDefault();

  try {
    let newText = getText();
    for (const file of imageFiles) {
      const result = await uploadImage(file);
      newText += makeMarkdownImage(result);
    }
    setText(newText);
  } catch (err) {
    console.error("图片上传失败:", err);
    alert("图片上传失败");
  }
  return true;
}

// === Typora 风格快捷键 ===

interface TextSelection {
  start: number;
  end: number;
}

// 在选区两侧包裹文本
function wrapSelection(
  text: string,
  selection: TextSelection,
  before: string,
  after: string = before
): { text: string; selection: TextSelection } {
  const selected = text.slice(selection.start, selection.end);
  const newText =
    text.slice(0, selection.start) +
    before +
    selected +
    after +
    text.slice(selection.end);
  return {
    text: newText,
    selection: {
      start: selection.start + before.length,
      end: selection.end + before.length,
    },
  };
}

// 给行首添加前缀
function prefixLine(
  text: string,
  selection: TextSelection,
  prefix: string,
  toggle: boolean = true
): { text: string; selection: TextSelection } {
  // 找到选区涉及的行
  const before = text.slice(0, selection.start);
  const lineStart = before.lastIndexOf("\n") + 1;

  const selected = text.slice(lineStart, selection.end);
  const hasPrefix = selected.startsWith(prefix);

  let newText: string;
  if (hasPrefix && toggle) {
    // 移除前缀
    newText =
      text.slice(0, lineStart) +
      selected.slice(prefix.length) +
      text.slice(selection.end);
    return {
      text: newText,
      selection: {
        start: selection.start - prefix.length,
        end: selection.end - prefix.length,
      },
    };
  } else {
    // 添加前缀
    newText =
      text.slice(0, lineStart) + prefix + selected + text.slice(selection.end);
    return {
      text: newText,
      selection: {
        start: selection.start + prefix.length,
        end: selection.end + prefix.length,
      },
    };
  }
}

// 设置行首为指定标题级别
function setHeading(
  text: string,
  selection: TextSelection,
  level: number
): { text: string; selection: TextSelection } {
  const before = text.slice(0, selection.start);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = text.indexOf("\n", selection.end);
  const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;

  const lineContent = text.slice(lineStart, actualLineEnd);
  // 移除已有标题前缀
  const cleaned = lineContent.replace(/^#{1,6}\s*/, "");
  const prefix = level > 0 ? "#".repeat(level) + " " : "";

  const newText =
    text.slice(0, lineStart) + prefix + cleaned + text.slice(actualLineEnd);

  const offset = prefix.length - (lineContent.length - cleaned.length);
  return {
    text: newText,
    selection: {
      start: selection.start + offset,
      end: selection.end + offset,
    },
  };
}

export interface MarkdownShortcutResult {
  handled: boolean;
  text?: string;
  selection?: TextSelection;
}

// Typora 风格快捷键处理
export function handleMarkdownShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  text: string,
  selection: TextSelection
): MarkdownShortcutResult {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const ctrl = isMac ? e.metaKey : e.ctrlKey;
  const shift = e.shiftKey;

  if (!ctrl) return { handled: false };

  const key = e.key.toLowerCase();

  // Ctrl+B: 加粗
  if (key === "b" && !shift) {
    e.preventDefault();
    return { handled: true, ...wrapSelection(text, selection, "**") };
  }

  // Ctrl+I: 斜体
  if (key === "i" && !shift) {
    e.preventDefault();
    return { handled: true, ...wrapSelection(text, selection, "*") };
  }

  // Ctrl+K: 链接
  if (key === "k" && !shift) {
    e.preventDefault();
    const selected = text.slice(selection.start, selection.end) || "链接文字";
    const newText =
      text.slice(0, selection.start) +
      `[${selected}](url)` +
      text.slice(selection.end);
    return {
      handled: true,
      text: newText,
      selection: {
        start: selection.start + selected.length + 3,
        end: selection.start + selected.length + 6,
      },
    };
  }

  // Ctrl+Shift+K: 代码块
  if (key === "k" && shift) {
    e.preventDefault();
    const selected = text.slice(selection.start, selection.end);
    if (selected.includes("\n")) {
      // 多行 -> 代码块
      const newText =
        text.slice(0, selection.start) +
        "```\n" +
        selected +
        "\n```" +
        text.slice(selection.end);
      return {
        handled: true,
        text: newText,
        selection: {
          start: selection.start + 4,
          end: selection.start + 4 + selected.length,
        },
      };
    } else {
      // 单行 -> 行内代码
      return { handled: true, ...wrapSelection(text, selection, "`") };
    }
  }

  // Ctrl+Shift+M: 公式
  if (key === "m" && shift) {
    e.preventDefault();
    const selected = text.slice(selection.start, selection.end);
    if (selected.includes("\n")) {
      return { handled: true, ...wrapSelection(text, selection, "$$", "$$") };
    }
    return { handled: true, ...wrapSelection(text, selection, "$") };
  }

  // Ctrl+Shift+Q: 引用
  if (key === "q" && shift) {
    e.preventDefault();
    return { handled: true, ...prefixLine(text, selection, "> ") };
  }

  // Ctrl+Shift+U: 无序列表
  if (key === "u" && shift) {
    e.preventDefault();
    return { handled: true, ...prefixLine(text, selection, "- ") };
  }

  // Ctrl+Shift+O: 有序列表
  if (key === "o" && shift) {
    e.preventDefault();
    return { handled: true, ...prefixLine(text, selection, "1. ") };
  }

  // Ctrl+Shift+H: 水平分割线
  if (key === "h" && shift) {
    e.preventDefault();
    const insert = "\n---\n";
    const newText = text.slice(0, selection.end) + insert + text.slice(selection.end);
    return {
      handled: true,
      text: newText,
      selection: {
        start: selection.end + insert.length,
        end: selection.end + insert.length,
      },
    };
  }

  // Ctrl+1~6: 标题级别
  if (["1", "2", "3", "4", "5", "6"].includes(key) && !shift) {
    e.preventDefault();
    return { handled: true, ...setHeading(text, selection, parseInt(key)) };
  }

  // Ctrl+0: 普通文本（取消标题）
  if (key === "0" && !shift) {
    e.preventDefault();
    return { handled: true, ...setHeading(text, selection, 0) };
  }

  return { handled: false };
}

// Tab/Shift+Tab 缩进处理
export function handleTabKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  text: string,
  selection: TextSelection
): MarkdownShortcutResult {
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      // 减少缩进
      const before = text.slice(0, selection.start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const linePrefix = text.slice(lineStart, lineStart + 2);
      if (linePrefix === "  " || linePrefix.startsWith("\t")) {
        const removeCount = linePrefix === "  " ? 2 : 1;
        const newText = text.slice(0, lineStart) + text.slice(lineStart + removeCount);
        return {
          handled: true,
          text: newText,
          selection: {
            start: Math.max(lineStart, selection.start - removeCount),
            end: Math.max(lineStart, selection.end - removeCount),
          },
        };
      }
    } else {
      // 增加缩进
      const newText =
        text.slice(0, selection.start) + "  " + text.slice(selection.end);
      return {
        handled: true,
        text: newText,
        selection: {
          start: selection.start + 2,
          end: selection.start + 2,
        },
      };
    }
  }
  return { handled: false };
}

// 回车键自动延续列表
export function handleEnterKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  text: string,
  selection: TextSelection
): MarkdownShortcutResult {
  if (e.key !== "Enter") return { handled: false };

  const before = text.slice(0, selection.start);
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = text.slice(lineStart, selection.start);

  // 匹配列表前缀
  const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)/);
  const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)/);
  const quoteMatch = currentLine.match(/^(\s*)(>)\s+(.*)/);

  if (unorderedMatch) {
    const [, indent, marker, content] = unorderedMatch;
    if (!content) {
      // 空列表项，取消列表
      e.preventDefault();
      const newText = text.slice(0, lineStart) + text.slice(selection.start);
      return {
        handled: true,
        text: newText,
        selection: { start: lineStart, end: lineStart },
      };
    }
    e.preventDefault();
    const insert = `\n${indent}${marker} `;
    const newText = text.slice(0, selection.start) + insert + text.slice(selection.end);
    const newPos = selection.start + insert.length;
    return {
      handled: true,
      text: newText,
      selection: { start: newPos, end: newPos },
    };
  }

  if (orderedMatch) {
    const [, indent, num, content] = orderedMatch;
    if (!content) {
      e.preventDefault();
      const newText = text.slice(0, lineStart) + text.slice(selection.start);
      return {
        handled: true,
        text: newText,
        selection: { start: lineStart, end: lineStart },
      };
    }
    e.preventDefault();
    const nextNum = parseInt(num) + 1;
    const insert = `\n${indent}${nextNum}. `;
    const newText = text.slice(0, selection.start) + insert + text.slice(selection.end);
    const newPos = selection.start + insert.length;
    return {
      handled: true,
      text: newText,
      selection: { start: newPos, end: newPos },
    };
  }

  if (quoteMatch) {
    const [, indent, marker, content] = quoteMatch;
    if (!content) {
      e.preventDefault();
      const newText = text.slice(0, lineStart) + text.slice(selection.start);
      return {
        handled: true,
        text: newText,
        selection: { start: lineStart, end: lineStart },
      };
    }
    e.preventDefault();
    const insert = `\n${indent}${marker} `;
    const newText = text.slice(0, selection.start) + insert + text.slice(selection.end);
    const newPos = selection.start + insert.length;
    return {
      handled: true,
      text: newText,
      selection: { start: newPos, end: newPos },
    };
  }

  return { handled: false };
}

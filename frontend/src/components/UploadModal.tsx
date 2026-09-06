"use client";

import { useState, useRef, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import {
  Upload,
  FolderOpen,
  FileCode,
  X,
  Folder,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  parentCategoryId: string | null;
}

type UploadMode = "folder" | "file";

interface FileInfo {
  file: File;
  path: string;
  size: number;
}

export default function UploadModal({ isOpen, onClose, parentCategoryId }: Props) {
  const { importFolder } = useAppStore();

  const [mode, setMode] = useState<UploadMode>("folder");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    importedSnippets: number;
    createdCategories: number;
    skippedFiles: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setProgress(0);
    setImporting(false);
  }, []);

  const handleClose = () => {
    if (!importing) {
      resetState();
      onClose();
    }
  };

  const processFiles = useCallback((fileList: FileList | null, isFolder: boolean) => {
    if (!fileList || fileList.length === 0) return;

    const fileInfos: FileInfo[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // @ts-ignore
      const path = file.webkitRelativePath || file.name;
      fileInfos.push({ file, path, size: file.size });
    }

    setFiles(fileInfos);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (mode === "folder") {
        // 拖拽文件夹 - 使用 webkitGetAsEntry
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
          const fileList: File[] = [];
          const pathList: string[] = [];

          const traverseEntry = async (entry: any, path: string) => {
            return new Promise<void>((resolve) => {
              if (entry.isFile) {
                entry.file((file: File) => {
                  fileList.push(file);
                  pathList.push(path + entry.name);
                  resolve();
                });
              } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const readEntries = () => {
                  dirReader.readEntries(async (entries: any[]) => {
                    if (entries.length === 0) {
                      resolve();
                      return;
                    }
                    for (const subEntry of entries) {
                      await traverseEntry(subEntry, path + entry.name + "/");
                    }
                    readEntries();
                  });
                };
                readEntries();
              } else {
                resolve();
              }
            });
          };

          (async () => {
            const entries = [];
            for (let i = 0; i < items.length; i++) {
              const entry = items[i].webkitGetAsEntry?.();
              if (entry) entries.push(entry);
            }
            for (const entry of entries) {
              await traverseEntry(entry, "");
            }
            const fileInfos = fileList.map((file, i) => ({
              file,
              path: pathList[i],
              size: file.size,
            }));
            setFiles(fileInfos);
            setResult(null);
            setError(null);
          })();
        }
      } else {
        // 单文件模式
        processFiles(e.dataTransfer.files, false);
      }
    },
    [mode, processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当鼠标真正离开区域时才重置
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleClick = () => {
    if (mode === "folder") {
      folderInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files, true);
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files, false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleModeChange = (newMode: UploadMode) => {
    if (importing) return;
    setMode(newMode);
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleImport = async () => {
    if (files.length === 0 || importing) return;

    setImporting(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      setProgress(30);
      const fileArray = files.map((f) => f.file);
      const pathArray = files.map((f) => f.path);

      setProgress(50);
      const importResult = await importFolder(fileArray, pathArray, parentCategoryId);

      setProgress(100);
      setResult(importResult);
    } catch (err: any) {
      setError(err.message || "导入失败");
      setProgress(0);
    } finally {
      setImporting(false);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const folderCount = new Set(
    files.map((f) => {
      const slashIdx = f.path.lastIndexOf("/");
      return slashIdx > 0 ? f.path.substring(0, slashIdx) : "";
    })
  ).size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="导入文件"
      width="w-[520px]"
    >
      <div className="upload-modal">
      {/* 模式切换 */}
      <div className="upload-mode-tabs">
        <button
          className={`upload-mode-tab ${mode === "folder" ? "active" : ""}`}
          onClick={() => handleModeChange("folder")}
          disabled={importing}
        >
          <span className="flex items-center justify-center gap-1.5">
            <FolderOpen size={14} />
            文件夹导入
          </span>
        </button>
        <button
          className={`upload-mode-tab ${mode === "file" ? "active" : ""}`}
          onClick={() => handleModeChange("file")}
          disabled={importing}
        >
          <span className="flex items-center justify-center gap-1.5">
            <FileCode size={14} />
            单文件导入
          </span>
        </button>
      </div>

      {/* 拖拽上传区域 */}
      <div
        className={`upload-dropzone ${isDragging ? "drag-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="upload-dropzone-content">
          <div className="upload-icon-wrapper">
            <Upload size={28} strokeWidth={1.5} />
          </div>
          <div className="upload-title">
            {mode === "folder" ? "拖拽文件夹到这里" : "拖拽文件到这里"}
          </div>
          <div className="upload-hint">
            或者 <strong>点击选择</strong>
            {mode === "folder" ? " 本地文件夹" : " 本地文件"}
          </div>
        </div>
      </div>

      {/* 隐藏的 file input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 文件列表 */}
      {files.length > 0 && !result && (
        <div className="upload-file-list">
          {files.slice(0, 20).map((f, i) => {
            const isFolder = f.path.includes("/");
            return (
              <div key={i} className="upload-file-item group">
                <div className="upload-file-icon">
                  {isFolder ? <Folder size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="upload-file-name" title={f.path}>
                    {f.path}
                  </div>
                </div>
                <span className="upload-file-size">{formatFileSize(f.size)}</span>
                {!importing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {files.length > 20 && (
            <div className="upload-file-item text-slate-400 text-xs justify-center">
              ... 还有 {files.length - 20} 个文件
            </div>
          )}
        </div>
      )}

      {/* 进度条 */}
      {importing && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* 导入结果 */}
      {result && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
            <CheckCircle2 size={18} />
            导入完成
          </div>
          <div className="text-sm text-emerald-600 space-y-1">
            <div>新增代码片段：<strong>{result.importedSnippets}</strong> 个</div>
            <div>新增分类：<strong>{result.createdCategories}</strong> 个</div>
            {result.skippedFiles > 0 && (
              <div>跳过文件：<strong>{result.skippedFiles}</strong> 个</div>
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-center gap-2 text-rose-700 font-medium">
            <AlertCircle size={18} />
            导入失败
          </div>
          <div className="text-sm text-rose-600 mt-1">{error}</div>
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          {files.length > 0
            ? `${files.length} 个文件 · ${formatFileSize(totalSize)}`
                + (folderCount > 1 ? ` · ${folderCount} 个文件夹` : "")
            : mode === "folder"
            ? "支持递归导入子文件夹"
            : "支持多选文件"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {result ? "关闭" : "取消"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={files.length === 0 || importing}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  开始导入
                </>
              )}
            </button>
          )}
        </div>
      </div>
      </div>
    </Modal>
  );
}

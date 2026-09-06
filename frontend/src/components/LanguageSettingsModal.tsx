"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, Check, X, Languages } from "lucide-react";
import type { LanguageConfig } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguageSettingsModal({ isOpen, onClose }: Props) {
  const { languages, addLanguageConfig, updateLanguageConfig, deleteLanguageConfig } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formMode, setFormMode] = useState("javascript");
  const [formExtensions, setFormExtensions] = useState("");

  const [error, setError] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormValue("");
    setFormMode("javascript");
    setFormExtensions("");
    setError("");
  };

  const handleAdd = () => {
    resetForm();
    setIsAdding(true);
    setEditingId(null);
  };

  const handleEdit = (lang: LanguageConfig) => {
    setFormName(lang.name);
    setFormValue(lang.value);
    setFormMode(lang.mode);
    setFormExtensions(lang.extensions);
    setEditingId(lang.id);
    setIsAdding(false);
    setError("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleSave = async () => {
    setError("");

    if (!formName.trim()) {
      setError("语言名称不能为空");
      return;
    }
    if (!formValue.trim()) {
      setError("语言标识不能为空");
      return;
    }
    if (!formMode.trim()) {
      setError("CodeMirror Mode 不能为空");
      return;
    }
    if (!formExtensions.trim()) {
      setError("文件后缀不能为空，多个后缀用逗号分隔");
      return;
    }

    try {
      if (isAdding) {
        await addLanguageConfig({
          name: formName.trim(),
          value: formValue.trim().toLowerCase(),
          mode: formMode.trim(),
          extensions: formExtensions.trim(),
        });
      } else if (editingId) {
        await updateLanguageConfig(editingId, {
          name: formName.trim(),
          value: formValue.trim().toLowerCase(),
          mode: formMode.trim(),
          extensions: formExtensions.trim(),
        });
      }
      handleCancel();
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLanguageConfig(deleteId);
      setDeleteId(null);
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  };

  const sortedLanguages = [...languages].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="语言类型配置" width="w-[600px]">
        <div className="space-y-4">
          {/* 说明 */}
          <p className="text-xs text-slate-500">
            配置支持的编程语言类型。文件后缀用于文件夹导入时自动识别语言类型，多个后缀用英文逗号分隔。
          </p>

          {/* 添加表单 / 编辑表单 */}
          {(isAdding || editingId) && (
            <div className="border border-primary-200 bg-primary-50/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-slate-700">
                  {isAdding ? "添加语言类型" : "编辑语言类型"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">语言名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="如：Solidity"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">语言标识 (value)</label>
                  <input
                    type="text"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="如：solidity"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  CodeMirror Mode（语法高亮模式）
                </label>
                <input
                  type="text"
                  value={formMode}
                  onChange={(e) => setFormMode(e.target.value)}
                  placeholder="如：javascript, python, java, css, html, json, sql, markdown, xml, rust, go, yaml"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">
                  支持的 mode：javascript, typescript, python, java, rust, go, css, html, json, sql, markdown, xml, shell, yaml 等
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  文件后缀（多个用逗号分隔）
                </label>
                <input
                  type="text"
                  value={formExtensions}
                  onChange={(e) => setFormExtensions(e.target.value)}
                  placeholder="如：.sol,.soli"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              {error && (
                <p className="text-xs text-rose-500">{error}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  保存
                </button>
              </div>
            </div>
          )}

          {/* 语言列表 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Languages size={14} />
                已配置 {sortedLanguages.length} 种语言
              </span>
              {!isAdding && (
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors"
                >
                  <Plus size={14} />
                  添加
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {sortedLanguages.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  暂无语言配置
                </div>
              ) : (
                sortedLanguages.map((lang) => (
                  <div
                    key={lang.id}
                    className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-700">
                          {lang.name}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {lang.value}
                        </span>
                        {lang.isBuiltIn && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            内置
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        {lang.extensions}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!lang.isBuiltIn && (
                        <>
                          <button
                            onClick={() => handleEdit(lang)}
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(lang.id)}
                            className="p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="删除语言类型"
        message="确定要删除这个语言类型吗？已使用该类型的代码片段不会被删除。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </>
  );
}

"use client";

import { useState } from "react";
import Modal from "./Modal";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title = "确认操作",
  message,
  confirmText = "确认",
  cancelText = "取消",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const variantStyles = {
    danger: "bg-red-500 hover:bg-red-600",
    warning: "bg-amber-500 hover:bg-amber-600",
    info: "bg-primary-500 hover:bg-primary-600",
  };

  const iconStyles = {
    danger: "bg-red-50 text-red-500",
    warning: "bg-amber-50 text-amber-500",
    info: "bg-primary-50 text-primary-500",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      width="w-[400px]"
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-1.5 text-sm text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${variantStyles[variant]}`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconStyles[variant]}`}>
          <AlertTriangle size={18} />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed pt-1">
          {message}
        </p>
      </div>
    </Modal>
  );
}

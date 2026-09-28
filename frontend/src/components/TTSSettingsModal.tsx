"use client";

import { useState, useEffect } from "react";
import { X, Volume2 } from "lucide-react";
import { getTTSConfig, saveTTSConfig, TTSConfig } from "@/lib/tts";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function TTSSettingsModal({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<TTSConfig>({
    endpoint: "",
    timeout: 30000,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setTestResult("");
      getTTSConfig().then((cfg) => {
        setConfig(cfg);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTTSConfig(config);
      onClose();
    } catch (e: any) {
      alert("保存失败: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.endpoint) {
      setTestResult("请先填写接口地址");
      return;
    }
    setTesting(true);
    setTestResult("");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "测试语音合成" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        setTestResult(`接口返回错误: ${response.status}`);
      } else {
        const blob = await response.blob();
        if (blob.size === 0) {
          setTestResult("接口返回空音频");
        } else {
          setTestResult(`测试成功！返回 ${blob.size} 字节音频`);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.play().catch(() => {});
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        setTestResult(`请求超时（${config.timeout / 1000}秒）`);
      } else {
        setTestResult(`测试失败: ${e.message}`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-[480px] max-w-[90vw] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">朗读设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="text-center text-slate-500 text-sm py-4">加载中...</div>
          )}

          {!loading && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  TTS 接口地址
                </label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                  placeholder="例如: http://192.168.1.109:9999/tts"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  支持返回 MP3 音频流的 POST 接口，请求体格式: {"{\"text\": \"要朗读的文本\"}"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  超时时间（秒）
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={config.timeout / 1000}
                  onChange={(e) => setConfig({ ...config, timeout: Math.max(5, Math.min(120, parseInt(e.target.value) || 30)) * 1000 })}
                  className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  请求超时后自动取消，默认 30 秒
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleTest}
                  disabled={testing || !config.endpoint}
                  className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-slate-400"
                >
                  {testing ? "测试中..." : "测试连接"}
                </button>
                {testResult && (
                  <p className={`text-xs mt-1 ${testResult.includes("成功") ? "text-emerald-600" : "text-rose-600"}`}>
                    {testResult}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-md disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

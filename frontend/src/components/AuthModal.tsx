"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { Code2, Eye, EyeOff, Loader2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result =
        mode === "login"
          ? await authApi.login({ email, password })
          : await authApi.register({ email, password, nickname });

      localStorage.setItem("token", result.token);
      localStorage.setItem("userEmail", result.email);
      localStorage.setItem("userNickname", result.nickname || "");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <Code2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CodeNote</h1>
          <p className="text-slate-400 text-sm mt-1">代码片段管理与注释工具</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          {/* 标签切换 */}
          <div className="flex mb-6 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "login"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "register"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  昵称
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="请输入昵称"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === "login" ? "登录" : "注册"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          数据将保存到 PostgreSQL，图片保存到 MinIO
        </p>
      </div>
    </div>
  );
}

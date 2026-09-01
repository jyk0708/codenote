"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { healthApi } from "@/lib/api";

export function useHeartbeat(intervalMs: number = 15000) {
  const [isOnline, setIsOnline] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const wasOnlineRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    const ok = await healthApi.ping();
    setIsOnline(ok);

    if (wasOnlineRef.current && !ok) {
      // 刚断连，显示警告
      setShowWarning(true);
    } else if (!wasOnlineRef.current && ok) {
      // 刚恢复，延迟隐藏警告
      setTimeout(() => setShowWarning(false), 3000);
    }
    wasOnlineRef.current = ok;
  }, []);

  useEffect(() => {
    // 立即检查一次
    check();

    timerRef.current = setInterval(check, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [check, intervalMs]);

  return {
    isOnline,
    showWarning,
    dismissWarning: () => setShowWarning(false),
    recheck: check,
  };
}

// TTS 朗读工具 - 配置存储在后端数据库
import { configApi } from "@/lib/api";

export interface TTSConfig {
  endpoint: string; // TTS 接口地址，如 http://192.168.1.109:9999/tts
  timeout: number;  // 超时时间（毫秒），默认 30000
}

const DEFAULT_CONFIG: TTSConfig = {
  endpoint: "",
  timeout: 30000,
};

// 内存缓存，避免每次朗读都请求
let cachedConfig: TTSConfig | null = null;
let configPromise: Promise<TTSConfig> | null = null;

export async function getTTSConfig(): Promise<TTSConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const data = await configApi.get();
      const cfg: TTSConfig = {
        endpoint: data.ttsEndpoint || "",
        timeout: data.ttsTimeout || 30000,
      };
      cachedConfig = cfg;
      return cfg;
    } catch (e) {
      cachedConfig = { ...DEFAULT_CONFIG };
      return cachedConfig;
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

export async function saveTTSConfig(config: Partial<TTSConfig>): Promise<TTSConfig> {
  const data = await configApi.update({
    ttsEndpoint: config.endpoint,
    ttsTimeout: config.timeout,
  });
  const cfg: TTSConfig = {
    endpoint: data.ttsEndpoint || "",
    timeout: data.ttsTimeout || 30000,
  };
  cachedConfig = cfg;
  return cfg;
}

// 当前播放的音频，用于停止
let currentAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;

export function stopTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

export function isTTSPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * 调用 TTS 接口并朗读文本
 * @param text 要朗读的文本
 * @param onProgress 状态回调
 * @returns Promise，播放完成后 resolve
 */
export async function speakText(
  text: string,
  onProgress?: (status: "loading" | "playing" | "done" | "error", message?: string) => void
): Promise<void> {
  if (!text.trim()) {
    throw new Error("没有选中文本");
  }

  const config = await getTTSConfig();
  if (!config.endpoint) {
    throw new Error("请先在设置中配置 TTS 接口地址");
  }

  // 停止之前的播放
  stopTTS();

  onProgress?.("loading");

  const controller = new AbortController();
  currentAbortController = controller;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.timeout);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`TTS 接口返回错误: ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("TTS 接口返回空音频");
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        onProgress?.("done");
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        onProgress?.("error", "音频播放失败");
        reject(new Error("音频播放失败"));
      };
      audio.onplay = () => {
        onProgress?.("playing");
      };
      audio.play().catch((e) => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        onProgress?.("error", e.message);
        reject(e);
      });
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    currentAbortController = null;
    if (e.name === "AbortError") {
      onProgress?.("error", "请求超时");
      throw new Error("TTS 请求超时");
    }
    onProgress?.("error", e.message);
    throw e;
  }
}

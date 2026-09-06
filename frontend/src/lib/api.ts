const API_BASE = "/api";

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  }).catch((err) => {
    // 网络错误
    throw new Error(`网络错误：无法连接到服务器 (${err.message})`);
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let errorMessage = `HTTP ${response.status}`;

    if (contentType.includes("application/json")) {
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text.substring(0, 200);
      }
    } else {
      const text = await response.text().catch(() => "");
      if (text) errorMessage = text.substring(0, 200);
    }

    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Auth ---
export const authApi = {
  register: (data: { email: string; password: string; nickname?: string }) =>
    request<{ token: string; email: string; nickname: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; email: string; nickname: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// --- Categories ---
export const categoryApi = {
  getAll: () => request<any[]>("/categories"),
  create: (data: { name: string; parentId: string | null }) =>
    request<any>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string; parentId?: string | null; sortOrder?: number }) =>
    request<any>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
};

// --- Snippets ---
export const snippetApi = {
  list: (params?: { categoryId?: string; search?: string; favorite?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set("categoryId", params.categoryId);
    if (params?.search) query.set("search", params.search);
    if (params?.favorite) query.set("favorite", "true");
    const qs = query.toString();
    return request<any[]>(`/snippets${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<any>(`/snippets/${id}`),
  create: (data: any) =>
    request<any>("/snippets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<any>(`/snippets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/snippets/${id}`, { method: "DELETE" }),
  toggleFavorite: (id: string) =>
    request<any>(`/snippets/${id}/favorite`, { method: "POST" }),
};

// --- Annotations ---
export const annotationApi = {
  list: (snippetId: string) =>
    request<any[]>(`/snippets/${snippetId}/annotations`),
  create: (snippetId: string, data: any) =>
    request<any>(`/snippets/${snippetId}/annotations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (snippetId: string, id: string, data: any) =>
    request<any>(`/snippets/${snippetId}/annotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (snippetId: string, id: string) =>
    request<void>(`/snippets/${snippetId}/annotations/${id}`, {
      method: "DELETE",
    }),
};

// --- File Upload ---
export const fileApi = {
  upload: async (file: File): Promise<{ url: string; name: string }> => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).catch((err) => {
      throw new Error(`网络错误：无法连接到服务器 (${err.message})`);
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let errorMessage = `HTTP ${response.status}`;
      if (contentType.includes("application/json")) {
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          const text = await response.text().catch(() => "");
          if (text) errorMessage = text.substring(0, 200);
        }
      } else {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text.substring(0, 200);
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },
  cleanup: (): Promise<{ deletedCount: number; message: string }> => {
    return request<{ deletedCount: number; message: string }>("/files/cleanup", {
      method: "POST",
    });
  },
};

// --- Search ---
export const searchApi = {
  search: (query: string, type?: string) =>
    request<{
      snippets: any[];
      annotations: any[];
      categories: any[];
    }>(`/search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ""}`),
};

// --- Language Config ---
export const languageApi = {
  getAll: () => request<any[]>("/languages"),
  create: (data: { name: string; value: string; mode: string; extensions: string }) =>
    request<any>("/languages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; value?: string; mode?: string; extensions?: string }) =>
    request<any>(`/languages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/languages/${id}`, { method: "DELETE" }),
};

// --- Import ---
export const importApi = {
  importFolder: async (files: File[], paths: string[], parentCategoryId: string | null): Promise<{ importedSnippets: number; createdCategories: number; skippedFiles: number }> => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    paths.forEach((path) => {
      formData.append("paths", path);
    });
    if (parentCategoryId) {
      formData.append("parentCategoryId", parentCategoryId);
    }

    const response = await fetch(`${API_BASE}/import/folder`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).catch((err) => {
      throw new Error(`网络错误：无法连接到服务器 (${err.message})`);
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let errorMessage = `HTTP ${response.status}`;
      if (contentType.includes("application/json")) {
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          const text = await response.text().catch(() => "");
          if (text) errorMessage = text.substring(0, 200);
        }
      } else {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text.substring(0, 200);
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },
};

// --- Health Check (心跳) ---
export const healthApi = {
  ping: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/health/ping`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

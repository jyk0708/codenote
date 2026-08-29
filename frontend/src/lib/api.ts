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
        // JSON 解析失败，尝试读取文本
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text.substring(0, 200);
      }
    } else {
      const text = await response.text().catch(() => "");
      if (text) errorMessage = text.substring(0, 200);
    }

    throw new Error(errorMessage);
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
  update: (id: string, data: { name: string; parentId?: string | null }) =>
    request<any>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
};

// --- Snippets ---
export const snippetApi = {
  list: (params?: { categoryId?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set("categoryId", params.categoryId);
    if (params?.search) query.set("search", params.search);
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
};

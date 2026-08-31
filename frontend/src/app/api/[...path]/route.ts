import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 后端地址，运行时读取环境变量
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

async function handler(request: NextRequest) {
  // 提取 /api 后面的路径
  const path = request.nextUrl.pathname.replace(/^\/api/, "");
  const query = request.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api${path}${query}`;

  // 复制请求头
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== "host" &&
      lowerKey !== "connection" &&
      lowerKey !== "content-length" &&
      lowerKey !== "transfer-encoding"
    ) {
      headers[key] = value;
    }
  });

  try {
    // 获取请求体
    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentType = headers["content-type"] || "";
      if (contentType.includes("multipart/form-data")) {
        // 文件上传：直接转发 FormData
        const formData = await request.formData();
        body = formData as any;
        // 让 fetch 自动设置正确的 Content-Type（带 boundary）
        delete headers["content-type"];
      } else {
        // JSON 或其他文本：直接转发
        body = (await request.text()) as BodyInit;
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    // 复制响应头
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== "transfer-encoding" &&
        lowerKey !== "connection" &&
        lowerKey !== "content-encoding"
      ) {
        responseHeaders.set(key, value);
      }
    });

    // 读取响应体：使用 arrayBuffer 兼容二进制（图片）和文本（JSON）
    const responseBuffer = await response.arrayBuffer();

    return new NextResponse(responseBuffer, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Backend connection failed",
        message: `无法连接到后端服务 (${BACKEND_URL})：${error.message}`,
      },
      { status: 502 }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as OPTIONS };

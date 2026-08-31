# =========================
# 依赖安装阶段
# =========================
FROM node:20-alpine AS deps

WORKDIR /app

# 使用国内 npm 镜像加速
RUN npm config set registry https://registry.npmmirror.com

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# =========================
# 构建阶段
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源码
COPY . .

# 构建
RUN npm run build

# =========================
# 运行阶段
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# 后端地址（运行时环境变量，可被 docker-compose 覆盖）
ENV NEXT_PUBLIC_BACKEND_URL=http://backend:8080

# 复制 standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 创建 public 目录
RUN mkdir -p ./public

# 运行端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]

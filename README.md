version: "3.8"

services:
  # PostgreSQL 数据库（可禁用：ENABLE_POSTGRES=false）
  postgres:
    image: postgres:16-alpine
    container_name: codenote-postgres
    restart: unless-stopped
    profiles: ["postgres"]
    environment:
      POSTGRES_DB: ${DB_NAME:-codenote}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${DB_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-codenote}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO 对象存储（可禁用：ENABLE_MINIO=false）
  minio:
    image: minio/minio:latest
    container_name: codenote-minio
    restart: unless-stopped
    profiles: ["minio"]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # 后端服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: codenote-backend
    restart: unless-stopped
    environment:
      - DB_HOST=${DB_HOST:-postgres}
      - DB_PORT=${DB_PORT:-5432}
      - DB_NAME=${DB_NAME:-codenote}
      - DB_USER=${DB_USER:-postgres}
      - DB_PASSWORD=${DB_PASSWORD:-postgres}
      - JWT_SECRET=${JWT_SECRET:-change-this-secret-key-to-something-very-long-and-secure}
      - JWT_EXPIRATION_MS=${JWT_EXPIRATION_MS:-86400000}
      - CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS}
      - MINIO_ENDPOINT=${MINIO_ENDPOINT:-http://minio:9000}
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}
      - MINIO_BUCKET=${MINIO_BUCKET:-codenote}
    # 后端只在内部网络暴露，不对外映射端口
    expose:
      - "8080"

  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: codenote-frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8080
    ports:
      - "${FRONTEND_PORT:-3000}:3000"

volumes:
  postgres_data:
  minio_data:

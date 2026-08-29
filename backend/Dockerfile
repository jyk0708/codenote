# =========================
# 构建阶段
# =========================
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# 创建 Maven 配置文件，使用阿里云镜像加速
RUN mkdir -p /root/.m2 && \
    echo '<?xml version="1.0" encoding="UTF-8"?>\
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"\
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/settings-1.0.0.xsd">\
  <mirrors>\
    <mirror>\
      <id>aliyunmaven</id>\
      <mirrorOf>*</mirrorOf>\
      <name>阿里云公共仓库</name>\
      <url>https://maven.aliyun.com/repository/public</url>\
    </mirror>\
  </mirrors>\
</settings>' > /root/.m2/settings.xml

# 复制 pom.xml 并下载依赖（利用缓存）
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 复制源码并构建
COPY src ./src
RUN mvn package -DskipTests -B

# =========================
# 运行阶段
# =========================
FROM eclipse-temurin:21-jre

WORKDIR /app

# 从构建阶段复制 jar 包
COPY --from=builder /app/target/*.jar app.jar

# 设置时区
ENV TZ=Asia/Shanghai

# 运行端口
EXPOSE 8080

# 启动命令
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

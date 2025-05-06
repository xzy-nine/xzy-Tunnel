FROM node:18-alpine

# 创建应用目录
WORKDIR /app

# 安装应用依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY src/ ./src/

# 创建日志目录
RUN mkdir -p /app/logs

# 环境变量
ENV NODE_ENV=production
ENV PORT=1234

# 暴露固定的容器内端口,,
EXPOSE 1234

# 启动命令
CMD ["sh", "-c", "mkdir -p /app/logs && node src/index.js"]
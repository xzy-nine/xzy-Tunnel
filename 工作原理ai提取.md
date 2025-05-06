# FN Connect 浏览器扩展工作原理综述

## 客户端（浏览器扩展）原理

FN Connect 是一个专为访问 `5ddd.com` 和 `fnos.net` 域名设计的浏览器扩展，其核心功能包括：

1. **域名检测与请求头修改**
   - 监控浏览器标签，识别特定域名的访问请求
   - 为识别到的目标域名请求添加特殊请求头 `from-fn-connect-extension`
   - 使用 WebAssembly 模块处理请求头，可能包含签名验证机制

2. **端口信息处理**
   - 检测带端口URL（如 `https://mynas.5ddd.com:8080`）
   - 尝试重定向到不带端口的URL（如 `https://mynas.5ddd.com`）
   - 同时保存端口信息到请求头中，确保服务器端仍能接收到该信息

3. **缓存管理**
   - 提供针对特定域名的缓存清理功能
   - 通过 `chrome.browsingData.remove` API 实现定向清理

4. **设备识别**
   - 显示已检测到的 FN NAS 设备列表（ID和名称）
   - 维护与这些设备的连接状态

## 服务器端可能的原理

基于扩展的行为，可以推断服务器端的工作机制：

1. **端口路由系统**
   - 服务器可能使用反向代理（如Nginx）接收不同端口的请求
   - 标准端口（80/443）用于接收常规web访问
   - 非标准端口可能对应NAS设备的不同服务或实例

2. **请求头识别机制**
   - 服务器检测带有 `from-fn-connect-extension` 请求头的流量
   - 从请求头中提取原始端口信息
   - 根据该信息将请求路由到正确的后端服务或NAS设备

3. **域名解析架构**
   - 子域名（如`mynas.5ddd.com`）可能映射到特定的NAS设备
   - DDNS（动态DNS）系统可能用于管理这些动态IP地址映射

4. **安全验证层**
   - 请求头中可能包含由WebAssembly生成的签名或验证信息
   - 服务器验证这些签名以确保请求来自合法的扩展

## 整体工作流程

1. 用户尝试通过浏览器访问带端口的FN NAS设备URL
2. 扩展检测到访问，发起重定向并添加特殊请求头
3. 重定向后的请求（不带端口）发送到服务器
4. 服务器检查请求头，提取原始端口信息
5. 根据子域名和端口信息，服务器将请求路由到正确的NAS设备
6. NAS设备处理请求并返回响应

## 设计目的

这种架构设计的主要目的可能是：

1. **简化访问体验** - 用户不需要记住复杂的端口号
2. **提高安全性** - 隐藏实际服务端口，减少直接端口暴露
3. **提供统一访问点** - 通过统一域名服务访问分散的NAS设备
4. **解决NAT穿透问题** - 帮助用户在复杂网络环境下访问家庭NAS

这种方案巧妙地利用了浏览器扩展和请求头来传递关键连接信息，同时保持了用户界面的简洁性和操作的便捷性。
















# 在Docker中复现FN Connect服务器端的简易实现

要在Docker中复现FN Connect的服务器端功能，可以使用Node.js作为主要语言，它简单易用且适合处理HTTP请求和请求头解析。以下是一个简易实现方案：

## 实现步骤

### 1. 创建项目结构

```
fn-connect-server/
├── Dockerfile
├── package.json
├── server.js
└── nginx.conf
```

### 2. 编写Node.js服务器代码

```javascript
const express = require('express');
const http = require('http');
const app = express();
const PORT = 3000;

// 中间件：解析请求头
app.use((req, res, next) => {
  console.log(`收到请求: ${req.method} ${req.url}`);
  console.log('请求头:', req.headers);
  next();
});

// 检测FN Connect扩展请求头
app.use((req, res, next) => {
  const fnConnectHeader = req.headers['from-fn-connect-extension'];
  if (fnConnectHeader) {
    // 解析请求头中的端口信息（实际场景中可能需要更复杂的解码）
    // 这里假设端口信息被编码在请求头中的某个位置
    console.log('检测到FN Connect扩展请求，header:', fnConnectHeader);
    // 可以在req对象上添加额外信息供后续处理
    req.fnPort = extractPortFromHeader(fnConnectHeader);
    console.log(`提取的端口: ${req.fnPort}`);
  }
  next();
});

// 模拟提取端口的函数
function extractPortFromHeader(headerValue) {
  // 简化版本 - 实际可能需要解密或复杂解析
  // 假设端口信息是头部值的最后4位数字
  const match = headerValue.match(/(\d{2,5})$/);
  return match ? match[1] : '80';
}

// 根据子域名和端口路由请求
app.use((req, res) => {
  // 获取主机名的第一部分作为设备ID
  const host = req.headers.host || '';
  const deviceId = host.split('.')[0];
  const port = req.fnPort || '80';
  
  // 构建响应内容
  const responseData = {
    message: "FN Connect服务器模拟响应",
    device: deviceId,
    originalPort: port,
    timestamp: new Date().toISOString()
  };
  
  // 模拟不同端口返回不同服务内容
  if (port === '8080') {
    responseData.service = "文件管理服务";
  } else if (port === '8443') {
    responseData.service = "管理控制台";
  } else {
    responseData.service = "默认Web服务";
  }
  
  res.json(responseData);
});

// 启动服务器
http.createServer(app).listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
```

### 3. 创建package.json

```json
{
  "name": "fn-connect-server",
  "version": "1.0.0",
  "description": "简易模拟FN Connect服务器端",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### 4. Nginx配置（处理子域名和SSL）

```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        listen 443 ssl;
        server_name ~^(.+)\.5ddd\.local$;
        
        # 自签名证书(生产环境需要替换为有效证书)
        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;
        
        # 将所有子域名请求代理到Node.js服务
        location / {
            proxy_pass http://node-app:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # 处理带端口的请求(模拟多个端口)
    server {
        listen 8080;
        listen 8443 ssl;
        server_name ~^(.+)\.5ddd\.local$;
        
        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;
        
        location / {
            proxy_pass http://node-app:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Original-Port $server_port;
        }
    }
}
```

### 5. Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制项目文件
COPY package.json .
COPY server.js .

# 安装依赖
RUN npm install

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["node", "server.js"]
```

### 6. Docker Compose配置

```yaml
version: '3'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
      - "8443:8443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - node-app
    
  node-app:
    build: .
    expose:
      - "3000"
    volumes:
      - ./server.js:/app/server.js

networks:
  default:
    driver: bridge
```

### 7. 生成自签名SSL证书

在项目根目录创建ssl文件夹并生成自签名证书：

```bash
mkdir -p ssl
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt
```

## 启动服务

```bash
docker-compose up -d
```

## 测试方法

1. 修改本地hosts文件，添加:
   ```
   127.0.0.1 mynas.5ddd.local
   ```

2. 使用浏览器访问:
   - http://mynas.5ddd.local
   - https://mynas.5ddd.local
   - http://mynas.5ddd.local:8080
   - https://mynas.5ddd.local:8443

3. 观察服务器日志中请求头的处理情况:
   ```bash
   docker-compose logs -f node-app
   ```

## 扩展增强

这个简易实现可以根据需要进行增强:

1. **添加WebAssembly验证**: 引入与扩展相同的WebAssembly模块来验证请求签名
2. **实现动态路由**: 根据子域名将请求路由到不同Docker容器
3. **添加数据库**: 存储设备信息和用户认证数据
4. **实现DDNS功能**: 动态更新子域名与IP地址的映射

这种简易实现提供了FN Connect工作原理的基本框架，而且在Docker环境中易于部署和测试。
const express = require('express');
const config = require('../config');
const { createProxyMiddleware } = require('../utils/proxy');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 处理所有请求的代理路由
router.all('*', (req, res, next) => {
  // 从请求头获取目标端口
  const tunnelHeader = req.headers[config.TUNNEL_HEADER_NAME.toLowerCase()];
  
  // 如果未提供隧道请求头，显示提示页面
  if (!tunnelHeader) {
    logger.debug(`未检测到 ${config.TUNNEL_HEADER_NAME} 请求头，显示提示页面`);
    return res.status(200).send(renderHelpPage(req));
  }
  
  let targetPort;
  if (tunnelHeader) {
    // 尝试从请求头获取端口
    const requestedPort = parseInt(tunnelHeader, 10);
    
    if (!isNaN(requestedPort)) {
      // 检查是否为被阻止的端口
      if (config.BLOCKED_PORTS.includes(Number(requestedPort))) {
        return res.status(403).json({ error: "Access to this port is forbidden" });
      }
      
      const targetUrl = `http://localhost:${requestedPort}`;
      const proxy = createProxyMiddleware({ 
        target: targetUrl,
        changeOrigin: true,
        pathRewrite: {
          [`^/proxy/${requestedPort}`]: ''
        }
      });
      return proxy(req, res, next);
    } else {
      // 如果没有指定端口或端口无效，可以使用默认端口或返回错误
      res.status(400).json({ error: "Invalid port specified" });
    }
  }
});

// 生成帮助页面HTML
function renderHelpPage(req, errorInfo) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // 构建错误展示区
  let errorSection = '';
  if (errorInfo && errorInfo.message) {
    errorSection = `
      <div class="warning-box">
        <h3>错误信息</h3>
        <pre>${errorInfo.message}</pre>
        ${config.NODE_ENV !== 'production' && errorInfo.stack
          ? `<pre>${errorInfo.stack}</pre>` : ''}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XZY-Tunnel 服务</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        .info-box {
            background-color: #f8f9fa;
            border-left: 4px solid #4285f4;
            padding: 15px;
            margin-bottom: 20px;
        }
        .warning-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-bottom: 20px;
        }
        code {
            background-color: #f0f0f0;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
        }
        pre {
            background-color: #f6f8fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    ${errorSection}
    <h1>XZY-Tunnel 服务</h1>
    
    <div class="info-box">
        <h2>欢迎使用 XZY-Tunnel 代理服务</h2>
        <p>此服务允许您将请求转发到本地运行的其他服务端口。</p>
    </div>
    
    <h3>如何使用</h3>
    <p>要使用此服务，您需要在请求中添加 <code>${config.TUNNEL_HEADER_NAME}</code> 请求头，指定目标端口。</p>
    
    <h4>示例</h4>
    <pre>
curl -H "${config.TUNNEL_HEADER_NAME}: 3000" ${baseUrl}/your-api-path

// 或使用 fetch API
fetch('${baseUrl}/your-api-path', {
    headers: {
        '${config.TUNNEL_HEADER_NAME}': '3000'
    }
});</pre>
    
    <div class="warning-box">
        <h3>注意事项</h3>
        <p>以下端口被阻止转发: ${config.BLOCKED_PORTS.join(', ')}</p>
        <p>默认超时时间: ${config.REQUEST_TIMEOUT}ms</p>
    </div>
    
    <h3>服务信息</h3>
    <ul>
        <li>版本: ${require('../../package.json').version || '未知'}</li>
        <li>运行模式: ${config.NODE_ENV}</li>
        <li>健康检查路径: <a href="${baseUrl}${config.HEALTH_CHECK_PATH}">${config.HEALTH_CHECK_PATH}</a></li>
    </ul>
</body>
</html>`;
}

module.exports = router;
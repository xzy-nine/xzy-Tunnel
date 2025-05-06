const express = require('express');
const config = require('../config');
const { createProxyMiddleware } = require('../utils/proxy');
const logger = require('../utils/logger');

const router = express.Router();

// 处理所有请求的代理路由
router.all('*', (req, res, next) => {
  // 从请求头获取目标端口
  const tunnelHeader = req.headers[config.TUNNEL_HEADER_NAME.toLowerCase()];
  
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
  } else {
    // 无请求头时使用默认端口
    targetPort = config.DEFAULT_TARGET_PORT;
    logger.debug(`未检测到 ${config.TUNNEL_HEADER_NAME} 请求头，使用默认端口: ${targetPort}`);
  }

  // 创建针对特定端口的代理中间件
  const proxy = createProxyMiddleware(targetPort);
  
  // 应用代理
  return proxy(req, res, next);
});

module.exports = router;
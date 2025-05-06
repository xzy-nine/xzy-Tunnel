const httpProxy = require('http-proxy');
const logger = require('./logger');
const config = require('../config');

// 创建代理中间件工厂函数
function createProxyMiddleware(targetPort) {
  const proxyOptions = {
    target: `http://localhost:${targetPort}`,
    changeOrigin: true,
    ws: true, // 支持 WebSocket
    xfwd: true, // 转发原始 IP
    timeout: config.REQUEST_TIMEOUT,
    proxyTimeout: config.REQUEST_TIMEOUT,
    followRedirects: true,
    preserveHeaderKeyCase: true
  };
  
  // 如果配置了要保留原始 Host 头
  if (config.PRESERVE_HOST_HEADER) {
    proxyOptions.preserveHostHeader = true;
  }
  
  const proxy = httpProxy.createProxyServer(proxyOptions);

  // 代理错误处理
  proxy.on('error', (err, req, res) => {
    logger.error(`代理错误: ${err.message}`);
    
    // 确保响应仍然能够发送
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: '代理服务器错误',
        message: config.NODE_ENV === 'development' ? err.message : undefined
      }));
    }
  });

  // 记录代理事件
  proxy.on('proxyReq', (proxyReq, req, res) => {
    logger.debug(`代理请求: ${req.method} ${req.url} -> 端口 ${targetPort}`);
    
    // 删除隧道请求头，避免泄露到后端服务
    proxyReq.removeHeader(config.TUNNEL_HEADER_NAME);
    
    // 在开发模式下记录更多详细信息
    if (config.NODE_ENV === 'development') {
      if (config.LOG_REQUEST_HEADERS) {
        logger.debug(`请求头: ${JSON.stringify(req.headers)}`);
      }
      
      if (config.LOG_REQUEST_BODY && req.body) {
        logger.debug(`请求体: ${JSON.stringify(req.body)}`);
      }
    }
  });

  // 新增：记录代理响应
  proxy.on('proxyRes', (proxyRes, req, res) => {
    logger.info(`转发完成: ${req.method} ${req.url} -> localhost:${targetPort}，状态码: ${proxyRes.statusCode}`);
  });

  // 返回代理中间件
  return (req, res, next) => {
    return proxy.web(req, res, {}, (err) => {
      if (err) {
        next(err);
      }
    });
  };
}

module.exports = {
  createProxyMiddleware
};
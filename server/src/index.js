const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const headerMiddleware = require('./middleware/headers');
const proxyRoutes = require('./routes/proxy');

// 创建 Express 应用
const app = express();

// 中间件设置
if (config.ENABLE_CORS) {
  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true
  }));
}

app.use(express.json());
app.use(headerMiddleware.logHeaders);

// 健康检查端点
if (config.HEALTH_CHECK_ENABLED) {
  app.get(config.HEALTH_CHECK_PATH, (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: require('../package.json').version
    });
  });
}

// 路由设置 - 所有请求通过代理路由处理
app.use('/', proxyRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(`服务器错误: ${err.message}`);
  res.status(500).json({ 
    error: config.NODE_ENV === 'production' ? '服务器错误' : err.message,
    requestId: req.id // 如果你添加了请求ID中间件
  });
});

// 启动服务器 - 固定端口
app.listen(config.PORT, () => {
  logger.info(`XZY-Tunnel 服务端已启动，监听端口: ${config.PORT}`);
  logger.info(`运行模式: ${config.NODE_ENV}`);
  logger.info(`请求转发基于请求头: ${config.TUNNEL_HEADER_NAME}`);
  
  // 显示一些帮助信息
  logger.info(`您可以通过添加 '${config.TUNNEL_HEADER_NAME}: 目标端口' 请求头来指定转发目标`);
  if (config.BLOCKED_PORTS.length > 0) {
    logger.info(`注意：以下端口被阻止转发: ${config.BLOCKED_PORTS.join(', ')}`);
  }
});

module.exports = app;
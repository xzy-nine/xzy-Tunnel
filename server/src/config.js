require('dotenv').config();

// 集中配置管理
module.exports = {
  // 服务器基础配置
  PORT: process.env.PORT || 1234, // 从环境变量读取端口，如不存在则默认为1234
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // 请求转发配置
  TUNNEL_HEADER_NAME: process.env.TUNNEL_HEADER_NAME || 'xzytunnel',
  DEFAULT_TARGET_PORT: process.env.DEFAULT_TARGET_PORT || 80,
  
  // 阻止列表 - 不允许转发的端口
  BLOCKED_PORTS: process.env.BLOCKED_PORTS
    ? process.env.BLOCKED_PORTS.split(',').map(port => parseInt(port.trim()))
    : [25, 465, 587], // 默认阻止常见邮件端口，防止滥用
  
  // 日志配置
  LOG_REQUEST_HEADERS: process.env.LOG_REQUEST_HEADERS === 'true' || false,
  LOG_REQUEST_BODY: process.env.LOG_REQUEST_BODY === 'true' || false,
  
  // 安全配置
  ENABLE_CORS: process.env.ENABLE_CORS !== 'false',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // 转发策略
  FORWARD_PATH: process.env.FORWARD_PATH !== 'false',
  PRESERVE_HOST_HEADER: process.env.PRESERVE_HOST_HEADER === 'true' || false,
  
  // 性能配置
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
  
  // 健康检查配置
  HEALTH_CHECK_ENABLED: process.env.HEALTH_CHECK_ENABLED !== 'false',
  HEALTH_CHECK_PATH: process.env.HEALTH_CHECK_PATH || '/health'
};
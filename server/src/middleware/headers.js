const logger = require('../utils/logger');
const config = require('../config');

// 记录请求头信息
function logHeaders(req, res, next) {
  logger.debug(`收到请求: ${req.method} ${req.url}`);
  
  const tunnelHeader = req.headers[config.TUNNEL_HEADER_NAME.toLowerCase()];
  if (tunnelHeader) {
    logger.info(`检测到 ${config.TUNNEL_HEADER_NAME} 请求头，目标端口: ${tunnelHeader}`);
  }
  
  next();
}

module.exports = {
  logHeaders
};
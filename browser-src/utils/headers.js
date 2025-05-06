/**
 * XZY-Tunnel 请求头处理工具
 */

// 添加XZY-Tunnel请求头
function addXzyTunnelHeader(headers, originalPort) {
  headers.push({
    name: "xzytunnel",
    value: originalPort
  });
  return headers;
}

// 从URL中解析端口信息
function getPortFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
  } catch (e) {
    console.error("解析URL端口失败:", e);
    return null;
  }
}

// 构建带有特定端口的URL
function buildUrlWithPort(url, port) {
  try {
    const urlObj = new URL(url);
    urlObj.port = port;
    return urlObj.toString();
  } catch (e) {
    console.error("构建URL失败:", e);
    return url;
  }
}

// 导出工具函数
export {
  addXzyTunnelHeader,
  getPortFromUrl,
  buildUrlWithPort
};
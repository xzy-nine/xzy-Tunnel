/**
 * XZY-Tunnel 请求头处理工具
 */

// 安全解析 URL
const safeUrl = url => {
  try { return new URL(url) }
  catch { return null }
}

// 添加 xzytunnel header（返回新数组，避免修改原 headers）
export const addXzyTunnelHeader = (headers, originalPort) =>
  [...headers, { name: 'xzytunnel', value: originalPort }]

// 从 URL 中提取端口
export const getPortFromUrl = url => {
  const u = safeUrl(url)
  if (!u) return null
  return u.port || (u.protocol === 'https:' ? '443' : '80')
}

// 构造带指定端口的新 URL
export const buildUrlWithPort = (url, port) => {
  const u = safeUrl(url)
  if (!u) return url
  u.port = port
  return u.toString()
}
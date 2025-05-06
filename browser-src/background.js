// 导入工具函数
import { addXzyTunnelHeader, getPortFromUrl, buildUrlWithPort } from './utils/headers.js';
// 目标域名和端口配置
const CONFIG = {
  targetDomain: "example.com",
  redirectPort: 1234, // 要重定向到的标准端口
  debugMode: false
};

// 存储检测到的连接
let detectedConnections = [];

// 全局记录当前活动规则ID
let activeRuleId = 1;

// 调试日志函数
function logDebug(message) {
  if (CONFIG.debugMode) {
    console.log(`[XZY-Tunnel] ${message}`);
  }
}

// 更新请求头规则函数
function updateHeaderRule(originalPort) {
  // 创建规则对象
  const headerRule = {
    id: activeRuleId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'xzytunnel',
        operation: 'set',
        value: originalPort  // 这里直接使用变量值，不使用模板字符串
      }]
    },
    condition: {
      domains: [CONFIG.targetDomain, `*.${CONFIG.targetDomain}`],
      urlFilter: '*'
    }
  };

  // 更新会话规则
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [activeRuleId],
    addRules: [headerRule]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("[XZY-Tunnel] 更新规则失败:", chrome.runtime.lastError);
    } else {
      logDebug(`已应用xzytunnel请求头规则，端口: ${originalPort}`);
      // 为下次更新准备新的规则ID
      activeRuleId = activeRuleId === 999 ? 1 : activeRuleId + 1;
    }
  });
}

// 替换原有的请求拦截器
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    try {
      // 确保它是主框架（顶级导航）
      if (details.frameId === 0) {
        logDebug(`检测到导航: ${details.url}`);
        
        // 检查和记录主机名
        const hostname = new URL(details.url).hostname;
        if (hostname.includes(CONFIG.targetDomain)) {
          recordConnection(hostname);
        }
        
        // 检查端口并处理
        const originalPort = getPortFromUrl(details.url);
        
        // 如果不是重定向端口，则进行重定向
        if (originalPort !== CONFIG.redirectPort.toString()) {
          logDebug(`需要重定向端口: ${originalPort} -> ${CONFIG.redirectPort}`);
          
          // 使用工具函数构建新URL
          const newUrl = buildUrlWithPort(details.url, CONFIG.redirectPort);
          
          // 重定向标签页
          chrome.tabs.update(details.tabId, { url: newUrl });
          logDebug(`已重定向到: ${newUrl}`);

          // 更新请求头规则以包含原始端口
          updateHeaderRule(originalPort);
        }
      }
    } catch (e) {
      console.error("URL解析错误:", e);
    }
  },
  { url: [
    { hostSuffix: CONFIG.targetDomain }
  ]}
);

// 记录检测到的连接
function recordConnection(hostname) {
  const connectionId = `${hostname}-${Date.now()}`;
  
  // 添加到连接列表，如果不存在
  if (!detectedConnections.some(conn => conn.id === connectionId)) {
    detectedConnections.push({ id: connectionId, name: hostname });
    // 最多保留最近10个连接
    if (detectedConnections.length > 10) {
      detectedConnections.shift();
    }
    // 保存到存储
    chrome.storage.local.set({ connections: detectedConnections });
  }
}

// 清除特定域名的缓存
function clearDomainCache(domain) {
  return new Promise((resolve, reject) => {
    try {
      chrome.browsingData.remove({
        "origins": [`https://${domain}`]
      }, {
        "cache": true,
        "cookies": true,
        "localStorage": true,
        "sessionStorage": true
      }, () => {
        logDebug(`已清除域名缓存: ${domain}`);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case "getConnections":
      sendResponse({ connections: detectedConnections });
      break;
    
    case "clearCache":
      if (request.domain) {
        clearDomainCache(request.domain)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.toString() }));
        return true; // 异步响应
      }
      break;
    
    case "setDebugMode":
      CONFIG.debugMode = request.enabled;
      sendResponse({ success: true });
      break;
  }
});

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  // 移除可能存在的旧会话规则
  chrome.declarativeNetRequest.getSessionRules(existingRules => {
    if (existingRules && existingRules.length > 0) {
      const ruleIdsToRemove = existingRules.map(rule => rule.id);
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: ruleIdsToRemove,
        addRules: []
      });
    }
  });

  // 其他初始化逻辑...
  chrome.storage.local.get(["connections", "debugMode"], (result) => {
    if (result.connections) {
      detectedConnections = result.connections;
    }
    
    if (result.debugMode !== undefined) {
      CONFIG.debugMode = result.debugMode;
    }
    
    logDebug("XZY-Tunnel扩展已初始化");
  });
});
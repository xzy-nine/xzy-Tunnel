// 导入工具函数
import { addXzyTunnelHeader, getPortFromUrl, buildUrlWithPort } from './utils/headers.js';
// 目标域名和端口配置
const CONFIG = {
  targetDomain: "", // 目标域名从存储中读取
  redirectPort: 9868, // 要重定向到的标准端口
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
  // 如果没有设置目标域名，则不添加规则
  if (!CONFIG.targetDomain) {
    logDebug("未设置目标域名，跳过添加请求头规则");
    return;
  }

  // 创建规则对象
  const headerRule = {
    id: activeRuleId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'xzytunnel',
        operation: 'set',
        value: originalPort
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

// 当前活跃的导航监听器
let activeListener = null;

// 根据目标域名设置导航监听器
function setupNavigationListener(domain) {
  // 如果存在旧监听器，先移除
  if (activeListener) {
    chrome.webNavigation.onBeforeNavigate.removeListener(activeListener);
  }
  
  if (!domain) return; // 如果没有域名，不设置监听器
  
  // 创建新的监听回调
  activeListener = (details) => {
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
  };
  
  // 添加新的监听器
  chrome.webNavigation.onBeforeNavigate.addListener(
    activeListener,
    { url: [{ hostSuffix: domain }] }
  );
  
  logDebug(`已设置导航监听器，目标域名: ${domain}`);
}

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
      chrome.browsingData.remove(
        { origins: [`https://${domain}`] },
        {
          cache: true,
          cookies: true,
          localStorage: true
        },
        () => {
          logDebug(`已清除域名缓存: ${domain}`);
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Promise 化 proxy 设置
const setProxy = enabled =>
  new Promise(res => {
    const mode = enabled ? 'system' : 'direct';
    chrome.proxy.settings.set({ value: { mode }, scope: 'regular' }, () => res({ success: true }));
  });

chrome.runtime.onMessage.addListener((req, sender, send) => {
  switch(req.action) {
    case "getConnections":
      send({ connections: detectedConnections });
      break;

    case "clearCache":
      clearDomainCache(req.domain)
        .then(() => send({ success: true }))
        .catch(e => send({ success: false, error: e.toString() }));
      return true;

    case "setDebugMode":
      CONFIG.debugMode = req.enabled;
      send({ success: true });
      break;

    case "setTargetDomain":
      CONFIG.targetDomain = req.domain;
      // 使用新域名更新导航监听器
      setupNavigationListener(req.domain);
      send({ success: true });
      break;

    case "setProxyState":
      setProxy(req.enabled).then(send);
      return true;

    case "bypassDomain":
      chrome.proxy.settings.get({ incognito: false }, config => {
        const value = config.value || {};
        const rules = value.rules || {};
        const bypassList = rules.bypassList || [];
        if (!bypassList.includes(req.domain)) {
          bypassList.push(req.domain);
        }
        const newValue = {
          ...value,
          rules: { ...rules, bypassList }
        };
        chrome.proxy.settings.set(
          { value: newValue, scope: 'regular' },
          () => send({ success: true })
        );
      });
      return true;
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
  chrome.storage.local.get(["connections", "debugMode", "targetDomain"], (result) => {
    if (result.connections) {
      detectedConnections = result.connections;
    }
    
    if (result.debugMode !== undefined) {
      CONFIG.debugMode = result.debugMode;
    }

    if (result.targetDomain) {
      CONFIG.targetDomain = result.targetDomain;
      // 使用保存的域名设置导航监听器
      setupNavigationListener(result.targetDomain);
    }
    
    logDebug("XZY-Tunnel扩展已初始化");
  });
});
// 将 sendMessage 封装为 Promise
const sendMsg = msg => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve))

// 统一状态展示
const show = (msg, type='') => {
  statusMessage.textContent = msg
  statusMessage.className = 'status ' + type
  setTimeout(()=> statusMessage.textContent = '', 3000)
}

// 清除缓存
async function clearDomainCache(domain) {
  show('正在清除缓存…')
  const res = await sendMsg({ action: 'clearCache', domain })
  show(res.success ? `已清除 ${domain} 的缓存` : `清除失败: ${res.error}`, res.success ? 'success' : 'error')
}

// 加载连接列表
async function loadConnections() {
  const { connections = [] } = await sendMsg({ action: 'getConnections' })
  displayConnections(connections)
}

// 切换代理
async function handleToggleProxy() {
  const res = await sendMsg({ action: 'setProxyState', enabled: false })
  show(res.success ? '代理已禁用' : `操作失败: ${res.error}`, res.success ? 'success' : 'error')
}

// 显示连接列表
function displayConnections(connections) {
  connectionList.innerHTML = '';
  
  if (connections.length === 0) {
    connectionList.innerHTML = '<div class="empty-message">暂未检测到连接</div>';
    return;
  }
  
  connections.forEach(conn => {
    const item = document.createElement('div');
    item.className = 'connection-item';
    
    const name = document.createElement('div');
    name.className = 'connection-name';
    name.textContent = conn.name;
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清除缓存';
    clearBtn.addEventListener('click', () => {
      clearDomainCache(conn.name);
    });
    
    item.appendChild(name);
    item.appendChild(clearBtn);
    connectionList.appendChild(item);
  });
}

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['debugMode', 'targetDomain'], result => {
    debugModeCheckbox.checked = !!result.debugMode;
    if (result.targetDomain) {
      targetDomainInput.value = result.targetDomain;
    }
  });
}

// 设置调试模式
function setDebugMode(enabled) {
  sendMsg({ action: "setDebugMode", enabled }).then(response => {
    if (response && response.success) {
      chrome.storage.local.set({ debugMode: enabled });
      show(`调试模式${enabled ? '已开启' : '已关闭'}`, 'success');
    }
  });
}

// 设置目标域名
function setTargetDomain(domain) {
  sendMsg({ action: "setTargetDomain", domain }).then(response => {
    if (response && response.success) {
      chrome.storage.local.set({ targetDomain: domain });
      show(`目标域名已设置为 ${domain}`, 'success');
    } else {
      show(`设置失败: ${response?.error || '未知错误'}`, 'error');
    }
  });
}

// 当前页面加入非代理名单
function handleBypassCurrent() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const url = tabs[0]?.url;
    if (!url) {
      show('获取页面信息失败', 'error');
      return;
    }
    const hostname = new URL(url).hostname;
    sendMsg({ action: 'bypassDomain', domain: hostname }).then(response => {
      if (response?.success) {
        show(`已将 ${hostname} 加入非代理名单`, 'success');
      } else {
        show(`操作失败: ${response?.error}`, 'error');
      }
    });
  });
}

// 初始化UI
function initializeUI() {
  loadConnections();
  loadSettings();
}

// 设置事件监听器
function setupEventListeners() {
  // 清除缓存按钮事件
  clearCacheBtn.addEventListener('click', () => {
    chrome.storage.local.get('targetDomain', ({ targetDomain }) => {
      const domain = targetDomain?.trim();
      if (!domain) {
        show('请先设置目标域名', 'error');
        return;
      }
      clearDomainCache(domain);
    });
  });
  
  // 调试模式切换
  debugModeCheckbox.addEventListener('change', () => {
    setDebugMode(debugModeCheckbox.checked);
  });

  // 保存目标域名
  saveTargetDomainBtn.addEventListener('click', () => {
    const domain = targetDomainInput.value.trim();
    if (!domain) {
      show('请输入目标域名', 'error');
      return;
    }
    setTargetDomain(domain);
  });

  // 切换代理状态
  toggleProxyBtn.addEventListener('click', handleToggleProxy);

  // 当前页面加入非代理名单
  bypassCurrentBtn.addEventListener('click', handleBypassCurrent);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const connectionList = document.getElementById('connectionList');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const debugModeCheckbox = document.getElementById('debugMode');
  const statusMessage = document.getElementById('statusMessage');
  const targetDomainInput = document.getElementById('targetDomainInput');
  const saveTargetDomainBtn = document.getElementById('saveTargetDomainBtn');
  const toggleProxyBtn = document.getElementById('toggleProxyBtn');
  const bypassCurrentBtn = document.getElementById('bypassCurrentBtn');
  
  initializeUI();
  setupEventListeners();
});
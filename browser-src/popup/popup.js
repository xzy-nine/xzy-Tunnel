document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const connectionList = document.getElementById('connectionList');
  const cacheDomainInput = document.getElementById('cacheDomain');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const debugModeCheckbox = document.getElementById('debugMode');
  const statusMessage = document.getElementById('statusMessage');
  
  // 初始化UI
  initializeUI();
  
  // 事件监听器设置
  setupEventListeners();
  
  // 初始化UI函数
  function initializeUI() {
    loadConnections();
    loadSettings();
  }
  
  // 设置事件监听器
  function setupEventListeners() {
    // 清除缓存按钮事件
    clearCacheBtn.addEventListener('click', handleClearCache);
    
    // 调试模式切换
    debugModeCheckbox.addEventListener('change', () => {
      setDebugMode(debugModeCheckbox.checked);
    });
  }
  
  // 处理清除缓存按钮点击
  function handleClearCache() {
    const domain = cacheDomainInput.value.trim();
    if (!domain) {
      showStatus('请输入域名', 'error');
      return;
    }
    
    clearDomainCache(domain);
  }
  
  // 加载连接列表
  function loadConnections() {
    chrome.runtime.sendMessage({ action: "getConnections" }, response => {
      if (response && response.connections) {
        displayConnections(response.connections);
      }
    });
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
  
  // 清除指定域名的缓存
  function clearDomainCache(domain) {
    showStatus('正在清除缓存...');
    
    chrome.runtime.sendMessage(
      { 
        action: "clearCache", 
        domain: domain 
      }, 
      response => {
        if (response && response.success) {
          showStatus(`已清除 ${domain} 的缓存`, 'success');
        } else {
          showStatus(`清除失败: ${response?.error || '未知错误'}`, 'error');
        }
      }
    );
  }
  
  // 加载设置
  function loadSettings() {
    chrome.storage.local.get(['debugMode'], result => {
      debugModeCheckbox.checked = !!result.debugMode;
    });
  }
  
  // 设置调试模式
  function setDebugMode(enabled) {
    chrome.runtime.sendMessage(
      { 
        action: "setDebugMode", 
        enabled: enabled 
      }, 
      response => {
        if (response && response.success) {
          chrome.storage.local.set({ debugMode: enabled });
          showStatus(`调试模式${enabled ? '已开启' : '已关闭'}`, 'success');
        }
      }
    );
  }
  
  // 显示状态消息
  function showStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status ' + type;
    
    // 3秒后清除消息
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status';
    }, 3000);
  }
});
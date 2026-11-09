// 设置页面逻辑

document.addEventListener('DOMContentLoaded', loadSettings);

/**
 * 从 chrome.storage.local 加载设置
 */
function loadSettings() {
    chrome.storage.local.get(['joplinToken', 'joplinUrl'], (result) => {
        if (result.joplinToken) {
            document.getElementById('joplinToken').value = result.joplinToken;
        }
        if (result.joplinUrl) {
            document.getElementById('joplinUrl').value = result.joplinUrl;
        }
    });
}

/**
 * 保存设置到 chrome.storage.local
 */
document.getElementById('saveBtn').addEventListener('click', () => {
    const token = document.getElementById('joplinToken').value.trim();
    const url = document.getElementById('joplinUrl').value.trim() || 'http://127.0.0.1:41184';
    
    if (!token) {
        showStatus('请输入 Joplin API Token', 'error');
        return;
    }

    chrome.storage.local.set({ 
        joplinToken: token,
        joplinUrl: url
    }, () => {
        showStatus('设置已保存！', 'success');
    });
});

/**
 * 清除 Token
 */
document.getElementById('clearBtn').addEventListener('click', () => {
    chrome.storage.local.get(['joplinUrl'], (result) => {
        const url = result.joplinUrl || 'http://127.0.0.1:41184';
        chrome.storage.local.set({ joplinToken: '' }, () => {
            document.getElementById('joplinToken').value = '';
            showStatus('Token 已清除', 'success');
        });
    });
});

/**
 * 显示状态消息
 * @param {string} message - 状态消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 */
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    
    setTimeout(() => {
        statusEl.className = 'status';
    }, 3000);
}

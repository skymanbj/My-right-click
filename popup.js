// 「我的右键」popup 设置面板逻辑
//
// 注意：Manifest V3 的 CSP 禁止扩展页面执行内联 <script>，
// 所以这段逻辑必须放在外部 js 文件里，由 popup.html 通过 src 引入。

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    document.getElementById('saveBtn').addEventListener('click', () => {
        const token = document.getElementById('joplinToken').value.trim();
        const url = document.getElementById('joplinUrl').value.trim() || 'http://127.0.0.1:41184';

        if (!token) {
            showStatus('请输入 Joplin API Token', 'error');
            return;
        }

        chrome.storage.local.set({ joplinToken: token, joplinUrl: url }, () => {
            showStatus('设置已保存！', 'success');
        });
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        chrome.storage.local.get(['joplinUrl'], (result) => {
            const url = result.joplinUrl || 'http://127.0.0.1:41184';
            chrome.storage.local.set({ joplinToken: '', joplinUrl: url }, () => {
                document.getElementById('joplinToken').value = '';
                showStatus('Token 已清除', 'success');
            });
        });
    });
});

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

function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    setTimeout(() => {
        statusEl.className = 'status';
    }, 3000);
}

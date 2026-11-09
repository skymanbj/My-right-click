(function() {
    let toolbar = null;
    let shadow = null;
    let isToolbarCreated = false;

    // 创建工具栏并注入 Shadow DOM
    function createToolbar() {
        // 防重复创建机制
        if (isToolbarCreated) {
            console.log('[Toolbar] 工具栏已存在，跳过创建');
            return;
        }
        
        // 检查是否已存在容器
        const existingContainer = document.getElementById('my-right-click-toolbar-container');
        if (existingContainer) {
            console.log('[Toolbar] 工具栏容器已存在，隐藏后返回');
            existingContainer.style.display = 'none';
            return;
        }
        
        isToolbarCreated = true;
        
        const container = document.createElement('div');
        container.id = 'my-right-click-toolbar-container';
        container.style.position = 'absolute';
        container.style.zIndex = '2147483647';
        document.body.appendChild(container);

        shadow = container.attachShadow({ mode: 'open' });
        
        toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        
        const style = document.createElement('style');
        style.textContent = `
            .toolbar {
                display: flex;
                align-items: center;
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 12px;
                padding: 5px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                gap: 2px;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
                border: 0.5px solid rgba(255, 255, 255, 0.3);
            }
            button {
                background: transparent;
                border: none;
                color: #2c3e50;
                cursor: pointer;
                font-size: 13px;
                padding: 6px 10px;
                border-radius: 8px;
                transition: all 0.2s cubic-bezier(0.12, 0, 0.39, 0);
                white-space: nowrap;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            button:hover {
                background: rgba(0, 0, 0, 0.05);
            }
            button:active {
                background: rgba(0, 0, 0, 0.1);
                transform: scale(0.95);
            }
            /* 按钮间的分割线 */
            button + button {
                border-left: 0.5px solid rgba(0, 0, 0, 0.1);
            }
            button.close {
                color: #ff3b30;
                font-size: 18px;
                font-weight: 300;
                padding: 6px 12px;
            }
            button.close:hover {
                background: rgba(255, 59, 48, 0.1);
            }
            .translation-result {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: #1c1c1e;
                padding: 12px;
                margin-top: 10px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                font-size: 14px;
                line-height: 1.4;
                border: 0.5px solid rgba(0, 0, 0, 0.1);
                max-width: 320px;
                z-index: 2147483647;
                word-wrap: break-word;
                animation: slideDown 0.3s ease-out;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        
        shadow.appendChild(style);
        shadow.appendChild(toolbar);

        const buttons = [
            { id: 'btn-open', text: '打开', action: 'open_url' },
            { id: 'btn-md', text: 'MD', action: 'copy_md' },
            { id: 'btn-joplin', text: 'Joplin', action: 'share_joplin' },
            { id: 'btn-np', text: 'Note', action: 'share_txt_notepad' },
            { id: 'btn-html', text: 'HTML', action: 'share_html' },
            { id: 'btn-add', text: 'Add', action: 'copy_merge_add' },
            { id: 'btn-qr', text: 'QR', action: 'qr_gen_sel' },
            { id: 'btn-ip', text: '域名/IP', action: 'extract_domain_ip' },
            { id: 'btn-model', text: 'Model', action: 'extract_model_ids' },
            { id: 'btn-trans', text: 'Trans', action: 'translate_hover' },
            { id: 'btn-search', text: 'Search', action: 'search_default' },
            { id: 'btn-github', text: 'GitHub', action: 'search_github', title: '用选中文字在 GitHub 中搜索' }
        ];

        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.id = btn.id;
            b.textContent = btn.text;
            if (btn.title) b.title = btn.title;
            b.onclick = (e) => {
                e.stopPropagation();
                handleAction(btn.action);
            };
            toolbar.appendChild(b);
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'close';
        closeBtn.onclick = hideToolbar;
        toolbar.appendChild(closeBtn);

        const resultDiv = document.createElement('div');
        resultDiv.className = 'translation-result';
        resultDiv.id = 'trans-result';
        shadow.appendChild(resultDiv);

        hideToolbar();
    }

    function handleAction(action) {
        const selText = window.getSelection().toString().trim();
        
        if (!selText && action !== 'share_joplin') {
            return;
        }

        if (action === 'translate_hover') {
            showTransResult("翻译中...");
            // 默认翻译成中文，可以根据需要修改
            chrome.runtime.sendMessage({ type: 'translate_text', text: selText, targetLang: 'zh-CN' }, response => {
                if (response && response.success) {
                    showTransResult(response.result);
                } else {
                    showTransResult("翻译失败，请重试");
                }
            });
            return;
        }

        try {
            chrome.runtime.sendMessage({ type: 'toolbar_action', action: action, text: selText }).catch(e => {
                if (e.message.includes("Receiving end does not exist")) {
                    // Service worker 暂未启动，忽略——点击右键菜单也能触发
                } else if (e.message.includes("Extension context invalidated")) {
                    alert("我的右键：扩展已更新，请刷新当前网页后重试。");
                }
            });
        } catch (e) {
            // 同步错误（极少发生）静默忽略
        }
        if (action !== 'copy_merge_add') hideToolbar();
    }

    function showTransResult(text) {
        const resDiv = shadow.getElementById('trans-result');
        resDiv.textContent = text;
        resDiv.style.display = 'block';
    }

    function hideToolbar() {
        if (!toolbar) return;
        const container = toolbar.parentNode.host;
        if (container) container.style.display = 'none';
        if (shadow) shadow.getElementById('trans-result').style.display = 'none';
    }

    function showToolbar(x, y) {
        if (!toolbar) createToolbar();
        if (!toolbar) return; // 创建失败则返回
        
        const container = toolbar.parentNode.host;
        if (!container) return;
        
        container.style.display = 'block';
        // 按工具栏实际宽度收敛左右位置，按钮增多后也不会被屏幕右边缘裁切
        const width = toolbar.getBoundingClientRect().width || 360;
        const left = Math.max(10, Math.min(window.innerWidth - width - 10, x));
        // 定位在选中区域下方
        container.style.left = left + 'px';
        container.style.top = (y + window.scrollY + 20) + 'px';
    }

    // 监听选中事件
    document.addEventListener('mouseup', function(e) {
        // 只处理左键松开
        if (e.button !== 0) return;

        const selection = window.getSelection();
        const selText = selection.toString().trim();

        if (selText.length > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            // 在选中文字的中心下方显示，最终边界收敛由 showToolbar 按实际宽度处理
            const left = rect.left + (rect.width / 2) - 120;
            showToolbar(left, rect.bottom);
        } else {
            // 如果点击的不是工具栏本身且没有选中文字，则隐藏
            if (toolbar && !e.composedPath().includes(toolbar.parentNode.host)) {
                hideToolbar();
            }
        }
    });

    // 监听背景消息（如果需要）
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'hide_toolbar') hideToolbar();
    });

})();

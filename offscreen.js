chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Offscreen] 收到消息:", message);
    
    if (message.target !== 'offscreen') return;

    if (message.type === 'ping') {
        console.log("[Offscreen] 响应 ping");
        sendResponse('pong');
        return;
    }

    if (message.type === 'copy-to-clipboard') {
        console.log("[Offscreen] 开始复制，内容长度:", message.data?.length);
        handleClipboardWrite(message.data).then(success => {
            console.log("[Offscreen] 复制完成，结果:", success);
            sendResponse({ success });
        }).catch(err => {
            console.error("[Offscreen] 复制失败:", err);
            sendResponse({ success: false });
        });
        return true; // 保持异步通道
    }
});

async function handleClipboardWrite(data) {
    try {
        // 尝试现代 API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            console.log("[Offscreen] 使用 navigator.clipboard");
            await navigator.clipboard.writeText(data);
            console.log("[Offscreen] navigator.clipboard 成功");
            return true;
        }
    } catch (err) {
        console.log("[Offscreen] navigator.clipboard 失败:", err);
        // 忽略 API 失败，尝试传统方法
    }
    
    try {
        const textArea = document.getElementById('temp-copy-area');
        if (textArea) {
            console.log("[Offscreen] 使用 execCommand");
            textArea.value = data;
            // 强行获取焦点和选中
            window.focus();
            textArea.focus();
            textArea.select();
            const success = document.execCommand('copy');
            console.log("[Offscreen] execCommand 结果:", success);
            return success;
        }
    } catch (err) {
        console.error("[Offscreen] execCommand 失败:", err);
        return false;
    }
    return false;
}

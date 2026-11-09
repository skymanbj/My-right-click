// --- 全局配置与导入 ---
// 在 MV3 Service Worker 中必须使用 importScripts 加载依赖
importScripts('jsqrcode.min.js', 'functions.js');

// --- 基础配置 ---
const services = {
    search: {
        google: "https://www.google.com/search?q=",
        baidu: "https://www.baidu.com/s?wd=",
        bing: "https://www.bing.com/search?q=",
        youtube: "https://www.youtube.com/results?search_query=",
        github: "https://github.com/search?q=",
        taobao: "https://s.taobao.com/search?q=",
        jd: "https://search.jd.com/Search?keyword=",
        pinduoduo: "https://mobile.yangkeduo.com/search_result.html?search_key=",
        duckduckgo: "https://duckduckgo.com/?q=",
        bingcn: "https://cn.bing.com/search?q=",
        so: "https://www.so.com/s?q="
    },
    translate: {
        google_cn: "https://translate.google.com/?sl=auto&tl=zh-CN&text=",
        google_en: "https://translate.google.com/?sl=auto&tl=en&text=",
        youdao: "https://dict.youdao.com/search?q=",
        bing: "https://www.bing.com/translator/?to=zh-Hans&text=",
        baidu_dict: "https://dict.baidu.com/s?wd="
    },
    tools: {
        whois: "https://whois.chinaz.com/",
        ip: "https://haoip.cn/ip/",
        ping: "https://ping.chinaz.com/",
        beian: "https://tool.chinaz.com/beian.aspx?s=",
        speed: "https://www.tool.la/SiteSpeed/?q=",
        sameip: "https://tool.chinaz.com/Same/?s="
    },
    share: {
        joplin: "joplin://x-callback-url/createNote?title={title}&body={body}&source={url}"
    }
};

// let copyBuffer = []; // MV3 中不建议使用全局变量，改为使用 chrome.storage.local

// --- 工具函数 ---
function openUrl(url) {
    chrome.tabs.create({ url });
}

function getHost(url) {
    if (!url) return "";
    try {
        if (url.includes("://")) {
            return new URL(url).hostname;
        }
        const tempUrl = new URL(url.startsWith('http') ? url : 'http://' + url);
        return tempUrl.hostname;
    } catch (e) {
        const match = url.match(/([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,6}/i);
        return match ? match[0] : "";
    }
}

/**
 * 从文本中提取所有不重复的域名和 IP 地址
 */
function extractAllMatches(text) {
    if (!text) return [];
    // 匹配域名和 IPv4 地址
    const domainRegex = /([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,6}/gi;
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

    const domainMatches = text.match(domainRegex) || [];
    const ipMatches = text.match(ipRegex) || [];


    // 合并、去重并转为小写（域名部分）
    const all = [...domainMatches.map(d => d.toLowerCase()), ...ipMatches];
    return [...new Set(all)];
}


/**
 * 从文本中提取所有 AI 模型 ID
 */
function extractModelIds(text) {
  if (!text) return [];

  const matches = new Set();

  // 1. org/name (Hugging Face / Ollama): moonshotai/kimi-k2.6, z-ai/glm-5.1
  const hfRegex = /[a-zA-Z0-9][a-zA-Z0-9\-]*\/[a-zA-Z0-9][a-zA-Z0-9\-._]*/g;
  for (const m of text.matchAll(hfRegex)) {
    matches.add(m[0]);
  }

  // 2. name:size (Ollama): deepseek-r1:70b, llama3:8b
  const colonSizeRegex = /[a-zA-Z][a-zA-Z0-9]*(?:[-.][a-zA-Z0-9]+)*:\d+[bBmMfF]/g;
  for (const m of text.matchAll(colonSizeRegex)) {
    matches.add(m[0]);
  }

  // 3. Common AI model prefixes + version/suffix
  const modelPrefixes = [
    'qwen', 'deepseek', 'claude', 'gpt', 'llama', 'mistral', 'mixtral',
    'gemma', 'gemini', 'grok', 'falcon', 'phi', 'yi', 'chatglm', 'baichuan',
    'codestral', 'codellama', 'starcoder', 'command-r', 'wizardlm',
    'vicuna', 'alpaca', 'orca', 'solar', 'internlm', 'minicpm', 'glm',
    'kimi', 'moonshot', 'doubao', 'hunyuan', 'ernie', 'skywork', 'aquila',
    'cogview', 'abab', 'spark', 'wenxin', 'o1', 'o3', 'o4'
  ];
  const prefixPattern = modelPrefixes.join('|');
  const broadRegex = new RegExp(
    '\\b(' + prefixPattern + ')[a-zA-Z0-9]*(?:[-.][a-zA-Z0-9]+)*\\b',
    'gi'
  );
  for (const m of text.matchAll(broadRegex)) {
    matches.add(m[0]);
  }

  // 4. Size suffix: xxx-7b, xxx-70b
  const sizeRegex = /\b[a-zA-Z][a-zA-Z0-9]*(?:[-.][a-zA-Z0-9]+)*[-]\d+[bB]\b/g;
  for (const m of text.matchAll(sizeRegex)) {
    matches.add(m[0]);
  }

  // Filter false positives
  const results = [...matches].filter(id => {
    if (id.length < 3) return false;
    if (/^\d+$/.test(id)) return false;
    if (/^(css|js|img|images?|assets?|static|dist|build|node_modules|src|lib|fonts?|icons?|svg|png|jpg|jpeg|gif|webp|woff|ttf|eot)/i.test(id)) return false;
    if (id.includes('/')) {
      const org = id.split('/')[0];
      if (/^(com|org|net|io|www|cdn|api|docs|blog|wiki|github|npm|pypi|google|microsoft|apple|amazon|facebook|meta|twitter)/i.test(org)) return false;
    }
    // Filter bare prefix with no suffix (e.g. just "gpt" or "yi" alone)
    if (id.length <= 3 && !/\d/.test(id)) return false;
    return true;
  });

  return results;
}

/**
 * 从文本中提取所有可能存在的有效网址
 * 支持：http/https/ftp链接、www.开头网址、无协议常见域名、IP及端口
 */
function extractUrls(text) {
    if (!text) return [];
    text = text.trim();

    // 清洗首尾非URL常见字符（括号、引号、标点等）
    const cleanUrl = (u) => {
        return u.replace(/^["'“‘（(《<\[]+|["'”’）)》>\]、。，；!！?？:：]+$/g, '');
    };

    const urls = [];

    // 1. 标准协议开头 (http://, https://, ftp://)
    const protocolRegex = /\b(https?|ftp):\/\/[^\s"'<>\[\](){}（）《》“”‘’\u4e00-\u9fa5]+/gi;
    let match;
    while ((match = protocolRegex.exec(text)) !== null) {
        const cleaned = cleanUrl(match[0]);
        if (cleaned && !urls.includes(cleaned)) {
            urls.push(cleaned);
        }
    }

    // 2. www. 开头
    const wwwRegex = /\bwww\.[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)+(:[0-9]+)?(\/[^\s"'<>\[\](){}（）《》“”‘’\u4e00-\u9fa5]*)?/gi;
    while ((match = wwwRegex.exec(text)) !== null) {
        let u = cleanUrl(match[0]);
        if (u) {
            if (!/^https?:\/\//i.test(u)) {
                u = 'https://' + u;
            }
            if (!urls.includes(u)) {
                urls.push(u);
            }
        }
    }

    // 3. 常见顶级域名或 IP 地址（无协议头，例如 bilibili.com/video/xxx, 192.168.1.1:8080）
    if (urls.length === 0) {
        const trimmed = cleanUrl(text);
        const domainOrIpRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+(com|cn|org|net|io|me|cc|top|xyz|info|edu|gov|vip|site|app|dev|wiki|tv|co|jp|uk|de|hk|tw|club|online|store)(:[0-9]+)?(\/[^\s]*)?$/i;
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(:[0-9]+)?(\/[^\s]*)?$/;
        if (domainOrIpRegex.test(trimmed) || ipRegex.test(trimmed)) {
            urls.push('https://' + trimmed);
        } else {
            // 在文本中查找常见的域名格式词
            const inlineDomainRegex = /\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+(com|cn|org|net|io|me|cc|top|xyz|info|edu|gov|vip|site|app|dev|wiki|tv|co|jp|uk|de|hk|tw|club|online|store)(:[0-9]+)?(\/[^\s"'<>\[\](){}（）《》“”‘’\u4e00-\u9fa5]*)?/gi;
            while ((match = inlineDomainRegex.exec(text)) !== null) {
                let u = cleanUrl(match[0]);
                if (u) {
                    if (!/^https?:\/\//i.test(u)) {
                        u = 'https://' + u;
                    }
                    if (!urls.includes(u)) {
                        urls.push(u);
                    }
                }
            }
        }
    }

    return urls;
}

/**
 * 处理“在浏览器打开网址”操作
 */
function handleOpenUrl(text, linkUrl) {
    if (linkUrl) {
        openUrl(linkUrl);
        return;
    }
    if (!text) {
        notify("使用提示", "请先用鼠标划词选中文本中的网址，再点击此菜单");
        return;
    }
    const urls = extractUrls(text);
    if (urls.length === 0) {
        notify("未识别到网址", "选中文本中没有找到有效网址");
        return;
    }
    urls.forEach(url => openUrl(url));
    if (urls.length > 1) {
        notify("打开网址", `已在浏览器打开 ${urls.length} 个网址`);
    }
}

function notify(title, message) {
    // 1. 系统通知 (保持原有逻辑，安全回调)
    const notificationId = "notify_" + Date.now();
    chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "myright48.png",
        title: title || "我的右键",
        message: message || ""
    }, () => {
        if (chrome.runtime.lastError) {
            // 忽略没有权限或失败的情况
        }
    });
    console.log(`[Notification] ${title}: ${message}`);

    // 2. 网页内注入精美气泡提示 (Toast)
    showToastOnActiveTab(title, message);
}

/**
 * 在当前活动页面注入并显示一个高颜值的玻璃拟态 Toast 提示
 */
async function showToastOnActiveTab(title, message) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        // 避免在无法注入脚本的特殊页面（如 chrome://, edge://, about:）尝试注入
        const blockedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'devtools:', 'view-source:'];
        if (blockedProtocols.some(proto => tab.url && tab.url.startsWith(proto))) {
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (t, m) => {
                // 确保容器存在
                let container = document.getElementById('my-right-click-toast-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'my-right-click-toast-container';
                    container.style.cssText = `
                        position: fixed;
                        top: 24px;
                        right: 24px;
                        z-index: 2147483647;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        pointer-events: none;
                    `;
                    document.body.appendChild(container);
                }

                // 创建 Toast 卡片
                const toast = document.createElement('div');
                toast.style.cssText = `
                    pointer-events: auto;
                    background: rgba(20, 20, 22, 0.88);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 12px;
                    padding: 14px 22px;
                    color: #ffffff;
                    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-size: 14px;
                    min-width: 260px;
                    max-width: 400px;
                    transform: translateX(100px);
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                `;

                // 根据类型确定颜色和图标
                let statusColor = '#007aff'; // 默认蓝色
                let statusIcon = 'ℹ️';

                const isSuccess = /成功|完成|已/.test(t);
                const isFail = /失败|无法|异常|错误/.test(t);

                if (isSuccess) {
                    statusColor = '#34c759'; // 成功绿
                    statusIcon = '✅';
                } else if (isFail) {
                    statusColor = '#ff3b30'; // 失败红
                    statusIcon = '❌';
                }

                // 图标
                const iconEl = document.createElement('span');
                iconEl.style.cssText = `
                    font-size: 18px;
                    line-height: 1;
                    user-select: none;
                `;
                iconEl.textContent = statusIcon;

                // 文字内容容器
                const textContainer = document.createElement('div');
                textContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                `;

                // 标题
                const titleEl = document.createElement('div');
                titleEl.style.cssText = `
                    font-weight: 600;
                    color: ${statusColor};
                    line-height: 1.3;
                `;
                titleEl.textContent = t;

                // 消息
                const msgEl = document.createElement('div');
                msgEl.style.cssText = `
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 13px;
                    line-height: 1.4;
                    word-break: break-all;
                `;
                msgEl.textContent = m;

                textContainer.appendChild(titleEl);
                textContainer.appendChild(msgEl);
                
                toast.appendChild(iconEl);
                toast.appendChild(textContainer);
                container.appendChild(toast);

                // 进场动画
                requestAnimationFrame(() => {
                    toast.style.transform = 'translateX(0)';
                    toast.style.opacity = '1';
                });

                // 3秒后淡出并自动销毁
                setTimeout(() => {
                    toast.style.transform = 'translateX(50px)';
                    toast.style.opacity = '0';
                    setTimeout(() => {
                        toast.remove();
                        if (container.children.length === 0) {
                            container.remove();
                        }
                    }, 400);
                }, 3000);
            },
            args: [title, message]
        });
    } catch (err) {
        console.warn('[showToast] 气泡提示注入失败:', err);
    }
}


/**
 * 提取域名对应的 IP (使用 Google DoH API)
 */
async function getDomainIP(hostname) {
    console.log("[getDomainIP] 正在查询:", hostname);
    if (!hostname || hostname === "localhost" || hostname.includes(":") || hostname.split('.').length < 2) {
        console.warn("[getDomainIP] 无效或本地域名:", hostname);
        return "";
    }

    // 定义多个 DoH 提供商，按优先级排序
    const providers = [
        { name: "Alidns", url: `https://dns.alidns.com/resolve?name=${hostname}&type=1` },
        { name: "Google", url: `https://dns.google/resolve?name=${hostname}&type=A` },
        { name: "Cloudflare", url: `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A` }
    ];

    for (const provider of providers) {
        try {
            console.log(`[getDomainIP] 尝试使用 ${provider.name} 解析...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时，尽快切换下一个

            const response = await fetch(provider.url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/dns-json' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.Answer && data.Answer.length > 0) {
                // 过滤出 A 记录 (type 1)
                const aRecord = data.Answer.find(item => item.type === 1);
                if (aRecord) {
                    console.log(`[getDomainIP] ${provider.name} 解析成功:`, aRecord.data);
                    return aRecord.data;
                }
            }
            console.log(`[getDomainIP] ${provider.name} 未返回 A 记录`);
        } catch (e) {
            console.warn(`[getDomainIP] ${provider.name} 解析异常:`, e.name === 'AbortError' ? '超时' : e.message);
        }
    }

    console.error("[getDomainIP] 所有 DNS 接口均解析失败");
    return "";
}

/**
 * 核心复制控制 (MV3 标准离屏页面版)
 * 使用 Offscreen Document 彻底解决剪贴板写入稳定性问题
 */
async function copyToClipboardOffscreen(text) {
    console.log("[copyToClipboard] 开始，文本长度:", text?.length);
    if (!text) {
        console.log("[copyToClipboard] 文本为空，返回 false");
        return false;
    }

    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    console.log("[copyToClipboard] 离屏页面 URL:", offscreenUrl);

    // 检查并创建离屏文档
    console.log("[copyToClipboard] 检查现有离屏文档...");
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });
    console.log("[copyToClipboard] 现有离屏文档数量:", existingContexts.length);

    if (existingContexts.length === 0) {
        console.log("[copyToClipboard] 创建新的离屏文档...");
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['CLIPBOARD'],
            justification: 'Write text to clipboard'
        });
        console.log("[copyToClipboard] 离屏文档已创建");

        // 探测就绪状态
        console.log("[copyToClipboard] 开始探测就绪状态...");
        let ready = false;
        for (let i = 0; i < 15; i++) {
            try {
                const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'ping' });
                console.log(`[copyToClipboard] Ping 尝试 ${i + 1}, 响应:`, response);
                if (response === 'pong') {
                    ready = true;
                    break;
                }
            } catch (e) {
                console.log(`[copyToClipboard] Ping 尝试 ${i + 1} 失败:`, e.message);
                await new Promise(r => setTimeout(r, 100));
            }
        }
        if (!ready) {
            console.error("[copyToClipboard] 离屏文档未就绪");
            return false;
        }
        console.log("[copyToClipboard] 离屏文档已就绪，等待 100ms...");
        // 就绪后稍微缓冲一下，确保 DOM 稳定
        await new Promise(r => setTimeout(r, 100));
    }

    // 发送数据并等待执行结果反馈
    try {
        console.log("[copyToClipboard] 发送消息到离屏页面，内容长度:", text.length);
        const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'copy-to-clipboard',
            data: text
        });
        console.log("[copyToClipboard] 收到离屏页面响应:", response);
        return response && response.success;
    } catch (e) {
        console.error("[copyToClipboard] 发送消息失败:", e);
        return false;
    }
}

/**
 * Markdown 转换与复制/分享 (MV3 专用增强版)
 * @param {string} target - 'clipboard' 或 'joplin'
 */
function copyToMarkdown(tabId, frameId, pageUrl, pageTitle, target = 'clipboard') {
    // 立即显示正在处理的通知
    if (target === 'clipboard') {
        notify("正在处理", "正在转换网页内容为 Markdown...");
    } else {
        notify("正在分享", "正在生成正文并发送至 Joplin...");
    }

    chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId || 0] },
        func: (url, title, targetMode) => {
            function nodeToMd(node, depth = 0) {
                let md = "";
                if (!node) return md;

                let tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
                let isTableStructure = ['table', 'thead', 'tbody', 'tr'].includes(tag);

                let children = node.childNodes;
                for (let i = 0; i < children.length; i++) {
                    let child = children[i];

                    if (child.nodeType === Node.TEXT_NODE) {
                        if (isTableStructure && !child.textContent.trim()) continue;
                        md += child.textContent;
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        let tag = child.tagName.toLowerCase();
                        switch (tag) {
                            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                                const hLevel = parseInt(tag[1]);
                                md += '\n\n' + '#'.repeat(hLevel) + ' ' + nodeToMd(child, 0).trim() + '\n\n';
                                break;
                            case 'p':
                                md += '\n\n' + nodeToMd(child, 0).trim() + '\n\n';
                                break;
                            case 'ul': case 'ol':
                                md += '\n' + nodeToMd(child, depth + 1) + '\n';
                                break;
                            case 'li':
                                let indent = (depth > 1) ? '  '.repeat(depth - 1) : '';
                                md += indent + '* ' + nodeToMd(child, depth).trim() + '\n';
                                break;
                            case 'strong': case 'b':
                                md += '**' + nodeToMd(child, depth) + '**';
                                break;
                            case 'em': case 'i':
                                md += '*' + nodeToMd(child, depth) + '*';
                                break;
                            case 'a':
                                let href = child.getAttribute('href');
                                let label = nodeToMd(child, depth).trim();
                                if (label && href && !href.startsWith('#')) {
                                    md += '[' + label + '](' + href + ')';
                                } else {
                                    md += label;
                                }
                                break;
                            case 'br': md += '\n'; break;
                            case 'pre':
                                let preContent = child.textContent;
                                if (preContent.startsWith('Copy')) preContent = preContent.replace(/^Copy\n?/, '');
                                md += '\n\n```\n' + preContent.trim() + '\n```\n\n';
                                break;
                            case 'code':
                                if (child.closest('pre')) break;
                                md += '`' + child.textContent + '`';
                                break;
                            case 'img':
                                let src = child.getAttribute('src');
                                let alt = child.getAttribute('alt') || '';
                                md += '![' + alt + '](' + src + ')';
                                break;
                            case 'table':
                                md += '\n\n' + nodeToMd(child, depth).trim() + '\n\n';
                                break;
                            case 'thead': case 'tbody':
                                md += nodeToMd(child, depth);
                                break;
                            case 'tr':
                                let rowCells = [];
                                for (let j = 0; j < child.childNodes.length; j++) {
                                    let c = child.childNodes[j];
                                    if (c.nodeType === Node.ELEMENT_NODE && (c.tagName === 'TH' || c.tagName === 'TD')) {
                                        let cellContent = nodeToMd(c, depth).trim().replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
                                        rowCells.push(cellContent);
                                    }
                                }
                                if (rowCells.length > 0) {
                                    md += '| ' + rowCells.join(' | ') + ' |\n';
                                    if (child.querySelector('th')) {
                                        md += '| ' + rowCells.map(() => ' --- ').join('|') + ' |\n';
                                    }
                                }
                                break;
                            case 'th': case 'td': break;
                            case 'script': case 'style': break;
                            default: md += nodeToMd(child, depth);
                        }
                    }
                }
                return md;
            }

            try {
                const sel = window.getSelection();
                let container = document.createElement("div");

                if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
                    // 有选中内容
                    for (let i = 0; i < sel.rangeCount; i++) {
                        container.appendChild(sel.getRangeAt(i).cloneContents());
                    }
                } else if (targetMode === 'joplin') {
                    // 无选中且是 Joplin 模式，尝试抓取正文
                    let mainNode = null;

                    // GitHub 深度适配：锁定 README 区域
                    if (window.location.hostname === 'github.com') {
                        mainNode = document.querySelector('#readme article') ||
                            document.querySelector('.repository-content article') ||
                            document.querySelector('article.markdown-body');
                    }

                    // 通用正文识别逻辑
                    if (!mainNode) {
                        mainNode = document.querySelector('article, main, [role="main"], .post-content, .article-content');
                    }

                    // 兜底到 body
                    if (!mainNode) mainNode = document.body;

                    // 深度克隆并做初步清理
                    const clone = mainNode.cloneNode(true);
                    // 移除 GitHub 的锚点链接图标
                    clone.querySelectorAll('a.anchor').forEach(el => el.remove());
                    // 移除隐藏元素
                    clone.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());

                    container.appendChild(clone);
                } else {
                    return "EMPTY";
                }

                let mdBody = nodeToMd(container).trim();
                mdBody = mdBody.replace(/\n{3,}/g, '\n\n');

                if (!mdBody) return "EMPTY";
                return mdBody + '\n\n---\n[来源：' + title + '](' + url + ')';
            } catch (e) { return "ERR:" + e.message; }
        },
        args: [pageUrl, pageTitle, target]
    }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
            notify("转换失败", "无法读取页面内容");
            return;
        }
        const res = results[0].result;
        if (res === "EMPTY") {
            notify("操作取消", "未选择任何内容且无法确定正文");
            return;
        }
        if (res.startsWith("ERR:")) {
            notify("转换异常", res);
            return;
        }

        if (target === 'clipboard') {
            copyToClipboardOffscreen(res).then(success => {
                if (success) notify("Markdown 复制成功", "已存入剪贴板");
                else notify("复制失败", "无法写入剪贴板");
            });
        } else if (target === 'joplin') {
            openJoplinChooser(res, pageTitle, pageUrl);
        }
    });
}

/**
 * 打开「选择笔记本」窗口：先暂存待导入内容，再弹出 chooser.html 让用户选择目标笔记本
 * @param {string} markdown - Markdown 格式的笔记内容
 * @param {string} title - 笔记标题
 * @param {string} url - 来源 URL
 */
async function openJoplinChooser(markdown, title, url) {
    // 先确认已配置 Token，避免弹出一个空窗口
    const stored = await chrome.storage.local.get({ joplinToken: "" });
    if (!stored.joplinToken) {
        notify("配置缺失", "未设置 Joplin API Token，请在扩展设置中配置");
        return;
    }

    // 待导入内容较大，走 storage 传递而不是塞进 URL
    await chrome.storage.local.set({
        pendingJoplin: { markdown, title, url, ts: Date.now() }
    });

    const chooserUrl = chrome.runtime.getURL('chooser.html');

    // 若已有选择窗口则聚焦，避免重复开窗
    try {
        const existing = await chrome.tabs.query({ url: chooserUrl });
        if (existing && existing.length > 0) {
            await chrome.windows.update(existing[0].windowId, { focused: true });
            await chrome.tabs.update(existing[0].id, { active: true });
            return;
        }
    } catch (e) { /* 忽略，继续新建窗口 */ }

    try {
        await chrome.windows.create({
            url: chooserUrl,
            type: 'popup',
            width: 460,
            height: 640
        });
    } catch (e) {
        chrome.tabs.create({ url: chooserUrl });
    }
}

/**
 * 发送 Markdown 内容到 Joplin
 * @param {string} markdown - Markdown 格式的笔记内容
 * @param {string} title - 笔记标题
 * @param {string} url - 来源 URL
 * @param {string} [parentId] - 目标笔记本 ID（可选，留空则用默认笔记本）
 */
async function sendToJoplin(markdown, title, url, parentId = "") {
    // 从 chrome.storage.local 读取 Joplin API Token 和 URL，避免硬编码
    const stored = await chrome.storage.local.get({
        joplinToken: "",
        joplinUrl: "http://127.0.0.1:41184"
    });
    const joplinToken = stored.joplinToken;
    const joplinUrl = stored.joplinUrl;
    
    if (!joplinToken) {
        notify("配置缺失", "未设置 Joplin API Token，请在扩展设置中配置");
        return;
    }
    
    try {
        const response = await fetch(`${joplinUrl}/notes?token=${joplinToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({
                title: title || "来自我的右键的 MD 笔记",
                body: markdown,
                source_url: url
            }, parentId ? { parent_id: parentId } : {}))
        });
        
        if (response.ok) {
            notify("分享成功", "MD 格式内容已存入 Joplin");
        } else {
            notify("分享失败", "Joplin 拒绝了请求");
        }
    } catch (err) {
        notify("分享异常", "请检查 Joplin 网页剪切服务是否启动");
    }
}

function downloadTxt(text, filename, url) {
    notify("开始下载", "正在准备文本文件...");
    const time = new Date().toLocaleString();
    const content = `${text}\n\n--------------------------------\n来源: ${url}\n时间: ${time}\nvia 我的右键`;
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    chrome.downloads.download({
        url: "data:text/plain;base64," + base64Content,
        filename: filename,
        saveAs: true
    });
}

function downloadAndOpenTxt(text, filename, url) {
    notify("正在启动程序", "正在生成临时文件并调起记事本...");
    const time = new Date().toLocaleString();
    const content = `${text}\n\n--------------------------------\n来源: ${url}\n时间: ${time}\nvia 我的右键`;
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    chrome.downloads.download({
        url: "data:text/plain;base64," + base64Content,
        filename: filename,
        saveAs: false // 直接下载到默认位置以实现快速打开
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            notify("下载失败", chrome.runtime.lastError.message);
            return;
        }

        // 监听下载状态，完成后打开
        const onDownloadChanged = (delta) => {
            if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
                chrome.downloads.onChanged.removeListener(onDownloadChanged);
                chrome.downloads.open(downloadId, () => {
                    if (chrome.runtime.lastError) {
                        console.error("无法打开文件:", chrome.runtime.lastError.message);
                        notify("无法启动记事本", "请手动打开下载的文件：" + filename);
                    }
                });
            }
        };
        chrome.downloads.onChanged.addListener(onDownloadChanged);
    });
}

function downloadHtmlPage(tabId, frameId, pageUrl, pageTitle) {
    chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId || 0] },
        func: (url, title) => {
            try {
                // 1. 判断是否有选中内容
                const sel = window.getSelection();
                let content = "";
                let isFullPage = true;
                
                if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
                    const container = document.createElement("div");
                    for (let i = 0; i < sel.rangeCount; i++) {
                        container.appendChild(sel.getRangeAt(i).cloneContents());
                    }
                    content = container.innerHTML;
                    isFullPage = false;
                } else {
                    content = document.documentElement.outerHTML;
                }

                // 2. 如果不是整页，套用精美模板
                let finalContent = "";
                if (isFullPage) {
                    finalContent = content;
                } else {
                    const time = new Date().toLocaleString();
                    finalContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>摘录_${title || "网页"}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif;
            line-height: 1.8;
            color: #2c3e50;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 24px;
            background-color: #f4f7f6;
        }
        .container {
            background: #ffffff;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.05);
        }
        h1 {
            font-size: 24px;
            color: #1a1a1a;
            border-bottom: 2px solid #3498db;
            padding-bottom: 12px;
            margin-top: 0;
            margin-bottom: 24px;
        }
        .content {
            font-size: 16px;
            color: #34495e;
            word-break: break-word;
        }
        .content pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
        }
        .content code {
            background: #f1f3f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 85%;
        }
        .content blockquote {
            border-left: 4px solid #cbd5e1;
            padding-left: 16px;
            margin-left: 0;
            color: #64748b;
            font-style: italic;
        }
        .content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 12px 0;
        }
        .content table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        .content th, .content td {
            border: 1px solid #e2e8f0;
            padding: 10px 14px;
            text-align: left;
        }
        .content th {
            background-color: #f8fafc;
        }
        .meta {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #94a3b8;
        }
        .meta p {
            margin: 6px 0;
        }
        .meta a {
            color: #3498db;
            text-decoration: none;
        }
        .meta a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>摘录自：${title || "无标题"}</h1>
        <div class="content">
            ${content}
        </div>
        <div class="meta">
            <p><strong>来源链接:</strong> <a href="${url}" target="_blank">${url}</a></p>
            <p><strong>保存时间:</strong> ${time}</p>
            <p><em>via 我的右键扩展程序</em></p>
        </div>
    </div>
</body>
</html>`;
                }

                // 3. 在页面端直接使用 Blob 和 object URL 触发下载，完美支持超大网页
                const blob = new Blob([finalContent], { type: "text/html;charset=utf-8" });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                
                let safeTitle = (title || "网页内容").replace(/[\\/:*?"<>|]/g, "_").trim();
                if (safeTitle.length > 50) safeTitle = safeTitle.substring(0, 50);
                const prefix = isFullPage ? "网页_" : "摘录_";
                a.download = `${prefix}${safeTitle}_${Date.now()}.html`;
                
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
                return "SUCCESS";
            } catch (e) {
                return "ERR:" + e.message;
            }
        },
        args: [pageUrl, pageTitle]
    }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
            const errMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "未知错误";
            notify("保存失败", "无法在当前页面执行下载，可能受浏览器安全策略限制: " + errMsg);
            return;
        }
        const res = results[0].result;
        if (res.startsWith("ERR:")) {
            notify("保存失败", "下载过程中出错: " + res.substring(4));
        } else {
            notify("保存成功", "HTML 文件已下载完成");
        }
    });
}

// --- 菜单创建逻辑 ---
let isCreatingMenus = false;
function createMenus() {
    if (isCreatingMenus) return;
    isCreatingMenus = true;
    chrome.contextMenus.removeAll(() => {
        isCreatingMenus = false;
        const safeCreate = (config) => {
            config.id = "v136_" + config.id;
            if (config.parentId) config.parentId = "v136_" + config.parentId;
            chrome.contextMenus.create(config);
        };

        // 顶级根菜单：我的右键
        chrome.contextMenus.create({
            id: "v136_m_main",
            title: "我的右键",
            contexts: ["all"]
        });

        // 0. 打开网址 (最常用功能，置顶于首位)
        safeCreate({ id: "open_url", parentId: "m_main", title: "🌐 在浏览器打开网址", contexts: ["all"] });

        // 1. 搜索引擎
        safeCreate({ id: "m_search", parentId: "m_main", title: "搜索引擎", contexts: ["selection"] });
        Object.keys(services.search).forEach(key => {
            safeCreate({ id: `sch_${key}`, parentId: "m_search", title: key.toUpperCase(), contexts: ["selection"] });
        });

        // 2. 翻译与词典
        safeCreate({ id: "m_trans", parentId: "m_main", title: "翻译与词典", contexts: ["selection", "page"] });
        safeCreate({ id: "trans_g_cn", parentId: "m_trans", title: "谷歌翻译 (->中)", contexts: ["selection"] });
        safeCreate({ id: "trans_g_en", parentId: "m_trans", title: "谷歌翻译 (->英)", contexts: ["selection"] });
        safeCreate({ id: "trans_yd", parentId: "m_trans", title: "有道中英互译", contexts: ["selection"] });
        safeCreate({ id: "trans_page_g", parentId: "m_trans", title: "整页翻成中文", contexts: ["page"] });

        // 3. 二维码工具
        safeCreate({ id: "m_qr", parentId: "m_main", title: "二维码工具", contexts: ["all"] });
        safeCreate({ id: "qr_read", parentId: "m_qr", title: "读取图片二维码", contexts: ["image"] });
        safeCreate({ id: "qr_gen_sel", parentId: "m_qr", title: "选中文本生成", contexts: ["selection"] });
        safeCreate({ id: "qr_gen_page", parentId: "m_qr", title: "当前页面生成", contexts: ["page"] });

        // 4. 网络与站长工具
        safeCreate({ id: "m_tools", parentId: "m_main", title: "网络与站长工具", contexts: ["page", "link"] });
        safeCreate({ id: "tool_ip", parentId: "m_tools", title: "IP 归属地查询", contexts: ["page", "link"] });
        safeCreate({ id: "tool_whois", parentId: "m_tools", title: "Whois 信息查询", contexts: ["page", "link"] });
        safeCreate({ id: "tool_ping", parentId: "m_tools", title: "超级 Ping 测试", contexts: ["page", "link"] });
        safeCreate({ id: "tool_beian", parentId: "m_tools", title: "网站备案查询", contexts: ["page", "link"] });
        safeCreate({ id: "tool_speed", parentId: "m_tools", title: "页面测速", contexts: ["page", "link"] });
        safeCreate({ id: "tool_sameip", parentId: "m_tools", title: "同 IP 站点查询", contexts: ["page", "link"] });
        safeCreate({ id: "tool_extract_domain_ip", parentId: "m_tools", title: "提取域名及 IP", contexts: ["page", "link"] });

        // 5. 社交分享与笔记
        safeCreate({ id: "m_share", parentId: "m_main", title: "社交分享与笔记", contexts: ["selection", "page"] });
        safeCreate({ id: "share_joplin", parentId: "m_share", title: "分享至 Joplin", contexts: ["selection", "page"] });
        safeCreate({ id: "share_txt", parentId: "m_share", title: "选中文本保存到本地 (.txt)", contexts: ["selection"] });
        safeCreate({ id: "share_txt_notepad", parentId: "m_share", title: "选中文本并用记事本打开", contexts: ["selection"] });
        safeCreate({ id: "share_html", parentId: "m_share", title: "保存为本地 HTML 文件", contexts: ["selection", "page"] });

        // 6. 复制增强
        safeCreate({ id: "m_copy_plus", parentId: "m_main", title: "复制增强", contexts: ["selection"] });
        safeCreate({ id: "copy_merge_add", parentId: "m_copy_plus", title: "加入合并复制", contexts: ["selection"] });
        safeCreate({ id: "copy_merge_done", parentId: "m_copy_plus", title: "完成并清空内容", contexts: ["selection"] });
        safeCreate({ id: "copy_md", parentId: "m_copy_plus", title: "复制为 Markdown 格式", contexts: ["selection"] });

        // 7. AI 模型 ID 提取
        safeCreate({ id: "ai_extract_model_ids", parentId: "m_main", title: "提取模型 ID", contexts: ["all"] });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    createMenus();
});

chrome.runtime.onStartup.addListener(() => {
    createMenus();
});

// 快捷键命令监听
chrome.commands.onCommand.addListener(async (command) => {
    console.log("快捷键被键盘触发:", command);

    try {
        // 1. 获取活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            console.log("未找到活动标签页");
            return;
        }

        // 2. 检查页面权限 (防止在 chrome:// 页面报错)
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            notify("功能受限", "由于浏览器安全策略，无法在系统内置页面使用此功能");
            return;
        }

        // 3. 尝试获取选中文字
        let text = "";
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            });
            text = (results && results[0] && results[0].result) ? results[0].result.trim() : "";
        } catch (scriptErr) {
            console.warn("无法在页面中执行脚本获取选中文字:", scriptErr);
        }

        // 4. 根据命令执行
        switch (command) {
            case "copy-merge-add":
                if (!text) {
                    notify("合并复制失败", "请先用鼠标选中文本再按快捷键");
                    return;
                }
                chrome.storage.local.get({ copyBuffer: [] }, async (data) => {
                    let buffer = data.copyBuffer;
                    console.log("[Command] 当前缓冲区段数:", buffer.length);
                    buffer.push(text);
                    const fullText = buffer.join("\r\n\r\n");
                    const success = await copyToClipboardOffscreen(fullText);
                    chrome.storage.local.set({ copyBuffer: buffer }, () => {
                        console.log("[Command] 已加入 1 段，总计:", buffer.length);
                        if (success) notify("快捷键：已合并", "当前共 " + buffer.length + " 段内容");
                        else notify("复制失败", "无法写入剪贴板");
                    });
                });
                break;

            case "copy-merge-done":
                console.log("[Command] 触发清空缓冲区");
                chrome.storage.local.set({ copyBuffer: [] }, () => {
                    console.log("[Command] 缓冲区已清空");
                    notify("快捷键：已清空", "合并任务已重置，之前的缓存已彻底清除");
                });
                break;



            case "copy-md":
                // Markdown 复制需要再次注入更复杂的脚本
                copyToMarkdown(tab.id, 0, tab.url, tab.title);
                break;
            case "share-joplin":
                copyToMarkdown(tab.id, 0, tab.url, tab.title, 'joplin');
                break;
        }
    } catch (err) {
        console.error("快捷键处理异常:", err);
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const id = (info.menuItemId || "").replace("v136_", "");
    const text = info.selectionText || "";
    const pageUrl = info.pageUrl || "";
    const linkUrl = info.linkUrl || "";
    const srcUrl = info.srcUrl || "";
    const targetUrl = linkUrl || pageUrl;
    const host = getHost(targetUrl);

    // 调试：显示点击的菜单 ID
    console.log("Menu clicked:", id, "Text:", text);

    if (id.startsWith("sch_")) {
        const key = id.replace("sch_", "");
        if (services.search[key]) openUrl(services.search[key] + encodeURIComponent(text));
    }

    switch (id) {
        // 打开网址
        case "open_url":
            handleOpenUrl(text, linkUrl);
            break;

        // 翻译
        case "trans_g_cn": openUrl(services.translate.google_cn + encodeURIComponent(text)); break;
        case "trans_g_en": openUrl(services.translate.google_en + encodeURIComponent(text)); break;
        case "trans_yd": openUrl(services.translate.youdao + encodeURIComponent(text)); break;
        case "trans_page_g": openUrl(`https://translate.google.com/translate?sl=auto&tl=zh-CN&u=${encodeURIComponent(pageUrl)}`); break;

        // 二维码
        case "qr_read":
            // MV3 Worker 无法运行依赖 Canvas 的 qrcode，此处逻辑可能需要调整
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (url) => { alert("读取图片二维码功能正在适配 MV3 环境中...目前请直接使用右键生成功能。"); },
                args: [srcUrl]
            });
            break;
        case "qr_gen_sel": openUrl("https://haoip.cn/qrcode?t=" + encodeURIComponent(text)); break;
        case "qr_gen_page": openUrl("https://haoip.cn/qrcode?t=" + encodeURIComponent(pageUrl)); break;

        // 网络工具
        case "tool_ip": openUrl(services.tools.ip + host); break;
        case "tool_whois": openUrl(services.tools.whois + host); break;
        case "tool_ping": openUrl(services.tools.ping + host); break;
        case "tool_beian": openUrl(services.tools.beian + host); break;
        case "tool_speed": openUrl(services.tools.speed + host); break;
        case "tool_sameip": openUrl(services.tools.sameip + host); break;
        case "tool_extract_domain_ip":
            (async () => {
                const targetText = text || pageUrl;
                const matches = extractAllMatches(targetText);

                if (matches.length === 0) {
                    notify("无法提取", "未识别到有效的域名或 IP");
                    return;
                }

                const fullInfo = matches.join("\n");
                const success = await copyToClipboardOffscreen(fullInfo);

                if (success) {
                    notify("提取成功", `共提取 ${matches.length} 个信息并存入剪贴板`);
                } else {
                    notify("提取失败", "无法写入剪贴板");
                }
            })();
            break;
        case "ai_extract_model_ids":
            console.log("[AI提取] 菜单被点击, text:", text?.substring(0, 50), "pageUrl:", pageUrl?.substring(0, 50), "id:", id);
            (async () => {
                if (text) {
                    console.log("[AI提取] 从选中文本提取, 长度:", text.length);
                    const matches = extractModelIds(text);
                    if (matches.length === 0) {
                        notify("无法提取", "未识别到有效的模型 ID");
                        return;
                    }
                    const fullInfo = matches.join("\n");
                    const success = await copyToClipboardOffscreen(fullInfo);
                    if (success) {
                        notify("提取成功", `共提取 ${matches.length} 个模型 ID 并存入剪贴板`);
                    } else {
                        notify("提取失败", "无法写入剪贴板");
                    }
                } else {
                    // 页面上下文：从页面正文中提取
                    console.log("[AI提取] 从页面正文提取, tab.id:", tab?.id, "frameId:", info.frameId);
                    if (!tab || !tab.id) {
                        console.error("[AI提取] tab 无效");
                        notify("提取失败", "无法获取当前页面信息");
                        return;
                    }
                    notify("正在提取", "正在从页面内容中提取模型 ID...");
                    try {
                        const results = await chrome.scripting.executeScript({
                            target: { tabId: tab.id, frameIds: [info.frameId || 0] },
                            func: () => document.body ? document.body.innerText : document.documentElement.innerText
                        });
                        console.log("[AI提取] executeScript 返回:", results ? "有结果" : "无结果");
                        if (!results || !results[0] || !results[0].result) {
                            notify("提取失败", "无法读取页面内容");
                            return;
                        }
                        const pageText = results[0].result;
                        console.log("[AI提取] 页面文本长度:", pageText.length);
                        const matches = extractModelIds(pageText);
                        console.log("[AI提取] 提取到模型ID数量:", matches.length, matches);
                        if (matches.length === 0) {
                            notify("无法提取", "未识别到有效的模型 ID");
                            return;
                        }
                        const fullInfo = matches.join("\n");
                        const success = await copyToClipboardOffscreen(fullInfo);
                        if (success) {
                            notify("提取成功", `共提取 ${matches.length} 个模型 ID 并存入剪贴板`);
                        } else {
                            notify("提取失败", "无法写入剪贴板");
                        }
                    } catch (e) {
                        console.error("[AI提取] 异常:", e);
                        notify("提取失败", "页面内容读取异常: " + e.message);
                    }
                }
            })();
            break;

        // 分享与保存
        case "share_joplin":
            copyToMarkdown(tab.id, info.frameId, pageUrl, tab.title, 'joplin');
            break;
        case "share_txt":
            downloadTxt(text, "摘录_" + new Date().getTime() + ".txt", pageUrl);
            break;
        case "share_txt_notepad":
            downloadAndOpenTxt(text, "temp_" + new Date().getTime() + ".txt", pageUrl);
            break;
        case "share_html":
            downloadHtmlPage(tab.id, info.frameId, pageUrl, tab.title);
            break;

        // 复制增强
        case "copy_merge_add":
            console.log("进入 copy_merge_add case");
            try {
                chrome.storage.local.get({ copyBuffer: [] }, async (data) => {
                    console.log("storage.get 回调执行，data:", data);
                    try {
                        let buffer = data.copyBuffer;
                        buffer.push(text.trim());
                        const fullText = buffer.join("\r\n\r\n");

                        console.log("准备复制，内容长度:", fullText.length);
                        console.log("调用 copyToClipboardOffscreen 前，typeof copyToClipboardOffscreen:", typeof copyToClipboardOffscreen);
                        const success = await copyToClipboardOffscreen(fullText);
                        console.log("copyToClipboard 返回后");
                        console.log("复制结果:", success);

                        chrome.storage.local.set({ copyBuffer: buffer }, () => {
                            if (success) {
                                notify("已合并并复制", "当前共 " + buffer.length + " 段内容");
                            } else {
                                notify("合并存入失败", "无法写入剪贴板，内容已保存在扩展存储中");
                            }
                        });
                    } catch (err) {
                        console.error("内部错误:", err);
                        notify("合并复制异常", "错误: " + err.message);
                    }
                });
            } catch (err) {
                console.error("外部错误:", err);
                notify("合并复制失败", "错误: " + err.message);
            }
            break;
        case "copy_merge_done":
            chrome.storage.local.set({ copyBuffer: [] }, () => {
                notify("已清空", "合并任务已完成");
            });
            break;
        case "copy_md":
            copyToMarkdown(tab.id, info.frameId, pageUrl, tab.title);
            break;
    }
});


// --- 消息监听器 (处理悬浮工具栏指令) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const text = request.text || "";
    const tab = sender.tab;
    const pageUrl = tab ? tab.url : "";

    if (request.type === 'toolbar_action') {
        const action = request.action;
        console.log("[Toolbar Action]", action, "Text:", text);

        switch (action) {
            case 'open_url':
                handleOpenUrl(text);
                break;
            case 'copy_md':
                copyToMarkdown(tab.id, 0, pageUrl, tab.title);
                break;
            case 'share_joplin':
                copyToMarkdown(tab.id, 0, pageUrl, tab.title, 'joplin');
                break;
            case 'share_txt_notepad':
                downloadAndOpenTxt(text, "temp_" + Date.now() + ".txt", pageUrl);
                break;
            case 'share_html':
                downloadHtmlPage(tab.id, 0, pageUrl, tab.title);
                break;
            case 'copy_merge_add':
                chrome.storage.local.get({ copyBuffer: [] }, async (data) => {
                    let buffer = data.copyBuffer;
                    buffer.push(text.trim());
                    const success = await copyToClipboardOffscreen(buffer.join("\r\n\r\n"));
                    chrome.storage.local.set({ copyBuffer: buffer }, () => {
                        if (success) notify("已合并", "当前共 " + buffer.length + " 段内容");
                    });
                });
                break;
            case 'qr_gen_sel':
                openUrl("https://haoip.cn/qrcode?t=" + encodeURIComponent(text));
                break;
            case 'search_default':
                // 默认使用 Google
                openUrl(services.search.google + encodeURIComponent(text));
                break;
            case 'search_github':
                // 与右键菜单「搜索引擎 → GITHUB」保持一致
                openUrl(services.search.github + encodeURIComponent(text));
                break;
            case 'extract_domain_ip':
                (async () => {
                    const targetText = text || pageUrl;
                    const matches = extractAllMatches(targetText);

                    if (matches.length === 0) {
                        notify("无法提取", "未识别到有效的域名或 IP");
                        return;
                    }

                    const fullInfo = matches.join("\n");
                    const success = await copyToClipboardOffscreen(fullInfo);

                    if (success) {
                        notify("提取成功", `共提取 ${matches.length} 个信息并存入剪贴板`);
                    } else {
                        notify("提取失败", "无法写入剪贴板");
                    }
                })();
                break;
            case 'extract_model_ids':
                (async () => {
                    const targetText = text || pageUrl;
                    const matches = extractModelIds(targetText);

                    if (matches.length === 0) {
                        notify("无法提取", "未识别到有效的模型 ID");
                        return;
                    }

                    const fullInfo = matches.join("\n");
                    const success = await copyToClipboardOffscreen(fullInfo);

                    if (success) {
                        notify("提取成功", `共提取 ${matches.length} 个模型 ID 并存入剪贴板`);
                    } else {
                        notify("提取失败", "无法写入剪贴板");
                    }
                })();
                break;
        }
    } else if (request.type === 'translate_text') {
        const targetLang = request.targetLang || 'zh-CN';
        translateText(text, targetLang).then(result => {
            sendResponse({ success: true, result: result });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true; // 异步响应
    }
});

/**
 * 翻译文本
 * @param {string} text - 要翻译的文本
 * @param {string} targetLang - 目标语言代码 (如 'zh-CN', 'en', 'ja', 'ko')
 * @returns {Promise<string>} - 翻译结果
 */
async function translateText(text, targetLang = 'zh-CN') {
    if (!text) return "";

    // 语言代码映射
    const langMap = {
        'zh-CN': 'zh-CN',
        'zh-TW': 'zh-TW',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de',
        'es': 'es',
        'ru': 'ru',
        'pt': 'pt'
    };
    
    const tl = langMap[targetLang] || 'zh-CN';

    // 定义翻译接口列表及其解析函数
    const providers = [
        {
            name: "Google Primary",
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
            parse: (data) => data && data[0] ? data[0].map(item => item[0]).join('') : null
        },
        {
            name: "Google Secondary",
            url: `https://translate.google.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
            parse: (data) => data && data[0] ? data[0].map(item => item[0]).join('') : null
        },
        {
            name: "MyMemory",
            url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${tl}`,
            parse: (data) => data && data.responseData ? data.responseData.translatedText : null
        }
    ];

    for (const provider of providers) {
        try {
            console.log(`[translateText] 尝试使用 ${provider.name} 接口...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时

            const response = await fetch(provider.url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const result = provider.parse(data);

            if (result) {
                console.log(`[translateText] ${provider.name} 翻译成功`);
                return result;
            }
            throw new Error("解析结果为空");
        } catch (e) {
            console.warn(`[translateText] ${provider.name} 接口失败:`, e.name === 'AbortError' ? '超时' : e.message);
            // 继续下一个接口
        }
    }

    console.error("[translateText] 所有翻译接口均失败");
    return "翻译接口连接失败，请稍后重试";
}

// 确保在任何情况下加载时都尝试创建一次菜单
createMenus();


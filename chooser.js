// 「导入到 Joplin」笔记本选择窗口逻辑
//
// 注意：Manifest V3 的 CSP 禁止内联脚本，因此必须放在外部 js 文件里。
// 流程：background.js 触发分享 -> 把待导入内容暂存到 chrome.storage.local
//      -> 打开本窗口 -> 读取笔记本列表 -> 用户选择 -> 直接调用 Joplin API 写入。

const DEFAULT_URL = 'http://127.0.0.1:41184';

const state = {
    token: '',
    baseUrl: DEFAULT_URL,
    note: null,       // { markdown, title, url }
    folders: [],      // [{ id, title, parent_id }]
    selectedId: '',   // '' 表示默认笔记本
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    document.getElementById('importBtn').addEventListener('click', doImport);
    document.getElementById('cancelBtn').addEventListener('click', () => window.close());
    document.getElementById('searchBox').addEventListener('input', renderList);

    // 非扩展环境（例如直接打开该 html）时优雅降级
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        document.getElementById('notePreview').textContent = '此页面需在扩展环境中打开';
        document.getElementById('folderList').innerHTML = '<div class="empty">请从扩展触发「分享至 Joplin」</div>';
        showStatus('未检测到扩展环境', 'error');
        document.getElementById('importBtn').disabled = true;
        return;
    }

    const stored = await chrome.storage.local.get({
        joplinToken: '',
        joplinUrl: DEFAULT_URL,
        pendingJoplin: null,
        joplinLastFolderId: '',
    });

    state.token = String(stored.joplinToken || '').trim();
    state.baseUrl = String(stored.joplinUrl || DEFAULT_URL).trim().replace(/\/+$/, '') || DEFAULT_URL;
    state.selectedId = stored.joplinLastFolderId || '';

    const pending = stored.pendingJoplin;
    if (!pending || !pending.markdown) {
        document.getElementById('notePreview').textContent = '没有待导入的内容';
        showStatus('没有待导入的内容，请先在网页上使用「分享至 Joplin」', 'error');
        disableImport();
        return;
    }

    state.note = pending;
    document.getElementById('notePreview').textContent =
        '笔记标题：' + (pending.title || '未命名') + '　·　' + pending.markdown.length + ' 字符';

    if (!state.token) {
        showStatus('未设置 Joplin Token，请先在扩展设置里填写', 'error');
        disableImport();
        return;
    }

    try {
        state.folders = await fetchFolders();
    } catch (err) {
        showStatus('读取笔记本失败：' + err.message + '（请确认 Joplin 已启动，并开启了网页剪辑服务）', 'error');
        disableImport();
        return;
    }

    renderList();
}

function disableImport() {
    document.getElementById('importBtn').disabled = true;
    document.getElementById('folderList').innerHTML = '<div class="empty">—</div>';
}

async function fetchFolders() {
    const all = [];
    let page = 1;
    while (true) {
        const url = state.baseUrl + '/folders?fields=id,title,parent_id&limit=100&page=' + page
            + '&token=' + encodeURIComponent(state.token);
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.items && data.items.length) all.push(...data.items);
        if (!data.has_more) break;
        page++;
        if (page > 100) break;
    }
    return all;
}

// 把扁平文件夹列表按父子关系展开成带缩进层级的顺序
function buildFlatTree(folders) {
    const byId = new Map();
    folders.forEach(f => byId.set(f.id, Object.assign({}, f, { children: [] })));

    const roots = [];
    byId.forEach(f => {
        if (f.parent_id && byId.has(f.parent_id)) {
            byId.get(f.parent_id).children.push(f);
        } else {
            roots.push(f);
        }
    });

    const sortFn = (a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hans-CN');
    const out = [];
    const walk = (nodes, depth) => {
        nodes.sort(sortFn);
        for (const n of nodes) {
            out.push({ id: n.id, title: n.title, depth });
            walk(n.children, depth + 1);
        }
    };
    walk(roots, 0);
    return out;
}

function renderList() {
    const listEl = document.getElementById('folderList');
    const keyword = document.getElementById('searchBox').value.trim().toLowerCase();

    const items = [{ id: '', title: '（默认笔记本）', depth: 0 }];
    for (const f of buildFlatTree(state.folders)) {
        if (keyword && !String(f.title).toLowerCase().includes(keyword)) continue;
        items.push(f);
    }

    // 之前记住的笔记本若已不存在，则回落到默认笔记本
    if (state.selectedId && !items.some(i => i.id === state.selectedId)) {
        state.selectedId = '';
    }

    if (items.length === 1 && keyword) {
        listEl.innerHTML = '<div class="empty">没有匹配的笔记本</div>';
        return;
    }

    listEl.innerHTML = '';
    for (const item of items) {
        const label = document.createElement('label');
        label.className = 'folder-item' + (item.id === state.selectedId ? ' selected' : '');
        label.style.paddingLeft = (10 + item.depth * 16) + 'px';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'folder';
        radio.value = item.id;
        radio.checked = item.id === state.selectedId;
        radio.addEventListener('change', () => {
            state.selectedId = item.id;
            document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected'));
            label.classList.add('selected');
        });

        const span = document.createElement('span');
        span.textContent = item.title;

        label.appendChild(radio);
        label.appendChild(span);
        listEl.appendChild(label);
    }
}

async function doImport() {
    const btn = document.getElementById('importBtn');
    if (!state.note) return;

    btn.disabled = true;
    showStatus('正在导入…', 'info');

    const payload = {
        title: state.note.title || '来自我的右键的 MD 笔记',
        body: state.note.markdown,
        source_url: state.note.url || '',
    };
    if (state.selectedId) payload.parent_id = state.selectedId;

    try {
        const res = await fetch(state.baseUrl + '/notes?token=' + encodeURIComponent(state.token), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error('HTTP ' + res.status + ' ' + String(txt).slice(0, 120));
        }
        await chrome.storage.local.set({ joplinLastFolderId: state.selectedId, pendingJoplin: null });
        showStatus('导入成功！', 'success');
        setTimeout(() => window.close(), 1200);
    } catch (err) {
        showStatus('导入失败：' + err.message, 'error');
        btn.disabled = false;
    }
}

function showStatus(message, type) {
    const el = document.getElementById('status');
    el.textContent = message;
    el.className = 'status ' + type;
}

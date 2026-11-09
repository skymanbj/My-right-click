# 我的右键 · My Right Key (v1.3.6 / MV3)

> 一款 Manifest V3 浏览器扩展。选中文字后可调用搜索、翻译、Markdown 转换、二维码、站长工具与本地笔记工作流，入口集中在右键菜单与悬浮工具栏。

**仓库**：https://github.com/skymanbj/My-right-click
**适用**：Chrome / Edge 等 Chromium 内核浏览器
**版本**：1.3.6 · 文档更新于 2026-11-09
**许可证**：[MIT](LICENSE)（第三方库除外，见文末说明）

---

## 📥 安装与更新

1. `git clone https://github.com/skymanbj/My-right-click.git`，或直接下载 ZIP 解压。
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择**包含 `manifest.json` 的那一层目录**。
4. 修改代码后点扩展卡片上的刷新按钮；若改动涉及 `content.js`（悬浮工具栏），还需刷新已打开的网页才会重新注入。

扩展申请了 `<all_urls>` 主机权限，用于划词、页面内容读取与 Markdown / HTML 转换。

---

## ✨ 功能

### 1. 🍎 划词悬浮工具栏

选中任意文字即出现，采用磨砂玻璃样式与 Shadow DOM 隔离；位置按工具栏**实际宽度**自动收敛，按钮较多时也不会被屏幕右边缘裁切。

| 按钮 | 作用 |
| :--- | :--- |
| **打开** | 识别选中文字中的网址，新建标签页打开 |
| **MD** | 复制为 Markdown 格式 |
| **Joplin** | 分享至 Joplin（弹出笔记本选择窗口） |
| **Note** | 生成临时 `.txt` 并调起系统记事本 |
| **HTML** | 将当前页面保存为本地 HTML 文件 |
| **Add** | 加入合并复制缓冲区 |
| **QR** | 跳转在线服务为选中文本生成二维码 |
| **域名/IP** | 从选中文本提取域名与 IP 并写入剪贴板 |
| **Model** | 从选中文本提取 AI 模型 ID 并写入剪贴板 |
| **Trans** | 原地悬浮翻译为中文，无需跳页 |
| **Search** | 默认用 **Google** 搜索选中文字 |
| **GitHub** | 在 GitHub 中搜索选中文字，与右键菜单 `GITHUB` 一致 |
| **×** | 关闭工具栏 |

### 2. 🛠 右键菜单：我的右键

所有功能收纳在单一顶级入口下，保持浏览器原生右键菜单整洁。

| 分组 | 内容 |
| :--- | :--- |
| **常用** | 🌐 在浏览器打开网址、提取模型 ID |
| **搜索引擎**（划词） | GOOGLE、BAIDU、BING、BINGCN、DUCKDUCKGO、SO、YOUTUBE、GITHUB、TAOBAO、JD、PINDUODUO，共 11 个 |
| **翻译与词典** | 谷歌翻译（→中 / →英）、有道中英互译、整页翻成中文 |
| **二维码工具** | 读取图片二维码 ⚠️、选中文本生成、当前页面生成 |
| **网络与站长工具** | IP 归属地、Whois、超级 Ping、备案查询、页面测速、同 IP 站点、提取域名及 IP（对页面或链接生效） |
| **社交分享与笔记** | 分享至 Joplin、选中文本保存为 `.txt`、用记事本打开、保存为本地 HTML |
| **复制增强** | 加入合并复制、完成并清空内容、复制为 Markdown |

> ⚠️ 「读取图片二维码」在 MV3 下**尚未适配完成**，点击只会弹出提示；二维码生成功能可正常使用（跳转 `haoip.cn` 在线服务）。

### 3. 📝 Markdown 转换

- 解析 HTML 结构，支持复杂表格、多级嵌套列表与代码块（自动过滤 GitHub 页面上的按钮内容）。
- 在 GitHub 仓库页**无选中文字**时分享，会自动提取并清洗 `README.md` 正文。
- 输出末尾附一条分隔线与来源链接（页面标题 + 原始 URL）。

### 4. 📒 Joplin 整合

- **配置**：点击扩展图标打开 popup（或选项页），填入 Joplin Web Clipper 的 **API Token** 与服务地址（默认指向本机 `127.0.0.1:41184`），保存到本地 `chrome.storage.local`。
- **分享**：先校验 Token，再弹出 `chooser.html` 窗口选择目标笔记本，最后通过 Joplin 的 `/notes` 接口写入本机；内容经 storage 传递，不塞进 URL。
- 云端同步由 Joplin 自身完成，扩展只负责写入。
- Token 仅存本地，不随仓库提交（`.env`、`.workbuddy-ai/` 等已被 `.gitignore` 排除）。

### 5. 🔗 复制与本地工作流

- **合并复制**：每加入一段，就把**当前累积的全部内容**写入剪贴板，随时可直接粘贴；缓冲区存于 `chrome.storage.local`，浏览器重启后仍在，「完成并清空内容」用于重置。
- **记事本直达**：生成临时文件并通过 `downloads.open` 调起系统默认编辑器。
- **保存为 HTML / TXT**：TXT 摘录附带来源 URL 与生成时间。

---

## ⌨️ 快捷键

以下以 `manifest.json` 为准，可在 `chrome://extensions/shortcuts` 自行修改：

| 功能 | 快捷键 (Windows / Mac) |
| :--- | :--- |
| 复制为 Markdown | `Alt + Shift + M` |
| 加入合并复制 | `Alt + Shift + C` |
| 完成并清空合并缓冲区 | `Alt + Shift + Z` |
| 一键分享至 Joplin | `Alt + Shift + J` |

> `Alt + Shift + Z` 只清空缓冲区、不输出合并结果；当前**没有**「撤销上一次复制」快捷键。在 `chrome://`、`edge://`、`about:` 等浏览器内置页面，快捷键会被安全策略拦截。

---

## 🧩 技术架构

- **Manifest V3**：`background.js` 作为 Service Worker，通过 `importScripts` 加载依赖。
- **离屏文档**：`offscreen.html / offscreen.js` 负责稳定的剪贴板写入，规避 SW 中无 DOM 的限制。
- **Shadow DOM 隔离**：悬浮工具栏样式不受网页 CSS 污染或篡改。
- **页面注入**：`chrome.scripting.executeScript` 读取选区 / 正文、执行 Markdown 转换。
- **状态持久化**：`chrome.storage.local` 保存合并缓冲区、Joplin 配置与待导入内容。
- **异步处理**：翻译、Joplin API、下载等均为异步，并通过 `chrome.notifications` 反馈结果。

主要文件：

| 文件 | 职责 |
| :--- | :--- |
| `manifest.json` | 权限、命令、内容脚本配置 |
| `background.js` | 菜单、消息路由、Markdown 转换、Joplin、翻译、下载、站长工具 |
| `content.js` | 划词悬浮工具栏（Shadow DOM） |
| `chooser.html / chooser.js` | Joplin 笔记本选择窗口 |
| `popup.html / popup.js`、`options.html / options.js` | Joplin Token 设置 |
| `offscreen.html / offscreen.js` | 剪贴板写入 |
| `functions.js` + `*.min.js` | 通用函数与第三方库（jQuery、jsQR 等） |

---

## ⚠️ 已知限制

- **Google 在中国大陆可能无法直连**：可改用右键菜单中的 BAIDU / BINGCN / DUCKDUCKGO，或修改 `background.js` 中 `case 'search_default'` 指向的引擎。
- 搜索、翻译、二维码生成、站长工具均为**跳转第三方站点**，需要相应网络可达；悬浮翻译依赖在线翻译接口。
- 「读取图片二维码」在 MV3 下未适配（见上文）。
- 浏览器内置页面及部分受限站点（如 Chrome Web Store）无法注入内容脚本，悬浮工具栏与划词功能不可用。

## 🔐 隐私与数据

- 扩展**不包含统计、埋点或遥测**，也不会在后台主动上传内容。
- 但当你主动使用搜索、翻译、二维码生成或站长工具时，**选中文字或当前页面 URL 会作为查询参数发送给对应第三方站点**（如 Google、GitHub、有道、`haoip.cn` 及各类站长工具站点）。请避免对敏感内容使用这些功能。
- Joplin 相关请求只发往你在设置中指定的服务地址（默认本机），API Token 仅保存在本地 `chrome.storage.local`。
- 扩展运行所需的 `<all_urls>` 权限用于本地页面内容读取与转换，不代表数据会被回传。

---

## 📅 更新日志

### 1.3.6 (2026-11-09)
- 悬浮工具栏新增 `GitHub` 搜索按钮。
- 工具栏默认搜索引擎由 DuckDuckGo 改为 **Google**。
- 工具栏定位改为按实际宽度收敛，避免新增按钮后被屏幕右边缘裁切。
- 项目初始化并推送至 GitHub，补充 `.gitignore` 排除本地凭据与工作数据。
- 新增 MIT 许可证；重写 README，收紧隐私与功能描述措辞。

---

## 📄 许可证

本项目自身代码采用 [MIT License](LICENSE)，Copyright (c) 2026 skymanbj。

`jquery.min.js`、`jsqrcode.min.js`、`baozi.min.js` 等随项目分发的第三方库**保留各自的原始许可证与版权声明**，不在本仓库 MIT 授权范围内；使用时请遵循其原始条款。

---

*文档随代码更新，功能描述以源码为准。*

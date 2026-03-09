# APIClient - API 接口调试助手

APIClient 是一款基于 `Uni-app` (Vue 3) 和 `Node.js (Koa)` 构建的轻量级、跨平台 API 接口调试工具。它的设计理念旨在提供一个类似于 Postman 的纯净体验，不仅能在前端 H5（Web端）流畅使用，同时也完美适配微信小程序环境。

## 🌟 核心特性

### 🎨 前端界面 (Client)
- **多标签页管理 (Multi-Tab)**：支持同时开启多个请求标签页，双击标签可重命名，各自维护独立的 URL、参数、Headers、Body 及响应结果信息。
- **协议与数据支持**：
  - 完美支持 GET, POST, PUT, DELETE, PATCH, HEAD 等主流 HTTP Method。
  - Request Body 支持 `JSON`, `Text`, `Form-Data` 以及 `x-www-form-urlencoded`。
  - 提供 Auth 快捷配置表单（Basic Auth, Bearer Token）。
- **极速导入功能**：
  - **cURL 导入**：支持一键粘贴 cURL 或 fetch 命令，自动解析并填充至各个对应属性栏。
  - **表单文本导入**：支持基于纯文本换行（`key: value` 格式）一键批量导入字典至表单参数。
- **现代化 UI/UX 设计**：
  - 响应式侧边抽屉面板用于展示接口返回数据，支持触控拖拽式调整高度。
  - 提供系统级的【白天/暗黑】双主题一键无缝切换。
  - 特别针对移动端与刘海屏（iPhone Safe Area）进行了精细优化和防误触处理。
  - 内置 JSON 格式化以及高亮展示组件，长文本可丝滑滚动，且全局隐藏冗余滚动条。

### 🛡️ 服务端代理 (Server)
由于浏览器自带的 CORS 跨域限制以及微信小程序需要配置业务域名的限制，我们提供了一个轻量且安全的 Node.js 代理服务器。
- **无缝代理层**：前端只需统一请求 Node 服务，服务端将使用 `Axios` 在后台代为转发请求，打破所有的前端跨域墙。
- **防泄漏与端点保护 (SSRF Protection)**：底层内置强大的白名单与正则防护，严禁任何形式针对主机内网 IP (`127.0.0.1`, `192.168.*`等) 及云商敏感元数据 (`169.254.*`) 的恶意访问探测。
- **载荷限制防崩溃**：利用 `koa-bodyparser` 强干预最大有效载荷为 20MB，防止恶意超大请求把 Node.js 内存打满（OOM）。
- **自带 Mock & Swagger**：内置完善的本地 Mock 路由用于接口调试，并集成了 OpenAPI (Swagger) 规范自生成交互式的文档（运行后访问 `/docs` 查阅）。

---

## 🚀 快速上手 (Getting Started)

本项目分为 `client`（前端）和 `server`（后端服务端）两个部分。请确保你的环境中已安装 `Node.js`。

### 1. 启动后端 Proxy 服务

后端服务负责替前端发送真实请求。
```bash
cd server
npm install
npm run dev  # 启动本地开发服务，默认运行在 http://localhost:3000
```
*(如果要部署在生产环境，请查阅 `server/README.md` 中关于 PM2 与 Nginx 的使用详情)*。

### 2. 启动前端 (H5 / 微信小程序)

前端项目由 `vite` 和 `uni-app` 驱动。
环境变量 `.env.development` 默认指向本地服务端 `http://localhost:3000`，如需发布线上可前往 `.env.production` 更改。

```bash
cd client
npm install

# 运行为 H5 (在浏览器中打开调试)
npm run dev:h5

# 运行为微信小程序 (需使用微信开发者工具打开 client/dist/dev/mp-weixin)
npm run dev:mp-weixin 
```

### 3. 一键编译打包
```bash
# 编译 H5 生产环境产物
npm run build:h5

# 编译 微信小程序 生产产物
npm run build:mp-weixin
```

---

## 🛠️ 技术栈 (Tech Stack)
- **Frontend**: Vue 3 (Composition API), Vite, Uni-app
- **Backend**: Node.js, Koa2, Axios
- **Docs**: Swagger JSDoc, Koa2-Swagger-UI
- **Others**: Vue Reactivity, CSS Variables (Theming), multer, form-data.

## 🤝 贡献与反馈
有任何的 Bug 或新想法，欢迎一起讨论交流和改进此项目。

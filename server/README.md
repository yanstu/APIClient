# Nebula API Client - Proxy Server

这是 Nebula API 调试助手的服务端代理，主要用于规避浏览器和微信小程序的跨域 (CORS) 限制，并提供了部分 Mock 测试接口和前置安全过滤。

## 特性说明

- **反向代理**: 接受前端传递的完整请求参数，经由 Axios 服务端发起真实请求，解决跨域问题。
- **安全检查 (SSRF Protection)**: 自动阻断针对内网 IP（如 `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `172.16.x.x`）的扫描与探测，防止服务器被利用作为跳板。
- **载荷限制**: 通过 `koa-bodyparser` 严格限制最大请求载荷为 `20MB`，防止恶意大体积包导致 Node.js 内存耗尽或崩溃 (OOM)。
- **Mock 服务**: 自带 `/api/mock/*` 路由用于自测各种常见 HTTP 请求和响应。
- **Swagger 文档**: 服务启动后自动生成 OpenAPI 接口规范，访问 `/docs` 即可查看。

## 环境要求

- Node.js >= 16
- npm 或 yarn 或 pnpm

## 本地开发与运行

1. 进入当前目录 (`server`):
   ```bash
   cd server
   ```
2. 安装依赖:
   ```bash
   npm install
   ```
3. 启动开发服务器 (支持修改后自动热更):
   ```bash
   npm run dev
   # 或者手动启动
   node server.js
   ```
4. 服务默认运行于 `http://localhost:3000`

## 生产环境部署部署 (Production)

在生产环境中，**强烈建议使用进程守护工具 (如 PM2)** 以保证服务的高可用性和异常自动重启。

### 1. 安装 PM2
```bash
npm install pm2 -g
```

### 2. 启动服务
```bash
# 在 server 目录下执行
pm2 start server.js --name "api-client-proxy"
```

### 3. 查看服务状态与日志
```bash
# 查看状态
pm2 status

# 查看实时日志
pm2 logs api-client-proxy

# 监控资源占用
pm2 monit
```

### 4. Nginx 代理配置推荐

通常你应该在服务器外层套一个 Nginx 进行域名绑定和 HTTPS 卸载，Nginx 配置示例如下：

```nginx
server {
    listen 80;
    server_name proxy.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 匹配 Koa 20MB 配置，Nginx 端也要放行大报文
        client_max_body_size 20M; 
    }
}
```

## 注意事项与进阶配置

1. **跨域配置 (CORS)**
   当前 `app.use(cors())` 默认允许了所有域名的访问 (`*`)，这在生产环境可能会被滥用。如果你部署在公网并且仅供自己的前端站点使用，建议在 `server.js` 中将跨域设为你的特定域名。
   
   ```javascript
   app.use(cors({
     origin: 'https://your-frontend-domain.com'
   }));
   ```
2. **自定义端口**
   你可以通过环境变量临时改变端口：
   ```bash
   PORT=8080 node server.js
   ```

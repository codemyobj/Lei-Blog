# Lei-Blog 改造方案：Vercel → 腾讯云 + 首版功能补齐

> 作者：高见远（架构师） · 面向：雷磊（前端工程师，自有腾讯云 CVM）
> 结论先行：Lei-Blog 的架构（Vite + React 19 + Express 5 + PostgreSQL + JWT）**值得保留**，去 Vercel 化的改造量约 **1.5 人日**，功能补齐约 **4 人日**，总计约 5~6 人日。

---

## 0. 一句话结论

| 问题 | 结论 |
|---|---|
| 架构要不要换 | **不换**。Express 可独立 `node dist/index.js` 启动（`server/src/index.ts:13`），Vercel 只是多了一层 serverless 包装，剥掉即可。 |
| 部署拓扑 | 单台 CVM：Nginx(443) 静态托管 `client/dist` + 反代 `/api` → PM2 常驻 Node(127.0.0.1:8080) → Docker `postgres:17-alpine`(127.0.0.1:5432) |
| 全文搜索 | **服务端 `pg_trgm` GIN 索引**，`<3` 字符降级 `ILIKE`。**不用 zhparser**，**不用客户端索引**。 |
| 代码高亮 | **不换 Shiki**。真正的问题是「没引主题 CSS」，补一套 ~60 行 hljs token 配色即可。 |
| 两份 schema.sql | **以 `server/src/database/schema.sql` 为唯一权威**，删掉根 `database/schema.sql`。 |
| 阻塞项 | 2 个：域名备案状态、CVM 内存规格（详见 §7） |

---

## 1. 现状评估结论表

### 1.1 六项首版功能

| # | 功能 | 现状 | 证据（文件:行号） | 需做的工作 |
|---|---|---|---|---|
| 1 | 文章列表 | ✅ 已有 | `client/src/pages/HomePage.tsx:20` 调 `usePosts`；`server/src/controllers/postController.ts:27` `getPosts`（分页 + 总数 + `totalPages`） | 无。列表还差「按分类筛选」（见 #2） |
| 2 | 文章详情 | ✅ 已有 | `client/src/pages/PostDetailPage.tsx:98` `MarkdownRenderer`；`postController.ts:98` `getPostBySlug`（含阅读量 +1、标签回带） | 补 TOC 侧栏（见 #3） |
| 3 | **归档页** | ❌ **没有** | `client/src/App.tsx:27-33` 路由表只有 `/`、`/posts/:slug`、`/tags`、`/tags/:slug`、`/about`，无 `/archive`；全库 grep `archive` 零命中 | 新增 `GET /api/posts/archive` 接口 + `ArchivePage.tsx` + 路由 + Navbar 入口 |
| 4 | 标签系统 | ✅ 完整 | 表 `tags`/`post_tags`（`server/src/database/schema.sql:35-50`）；`tagController.ts:5` 带 `post_count`；`TagCloud`/`TagBadge`/`TagsPage`/`TagDetailPage` 齐备 | 无 |
| 5 | **分类** | ❌ **没有** | `server/src/database/schema.sql` 全部 5 表为 `users/posts/tags/post_tags/about`，无 `categories`；`client/src/types/index.ts:19-33` `Post` 无 `category` 字段 | 新增 `categories` 表 + `posts.category_id` + 前后端 CRUD + 列表页 + 详情页 |
| 6 | **代码高亮** | ⚠️ **已接线但视觉无效** | `MarkdownRenderer.tsx:3,25` 接了 `rehype-highlight`；但**全项目从未 import 任何 highlight.js 主题 CSS**（grep `hljs` 仅命中 `client/src/index.css:270-272`，只设了 `.hljs` 的前景/背景色，**无任何 token 配色**）。现状是代码块渲染出一堆 `hljs-keyword` class 但全部同色 | 新增 hljs token 配色表（light/dark 两组），详见 §3.3 |
| 7 | **目录锚点 TOC** | ❌ **没有** | `MarkdownRenderer.tsx` 全文 32 行，未接 `rehype-slug`（heading 无 `id`），无 TOC 组件 | 加 `rehype-slug` + `extractToc` 工具 + `TocSidebar` 组件 + IntersectionObserver 高亮 |
| 8 | **评论系统** | ❌ **没有** | 无 `comments` 表、无组件、无相关依赖；全库 grep `comment`/`giscus` 零命中 | 接 Giscus + 优雅降级（见 §3.5） |
| 9 | **全文搜索** | ❌ **没有** | 前端无搜索组件/页面；后端 `postController.ts` 仅 `getPosts`（只支持 `?tag=`）/ `getPostBySlug`，**无 `q` 参数、无 `tsvector`、无 `pg_trgm`**；全库 grep `search` 只命中 `useSearchParams`（分页用） | 新增 `GET /api/search?q=`（pg_trgm）+ `SearchPage` + Navbar 搜索入口 |
| 10 | **暗黑模式** | ⚠️ **有，但只有两态** | `ThemeContext.tsx:4` `type Theme = 'light' \| 'dark'`（无 `system`）；持久化 ✅ `ThemeContext.tsx:16,23` localStorage `theme`；防首屏闪白 ✅ `client/index.html:9-18` 内联前置脚本；CLS ✅ 走 CSS 变量 + `.dark` class 切换，`index.css:58` 只 transition `background-color/color` | 升级为三态（light/dark/system）+ 监听 `prefers-color-scheme` change + 同步改 `index.html` 内联脚本 |

**汇总**：6 项需求里，**0 项完全满足、2 项部分满足（暗黑模式、代码高亮）、4 项缺失（归档、分类、TOC、搜索、评论算 5 项）**。README:16 声称的「代码高亮」是虚标。

### 1.2 i18n 现状（改造时会不会被破坏）

- 实现：`i18next@24` + `react-i18next@15` + `LanguageDetector`，资源内联在 `client/src/i18n/locales/{zh,en}.ts`（均 ~164 行，11 个 namespace）。
- 范围：**仅 UI 文案**。文章正文和标签名**不做翻译**（DB 里只有单份 `title`/`content`），符合单语博客预期。
- 持久化：`localStorage['blog_lang']`，`i18n/index.ts:21-26`；同步 `<html lang>`（`i18n/index.ts:30-33`）。
- 风险：**低**。改造只要在 `zh.ts`/`en.ts` 各加对应 key 即可，不涉及结构改动。新增页面（归档/分类/搜索/评论）需同步补两组文案，否则会显示 key 原文。
- 一个现存瑕疵：`zh.ts:109` 把明文默认账号 `admin@blog.com / admin123` 写进登录页文案，生产环境必须删（见 §7 待明确 #5）。

---

## 2. Vercel → 腾讯云 迁移方案（核心）

### 2.1 Vercel 耦合点清单

| 文件 | 作用（现在） | 迁移后是否失效 | 处置 |
|---|---|---|---|
| `vercel.json` | `buildCommand` / `outputDirectory` / `installCommand` + 两条 rewrite：`/api/(.*)`→`/api`（走 serverless）、`/((?!api).*)`→`/index.html`（SPA fallback） | **完全失效**（rewrite 由 Nginx 接管，构建命令由本地/服务器接管） | **删除** |
| `api/index.ts` | Vercel serverless 入口，`export default app`（`api/index.ts:7-9`） | **完全失效**（常驻 Node 不需要 serverless 包装） | **删除** |
| `DEPLOY.md` | 整篇是 Vercel + Neon 部署指南（`DEPLOY.md:1-78`） | **内容过期** | **重写**为 `docs/DEPLOY-TENCENT.md`，原文件删除 |
| `client/src/api/index.ts:4` | `baseURL: '/api'` 硬编码相对路径 | **不失效**（同域 + Nginx 反代 `/api` 后继续可用） | 改为读 `import.meta.env.VITE_API_BASE ?? '/api'`，为将来分域留口子 |
| `client/.env.example:3` | 声明了 `VITE_API_BASE=/api` | **死配置**——代码里根本没读 | 一并修好，让配置生效 |
| `server/src/config/db.ts:16` | `max: NODE_ENV==='production' ? 1 : 10` | **有害**。这是 serverless 专用值（Vercel 函数并发会打爆 PG 连接数）。常驻 Node 下会导致**所有查询串行走 1 条连接** | 改为常量 `10` |
| `server/src/config/db.ts:15` | `ssl: useRemote ? { rejectUnauthorized: false } : undefined`（有 `DATABASE_URL` 就强制 SSL） | **有害**。腾讯云本机 Docker PG 默认不开 SSL，用 `DATABASE_URL` 会直接连不上 | 改为按 `DB_SSL` 环境变量显式开关 |
| `server/src/app.ts:24-27` | CORS 默认只允许 `localhost:5173`，生产靠 `ALLOWED_ORIGINS` | 部分失效（同域反代下浏览器不发跨域请求，CORS 不触发；但直连/IP 访问仍受限） | 保留机制，`ALLOWED_ORIGINS` 填真实域名 |
| `server/src/index.ts` | `app.listen(PORT)`，**独立启动能力完整** | ✅ 不失效 | 补 `SIGTERM` 优雅关闭（PM2 restart 时释放连接池） |
| `README.md:74` | 「后端通过 `api/index.ts` 作为 serverless 函数运行」 | 过期 | 改写部署章节 |

**关键判断：不存在「Express 应用无法独立 `node server` 启动」的问题。** `server/src/index.ts:13` 有完整的 `app.listen`，`server/package.json:9` 的 `npm start` → `node dist/index.js` 开箱可用。去 Vercel 化的本质是「删两个文件 + 改两行 db 配置 + 加一层 Nginx」。

### 2.2 部署拓扑

```
                    腾讯云 CVM（推荐 2C4G，Ubuntu 24.04）
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Internet :80 ──301──▶ :443                                 │
│                          │                                   │
│                    ┌─────▼──────┐                            │
│                    │   Nginx    │                            │
│                    └─────┬──────┘                            │
│          ┌───────────────┼────────────────┐                  │
│          │ /             │ /api/*         │                  │
│   ┌──────▼──────┐  ┌─────▼────────────────▼─────┐            │
│   │ 静态文件     │  │  proxy_pass                │            │
│   │ /opt/.../   │  │  127.0.0.1:8080            │            │
│   │ client/dist │  └─────┬──────────────────────┘            │
│   │ try_files   │        │                                   │
│   │ → index.html│  ┌─────▼───────────────┐                   │
│   └─────────────┘  │ PM2: node           │                   │
│                    │ server/dist/index.js│                   │
│                    │ (Express 5, 单进程)  │                   │
│                    └─────┬───────────────┘                   │
│                          │ TCP 5432 (localhost only)         │
│                    ┌─────▼───────────────┐                   │
│                    │ Docker: postgres    │                   │
│                    │ :17-alpine          │                   │
│                    │ volume → /data/pg   │                   │
│                    └─────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 前端构建产物如何部署

**Nginx 静态托管 `client/dist`，不走 Node。**

- 构建在**服务器**上做（`git pull && cd client && npm ci && npm run build`），产物 `/opt/lei-blog/client/dist`。
- 不在本地构建再传：Vite 产物含哈希文件名，rsync 需带 `--delete`，且 `VITE_*` 变量是 build 期内联的，本地构建容易用错环境。
- Nginx 直接 `root` 指过去 + `try_files` 做 SPA fallback，零 Node 参与，静态资源走 `sendfile`，首屏比任何 Node 托管都快。
- 缓存策略：带 hash 的 `/assets/*` 设 `immutable` 长缓存；`index.html` 设 `no-cache`（否则发版后用户拿不到新入口）。

### 2.4 Express 后端如何常驻 —— 选 PM2

| 方案 | 结论 |
|---|---|
| **PM2** | ✅ **推荐** |
| Docker（全站容器化） | ❌ 不推荐 |
| systemd | ⚠️ 备选 |

**选 PM2 的理由**：
1. 应用**天天改**，PM2 的发布路径最短：`git pull && npm run build && pm2 restart blog-api`，3 条命令、约 40 秒。Docker 化要多走镜像构建 + 容器重建，每次多 2 分钟，对个人博客是净负担。
2. `pm2 startup` + `pm2 save` 两条命令解决开机自启（生成 systemd unit），不需要手写 unit 文件。
3. 崩溃自拉、内存阈值重启、`pm2 logs` / `pm2 monit` 对前端工程师的调试习惯最友好。
4. 日志轮转 `pm2 install pm2-logrotate`，避免日志撑爆磁盘。

**为什么数据库反而用 Docker**：PostgreSQL 几乎不改，容器化的收益（版本锁定、秒级重建、`pg_dump` 备份隔离）远大于成本。而 Node 应用改得勤，容器化收益小。**这个"混搭"是刻意的，不是随意。**

`ecosystem.config.js`（放在 `/opt/lei-blog/`）：

```js
module.exports = {
  apps: [{
    name: 'blog-api',
    cwd: '/opt/lei-blog/server',   // 关键：dotenv.config() 按 cwd 解析 .env，cwd 错了就读不到密钥
    script: 'dist/index.js',
    instances: 1,                   // 单进程足够；博客 QPS < 10
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '300M',
    error_file: '/var/log/lei-blog/api-error.log',
    out_file:   '/var/log/lei-blog/api-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  }],
}
```

**⚠️ 坑位预告（务必写进部署文档）**：`server/src/app.ts:19` 的 `dotenv.config()` 按 `process.cwd()` 解析 `.env`。PM2 若不设 `cwd`，默认 cwd 是 PM2_HOME（`~/.pm2`），`.env` 读不到 → `JWT_SECRET` 为 `undefined` → 登录接口直接 500。上面配置里的 `cwd` 是**必须的**。

### 2.5 PostgreSQL 部署方式 —— Docker postgres:17-alpine

| 方案 | 结论 | 理由 |
|---|---|---|
| **Docker `postgres:17-alpine`** | ✅ **推荐** | 版本可控（`17-alpine` 锁定）、镜像 ~90MB、常驻内存 ~50-80MB、`pg_dump` 备份与宿主解耦、升级就是换 tag 重建 |
| 云数据库 TencentDB for PG | ❌ 不推荐 | 最低配 ~100 元/月起，个人博客文章量 < 500 篇，性价比不成立 |
| 宿主直接 `apt install postgresql` | ❌ 不推荐 | 版本受 Ubuntu 24.04 镜像限制（PG 16），大版本升级要 `pg_upgradecluster`，比换 Docker tag 麻烦一个数量级 |

启动命令（一次性，之后靠 `restart: always` 自愈）：

```bash
docker run -d --name blog-pg \
  --restart=always \
  --memory=512m --memory-swap=512m \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD='<强随机密码>' \
  -e POSTGRES_DB=blog \
  -e TZ=Asia/Shanghai \
  -v /data/pg:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \      # 只监听回环，不放公网
  postgres:17-alpine \
  -c shared_buffers=128MB \
  -c max_connections=50 \
  -c timezone=Asia/Shanghai
```

**注意 `-p 127.0.0.1:5432:5432`**：只绑回环地址，配合腾讯云安全组不放行 5432，数据库不暴露公网。

**首次初始化**：在服务器上 `cd server && npm run db:setup`（`server/src/scripts/setupDb.ts`，305 行，建 5 表 + 管理员 + 5 标签 + 4 篇示例文章，见 `DEPLOY.md:59`）。

**备份策略**：

```bash
# /opt/lei-blog/scripts/backup.sh
#!/bin/bash
set -euo pipefail
D=$(date +%Y%m%d-%H%M)
mkdir -p /data/backup
docker exec blog-pg pg_dump -U blog -Fc blog > /data/backup/blog-$D.dump
gzip -f /data/backup/blog-$D.dump
find /data/backup -name 'blog-*.dump.gz' -mtime +7 -delete
```

- `crontab -e`：`0 3 * * * /opt/lei-blog/scripts/backup.sh >> /var/log/lei-blog/backup.log 2>&1`
- 用 `-Fc`（自定义格式，压缩 + 支持 `pg_restore` 选择性恢复），不用纯 SQL。
- 本地保留 7 天；**每周一次 `rclone`/`coscli` 同步到腾讯云 COS 归档桶**（低成本，防宿主机磁盘故障）。

### 2.6 Nginx 配置（关键片段）

`/etc/nginx/conf.d/lei-blog.conf`：

```nginx
# ---------- HTTP → HTTPS ----------
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name yourdomain.com www.yourdomain.com;

    # ---------- TLS ----------
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # ---------- 安全头 ----------
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    root /opt/lei-blog/client/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    client_max_body_size 10m;   # 后台上传/长 Markdown 正文

    # ---------- 1) API 反向代理 ----------
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        # 阅读量 +1 是 fire-and-forget，别让它拖慢响应
        proxy_buffering on;
    }

    # ---------- 2) 带哈希的静态资源：长缓存 ----------
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location = /favicon.svg {
        expires 7d;
        add_header Cache-Control "public";
    }

    # ---------- 3) SPA fallback ----------
    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html 绝不长缓存，否则发版后用户拿不到新入口
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
}
```

**跨域说明**：前端与 API **同域同协议**（都是 `https://yourdomain.com`），浏览器不发跨域请求，`ALLOWED_ORIGINS` 不会被触发。保留它只是为了本地开发（`http://localhost:5173`）和将来分域。因此**不存在跨域改造工作量**，只需把 `ALLOWED_ORIGINS` 填成 `https://yourdomain.com,http://localhost:5173`。

### 2.7 环境变量与密钥管理

| 变量 | 位置 | 值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | `/opt/lei-blog/server/.env` | `postgresql://blog:xxx@127.0.0.1:5432/blog` | 本机回环，**不带 `sslmode`** |
| `DB_SSL` | 同上 | `false` | 新增开关，替代现在的「有 DATABASE_URL 就强制 SSL」 |
| `JWT_SECRET` | 同上 | `openssl rand -base64 32` 输出 | 与 Vercel 时期的密钥**必须不同**（视旧密钥为已泄露） |
| `ALLOWED_ORIGINS` | 同上 | `https://yourdomain.com,http://localhost:5173` | |
| `PORT` | 同上 | `8080` | PM2 里不设也行，`server/src/index.ts:8` 有默认值 |
| `NODE_ENV` | PM2 `ecosystem.config.js` | `production` | **不要**写进 `.env`，否则本地 build 会误用 |
| `VITE_API_BASE` | `/opt/lei-blog/client/.env.production` | `/api` | Vite build 期内联，改了必须重新 build |
| `VITE_GISCUS_*` | 同上 | 见 §3.5 | 未配置则评论模块自动隐藏 |

管理约定：
- `/opt/lei-blog/server/.env` `chmod 600`，属主 `deploy` 用户，不进 Git（`.gitignore:9` 已覆盖 `.env`）。
- 建库密码用 `openssl rand -base64 24` 生成，与 `JWT_SECRET` 一起记在你的密码管理器。
- **旧 Vercel 环境变量（含 Neon 连接串）视为已泄露**：迁移完成后在 Vercel 后台删项目，在 Neon 删库或轮换密码。

### 2.8 HTTPS 证书方案

**`acme.sh` + Let's Encrypt，90 天自动续期。** 不用腾讯云免费 DV 证书（一年期需手动续，容易忘）。

```bash
curl https://get.acme.sh | sh -s email=you@example.com
~/.acme.sh/acme.sh --issue -d yourdomain.com -d www.yourdomain.com --webroot /opt/lei-blog/client/dist
~/.acme.sh/acme.sh --install-cert -d yourdomain.com \
  --key-file       /etc/letsencrypt/live/yourdomain.com/privkey.pem \
  --fullchain-file /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
  --reloadcmd      "systemctl reload nginx"
```

`acme.sh` 安装时会写一条 crontab 自动续期；`--webroot` 模式复用 Nginx 的静态目录做 HTTP-01 校验，**不需要停服**。

> ⚠️ 前提：域名必须已完成 ICP 备案（中国大陆 CVM），否则 80/443 会被拦截，acme.sh 校验失败。见 §7 待明确 #1。

### 2.9 `api/index.ts` 与 `vercel.json` 的处置

| 文件 | 处置 | 理由 |
|---|---|---|
| `api/index.ts` | **删除**（连带 `api/` 目录） | 腾讯云常驻 Node 不需要 serverless 包装；留着是死代码，且会让人误以为有两条启动路径 |
| `vercel.json` | **删除** | 不要「保留但不用」。留着的真实风险：将来有人（或你自己）把仓库重新导入 Vercel，会走一套已无人维护的构建/路由配置，浪费排查时间。删掉是干净的信号 |
| `DEPLOY.md` | **删除**，内容重写为 `docs/DEPLOY-TENCENT.md` | 内容全是 Vercel + Neon，留着会误导 |
| `README.md:66-74`（结构 + 部署章节） | **改写** | 去掉 `api/` 目录说明，改写成腾讯云部署指向 |
| 根 `package.json` | **保留原样** | `install:all` / `dev:server` / `dev:client` / `db:setup` 在服务器上都还要用 |

---

## 3. 补齐缺失功能的方案

### 3.1 全文搜索 —— 最终结论

#### 决策

> **服务端 PostgreSQL `pg_trgm` + GIN 索引，`GET /api/search?q=`。**
> **不用 zhparser，不用 pg_jieba，不用客户端索引（FlexSearch/MiniSearch）。**

#### 为什么中文分词不构成阻塞

中文分词的本质是「把连续汉字切成语素」。但对**博客搜索**这个场景，用户的意图是「找包含这几个字的文章」，不是「找语义相关的文章」。三元组（trigram）匹配**绕开了分词**：它把「深入理解 React」切成 `深入`、`入理`、`理解`、`解 R`、`Re`、`eac`、`act`… 这样的 3 字符滑窗，查询词同样切片后做相似度比对。**它不依赖词边界，所以中文天然可用。**

实测结论（PG 官方 contrib，`pg_trgm` 无需编译）：
- `CREATE EXTENSION pg_trgm;` —— 一行，Docker 官方镜像自带。
- 500 篇文章规模下查询 **毫秒级**。

> **⚠️ v2 修正（2026-10-09，寇豆码在真机实测后推翻本方案初版阈值，已确认并采纳）**
>
> 初版写的是 `similarity(search_document, q) > 0.15`，**这是错的，不要用。**
>
> 原因：`similarity(a, b)` 的定义是 `|A ∩ B| / |A ∪ B|`（A、B 是三元组集合）。查询词「虚拟列表」只有 ~6 个三元组，而 `search_document` 是「标题 + 摘要 + 去 Markdown 正文」，几百字起步就有几百个三元组。**分母被正文长度撑爆，命中分数必然被稀释。** 初版那句「中文能命中」是用短标题当被测文本得出的 —— 构造了一个对自己有利的用例，属于方案缺陷。
>
> 真机数据（PostgreSQL 18.3 + pg_trgm）：
>
> | 表达式 | 值 |
> |---|---|
> | `similarity('虚拟列表', '深入理解虚拟列表原理')` | 0.1429（标题精确含词，仍低于 0.15） |
> | `similarity('虚拟列表', <400+ 字真实文章>)` | **0.0610** |
> | `similarity('虚拟列表', <无关文章>)` | 0.0000 |
>
> **按 0.15 阈值，中文搜索永远返回 0 条。** 改用 `word_similarity()`，见下方「查询策略」。

#### 被否决的方案与理由

| 方案 | 否决理由 |
|---|---|
| `to_tsvector('simple', ...)` | 中文按整句切成单个 token，搜「虚拟列表」搜不到「深入理解虚拟列表」。**等于没有中文搜索。** |
| `zhparser` / `pg_jieba` | 需编译（zhparser 依赖 SCWS 词典 + `postgresql-server-dev-17` + `build-essential`），镜像体积 +300MB，PG 大版本升级要重编。为 500 篇文章付出持续运维成本，**不划算**。 |
| 客户端 FlexSearch / MiniSearch | 要在前端加载全部文章正文。500 篇 Markdown 纯文本约 2-5MB，首屏不可接受；且要维护「索引产物生成 + 发布时同步」的额外链路。**把搜索做在服务端本来就是 PG 的强项。** |
| Elasticsearch / Meilisearch | 个人博客杀鸡用牛刀，多一个进程 = 多 300MB 内存 + 多一套运维。 |

#### 实现要点

**SQL 迁移**（追加到 `server/src/database/schema.sql`）：

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 搜索专用列：标题 + 摘要 + 正文纯文本（去 Markdown 标记）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_document TEXT;

-- GIN trigram 索引（当前实现靠它做 headroom，见下方「索引使用情况」说明）
CREATE INDEX IF NOT EXISTS idx_posts_search_trgm
  ON posts USING GIN (search_document gin_trgm_ops);

-- 英文词干分支的表达式索引（只在 q 含 ASCII 字母时命中，必须建，否则该分支是纯 seq scan + 逐行 to_tsvector）
CREATE INDEX IF NOT EXISTS idx_posts_search_en_tsv
  ON posts USING GIN (to_tsvector('english', search_document));
```

> **不要再建 `idx_posts_title_trgm`（初版方案里有，已删除）。**
> 三条查询路径都不用它：trigram 分支打的是 `search_document`；ILIKE 分支的 `q` 只有 1–2 字符、抽不出三元组，GIN 用不上（必然 seq scan）；tsvector 分支走的是表达式索引。它是纯粹的写入放大，白白拖慢每次保存文章。

**`search_document` 的填充**：在 `createPost`/`updatePost`（`server/src/controllers/adminPostController.ts:147,218`）写入时，用同一个 `stripMarkdown()` 工具从 `content` 生成纯文本，拼 `title + '\n' + excerpt + '\n' + plainContent`，一并入库。**不在查询时实时转换**（浪费 CPU）。存量文章跑一次回填脚本。

**查询策略（明确规则，不留模糊空间）**：

```
q 长度判定（按 Unicode 码点计，非字节）：
  q 为空 / 长度 > 100   → 返回 400，不做查询

  len(q) >= 3           → 走 trigram 全文：
      过滤：word_similarity(q, search_document) > SEARCH_MIN_SCORE   （默认 0.3）
      排序：( word_similarity(q, title) * 3
              + word_similarity(q, search_document) ) DESC, published_at DESC

  len(q) in [1, 2]      → 降级 ILIKE 子串匹配：
      title ILIKE '%q%' OR excerpt ILIKE '%q%'
      排序：published_at DESC

  q 含 ASCII 字母       → 在 trigram 分支之外「OR」叠加一次英文词干命中：
      to_tsvector('english', search_document) @@ plainto_tsquery('english', q)
      （hook/hooks、run/running 这类词形变化靠它召回；必须是 OR 叠加，不能替换 trigram 分支）
```

**为什么是 `word_similarity` 而不是 `similarity`**（v2 修正的核心）：
`word_similarity(query, document)` 取「文档中与查询词最相似的一段连续三元组片段」来比对，**不受文档总长度稀释** —— 这正是 pg_trgm 为「短查询词匹配长文档」设计的函数。参数顺序有意义，第一个参数是查询词，第二个是被搜文档，写反了结果完全不同。

真机数据（PostgreSQL 18.3）：

| 表达式 | 值 |
|---|---|
| `word_similarity('虚拟列表', <标题含词>)` | 1.0000 |
| `word_similarity('虚拟列表', <仅正文含词>)` | 0.8000 |
| `word_similarity('虚拟列表', <无关文档>)` | 0.0000 |
| `word_similarity('hooks', <含 hook 的文>)` | 0.6667 |

命中 ≥ 0.66、无关 ≤ 0.09，间隔极大，`0.3` 阈值安全边界充足。阈值走 `SEARCH_MIN_SCORE` 环境变量覆盖，便于调参与 QA。

**不要为了「标题加权」把 `similarity()` 请回来做二次排序** —— 它同样受长度稀释，会让分数不可比。标题加权用 `word_similarity(q, title) * 3` 实现即可（标题命中最高拿 3.0，正文命中拿 1.0，量纲一致）。

`<3` 字符降级的原因：trigram 至少需要 3 字符才能生成一个三元组，2 字查询（如「Vue」「SSR」）相似度恒为 0，必须有降级路径 —— 这是可落地、可测的明确规则，不是「看情况」。

**索引使用情况（说清楚，别自欺）**：
`word_similarity(q, search_document) > 0.3` 作为裸表达式谓词 **用不上 GIN 索引**，实际是 seq scan + 逐行计算。500 篇文章下这是 1–2ms，完全可接受，所以当前实现就这么写。
GIN 索引保留为 headroom：等文章量涨到万级再切索引加速形态 —— 把谓词换成 `<%` 运算符（`$1 <% search_document`），并把 GUC `pg_trgm.word_similarity_threshold` 设成 `0.3`（该 GUC 默认 0.6，不设会用错阈值）。注意 `SET LOCAL` 只在事务内有效，需在 `pool.on('connect')` 里用 `SET` 或在 client checkout 后显式 BEGIN/COMMIT 包裹。
在此之前，**不要让 QA 拿「是否走索引」当验收项**。

**接口契约**：

```
GET /api/search?q=虚拟列表&page=1&pageSize=10
→ {
    results: [{ id, title, slug, excerpt, published_at, tags[], score, highlight{ title, excerpt } }],
    total, page, pageSize, totalPages, took_ms
  }
```

**高亮**：pg_trgm 没有 `ts_headline`。**在前端做**：服务端只返回原始 `title`/`excerpt`，前端用转义后的纯文本按关键词做 `<mark>` 包裹（React 节点拼接，不走 `dangerouslySetInnerHTML`）。零 XSS 风险，实现 20 行。

**前端**：`SearchPage`（`/search?q=`）+ Navbar 搜索框（回车跳转）+ 300ms debounce 的即时下拉建议（可选，V2）。

**依赖包**：`pg_trgm` 是 PG 自带 contrib，**无需新增 npm 包**。

### 3.2 目录锚点 TOC

**依赖**：
- `rehype-slug@^6.0.0` —— 给 `h1~h6` 生成 `id`（内部用 `github-slugger`）
- `github-slugger@^2.0.0` —— TOC 侧生成同样的 slug，保证锚点一致（必须显式装，不能靠 rehype-slug 的内部依赖）
- `unist-util-visit@^5.0.0` + `remark-parse@^15.0.0` —— 解析 AST 提取标题

**实现要点**：
1. `client/src/utils/extractToc.ts`：纯函数 `(md: string) => TocItem[]`，用 `remark-parse` 解析后 `unist-util-visit` 遍历 `heading` 节点，`depth` 取 `node.depth`，`slug` 用 `github-slugger` 生成（**必须和 `rehype-slug` 用同一个 slugger 实例算法，否则锚点对不上**）。只取 `depth 2-3`（h1 通常是文章标题，不进 TOC）。
2. `MarkdownRenderer.tsx` 的 `rehypePlugins` 加 `[rehypeSlug]`。
3. `TocSidebar.tsx`：渲染嵌套列表，`<a href={'#' + slug}>`；用 `IntersectionObserver` 监听所有 heading，当前可见项高亮（`aria-current="location"`）。
4. `PostDetailPage.tsx` 布局改为 `grid lg:grid-cols-[1fr_220px]`，TOC 在 `lg` 以上固定右侧（`position: sticky; top: 5rem`），`lg` 以下隐藏（移动端不做浮层，避免遮挡）。
5. `scroll-margin-top: 5rem` 加到 `.markdown-body h2,h3,h4`（`client/src/index.css`），补偿 sticky Navbar 高度，否则锚点跳转会被导航栏盖住。
6. 标题数 < 2 时不渲染 TOC（避免孤零零一条）。

### 3.3 代码高亮 —— 不换 Shiki

**结论：保留 `rehype-highlight`（highlight.js），不换 Shiki。** 真正的问题是没引主题 CSS，换库是治错病。

**为什么不换 Shiki**：
| 维度 | highlight.js（现状） | Shiki |
|---|---|---|
| 客户端体积 | ~30KB（按需语言） | 全量语法 JSON 1-3MB；按需加载也要在构建期确定语言集 |
| 双主题 | 换 CSS 变量即可 | 需服务端预渲染双份 HTML 或客户端重新高亮 |
| 改架构 | 否 | **要**。客户端 Shiki 要加载 WASM/JSON；要真正用好必须改成「服务端渲染 Markdown → 存 HTML 进 DB」，这是数据模型和发布流程的大改 |
| 收益 | 20+ 常见语言够用 | 更精准的语义高亮（对博客读者感知极弱） |

**做法**：新建 `client/src/styles/hljs-theme.css`，用 CSS 变量定义 ~25 个 token 类（`.hljs-keyword` / `.hljs-string` / `.hljs-comment` / `.hljs-title` / `.hljs-number` / `.hljs-attr` / `.hljs-built_in` / `.hljs-literal` / `.hljs-type` / `.hljs-variable` / `.hljs-regexp` / `.hljs-symbol` / `.hljs-meta` / `.hljs-section` / `.hljs-tag` / `.hljs-name` / `.hljs-selector-*` / `.hljs-addition` / `.hljs-deletion` / `.hljs-emphasis` / `.hljs-strong` …），light/dark 两组，在 `client/src/index.css` 顶部 `@import`。

**为什么手写而不是 `@import 'highlight.js/styles/github.css'`**：highlight.js 的主题文件是**全局作用域**，无法用 PostCSS 加 `.dark` 前缀；引两个主题会互相覆盖需要靠加载顺序 hack。手写 60 行变量驱动的 CSS 是一次性成本，且完全可控、不吃上游版本变化。

**顺带修的**：`rehype-highlight` 默认会尝试高亮所有 `code` 块，未识别语言时静默跳过。给 `MarkdownEditor` 的语言提示加文档说明即可。

### 3.4 归档页 + 分类

**归档页**
- 后端：`GET /api/posts/archive` → `SELECT id, title, slug, published_at FROM posts WHERE status='published' ORDER BY published_at DESC NULLS LAST`。**在 JS 里用 `reduce` 按年份分组**（不上 `date_trunc`，SQL 更简单且年份分组逻辑前端要用 i18n 格式化）。
- 前端：`ArchivePage.tsx`（`/archive`），按年分组时间线，年份大标题 + 文章行（`MM-DD` + 标题），`lg` 双列。
- Navbar `navLinks`（`client/src/components/Navbar.tsx:15-19`）插入 `{ to: '/archive', label: t('nav.archive') }`。

**分类**
- 数据模型（追加到 `server/src/database/schema.sql`）：
  ```sql
  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS category_id INTEGER
    REFERENCES categories(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
  ```
- 语义边界（明确，避免和标签重复）：**一篇文章只有一个分类，可以有多个标签**。分类做一级导航（前端 / 后端 / 工具 / 随笔），标签做细粒度关键词。
- 后端：`routes/categories.ts`（公开 `GET /api/categories`、`GET /api/categories/:slug`）+ `routes/adminCategories.ts`（CRUD，挂 `authMiddleware`，复用 `utils/slug.ts` 的 `generateSlug`/`ensureUniqueSlug`）。`getPosts` 增加 `?category=slug` 过滤分支（照现有 `?tag=` 分支的写法扩展，`postController.ts:38-54`）。`PostListRow` 类型加 `category_id`/`category`。
- 前端：`CategoryBadge.tsx`、`CategoriesPage.tsx`、`CategoryDetailPage.tsx`（`/categories/:slug`）、`admin/AdminCategoryListPage.tsx`；`PostCard` 显示分类；`AdminPostEditPage` 加分类下拉（必填改为选填，`null` 允许）。

### 3.5 评论系统 —— Giscus + 优雅降级

**依赖**：`@giscus/react@^3.1.0`

**为什么 Giscus**：零后端、零数据库表、零运维；评论存 GitHub Discussions，自带 Markdown + 表情 + 邮件通知；读者用 GitHub 账号登录，天然过滤大部分垃圾评论。

**优雅降级（硬要求）**：
```
client/src/config/site.ts:
  export const giscus = {
    enabled: Boolean(
      import.meta.env.VITE_GISCUS_REPO &&
      import.meta.env.VITE_GISCUS_REPO_ID &&
      import.meta.env.VITE_GISCUS_CATEGORY_ID
    ),
    repo: import.meta.env.VITE_GISCUS_REPO,
    repoId: ...,
    categoryId: ...,
  }

CommentSection.tsx:
  if (!giscus.enabled) return null      // ← 静默不渲染，不是错误提示、不是破损 UI
```

三个环境变量任意一个缺失 → 整个评论区**完全不出现**（不占位、不报错、不显示「评论功能未配置」）。这样本地开发和未配置的生产环境都不会出现破损 UI。

**主题同步**：Giscus 是 iframe，不吃外部 CSS 变量。通过 `theme` prop 传 `'light' | 'dark'`，从 `useTheme()` 取值 —— 但 `ThemeContext` 升级为三态后，需要把 `system` 解析成实际的 `light`/`dark`（见 §3.6）。

**放置位置**：`PostDetailPage` 文章正文下方、分隔线之后。

**备选（若拒绝 GitHub 账号门槛）**：Waline（`client` 侧 `@waline/client` + 服务端独立的 `@waline/vercel` Node 进程 + 额外 SQLite/PG 表）。**多一个进程 ≈ 多 100MB 内存 + 多一套运维**，本项目不推荐，仅列为备选。

### 3.6 暗黑模式升级为三态

现状满足「持久化 ✅ / 无首屏闪白 ✅ / CLS=0 ✅」，缺的是「三态」和「跟随系统变化」。

改造点：
1. `ThemeContext.tsx:4`：`type Theme = 'light' | 'dark' | 'system'`；内部维护 `resolvedTheme: 'light' | 'dark'`。
2. localStorage 存**用户选择**（`'light' | 'dark' | 'system'`，缺省 `'system'`），不存解析结果。
3. `useEffect` 里加 `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handler)`，在 `system` 态下实时跟随；卸载时移除监听。
4. **`client/index.html:9-18` 的内联脚本必须同步改**：
   ```js
   const saved = localStorage.getItem('theme')       // 'light' | 'dark' | 'system' | null
   const isDark = saved === 'dark' || ((saved === 'system' || !saved) &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches)
   if (isDark) document.documentElement.classList.add('dark')
   ```
   这段是**阻塞式内联脚本**（在 `<head>` 内、CSS 之外），保证首帧之前 class 已经就位 → 无闪白、CLS=0。改三态时漏改这里会直接导致首屏闪白回归。
5. `document.documentElement.classList.toggle('dark', resolved === 'dark')` 保持不变。
6. UI：`Navbar` 的主题按钮由「明暗切换」改为三态循环（light → dark → system），图标分别用太阳/月亮/显示器，`aria-label` 同步 i18n。
7. Giscus 的 `theme` prop 用 `resolvedTheme`（iframe 不认 `system`）。

---

## 4. 文件清单

### 新增

| 路径 | 说明 |
|---|---|
| `docs/MIGRATION-PLAN.md` | 本文档 |
| `docs/DEPLOY-TENCENT.md` | 腾讯云部署手册（替代 `DEPLOY.md`） |
| `deploy/nginx.conf.example` | Nginx 配置模板 |
| `deploy/ecosystem.config.js` | PM2 配置 |
| `deploy/backup.sh` | PG 备份脚本 |
| `deploy/setup-server.sh` | 一键初始化（装 Docker/Nginx/Node/acme.sh，建目录） |
| `server/src/routes/categories.ts` | 分类公开路由 |
| `server/src/routes/adminCategories.ts` | 分类管理路由 |
| `server/src/controllers/categoryController.ts` | 分类公开控制器 |
| `server/src/controllers/adminCategoryController.ts` | 分类管理控制器 |
| `server/src/controllers/searchController.ts` | 全文搜索控制器 |
| `server/src/routes/search.ts` | 搜索路由 |
| `server/src/utils/stripMarkdown.ts` | Markdown → 纯文本（`search_document` 用） |
| `server/src/scripts/backfillSearch.ts` | 存量文章 `search_document` 回填 |
| `client/src/styles/hljs-theme.css` | hljs token 配色（light/dark） |
| `client/src/utils/extractToc.ts` | Markdown AST → TOC |
| `client/src/components/TocSidebar.tsx` | TOC 侧栏 |
| `client/src/components/CommentSection.tsx` | Giscus 封装（含降级） |
| `client/src/components/SearchBox.tsx` | Navbar 搜索框 |
| `client/src/components/CategoryBadge.tsx` | 分类徽章 |
| `client/src/pages/ArchivePage.tsx` | 归档页 |
| `client/src/pages/SearchPage.tsx` | 搜索结果页 |
| `client/src/pages/CategoriesPage.tsx` | 分类总览 |
| `client/src/pages/CategoryDetailPage.tsx` | 分类下文章 |
| `client/src/pages/admin/AdminCategoryListPage.tsx` | 分类管理 |
| `client/src/hooks/useSearch.ts` | 搜索 hook |
| `client/src/hooks/useCategories.ts` | 分类 hook |
| `client/src/hooks/useArchive.ts` | 归档 hook |
| `client/src/config/site.ts` | 站点配置（Giscus 开关等） |

### 修改

| 路径 | 改动 |
|---|---|
| `server/src/database/schema.sql` | **权威 schema**：加 `categories` 表、`posts.category_id`、`pg_trgm` 扩展 + `search_document` 列 + GIN 索引 |
| `server/src/config/db.ts` | `max` 改常量 10；SSL 改 `DB_SSL` 显式开关 |
| `server/src/app.ts` | 注册 `categories` / `search` / admin categories 路由 |
| `server/src/index.ts` | 加 `SIGTERM` 优雅关闭（释放 pg 连接池） |
| `server/src/controllers/postController.ts` | `getPosts` 加 `?category=` 分支；新增 `getArchive`；写入时维护 `search_document`；`getPosts` 返回 `category` |
| `server/src/controllers/adminPostController.ts` | create/update 时写 `search_document` 与 `category_id` |
| `server/src/routes/posts.ts` | 挂 `GET /archive`（**必须放在 `/:slug` 之前**） |
| `server/src/types/index.ts` | `CategoryRow` / `PostRow.category_id` / `SearchResult` |
| `server/.env.example` | 加 `DB_SSL`；补充分项说明 |
| `server/src/scripts/setupDb.ts` | 管理员账号改读 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 环境变量，不再硬编码 `admin123` |
| `client/src/App.tsx` | 加 `/archive`、`/search`、`/categories`、`/categories/:slug`、`/admin/categories` 路由 |
| `client/src/components/Navbar.tsx` | `navLinks` 加归档/分类；加 `SearchBox`；主题按钮改三态 |
| `client/src/context/ThemeContext.tsx` | 三态 + `matchMedia` 监听 |
| `client/index.html` | 内联防闪脚本同步三态逻辑 |
| `client/src/index.css` | `@import` hljs 主题；`.markdown-body h2,h3,h4` 加 `scroll-margin-top` |
| `client/src/components/MarkdownRenderer.tsx` | `rehypePlugins` 加 `rehypeSlug` |
| `client/src/pages/PostDetailPage.tsx` | 双列布局 + TOC + `CommentSection` + 分类徽章 |
| `client/src/components/PostCard.tsx` | 显示分类 |
| `client/src/pages/admin/AdminPostEditPage.tsx` | 加分类下拉 |
| `client/src/api/index.ts` | `baseURL` 读 `import.meta.env.VITE_API_BASE ?? '/api'` |
| `client/src/types/index.ts` | `Category`、`Post.category`、`TocItem`、`SearchResponse` |
| `client/src/i18n/locales/zh.ts` / `en.ts` | 补 archive/search/category/comment/theme 文案；**删掉 `zh.ts:109` 的明文默认账号** |
| `client/.env.example` / 新增 `client/.env.production.example` | 声明 `VITE_API_BASE` 与 Giscus 三件套 |
| `client/package.json` | 加 `rehype-slug`、`github-slugger`、`unist-util-visit`、`remark-parse`、`@giscus/react` |
| `README.md` | 重写部署章节与项目结构 |

### 删除

| 路径 | 理由 |
|---|---|
| `api/index.ts`（及 `api/` 目录） | Vercel serverless 入口，腾讯云不用 |
| `vercel.json` | Vercel 部署配置，腾讯云不用 |
| `DEPLOY.md` | Vercel + Neon 指南，内容过期（重写为 `docs/DEPLOY-TENCENT.md`） |
| `database/schema.sql` | 与 `server/src/database/schema.sql` 重复的副本，且已不同步（注释被剥、seed 文案被改） |

---

## 5. 任务列表

> 依赖关系：T01 是所有任务的前置。T02 / T03 可并行；T04 依赖 T02+T03；T05 依赖 T04。

### T01 · 去 Vercel 化与部署基础设施 — P0

**依赖**：无
**涉及文件**：
- 删除：`api/index.ts`、`vercel.json`、`DEPLOY.md`、`database/schema.sql`
- 新增：`deploy/nginx.conf.example`、`deploy/ecosystem.config.js`、`deploy/backup.sh`、`deploy/setup-server.sh`、`docs/DEPLOY-TENCENT.md`
- 修改：`server/src/config/db.ts`、`server/src/index.ts`、`server/.env.example`、`client/src/api/index.ts`、`client/.env.example`、`README.md`

**完成判定**：
1. 删掉 `api/`、`vercel.json` 后，本地 `cd server && npm run build && npm start` 能起服务，`curl localhost:8080/api/health` 返回 `{"status":"ok"}`。
2. `db.ts` 的 `max` 不再依赖 `NODE_ENV`，且 `DB_SSL=false` 时能连本机无 SSL 的 PG。
3. `server/src/index.ts` 收到 `SIGTERM` 时打印日志并 `process.exit(0)`（`kill -TERM <pid>` 验证）。
4. `deploy/` 下 4 个文件语法检查通过（`nginx -t` 用模板变量替换后校验、`node -c` 不适用则 `node --check` 校验 js、bash 脚本 `bash -n` 通过）。
5. 仓库根目录 `grep -r vercel` 只剩 0 处（README 也已改）。

---

### T02 · 数据层与后端能力扩展（分类 / 归档 / 搜索） — P0

**依赖**：T01
**涉及文件**：
- 修改：`server/src/database/schema.sql`、`server/src/app.ts`、`server/src/types/index.ts`、`server/src/controllers/postController.ts`、`server/src/controllers/adminPostController.ts`、`server/src/routes/posts.ts`、`server/src/scripts/setupDb.ts`
- 新增：`server/src/routes/categories.ts`、`server/src/routes/adminCategories.ts`、`server/src/controllers/categoryController.ts`、`server/src/controllers/adminCategoryController.ts`、`server/src/controllers/searchController.ts`、`server/src/routes/search.ts`、`server/src/utils/stripMarkdown.ts`、`server/src/scripts/backfillSearch.ts`

**完成判定**：
1. 全新数据库执行 `npm run db:setup` 后：`\dt` 有 6 张表（+`categories`），`posts` 有 `category_id` 与 `search_document` 列，`\dx` 能看到 `pg_trgm`。
2. `GET /api/posts?category=frontend` 只返回该分类下已发布文章；不传参行为与改动前一致（回归）。
3. `GET /api/posts/archive` 返回按 `published_at DESC` 排序的文章数组（**且该路由在 `/:slug` 之前，不会被 `/posts/archive` 误匹配成 slug 查询**）。
4. `GET /api/search?q=虚拟列表` 返回 `results/total/took_ms`，`took_ms < 50`（本地 1000 篇种子数据下）；
   `q=Vue`（2 字符）走 ILIKE 降级仍能返回结果；`q=` 空返回 400。
4b. **中文关键词必须能命中「只在正文出现、标题和摘要都没有」的文章** —— 这是初版阈值踩过的坑（长文档会把 `similarity()` 稀释到 0.06，导致中文搜索恒返回 0 条）。
   验收时必须构造一篇正文含「虚拟列表」但标题/摘要不含的文章，确认 `score > 0`。
   响应体的 `strategy` / `used_english_tsvector` 两个字段要能直接看出走了哪条路径。
5. 新建/更新文章后 `search_document` 自动填充；跑 `backfillSearch.ts` 后存量文章 `search_document` 非空率为 100%。
6. `setupDb.ts` 不再出现硬编码密码，改为读 `ADMIN_EMAIL` / `ADMIN_PASSWORD`（缺失时用随机密码并打印一次）。

---

### T03 · 前端基础能力（主题三态 / 代码高亮 / TOC） — P1

**依赖**：T01
**涉及文件**：
- 修改：`client/src/context/ThemeContext.tsx`、`client/index.html`、`client/src/index.css`、`client/src/components/MarkdownRenderer.tsx`、`client/package.json`
- 新增：`client/src/styles/hljs-theme.css`、`client/src/utils/extractToc.ts`、`client/src/components/TocSidebar.tsx`

**完成判定**：
1. 主题状态可为 `light`/`dark`/`system`；选 `system` 后在 OS 层面切换深色模式，页面**无需刷新**即跟随变化。
2. 三种状态下刷新页面**均无首屏闪白**（用 DevTools 性能录制 + 帧截图验证首帧背景色正确）。
3. 代码块中关键字/字符串/注释呈现**三种不同颜色**（亮色与暗色各验一次）—— 即 hljs token 配色真正生效。
4. 一篇文章的 `h2`/`h3` 均带 `id` 属性，且 `id` 与 `extractToc` 生成的 `slug` **完全一致**（写一个单测对比）。
5. 滚动正文时 TOC 高亮项跟随变化；点击 TOC 条目跳转后标题**不被 sticky Navbar 遮挡**（`scroll-margin-top` 生效）。
6. 标题数 < 2 的文章不渲染 TOC。

---

### T04 · 新增页面与功能集成（归档 / 分类 / 搜索 / 评论） — P0

**依赖**：T02、T03
**涉及文件**：
- 新增：`client/src/pages/ArchivePage.tsx`、`client/src/pages/SearchPage.tsx`、`client/src/pages/CategoriesPage.tsx`、`client/src/pages/CategoryDetailPage.tsx`、`client/src/pages/admin/AdminCategoryListPage.tsx`、`client/src/components/SearchBox.tsx`、`client/src/components/CategoryBadge.tsx`、`client/src/components/CommentSection.tsx`、`client/src/hooks/useSearch.ts`、`client/src/hooks/useCategories.ts`、`client/src/hooks/useArchive.ts`、`client/src/config/site.ts`
- 修改：`client/src/App.tsx`、`client/src/components/Navbar.tsx`、`client/src/pages/PostDetailPage.tsx`、`client/src/components/PostCard.tsx`、`client/src/pages/admin/AdminPostEditPage.tsx`、`client/src/types/index.ts`、`client/src/i18n/locales/zh.ts`、`client/src/i18n/locales/en.ts`

**完成判定**：
1. `/archive` 按年份分组展示全部已发布文章，年份从新到旧。
2. `/categories` 列出全部分类及文章数；`/categories/:slug` 列出该分类下文章；`PostCard` 显示分类徽章。
3. Navbar 搜索框回车跳 `/search?q=xxx` 并展示结果；**中文关键词可命中正文内容**（不是只搜标题）。
4. 未配置 Giscus 三件套环境变量时，文章页**评论区完全不出现**，且 console 无报错、无 React warning。
5. 中英文切换后，新增页面的文案全部有对应翻译（`grep` 页面里不能出现未定义的 i18n key 原文）。
6. `zh.ts` 中不再有明文默认账号。
7. `npm run build` 通过（含 `tsc -b` 类型检查），`npm run lint` 无 error。
8. 含中文 slug 的文章详情页能正常打开（链接与请求均做 `encodeURIComponent`）。

---

### T05 · 腾讯云部署上线与验收 — P0

**依赖**：T04
**涉及文件**：`deploy/*`（在服务器上落地）、`docs/DEPLOY-TENCENT.md`（按实际踩坑回填）

**完成判定**：
1. `docker ps` 显示 `blog-pg` 为 `Up`，且 `docker exec blog-pg pg_isready` 通过；`ss -lntp` 显示 5432 只监听 `127.0.0.1`。
2. `pm2 list` 显示 `blog-api` `online`；`pm2 save` + `pm2 startup` 已执行，`systemctl reboot` 后服务自动恢复（**必须真重启验证一次**）。
3. `https://yourdomain.com` 打开首页正常，SSL 评级 SSL Labs ≥ A。
4. `https://yourdomain.com/api/health` 返回 `{"status":"ok"}`；直接访问 `:8080` 从外网不通（安全组已放行仅 80/443/22）。
5. `/posts/:slug` 深链接刷新不 404（SPA fallback 生效）；发版后 `index.html` 不被长缓存（响应头为 `no-cache`）。
6. 手动跑一次 `backup.sh`，`/data/backup/` 生成 `.dump.gz`，且 `pg_restore -l` 能读出内容。
7. 全站冒烟：首页 → 详情（TOC + 高亮 + 评论）→ 归档 → 分类 → 搜索 → 关于 → 后台登录 → 新建文章 → 前台可见。

---

## 6. 风险评估

### 6.1 资源占用（实测估算）

| 组件 | 常驻内存 | 磁盘 | 备注 |
|---|---|---|---|
| `postgres:17-alpine` | 50–120MB（`shared_buffers=128MB` 时峰值 ~200MB） | 数据 ~10MB(100 篇) + 镜像 90MB | `--memory=512m` 限死 |
| Node(Express 5) 单进程 | 80–150MB | — | PM2 `max_memory_restart: 300M` 兜底 |
| Nginx | 10–20MB | — | worker_processes=auto，2C 就 2 个 worker |
| acme.sh / cron / 备份 | ~0 | 备份 7 天 ~70MB | |
| **合计** | **~250–400MB** | **~5GB**（含 OS + Node + 镜像） | |

**结论**：**2C4G 舒适，2C2G 可用，1C1G 不建议**（PG 至少要 512MB 才不 swap，1G 机器会频繁 OOM）。

### 6.2 故障点与对策

| # | 故障点 | 概率 | 影响 | 对策 |
|---|---|---|---|---|
| 1 | PG 容器被 OOM kill | 中（1C1G 机器） | 全站 500 | `--memory=512m` + `--restart=always`；PG 配置 `shared_buffers=128MB` 保守值；2C4G 起 |
| 2 | 磁盘被备份/日志撑满 | 中 | 全站不可用 | `backup.sh` 保留 7 天；`pm2-logrotate` 限 100MB/7 天；`df -h` 加进每周巡检 |
| 3 | Node 进程崩溃 | 低 | API 500（静态页仍可访问） | PM2 `autorestart: true`；`pm2 logs --err --lines 100` 定位 |
| 4 | **服务器重启后 Docker 未自启** | **中** | 全站 500 | `systemctl enable docker` + 容器 `--restart=always`（两条都要做，只做一条不够） |
| 5 | **PM2 `cwd` 配错 → `.env` 读不到 → JWT_SECRET undefined → 登录 500** | **高**（最可能的翻车点） | 后台无法登录 | `ecosystem.config.js` 显式 `cwd: '/opt/lei-blog/server'`；部署文档里加显式验证步骤（`pm2 logs` 首行应打印 `PORT: 8080`） |
| 6 | acme.sh 续期失败（域名未备案 / 80 端口被封） | 中 | 90 天后 HTTPS 过期 | 部署当天就跑一次 `acme.sh --renew --force` 验证流程；加 crontab 邮件告警 |
| 7 | 连接池耗尽 | 低 | 请求排队 | `max: 10`（已从 serverless 的 1 改回），Express 单进程 QPS 远低于此 |
| 8 | 中文 slug 链接失效 | 中 | 部分文章 404 | T04 判定 #8：列表与 TOC 链接统一 `encodeURIComponent`；`generateSlug`（`server/src/utils/slug.ts:11`）保留中文是既定行为，不改 |
| 9 | `search_document` 未回填 | 中 | 老文章搜不到 | T02 判定 #5：部署后必跑 `backfillSearch.ts` 并校验非空率 100% |
| 10 | **ILIKE 分支硬编码占位符编号 → `could not determine data type of parameter $1`** | 高（必现） | 1–2 字搜索直接 500 | ILIKE 分支只用 like 模式参数，若 SQL 里出现 `$2` 却没有 `$1`，PG 无法确定参数类型。必须用动态分配占位符的参数构造器，**不要**在拼接 WHERE 时手写编号 |
| 11 | **`setupDb.ts` 从 `dist/` 运行会 ENOENT** | 高（必现） | 生产首次初始化失败 | `__dirname/../database/schema.sql` 在 `dist/` 下不存在。需加候选路径探测（`src/` 与 `dist/` 两套布局都要能找到），不要把路径写死成单一布局 |
| 12 | 搜索阈值依赖 `pg_trgm` 具体版本行为 | 低 | 换 PG 大版本后召回变化 | T05 在真实 `postgres:17-alpine` 上复跑一次阈值验证脚本（`D:/学习/前端/.pgverify/`），确认 0.3 阈值在 17 上同样成立再上线 |

### 6.3 运维负担（实话实说）

| 频率 | 事项 | 耗时 |
|---|---|---|
| 每次发文章 | 后台写文章，无需碰服务器 | 0 |
| 每次改代码 | `git pull && npm run build && pm2 restart blog-api` | ~1 分钟 |
| 每月 | 0（证书自动续、备份自动跑） | 0 |
| 每季度 | 系统安全更新 + `docker pull postgres:17-alpine` 重建 + 确认备份可用 | ~15 分钟，**有 downtime，挑凌晨** |
| 每年 | PG 大版本升级（17 → 18）：`pg_dumpall` → 起新容器 → `pg_restore` | ~30 分钟 |

**对比 Vercel**：多出来的运维成本约 **每季度 15 分钟 + 每年 30 分钟**。换来的是：无函数超时限制、无冷启动、数据库常驻（搜索可建索引）、完全可控。**这个交换对个人博客很划算。**

### 6.4 明确不做（避免过度设计）

- ❌ 不做 CI/CD 流水线（GitHub Actions 自动部署）—— 手动 3 条命令够用，加流水线反而要管 Secret 和 runner
- ❌ 不做 Docker Compose 全站编排 —— 应用侧用 PM2 更快（见 §2.4）
- ❌ 不做 Redis 缓存 —— 单机 PG 查询毫秒级，缓存层是净负担
- ❌ 不做 SSR / SEO 预渲染 —— 个人博客主要靠分享和搜索收录，SPA 够用（真要做再加 `vite-plugin-ssr`，V2）
- ❌ 不做图片上传 —— 图床用 COS/对象存储，正文里贴外链（`cover_image` 已是 URL 字段）

---

## 7. 待明确事项

| # | 问题 | 影响 | 建议默认值（可直接执行） |
|---|---|---|---|
| 1 | **域名是否已完成 ICP 备案？** 中国大陆 CVM 的 80/443 未备案会被拦截，acme.sh 无法签发证书 | **阻塞 T05** | 若有已备案域名 → 直接用。若没有 → **先用服务器 IP + 自签证书跑通 T05 的功能验收，备案完成后再切域名**（备案通常 10-20 天，不要让它卡住开发）。方案已按「域名可替换」设计，`nginx.conf.example` 里 `server_name` 是唯一变量 |
| 2 | **CVM 规格（几 C 几 G）？** | 不阻塞开发，影响部署体验 | **2C4G**。低于 2G 会出现 §6.2 故障 #1。若现有机型是 1C2G，把 `shared_buffers` 降到 64MB 可勉强跑 |
| 3 | **分类和标签并存是否接受？** 有人觉得重复 | 影响 T02/T04 工作量（约 0.5 人日） | **接受并存**。分类 = 一级导航（≤10 个，后台手工维护），标签 = 细粒度关键词（自由增删）。这是博客的常见做法，且 PRD 里两者都提了 |
| 4 | **评论是否接受「必须登录 GitHub 才能评论」？** Giscus 的硬约束，会劝退非技术读者 | 影响 §3.5 选型 | **接受**。技术博客读者绝大多数有 GitHub 账号，且天然防垃圾评论。若不接受则换 Waline（+1 个 Node 进程 +1 张表，约 +0.5 人日），请明确告知 |
| 5 | **默认管理员账号 `admin@blog.com / admin123` 要改成什么？** 现密码明文写在 `DEPLOY.md:59` 和 `client/src/i18n/locales/zh.ts:109`（登录页直接显示给访客） | **安全，必须改** | 改为首次初始化时读 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 环境变量；未设置则生成随机密码并只在终端打印一次；登录页默认账号提示**删除**。部署当天用你自己的邮箱 + 密码管理器生成的强密码 |
| 6 | **旧 Vercel / Neon 资源如何处理？** | 安全 | 迁移验收后：Vercel 后台删除项目（旧 `JWT_SECRET` 和 Neon 连接串视为已泄露），Neon 删库或轮换密码。`JWT_SECRET` **必须换新的** |
| 7 | ~~`server/src/scripts/setupDb.ts` 是否内联 SQL~~ | 已澄清 | **已解答（寇豆码，2026-10-09）：它本来就只读 `schema.sql` 文件，不内联 SQL，不会产生第三份 schema。** 但暴露出一个更隐蔽的问题 —— 从 `dist/` 运行时 `__dirname/../database/schema.sql` 会 ENOENT，已加候选路径探测。详见 §6.2 故障 #11 |

---

## 8. 附：关键行号索引（供工程师快速定位）

| 事实 | 位置 |
|---|---|
| 无归档页路由 | `client/src/App.tsx:27-33` |
| 无分类字段 | `server/src/database/schema.sql`（全 5 表无 categories）；`client/src/types/index.ts:19-33` |
| 代码高亮无主题 CSS | `client/src/components/MarkdownRenderer.tsx:3,25`（接了插件）；`client/src/index.css:270-272`（只有 2 行背景色） |
| 无 TOC | `client/src/components/MarkdownRenderer.tsx`（全文 32 行，无 rehype-slug） |
| 无搜索 | `server/src/controllers/postController.ts`（仅 getPosts / getPostBySlug）；`server/src/routes/posts.ts:7-10` |
| 主题仅两态 | `client/src/context/ThemeContext.tsx:4` |
| 防闪白脚本（改三态时必改） | `client/index.html:9-18` |
| Vercel rewrite | `vercel.json:5-8` |
| Serverless 入口 | `api/index.ts:7-9` |
| API baseURL 硬编码 | `client/src/api/index.ts:4` |
| 死配置 VITE_API_BASE | `client/.env.example:3`（代码未读） |
| CORS 默认仅 localhost | `server/src/app.ts:24-27` |
| Express 可独立启动（好事） | `server/src/index.ts:13`；`server/package.json:9` |
| **连接池 max=1（serverless 遗留，必改）** | `server/src/config/db.ts:16` |
| **有 DATABASE_URL 就强制 SSL（必改）** | `server/src/config/db.ts:15` |
| 两份 schema 差异 | `database/schema.sql`（55 行，无注释，seed 文案短）vs `server/src/database/schema.sql`（74 行，带注释，seed 文案长）—— 表结构一致 |
| 明文默认账号 | `DEPLOY.md:59`；`client/src/i18n/locales/zh.ts:109` |
| dotenv 按 cwd 解析（PM2 坑） | `server/src/app.ts:19` |
| 中文 slug 保留中文 | `server/src/utils/slug.ts:11` |

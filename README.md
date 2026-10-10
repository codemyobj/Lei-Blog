# 个人博客

一个基于 React + Express + PostgreSQL 的全栈个人博客系统，部署在腾讯云 CVM（Nginx + PM2 + Docker PostgreSQL）。

## 技术栈

- **前端**：Vite + React 19 + TypeScript + Tailwind CSS + react-router-dom v7
- **后端**：Express 5 + TypeScript（常驻进程，PM2 托管）
- **数据库**：PostgreSQL 17（Docker `postgres:17-alpine`，只监听回环）
- **Web 服务器**：Nginx（静态托管 + `/api` 反向代理 + TLS）
- **鉴权**：JWT (jsonwebtoken + bcryptjs)
- **Markdown**：react-markdown + remark-gfm + rehype-highlight（渲染）、@uiw/react-md-editor（编辑）

## 功能

- 文章列表（卡片展示、分页、按标签/分类筛选）
- 文章详情（Markdown 渲染、代码高亮、阅读时长估算、元信息）
- 标签系统（标签云、按标签筛选）
- 分类系统（一级导航，一篇文章一个分类、多个标签）
- 归档（按年份分组的时间线）
- 全文搜索（`pg_trgm` GIN 索引，中文可用，`<3` 字符自动降级 `ILIKE`）
- 关于页面（Markdown 内容，后台可编辑）
- 深色/浅色主题切换（localStorage 持久化）
- 响应式布局（桌面 + 移动端）
- 后台管理（JWT 登录、文章/标签/分类/关于页 CRUD）

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
```

填写数据库连接信息和 JWT 密钥：

```bash
# JWT 密钥请勿使用示例值
openssl rand -base64 32
```

> ⚠️ 本机 / Docker PostgreSQL 默认不开启 SSL，`.env` 里请设置 `DB_SSL=false`。

### 3. 启动数据库

```bash
docker run -d --name blog-pg \
  --restart=always \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD='你的强密码' \
  -e POSTGRES_DB=blog \
  -p 127.0.0.1:5432:5432 \
  postgres:17-alpine
```

### 4. 初始化数据库

```bash
# 执行建表（server/src/database/schema.sql）+ 种子数据
npm run db:setup
```

管理员账号由环境变量决定（`ADMIN_EMAIL` / `ADMIN_PASSWORD`）。两个都未设置时，脚本会生成**随机密码并只在终端打印一次**，请立即保存。

> **不要**在代码或文档里留下明文默认账号 —— 初始化凭据只在你的终端出现一次。

### 5. 启动开发服务器

```bash
# 终端1：启动后端
npm run dev:server

# 终端2：启动前端
npm run dev:client
```

- 前端：http://localhost:5173
- 后端：http://localhost:8080
- 健康检查：http://localhost:8080/api/health
- 后台管理：http://localhost:5173/admin/login

## 项目结构

```
Lei-Blog/
├── client/        # 前端 (Vite + React + TS)
├── server/        # 后端 (Express + TS)
│   └── src/
│       ├── database/schema.sql   # 唯一的权威数据库 schema
│       ├── scripts/              # setupDb / backfillSearch
│       └── ...
├── deploy/        # 部署配置（Nginx / PM2 / 备份 / 手册）
└── docs/          # 设计与改造文档
```

## 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run install:all` | 安装前后端依赖 |
| `npm run dev:server` / `dev:client` | 本地开发 |
| `npm run build` | 构建前后端产物 |
| `npm run db:setup` | 建表 + 灌种子数据（含随机管理员密码） |
| `cd server && npm run db:search-backfill` | 存量文章回填 `search_document` |

## 部署

完整步骤见 **[`deploy/DEPLOY-TENCENT.md`](deploy/DEPLOY-TENCENT.md)**。

拓扑（单台 CVM）：

```
Internet :80 ──301──▶ :443
                       │
                  ┌────▼─────┐
                  │  Nginx   │
                  └────┬─────┘
        ┌──────────────┴──────────────┐
        │ /                    /api/* │
  client/dist (静态)      proxy_pass  │
                                 ▼
                    PM2: node server/dist/index.js (127.0.0.1:8080)
                                 │
                    Docker: postgres:17-alpine (127.0.0.1:5432)
```

日常发版三条命令：

```bash
cd /opt/lei-blog && git pull
cd client && npm ci && npm run build
pm2 restart blog-api
```

# 个人博客

一个基于 React + Express + PostgreSQL 的全栈个人博客系统。

## 技术栈

- **前端**：Vite + React 19 + TypeScript + Tailwind CSS + react-router-dom v7
- **后端**：Express 5 + TypeScript
- **数据库**：PostgreSQL
- **鉴权**：JWT (jsonwebtoken + bcryptjs)
- **Markdown**：react-markdown + remark-gfm + rehype-highlight（渲染）、@uiw/react-md-editor（编辑）

## 功能

- 文章列表（卡片展示、分页）
- 文章详情（Markdown 渲染、代码高亮、阅读时长估算、元信息）
- 标签分类系统（标签云、按标签筛选）
- 关于页面（Markdown 内容，后台可编辑）
- 深色/浅色主题切换（跟随系统、localStorage 持久化）
- 响应式布局（桌面 + 移动端）
- 后台管理（JWT 登录、文章/标签/关于页 CRUD）

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置环境变量

复制 `.env.example` 为 `server/.env`，填写数据库连接信息和 JWT 密钥。

### 3. 初始化数据库

创建 PostgreSQL 数据库 `blog`，然后执行：

```bash
# 执行建表 + 种子数据
npm run db:setup
```

或手动执行 `database/schema.sql` 和 `database/seed.sql`。

默认管理员账号：`admin@blog.com` / `admin123`

### 4. 启动开发服务器

```bash
# 终端1：启动后端
npm run dev:server

# 终端2：启动前端
npm run dev:client
```

- 前端：http://localhost:5173
- 后端：http://localhost:8080
- 后台管理：http://localhost:5173/admin/login

## 项目结构

```
Blog/
├── api/           # Vercel serverless 入口
├── client/        # 前端 (React + Vite)
├── server/        # 后端 (Express + TS)
└── database/      # SQL 建表与种子数据
```

## 部署

项目配置了 Vercel 部署（vercel.json）。前端构建到 `client/dist`，后端通过 `api/index.ts` 作为 serverless 函数运行。

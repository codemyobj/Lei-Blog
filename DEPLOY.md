# 免费部署指南：Vercel + Neon

把本全栈博客（React 前端 + Express API + PostgreSQL）以**零成本**部署上线，可发文、可进后台。

## 免费额度
- **Vercel Hobby**：免费，Serverless 函数 10s 超时、每月 100GB 流量；绑定 Git 仓库后 push 自动部署。
- **Neon Free**：免费 Postgres 0.5GB；计算空闲 5 分钟后自动休眠（首次连接冷启动约 1s），个人博客够用。

## 需要准备的账号（都免费，均可用 GitHub 一键注册）
1. GitHub（代码已在 `github.com/codemyobj/Lei-Blog`，分支 `main`）
2. Vercel（vercel.com，用 GitHub 登录）
3. Neon（neon.tech，用 GitHub 登录）

---

## 步骤

### 1. 推送最新代码
`vercel.json` 的 `maxDuration` 已改为 `10`（适配免费版函数超时上限），需先提交：
```bash
git add -A
git commit -m "chore: 适配 Vercel 免费版函数超时"
git push origin main
```

### 2. 创建 Neon 数据库
1. 打开 neon.tech → **New Project** → 起名 `blog` → Create。
2. 在 Dashboard 的 **Connection details** 选择 **Pooled** 连接，复制 **Connection string**
   （形如 `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`）。
3. 记下这串，下一步要用。

### 3. 导入到 Vercel 并首次部署
1. 打开 vercel.com → **Add New → Project** → 导入 `Lei-Blog` 仓库。
2. Framework Preset 选 **Other**（`vercel.json` 已配好构建与路由，无需改）。
3. Root Directory 保持 `.`（仓库根）。
4. 直接点 **Deploy**（先不配环境变量也能部署成功，只是暂时连不上库）。
5. 部署完会得到 `*.vercel.app` 域名，记下它（下文假设为 `https://lei-blog.vercel.app`）。

### 4. 配置环境变量
Vercel 项目 → **Settings → Environment Variables**，添加：

| Key | Value | 说明 |
|-----|-------|------|
| `DATABASE_URL` | 第 2 步复制的 Neon 连接串 | 远程 Postgres |
| `JWT_SECRET` | 一段强随机串（如 `openssl rand -base64 32` 的输出） | 登录鉴权密钥 |
| `ALLOWED_ORIGINS` | `https://lei-blog.vercel.app,http://localhost:5173` | 把域名换成你实际的 |

> `NODE_ENV` 在 Vercel 运行时自动为 `production`，可不填。

### 5. 初始化数据库（建表 + 种子数据）
在你本机 `server/` 目录下新建 `.env`，内容：
```
DATABASE_URL=上面复制的 Neon 连接串
```
然后运行：
```bash
npm run db:setup
```
会创建 5 张表、管理员账号（`admin@blog.com` / `admin123`）、5 个标签和 4 篇示例文章。

### 6. 重新部署让环境变量生效
回到 Vercel → **Deployments** → 最新部署点 **Redeploy**。之后访问你的域名即可看到博客。

### 7. 登录后台
访问 `https://你的域名/admin/login`，用 `admin@blog.com` / `admin123` 登录，即可写文章、管标签、改关于页。

---

## 常见问题
- **页面空白 / 接口报错 404**：确认 Vercel 域名已加入 `ALLOWED_ORIGINS`，并 **Redeploy**。
- **数据库连接失败**：Neon 免费版空闲后会休眠，首次访问可能等 ~1s；确认 `DATABASE_URL` 带 `sslmode=require` 且已 Redeploy。
- **函数超时**：已设为 10s（免费版上限），若某接口慢请优化查询。
- **改代码后不更新**：Vercel 绑定了 Git，push 到 `main` 会自动重新部署。

## 备注
- 前端用相对路径 `/api` 调接口，Vercel 同域下无需额外跨域配置（后台接口仍校验 `ALLOWED_ORIGINS`）。
- 文章 / 关于页内容存在数据库里，不在代码中；发布后通过后台录入。
- 想换中英文？点页面右上角 / 后台顶栏的「中文 / EN」切换，偏好存 localStorage。

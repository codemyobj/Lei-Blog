# Blog 项目长期记忆

## 技术栈
React 19 + Vite + TS（前端）/ Express 5 + TS + PostgreSQL（后端）/ 部署目标 Vercel + Neon。
i18n：react-i18next，默认 zh，切换器在 Navbar 与 AdminLayout，词条见 client/src/i18n/locales。

## 部署约定（免费方案）
- 平台：Vercel Hobby（前端 + Serverless API）+ Neon Free Postgres（0.5GB）。
- vercel.json 已配：build=client，output=client/dist，/api 重写到 api/index.ts 函数。
- 免费版函数 maxDuration=10s（务必 ≤10，否则部署告警并被强制降级）。
- 前端用相对路径 /api 调接口，同域无需额外跨域；后台接口仍校验 ALLOWED_ORIGINS。
- 生产环境变量：DATABASE_URL（Neon 连接串，带 sslmode=require）、JWT_SECRET、ALLOWED_ORIGINS。
- 初始化数据库：本机 server/.env 写 DATABASE_URL 后 `npm run db:setup`（建表+种子 admin@blog.com/admin123）。
- 远程仓库：github.com/codemyobj/Lei-Blog，分支 main。沙箱无 GitHub 凭证，push 需用户本机执行。

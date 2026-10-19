# Lei-Blog · 腾讯云 CVM 部署手册

> 适用：单台腾讯云 CVM（推荐 **2C4G**，Ubuntu 24.04），域名已完成 ICP 备案。
> 目标拓扑：**Nginx(443) 静态托管 client/dist + 反代 /api → PM2 常驻 Node(127.0.0.1:8080) → Docker postgres:17-alpine(127.0.0.1:5432)**

---

## 0. 前置检查

```bash
# 确认放行端口：22 / 80 / 443（安全组里放行，5432 与 8080 **绝不放公网**）
# 确认域名已备案：中国大陆 CVM 未备案会被拦截 80/443

lsb_release -a
free -h      # ≥ 2G 可用（低于 2G 见 §8 内存降级）
df -h        # ≥ 10G 可用
```

以下全部约定：项目落在 `/opt/lei-blog`，运行用户 `ubuntu`，域名用 `example.com` 代替（替换成你的真实域名）。

---

## 1. 安装基础软件

```bash
sudo apt update && sudo apt upgrade -y

# Docker（PG 用容器；Node 应用不用容器）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # 重新登录后生效
sudo systemctl enable --now docker   # ⚠️ 必须 enable，否则重启后容器不自启

# Nginx + Node 20
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v && npm -v && docker -v
```

---

## 2. 拉取代码并安装依赖

```bash
sudo mkdir -p /opt/lei-blog /var/log/lei-blog /data/backup
sudo chown -R $USER:$USER /opt/lei-blog
cd /opt/lei-blog
git clone https://github.com/codemyobj/Lei-Blog.git .

cd server && npm ci && cd ../client && npm ci
```

---

## 3. 启动 PostgreSQL（Docker）

```bash
# 生成强密码并记到密码管理器
openssl rand -base64 24

docker run -d --name blog-pg \
  --restart=always \
  --memory=512m --memory-swap=512m \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD='<上一步生成的强密码>' \
  -e POSTGRES_DB=blog \
  -e TZ=Asia/Shanghai \
  -v /data/pg:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  postgres:17-alpine \
  -c shared_buffers=128MB \
  -c max_connections=50 \
  -c timezone=Asia/Shanghai

# 验证
docker ps --filter name=blog-pg
docker exec blog-pg pg_isready -U blog
ss -lntp | grep 5432      # 必须只看到 127.0.0.1:5432，而不是 0.0.0.0:5432
```

> `-p 127.0.0.1:5432:5432` 只绑回环；配合安全组不放行 5432，数据库不暴露公网。

---

## 4. 配置服务端环境变量

```bash
cd /opt/lei-blog/server
cp .env.example .env
chmod 600 .env
```

`.env` 内容（**按实际情况替换**）：

```bash
PORT=8080
JWT_SECRET=<openssl rand -base64 32 的输出>
ALLOWED_ORIGINS=https://example.com,http://localhost:5173

# 本机回环连接，**不带 sslmode**
DATABASE_URL=postgresql://blog:<PG密码>@127.0.0.1:5432/blog

# ⚠️ 显式开关：本机 Docker PG 未开 SSL，必须为 false
DB_SSL=false

# 首次初始化管理员（可选；不设则脚本生成随机密码并只打印一次）
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<密码管理器生成的强密码>
```

> ⚠️ **`JWT_SECRET` 必须是全新的**。旧 Vercel / Neon 环境变量视为已泄露，迁移后在 Vercel 后台删项目、在 Neon 删库或轮换密码。

---

## 5. 初始化数据库

```bash
cd /opt/lei-blog/server
npm run db:setup
```

预期看到：表结构创建完成 → 管理员账号创建 → 标签/分类创建 → 文章创建 → `search_document` 回填 → 🎉 完成。

校验：

```bash
docker exec -it blog-pg psql -U blog -d blog -c '\dt'          # users/posts/tags/post_tags/about/categories 共 6 张表
docker exec -it blog-pg psql -U blog -d blog -c '\dx'          # 能看到 pg_trgm
docker exec -it blog-pg psql -U blog -d blog -c '\d posts'     # 能看到 category_id / search_document
```

若库里已有历史文章，跑一次回填并确认非空率 100%：

```bash
npm run db:search-backfill
```

> ⚠️ `ADMIN_PASSWORD` 未设置时生成的随机密码**只在终端出现一次**，务必当场保存。

---

## 6. 构建前端并用 PM2 启动后端

```bash
# 前端构建（服务器上做，避免本地 VITE_* 变量用错环境）
cd /opt/lei-blog/client
cp .env.example .env.production      # VITE_API_BASE=/api（Giscus 可选）
npm run build                        # 产物在 /opt/lei-blog/client/dist

# 后端构建 + PM2 启动
cd /opt/lei-blog/server
npm run build
sudo npm i -g pm2
sudo mkdir -p /var/log/lei-blog && sudo chown -R $USER:$USER /var/log/lei-blog

cd /opt/lei-blog
pm2 start deploy/ecosystem.config.js --env production
pm2 save
pm2 startup          # 按输出再执行一条 systemctl enable 命令
```

### ⚠️ 最高危翻车点：PM2 的 `cwd`

`server/src/app.ts` 里的 `dotenv.config()` 按 **`process.cwd()`** 解析 `.env`。
PM2 不显式设 `cwd` 时默认 `\`~/.pm2\`` → **读不到 `.env`** → `JWT_SECRET` 为 `undefined` → **后台登录直接 500**。

`deploy/ecosystem.config.js` 里已写死：

```js
cwd: '/opt/lei-blog/server',   // 不能省略、不能改错
```

**验证清单（每次部署后必跑）**：

```bash
pm2 logs blog-api --lines 5 --nostream
# ✅ 首行应出现：Starting Blog server... / PORT: 8080 / CWD: /opt/lei-blog/server
# ❌ 若 CWD 显示 ~/.pm2，说明 cwd 没生效，先修 ecosystem.config.js 再 pm2 restart

curl http://127.0.0.1:8080/api/health
# ✅ {"status":"ok","timestamp":"..."}

curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"你的密码"}'
# ✅ 返回 {"token":"..."}；返回 500 说明 JWT_SECRET 没读到 → 回到 cwd 检查
```

---

## 7. 配置 Nginx + HTTPS

### 7.1 先用 HTTP 起服务（拿证书之前）

```bash
sudo sed 's/__DOMAIN__/example.com/g' /opt/lei-blog/deploy/nginx.conf > /etc/nginx/conf.d/lei-blog.conf
```

在证书签发之前，把 443 server 块临时注释掉，只留 80 端口块（并在 80 块里先 `proxy_pass` 到 /api），否则 `nginx -t` 会因证书不存在而失败。

### 7.2 签发证书（acme.sh + Let's Encrypt，90 天自动续期）

```bash
curl https://get.acme.sh | sh -s email=you@example.com
source ~/.bashrc

~/.acme.sh/acme.sh --issue -d example.com -d www.example.com \
  --webroot /opt/lei-blog/client/dist

sudo mkdir -p /etc/letsencrypt/live/example.com
~/.acme.sh/acme.sh --install-cert -d example.com \
  --key-file       /etc/letsencrypt/live/example.com/privkey.pem \
  --fullchain-file /etc/letsencrypt/live/example.com/fullchain.pem \
  --reloadcmd      "systemctl reload nginx"
```

> `--webroot` 模式复用 Nginx 的静态目录做 HTTP-01 校验，**不需要停服**。
> `deploy/nginx.conf` 的 80 端口块已放行 `/.well-known/acme-challenge/`，续期不会被 301 挡掉。

### 7.3 启用完整配置

```bash
# 确认证书文件（/etc/letsencrypt/live/example.com/fullchain.pem）已经存在，再放开 443 块
sudo nginx -t && sudo systemctl reload nginx
```

### 7.4 验证

```bash
curl -I https://example.com                      # 200 + 安全头
curl -I https://example.com/                     # index.html 应为 no-cache
curl -I https://example.com/assets/<某个>.js      # 应为 public, immutable
curl https://example.com/api/health              # {"status":"ok"}
curl https://example.com/posts/<任意 slug>        # 深链接刷新不 404（SPA fallback 生效）

# 部署当天**必须**跑一次强制续期，验证流程真的可用
~/.acme.sh/acme.sh --renew -d example.com --force
```

上线后去 https://www.ssllabs.com/ssltest 检查，评级应 ≥ **A**。

---

## 8. 备份

```bash
sudo mkdir -p /opt/lei-blog/scripts
cp /opt/lei-blog/deploy/backup.sh /opt/lei-blog/scripts/backup.sh
chmod +x /opt/lei-blog/scripts/backup.sh

crontab -e
# 每天凌晨 3 点
0 3 * * * /opt/lei-blog/scripts/backup.sh >> /var/log/lei-blog/backup.log 2>&1
```

手动验证一次：

```bash
/opt/lei-blog/scripts/backup.sh
ls -lh /data/backup/
pg_restore -l /data/backup/blog-*.dump.gz | head    # 能读出内容才算成功
```

异地归档（可选，强烈建议）：装 `coscli` 或 `rclone`，在脚本里配 `REMOTE` / `REMOTE_CMD` 即可启用。

日志轮转：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 9. 日常发版

```bash
cd /opt/lei-blog && git pull
cd client && npm ci && npm run build
cd ../server && npm run build
pm2 restart blog-api
```

`pm2 restart` 会发 `SIGTERM`，`server/src/index.ts` 已实现优雅关闭：停止接收新连接 → 等待存量请求 → `pool.end()` 释放 PG 连接池 → 退出（10s 超时兜底）。

验证：

```bash
pm2 restart blog-api && sleep 2 && pm2 logs blog-api --lines 8 --nostream
# ✅ 应看到：[shutdown] Received SIGTERM ... PostgreSQL pool closed. → 新进程 Starting Blog server...
```

---

## 10. 上线验收清单

- [ ] `docker ps` 显示 `blog-pg` 为 `Up`；`docker exec blog-pg pg_isready` 通过
- [ ] `ss -lntp | grep 5432` 只监听 `127.0.0.1`
- [ ] `systemctl is-enabled docker` 为 `enabled`；容器 `--restart=always`
- [ ] `pm2 list` 显示 `blog-api` 为 `online`
- [ ] **`pm2 logs` 首行的 `CWD:` 是 `/opt/lei-blog/server`**（.env 读到的前提）
- [ ] `curl /api/health` 返回 `{"status":"ok"}`
- [ ] 用真实账号调 `/api/auth/login` 能拿到 token
- [ ] `pm2 save` + `pm2 startup` 已执行，**并真重启服务器验证一次**
- [ ] `https://域名` 首页正常；SSL Labs ≥ A
- [ ] 深链接 `/posts/:slug` 刷新不 404
- [ ] `index.html` 响应头 `no-cache`，`/assets/*` 响应头 `immutable`
- [ ] 手动跑一次 `backup.sh`，`pg_restore -l` 能读出内容
- [ ] 搜索三场景：`q=虚拟列表`（trigram）、`q=Vue`（ILIKE 降级）、`q=hooks`（英文词干）均有结果
- [ ] 全站冒烟：首页 → 详情 → 归档 → 分类 → 搜索 → 关于 → 后台登录 → 新建文章 → 前台可见

---

## 11. 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 后台登录 500 | **PM2 `cwd` 配错，`.env` 没读到** | 见 §6 验证清单；`pm2 delete blog-api && pm2 start deploy/ecosystem.config.js --env production` |
| `ECONNREFUSED 127.0.0.1:5432` | PG 容器没起来 / 服务器重启后 Docker 未自启 | `systemctl enable --now docker && docker start blog-pg` |
| 数据库连接报 SSL 错误 | `.env` 里 `DB_SSL` 未设为 `false` | `DB_SSL=false` 后 `pm2 restart blog-api` |
| 发版后页面没变化 | `index.html` 被长缓存 | Nginx 已配 `no-cache`；让用户强制刷新或换 CDN |
| 证书 90 天后过期 | acme.sh 续期失败（域名未备案 / 80 被封） | `~/.acme.sh/acme.sh --renew -d example.com --force` 看报错 |
| 搜不到老文章 | `search_document` 未回填 | `cd server && npm run db:search-backfill`，确认非空率 100% |
| 磁盘被撑满 | 备份 / 日志堆积 | 备份保留 7 天；`pm2-logrotate` 限 50M/7 天；每周 `df -h` 巡检 |

---

## 12. 内存降级（1C2G 机器）

```bash
docker rm -f blog-pg
docker run -d --name blog-pg \
  --restart=always \
  --memory=384m --memory-swap=384m \
  -e POSTGRES_USER=blog -e POSTGRES_PASSWORD='<密码>' -e POSTGRES_DB=blog \
  -v /data/pg:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  postgres:17-alpine \
  -c shared_buffers=64MB -c max_connections=30 -c work_mem=2MB
```

**1C1G 不建议部署**：PG 至少要 512MB 才不 swap，1G 机器会频繁 OOM。

---

## 13. 已知坑：服务器上 `npm ci` 后 client 构建必挂（原生二进制缺失）

**现象**：`npm ci && npm run build` 报 `MODULE_NOT_FOUND`，指向
`node_modules/rolldown/dist/shared/binding-*.mjs` 或 `node_modules/lightningcss/node/index.js`；
且 `vite build` 一启动就会**清空 `dist/`**，失败后站点直接 404。

**根因**：`package-lock.json` 是在 Windows 上生成的，npm 不会为其他平台补记
`optionalDependencies` 的平台二进制。Linux 服务器上 `npm ci` / `npm install` 都会
**静默跳过** `@rolldown/binding-linux-x64-gnu` 和 `lightningcss-linux-x64-gnu`，
rolldown / lightningcss 找不到原生 binding 就崩。

**处理**（构建前补装两个平台包，`--no-save` 不污染清单）：

```bash
cd /opt/lei-blog/client
VITE_VER=$(node -p "require('./node_modules/vite/package.json').version")   # 8.1.0
ROLLDOWN=$(node -p "require('./node_modules/rolldown/package.json').version")
LCSS=$(node -p "require('./node_modules/lightningcss/package.json').version")
npm install --no-save "@rolldown/binding-linux-x64-gnu@${ROLLDOWN}" "lightningcss-linux-x64-gnu@${LCSS}"
npm run build
```

**两条铁律**：
1. **构建前先备份 `dist/`**（`cp -a dist /opt/dist-bak-$(date +%Y%m%d)`），构建失败立刻回滚，
   因为 vite 会先清空 outDir。
2. **任何 `npm install` / `npm ci` 之后必须重装这两个包**，npm 会把它们剔除。

**根治方案**（待做）：在 Linux 上重新生成一份 lockfile（会补上 linux 平台条目，
且保留 win32 条目），提交后服务器即可直接 `npm ci`。

## 14. 部署通道（现行）：SSH 密钥直连（2026-10-19 起）

lighthouse-ops MCP 连接器不可用时，改走 SSH 直连，不再依赖任何连接器/控制台。

**一次性配置（已完成）**：
- 本地密钥对：`C:\leiblog-deploy\leiblog-deploy`（ed25519，无口令；副本在
  `C:\Users\雷磊\.workbuddy\ssh\`）。公钥以 `leiblog-deploy` 名称导入腾讯云轻量控制台
  「SSH密钥」并绑定实例 `lhins-17lq5cct`，重启后注入 `ubuntu` 账号。
- **Windows Git Bash 注意**：用户目录含中文（`C:\Users\雷磊`），ssh 会把 `$HOME`
  解析成 GBK 乱码路径导致 known_hosts 写不进/读不到。**必须显式指定**：
  `-i /c/leiblog-deploy/leiblog-deploy -o UserKnownHostsFile=/c/leiblog-deploy/known_hosts`。
- WorkBuddy 沙箱会拦截出站 SSH，需在执行时申请绕过沙箱。

**标准发版流程（全 ssh，约 3 分钟）**：

```bash
SSH="ssh -i /c/leiblog-deploy/leiblog-deploy -o UserKnownHostsFile=/c/leiblog-deploy/known_hosts -o StrictHostKeyChecking=no -o BatchMode=yes ubuntu@106.55.0.29"

# 1) 本地确认 git 干净、已 push
# 2) 推源码（git archive 只带已提交内容，天然排除 node_modules/dist/.env）
$SSH "rm -r /tmp/leiblog-src 2>/dev/null; mkdir -p /tmp/leiblog-src"
git archive --format=tar HEAD | $SSH "tar -x -C /tmp/leiblog-src"

# 3) 预演 rsync —— 确认 --delete 不会误删密钥文件（必须先看 deleting 列表）
$SSH 'sudo rsync -a --delete --dry-run --itemize-changes \
  --exclude node_modules --exclude dist --exclude .env --exclude logs \
  --exclude .adminpw --exclude .dbpw /tmp/leiblog-src/ /opt/lei-blog/ | grep deleting'

# 4) 备份 dist + 真同步
$SSH 'sudo cp -a /opt/lei-blog/client/dist /opt/dist-bak-$(date +%Y%m%d%H%M) && \
  sudo rsync -a --delete --exclude node_modules --exclude dist --exclude .env \
  --exclude logs --exclude .adminpw --exclude .dbpw /tmp/leiblog-src/ /opt/lei-blog/'

# 5) 服务器构建（/opt/lei-blog 为 root 属主，必须 sudo；依赖没变就跳过 npm install）
$SSH 'cd /opt/lei-blog/client && sudo npm run build'

# 6) 核验：dist/assets 的 index-*.js/css 哈希应与本地构建一致；/api/health 200；
#    /api/admin/posts 401（鉴权未误放开）
# 7) 清理：$SSH 'rm -r /tmp/leiblog-src'
```

**血泪点**：
- `--delete` 前必须 dry-run：服务器上有 `.dbpw`（数据库密码）和 `.adminpw`（后台密码），
  两者都 root:root 600，**不在 exclude 里会被同步删掉**。
- 依赖（package.json/lock）有变更时，先照 §13 补装平台二进制再构建。
- 构建必须 `sudo`：`node_modules/.tmp/*.tsbuildinfo` 是 root 属主，ubuntu 跑 tsc 会
  `EACCES` 且 npm 退出码仍为 0（假成功），要看产物哈希不能只看退出码。

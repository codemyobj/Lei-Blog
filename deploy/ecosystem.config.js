// ============================================================
// Lei-Blog — PM2 进程管理配置
//
// 用法（服务器上执行）：
//   cd /opt/lei-blog
//   pm2 start deploy/ecosystem.config.js --env production
//   pm2 save          # 持久化进程列表
//   pm2 startup       # 生成 systemd unit，开机自启（按输出再执行一条命令）
//
// ⚠️⚠️ cwd 是**必须显式设置**的，不能省略！
//    server/src/app.ts 里的 dotenv.config() 按 process.cwd() 解析 .env。
//    PM2 默认 cwd 是 PM2_HOME（~/.pm2），不设 cwd 就读不到 .env
//    → JWT_SECRET 为 undefined → 后台登录接口直接 500。
//    这是本部署方案最高频的翻车点。
// ============================================================

// ⚠️ 日志目录放在项目内，而不是 /var/log/lei-blog：
//    项目自包含，不需要额外创建 root 属主的系统日志目录，
//    备份/迁移时整个 /opt/lei-blog 一起搬走即可。
const LOG_DIR = '/opt/lei-blog/logs'

module.exports = {
  apps: [
    {
      name: 'blog-api',
      // 关键：必须是 server 目录（内含 .env），不能省略
      cwd: '/opt/lei-blog/server',
      script: 'dist/index.js',
      instances: 1, // 单进程足够；个人博客 QPS 远低于 10
      exec_mode: 'fork',
      max_memory_restart: '300M',
      // 日志目录需先创建：mkdir -p /opt/lei-blog/logs
      error_file: `${LOG_DIR}/api-error.log`,
      out_file: `${LOG_DIR}/api-out.log`,
      merge_logs: true,
      autorestart: true,
      watch: false,
      // 优雅关闭等待窗口，需与 server/src/index.ts 的 SHUTDOWN_TIMEOUT_MS 配合
      kill_timeout: 12000,
      // ⚠️ NODE_ENV 只在 PM2 里设，不要写进 server/.env
      //    （写进 .env 会导致本地 npm run build 误用生产分支逻辑）
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '8080',
      },
    },
  ],
}

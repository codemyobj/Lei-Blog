import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool, types } = pg

types.setTypeParser(types.builtins.NUMERIC, (val: string) => parseFloat(val))

// 使用远程 DATABASE_URL；否则回退到本地分项配置
const connectionString = process.env.DATABASE_URL
  || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'blog'}`

/**
 * SSL 开关：改为**显式**读取 DB_SSL 环境变量，不再靠「有没有 DATABASE_URL」推断。
 *
 * 原因：原实现「有 DATABASE_URL 就强制 SSL」，而腾讯云本机 Docker PostgreSQL
 * 默认不开启 SSL —— 此时使用 DATABASE_URL 会直接连不上数据库。
 *
 * @remarks
 * - `DB_SSL=true`  → 启用 SSL（证书校验关闭，兼容云厂商自签 CA）
 * - `DB_SSL=false` → 不启用 SSL（本机 / 内网 Docker PG 的常见场景）
 * - 未设置        → 回退兼容旧行为：仅在存在 DATABASE_URL 时启用（避免误伤老部署）
 */
function resolveSsl(): pg.ClientConfig['ssl'] {
  const raw = process.env.DB_SSL
  if (raw !== undefined) {
    const enabled = ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase())
    return enabled ? { rejectUnauthorized: false } : undefined
  }
  // 未显式声明时的保守回退：保留历史语义，但不再作为推荐路径
  return process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
}

/**
 * 连接池最大连接数。
 *
 * 原实现为 `NODE_ENV === 'production' ? 1 : 10` —— 这是 Serverless 平台专用值
 * （防止函数并发打爆远端 PG 连接数）。常驻 Node 进程下会让**所有查询串行复用
 * 1 条连接**，严重拖慢并发。常驻部署使用固定值 10，可由 DB_POOL_MAX 覆盖。
 */
function resolvePoolMax(): number {
  const parsed = parseInt(process.env.DB_POOL_MAX ?? '', 10)
  if (!Number.isNaN(parsed) && parsed > 0) return parsed
  return 10
}

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(),
  max: resolvePoolMax(),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err)
})

// 首次连接时打印脱敏配置，便于排查「PM2 cwd 配错 → .env 没读到」这类问题
console.log(
  `[db] pool.max=${pool.options.max} ssl=${pool.options.ssl ? 'on' : 'off'}`
)

export default pool

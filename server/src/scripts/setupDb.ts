// ============================================================
// 数据库初始化脚本
// 执行建表 SQL + 灌入种子数据（管理员密码用 bcrypt 实时哈希）
// 用法：npm run db:setup
// ============================================================

import bcrypt from 'bcryptjs'
import pool from '../config/db'
import { readFileSync } from 'fs'
import { join } from 'path'

async function setupDatabase() {
  const client = await pool.connect()
  try {
    console.log('📋 1. 执行建表 SQL...')

    // 读取并执行 schema.sql
    const schemaPath = join(__dirname, '..', 'database', 'schema.sql')
    const schemaSql = readFileSync(schemaPath, 'utf-8')
    await client.query(schemaSql)
    console.log('   ✅ 表结构创建完成')

    console.log('📋 2. 灌入种子数据...')

    // --- 管理员账号 ---
    const adminEmail = 'admin@blog.com'
    const adminPassword = 'admin123'
    const adminName = '博主'

    // 检查是否已存在
    const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      await client.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)',
        [adminEmail, passwordHash, adminName]
      )
      console.log(`   ✅ 管理员账号创建：${adminEmail} / ${adminPassword}`)
    } else {
      console.log('   ℹ️  管理员账号已存在，跳过')
    }

    // --- 标签 ---
    const tags = [
      { name: '前端', slug: 'frontend' },
      { name: 'React', slug: 'react' },
      { name: 'TypeScript', slug: 'typescript' },
      { name: '后端', slug: 'backend' },
      { name: '随笔', slug: 'essay' },
    ]
    const tagIds: Record<string, number> = {}
    for (const tag of tags) {
      const existing = await client.query('SELECT id FROM tags WHERE slug = $1', [tag.slug])
      if (existing.rows.length === 0) {
        const result = await client.query(
          'INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING id',
          [tag.name, tag.slug]
        )
        tagIds[tag.slug] = result.rows[0].id
        console.log(`   ✅ 标签创建：${tag.name}`)
      } else {
        tagIds[tag.slug] = existing.rows[0].id
      }
    }

    // --- 示例文章 ---
    const posts = [
      {
        title: '欢迎来到我的博客',
        slug: 'welcome-to-my-blog',
        excerpt: '这是博客的第一篇文章，介绍这个博客的搭建过程和技术选型。',
        content: `# 欢迎来到我的博客

这是博客的第一篇文章！在这里我会分享**技术学习笔记**和*思考感悟*。

## 技术栈

这个博客使用以下技术搭建：

- **前端**：React + TypeScript + Tailwind CSS
- **后端**：Express + Node.js
- **数据库**：PostgreSQL

## 代码示例

下面是一个简单的 React 组件：

\`\`\`tsx
function Welcome({ name }: { name: string }) {
  return <h1>你好，{name}！</h1>
}
\`\`\`

## 引用

> 代码是写给人看的，顺便能在机器上运行。 — Harold Abelson

## 表格

| 技术 | 用途 |
|------|------|
| React | 用户界面 |
| Express | API 服务 |
| PostgreSQL | 数据存储 |

## 列表

1. 学习 React 基础
2. 掌握 TypeScript
3. 构建全栈应用

- [x] 搭建项目脚手架
- [x] 实现文章功能
- [ ] 添加更多功能

希望你能在这里找到有用的内容！`,
        status: 'published',
        tag_slugs: ['essay', 'frontend'],
      },
      {
        title: 'React 19 新特性详解',
        slug: 'react-19-features',
        excerpt: 'React 19 带来了 Actions、useOptimistic、use 等新特性，本文详细介绍它们的使用场景。',
        content: `# React 19 新特性详解

React 19 是 React 的一个重要版本，带来了许多令人兴奋的新特性。

## Actions

React 19 引入了 Actions 概念，简化了异步操作的状态管理：

\`\`\`tsx
function UpdateName() {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    startTransition(async () => {
      const error = await updateName(name)
      if (error) {
        setError(error)
        return
      }
      redirect('/profile')
    })
  }

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>
        更新
      </button>
      {error && <p>{error}</p>}
    </div>
  )
}
\`\`\`

## useOptimistic

乐观更新让 UI 响应更迅速：

\`\`\`tsx
const [optimisticName, addOptimisticName] = useOptimistic(
  currentName,
  (state, newName) => newName
)
\`\`\`

## 新的 hook：use

\`use\` 是一个新的 API，可以在渲染期间读取资源：

\`\`\`tsx
const theme = use(ThemeContext)
\`\`\`

## 总结

React 19 的这些新特性让异步状态管理变得更加简单直观。建议在新项目中尝试使用！`,
        status: 'published',
        tag_slugs: ['frontend', 'react', 'typescript'],
      },
      {
        title: 'TypeScript 类型体操入门',
        slug: 'typescript-type-gymnastics',
        excerpt: '掌握 TypeScript 高级类型，写出更安全的代码。从条件类型到映射类型，逐步深入。',
        content: `# TypeScript 类型体操入门

TypeScript 的类型系统非常强大，本文介绍一些高级类型技巧。

## 条件类型

\`\`\`ts
type IsString<T> = T extends string ? true : false

type A = IsString<string>  // true
type B = IsString<number>  // false
\`\`\`

## 映射类型

\`\`\`ts
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}
\`\`\`

## 内置工具类型

- \`Partial<T>\` - 所有属性可选
- \`Required<T>\` - 所有属性必填
- \`Pick<T, K>\` - 选取部分属性
- \`Omit<T, K>\` - 排除部分属性

> 类型体操虽然强大，但可读性同样重要。不要过度使用复杂类型。

开始练习吧！`,
        status: 'published',
        tag_slugs: ['frontend', 'typescript'],
      },
      {
        title: 'Express 中间件机制详解',
        slug: 'express-middleware',
        excerpt: '深入理解 Express 中间件的工作原理，掌握请求处理流程。',
        content: `# Express 中间件机制详解

Express 的核心就是中间件机制。

## 什么是中间件

中间件是一个函数，能够访问请求对象、响应对象和下一个中间件：

\`\`\`ts
import { Request, Response, NextFunction } from 'express'

const myMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(\`请求：\${req.method} \${req.url}\`)
  next()
}
\`\`\`

## 中间件类型

1. **应用级中间件** - \`app.use()\`
2. **路由级中间件** - \`router.use()\`
3. **错误处理中间件** - 四参数函数
4. **内置中间件** - \`express.json()\`
5. **第三方中间件** - \`cors()\`

## 错误处理

\`\`\`ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: '服务器错误' })
})
\`\`\`

理解中间件机制是掌握 Express 的关键。`,
        status: 'draft',
        tag_slugs: ['backend'],
      },
    ]

    for (const post of posts) {
      const existing = await client.query('SELECT id FROM posts WHERE slug = $1', [post.slug])
      if (existing.rows.length === 0) {
        const publishedAt = post.status === 'published' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null
        const result = await client.query(
          `INSERT INTO posts (title, slug, excerpt, content, status, published_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [post.title, post.slug, post.excerpt, post.content, post.status, publishedAt]
        )
        const postId = result.rows[0].id

        // 关联标签
        for (const tagSlug of post.tag_slugs) {
          const tagId = tagIds[tagSlug]
          if (tagId) {
            await client.query(
              'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [postId, tagId]
            )
          }
        }
        console.log(`   ✅ 文章创建：${post.title} (${post.status})`)
      }
    }

    console.log('\n🎉 数据库初始化完成！')
    console.log(`   管理员登录：${adminEmail} / ${adminPassword}`)
    console.log('   后台地址：http://localhost:5173/admin/login')
  } catch (err) {
    console.error('❌ 数据库初始化失败：', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

setupDatabase()

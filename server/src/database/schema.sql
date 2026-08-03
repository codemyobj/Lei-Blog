-- ============================================================
-- Blog 数据库表结构
-- 数据库：PostgreSQL
-- ============================================================

-- 1. 用户表（后台管理员，单用户博客通常只需一个账号）
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 文章表
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,            -- URL 友好标识
  excerpt TEXT,                                  -- 摘要（列表展示）
  content TEXT NOT NULL,                         -- Markdown 原文
  cover_image VARCHAR(500),                      -- 封面图 URL（可选）
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  view_count INTEGER DEFAULT 0,                  -- 阅读量
  published_at TIMESTAMPTZ,                       -- 发布时间（与 created_at 分离，支持定时发布）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);

-- 3. 标签表
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,              -- URL 友好标识
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- 4. 文章-标签关联表（多对多）
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);

-- 5. 关于页内容表（单行表，存 Markdown 内容）
CREATE TABLE IF NOT EXISTS about (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 初始化一行数据
INSERT INTO about (id, content) VALUES (1, '# 关于我

欢迎来到我的博客！这里我会分享技术学习笔记和思考。

## 联系方式
- Email: hello@example.com
- GitHub: https://github.com/yourname

## 技能
- **前端**：React, TypeScript, Tailwind CSS
- **后端**：Node.js, Express, PostgreSQL
- **工具**：Git, Docker

> 热爱技术，乐于分享。')
ON CONFLICT (id) DO NOTHING;

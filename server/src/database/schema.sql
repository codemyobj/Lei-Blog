-- ============================================================
-- Blog 数据库表结构 —— 全项目**唯一权威** schema
--
-- 数据库：PostgreSQL 17
-- 执行方式：npm run db:setup（server/src/scripts/setupDb.ts 读取本文件执行）
--
-- 幂等性：所有 DDL 均使用 IF NOT EXISTS，可重复执行。
-- 依赖NODE支 PostgreSQL contrib 模块 pg_trgm（官方 Docker 镜像自带）。
-- ============================================================

-- ---------- 0. 扩展 ----------
-- pg_trgm：三元组相似度全文搜索。中文无需分词即可生效，
--          因为三元组（trigram）滑窗不依赖词边界。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- 1. 用户表（后台管理员，单用户博客通常只需一个账号）----------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 2. 分类表（一级导航，一篇文章只有一个分类）----------
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,               -- 分类名，如「前端」
  slug VARCHAR(50) NOT NULL UNIQUE,               -- URL 友好标识
  description TEXT,                               -- 可选说明
  sort_order INTEGER NOT NULL DEFAULT 0,          -- 排序权重，越大越靠前
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order DESC, name);

-- ---------- 3. 文章表 ----------
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,              -- URL 友好标识
  excerpt TEXT,                                   -- 摘要（列表展示）
  content TEXT NOT NULL,                          -- Markdown 原文
  cover_image VARCHAR(500),                       -- 封面图 URL（可选）
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  view_count INTEGER DEFAULT 0,                   -- 阅读量
  published_at TIMESTAMPTZ,                       -- 发布时间（与 created_at 分离，支持定时发布）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 已有库升级：补分类外键（一篇文章 0 或 1 个分类，分类删除后置 NULL）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category_id INTEGER
  REFERENCES categories(id) ON DELETE SET NULL;

-- 已有库升级：搜索专用列（标题 + 摘要 + 去 Markdown 的正文纯文本）
-- 写入时由服务端生成，**不在查询时实时转换**，避免每次搜索重复消耗 CPU。
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_document TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);

-- ---------- 4. 标签表（细粒度关键词，一篇可有多个标签）----------
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,               -- URL 友好标识
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- ---------- 5. 文章-标签关联表（多对多）----------
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);

-- ---------- 6. 关于页内容表（单行表，存 Markdown 内容）----------
CREATE TABLE IF NOT EXISTS about (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
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

-- ---------- 7. 全文搜索索引（pg_trgm GIN）----------
-- search_document：正文/摘要/标题的合并纯文本，主搜索入口
CREATE INDEX IF NOT EXISTS idx_posts_search_trgm
  ON posts USING GIN (search_document gin_trgm_ops);

-- 已下线：title 上的 trigram 索引。
-- 三条查询路径都用它不上：
--   1) trigram 分支打的是 search_document，不是 title；
--   2) ILIKE 分支的 q 只有 1~2 字符，抽不出三元组，GIN 本来就放弃；
--   3) tsvector 分支走下面的表达式索引。
-- 留着只是每次保存文章白拖一次写入。
DROP INDEX IF EXISTS idx_posts_title_trgm;

-- 英文词干匹配（"hooks" 命中 "hook"）。
-- ⚠️ 表达式必须与查询里的写法**逐字一致**，否则优化器认不出来、索引白建：
--    查询侧写的是 to_tsvector('english', coalesce(p.search_document, ''))，
--    所以这里必须带 coalesce —— 不能写成 to_tsvector('english', search_document)。
--    早期版本用过 idx_posts_search_tsvector 这个名字，一并收敛到 idx_posts_search_en_tsv。
DROP INDEX IF EXISTS idx_posts_search_tsvector;
CREATE INDEX IF NOT EXISTS idx_posts_search_en_tsv
  ON posts USING GIN (to_tsvector('english', coalesce(search_document, '')));

-- ---------- 8. updated_at 自动更新触发器 ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_about_updated_at ON about;
CREATE TRIGGER trg_about_updated_at
  BEFORE UPDATE ON about
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

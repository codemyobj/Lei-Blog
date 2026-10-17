import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import type { Components } from 'react-markdown'
import { useTheme } from '../context/ThemeContext'
import rehypeGallery from '../utils/rehypeGallery'
import remarkHighlight from '../utils/remarkHighlight'

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src as string}
      alt={alt || ''}
      loading="lazy"
      /* 外链图加载失败时不显示浏览器的破图图标：
         把 img 藏起来，让它所在容器的 --wash 底色兜底
         （.md-gallery-item 有 aspect-ratio 撑住形状，单图则自然收起）。 */
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden'
      }}
    />
  ),
  // 显式透传 id：rehype-slug 生成的锚点必须落到 DOM 上，目录侧栏依赖它
  h1: ({ node: _node, ...rest }) => <h1 {...rest} />,
  h2: ({ node: _node, ...rest }) => <h2 {...rest} />,
  h3: ({ node: _node, ...rest }) => <h3 {...rest} />,
}

export default function MarkdownRenderer({ content }: { content: string }) {
  // 三态主题下必须用 resolvedTheme：system 模式时 theme 值是 'system'，
  // 拿它去拼 class 会导致代码块永远走亮色配色。
  const { resolvedTheme } = useTheme()

  return (
    <div className={`markdown-body ${resolvedTheme === 'dark' ? 'dark-code' : 'light-code'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHighlight]}
        rehypePlugins={[rehypeHighlight, rehypeGallery, rehypeSlug]}
        components={components}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

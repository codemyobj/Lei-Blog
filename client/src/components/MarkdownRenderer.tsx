import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import type { Components } from 'react-markdown'
import { useTheme } from '../context/ThemeContext'

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src as string} alt={alt || ''} loading="lazy" />
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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={components}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

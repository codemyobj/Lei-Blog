import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
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
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const { theme } = useTheme()

  return (
    <div className={`markdown-body ${theme === 'dark' ? 'dark-code' : 'light-code'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

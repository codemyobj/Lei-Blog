import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import MarkdownRenderer from './MarkdownRenderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
}

// 轻量级 Markdown 编辑器：工具栏 + 分栏（编辑/预览）
export default function MarkdownEditor({ value, onChange, height = 400 }: MarkdownEditorProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('split')

  // 在光标位置插入/包裹文本
  const wrapSelection = (before: string, after: string = before, placeholder: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newValue)
    // 恢复光标位置
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = end + before.length
    })
  }

  // 在行首插入前缀（如列表、引用）
  const insertLinePrefix = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(newValue)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + prefix.length
    })
  }

  // Tab 键插入两个空格
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newValue = value.slice(0, start) + '  ' + value.slice(end)
      onChange(newValue)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  const tools = [
    { label: 'B', title: t('editor.bold'), action: () => wrapSelection('**', '**', t('editor.placeholderBold')) },
    { label: 'I', title: t('editor.italic'), action: () => wrapSelection('*', '*', t('editor.placeholderItalic')) },
    { label: 'S', title: t('editor.strikethrough'), action: () => wrapSelection('~~', '~~', t('editor.placeholderStrikethrough')) },
    { label: 'H', title: t('editor.heading'), action: () => insertLinePrefix('## ') },
    { label: '"', title: t('editor.quote'), action: () => insertLinePrefix('> ') },
    { label: '•', title: t('editor.bulletList'), action: () => insertLinePrefix('- ') },
    { label: '1.', title: t('editor.orderedList'), action: () => insertLinePrefix('1. ') },
    { label: '</>', title: t('editor.inlineCode'), action: () => wrapSelection('`', '`', t('editor.placeholderInlineCode')) },
    { label: '{}', title: t('editor.codeBlock'), action: () => wrapSelection('\n```\n', '\n```\n', t('editor.placeholderCodeBlock')) },
    { label: '🔗', title: t('editor.link'), action: () => wrapSelection('[', '](https://)', t('editor.placeholderLink')) },
    { label: '🖼', title: t('editor.image'), action: () => wrapSelection('![', '](https://)', t('editor.placeholderImage')) },
    { label: '—', title: t('editor.divider'), action: () => onChange(value + '\n\n---\n\n') },
  ]

  const editorHeight = height - 44 // 减去工具栏高度

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      {/* 工具栏 */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap"
        style={{ background: 'var(--surface-hover)', borderColor: 'var(--border)' }}
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.action}
            title={tool.title}
            className="w-8 h-8 rounded-lg text-sm font-mono font-bold flex items-center justify-center transition-colors hover:opacity-100"
            style={{ color: 'var(--text-secondary)', opacity: 0.7 }}
          >
            {tool.label}
          </button>
        ))}
        <div className="flex-1" />
        {/* 模式切换 */}
        <div className="flex items-center gap-1 ml-2">
          {(['edit', 'split', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: mode === m ? 'var(--brand)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)',
              }}
            >
              {m === 'edit' ? t('editor.edit') : m === 'split' ? t('editor.split') : t('editor.preview')}
            </button>
          ))}
        </div>
      </div>

      {/* 编辑区 + 预览区 */}
      <div className="flex" style={{ height: editorHeight }}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('editor.placeholder')}
            className={`p-4 resize-none outline-none font-mono text-sm leading-relaxed ${mode === 'split' ? 'w-1/2 border-r' : 'w-full'}`}
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              borderColor: 'var(--border)',
              borderRightWidth: mode === 'split' ? 1 : 0,
            }}
          />
        )}
        {mode !== 'edit' && (
          <div
            className={`overflow-y-auto p-4 ${mode === 'split' ? 'w-1/2' : 'w-full'}`}
            style={{ background: 'var(--surface)' }}
          >
            <MarkdownRenderer content={value} />
          </div>
        )}
      </div>
    </div>
  )
}

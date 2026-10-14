import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import MarkdownRenderer from './MarkdownRenderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
}

/**
 * 工具栏按钮的「声明式」描述。
 *
 * ⚠️ 这里刻意**不存放函数**。若写成 `{ action: () => wrapSelection(...) }`，
 * 数组字面量在渲染期求值时就已经产出了「闭包引用 textareaRef」的值，
 * 会被 `react-hooks/refs` 判为「渲染期访问 ref」。
 * 改成纯数据后，对 ref 的读取只发生在点击回调 `runTool` 内部（事件期，非渲染期）。
 */
type EditorTool =
  | { label: string; title: string; kind: 'wrap'; before: string; after: string; placeholder: string }
  | { label: string; title: string; kind: 'prefix'; prefix: string }
  | { label: string; title: string; kind: 'append'; text: string }

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

  // 纯数据描述：渲染期不触碰 textareaRef
  const tools: EditorTool[] = [
    { label: 'B', title: t('editor.bold'), kind: 'wrap', before: '**', after: '**', placeholder: t('editor.placeholderBold') },
    { label: 'I', title: t('editor.italic'), kind: 'wrap', before: '*', after: '*', placeholder: t('editor.placeholderItalic') },
    { label: 'S', title: t('editor.strikethrough'), kind: 'wrap', before: '~~', after: '~~', placeholder: t('editor.placeholderStrikethrough') },
    { label: 'H', title: t('editor.heading'), kind: 'prefix', prefix: '## ' },
    { label: '"', title: t('editor.quote'), kind: 'prefix', prefix: '> ' },
    { label: '•', title: t('editor.bulletList'), kind: 'prefix', prefix: '- ' },
    { label: '1.', title: t('editor.orderedList'), kind: 'prefix', prefix: '1. ' },
    { label: '</>', title: t('editor.inlineCode'), kind: 'wrap', before: '`', after: '`', placeholder: t('editor.placeholderInlineCode') },
    { label: '{}', title: t('editor.codeBlock'), kind: 'wrap', before: '\n```\n', after: '\n```\n', placeholder: t('editor.placeholderCodeBlock') },
    { label: '🔗', title: t('editor.link'), kind: 'wrap', before: '[', after: '](https://)', placeholder: t('editor.placeholderLink') },
    { label: '🖼', title: t('editor.image'), kind: 'wrap', before: '![', after: '](https://)', placeholder: t('editor.placeholderImage') },
    { label: '—', title: t('editor.divider'), kind: 'append', text: '\n\n---\n\n' },
  ]

  // 只有点击时才读 textareaRef
  const runTool = (tool: EditorTool) => {
    switch (tool.kind) {
      case 'wrap':
        wrapSelection(tool.before, tool.after, tool.placeholder)
        break
      case 'prefix':
        insertLinePrefix(tool.prefix)
        break
      case 'append':
        onChange(value + tool.text)
        break
    }
  }

  const editorHeight = height - 44 // 减去工具栏高度

  return (
    <div className="overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      {/* 工具栏 */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap"
        style={{ background: 'var(--surface-hover)', borderColor: 'var(--border)' }}
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => runTool(tool)}
            title={tool.title}
            className="w-8 h-8 text-sm font-mono font-bold flex items-center justify-center transition-colors hover:opacity-100"
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
              className="px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                background: mode === m ? 'var(--brand)' : 'transparent',
                /* 暗色下 --brand-fg 是近黑；#fff 在 #FF4D4D 上只有 3.27:1 */
                color: mode === m ? 'var(--brand-fg)' : 'var(--text-muted)',
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

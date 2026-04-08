import { useState } from 'react'

interface Props {
  onAdd: (text: string) => void
  disabled?: boolean
}

export function ItemCreateInput({ onAdd, disabled }: Props) {
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="px-2 py-1.5">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add item..."
        disabled={disabled}
        className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/50"
      />
    </form>
  )
}

'use client'

import { useState } from 'react'
import { Pencil, ImageDown, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BookWithProgress } from '@/types'

interface Props {
  book: BookWithProgress
  onSaved: (updated: Partial<BookWithProgress>) => void
  onDeleted: () => void
}

export function BookEditDialog({ book, onSaved, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author ?? '')
  const [narrator, setNarrator] = useState(book.narrator ?? '')
  const [saving, setSaving] = useState(false)
  const [fetchingCover, setFetchingCover] = useState(false)
  const [coverStatus, setCoverStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, narrator }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      onSaved({ title: title.trim() || 'Untitled', author: author.trim() || null, narrator: narrator.trim() || null })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleFetchCover() {
    setFetchingCover(true)
    setCoverStatus(null)
    try {
      const res = await fetch(`/api/books/${book.id}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author }),
      })
      let data: { error?: string; cover_url?: string } = {}
      try { data = await res.json() } catch { /* empty body */ }
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      onSaved({ cover_url: data.cover_url })
      setCoverStatus('Cover updated!')
    } catch (err) {
      setCoverStatus(err instanceof Error ? err.message : 'Cover fetch failed')
    } finally {
      setFetchingCover(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try { msg = (await res.json()).error || msg } catch { /* empty */ }
        throw new Error(msg)
      }
      setOpen(false)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmDelete(false) }}>
      <DialogTrigger
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 absolute bottom-3 right-3 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
        aria-label="Edit book details"
      >
        <Pencil size={13} />
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Edit details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-zinc-300 text-sm">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-author" className="text-zinc-300 text-sm">Author</Label>
            <Input
              id="edit-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-narrator" className="text-zinc-300 text-sm">Narrator</Label>
            <Input
              id="edit-narrator"
              value={narrator}
              onChange={(e) => setNarrator(e.target.value)}
              placeholder="Optional"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5"
              onClick={handleFetchCover}
              disabled={fetchingCover || !title}
            >
              <ImageDown size={14} />
              {fetchingCover ? 'Fetching cover…' : 'Fetch cover from Google Books'}
            </Button>
            {coverStatus && (
              <p className={`text-xs mt-1 text-center ${coverStatus === 'Cover updated!' ? 'text-amber-500' : 'text-red-400'}`}>
                {coverStatus}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            {!confirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
                Remove book
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 text-center">This will permanently delete the book and its audio file.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 text-zinc-400 hover:bg-zinc-800"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import Image from 'next/image'
import { Play, Pause } from 'lucide-react'
import { BookWithProgress } from '@/types'
import { usePlayerStore } from '@/store/player'
import { formatDuration, percentComplete } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useState } from 'react'
import { BookEditDialog } from './BookEditDialog'

interface Props {
  book: BookWithProgress
  onDeleted?: () => void
}

export function BookCard({ book: initialBook, onDeleted }: Props) {
  const [book, setBookLocal] = useState(initialBook)
  const { book: currentBook, isPlaying, setBook, setIsPlaying } = usePlayerStore()
  const isActive = currentBook?.id === book.id
  const supabase = createClient()

  const handleSaved = useCallback((updated: Partial<BookWithProgress>) => {
    setBookLocal(prev => ({ ...prev, ...updated }))
  }, [])

  const handlePlay = useCallback(async () => {
    if (isActive) {
      setIsPlaying(!isPlaying)
      return
    }

    // Fetch chapters
    const { data: chapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', book.id)
      .order('chapter_index')

    // Refresh signed URL if needed
    let audioUrl = book.audio_url
    try {
      const res = await fetch(`/api/books/${book.id}/stream`)
      if (res.ok) {
        const data = await res.json()
        audioUrl = data.url
      }
    } catch {}

    setBook({ ...book, audio_url: audioUrl }, chapters ?? [])
    setIsPlaying(true)
  }, [book, isActive, isPlaying, setBook, setIsPlaying, supabase])

  const pct = percentComplete(book.progress?.position ?? 0, book.duration)

  return (
    <div
      className="group relative bg-zinc-900 rounded-xl overflow-hidden cursor-pointer hover:bg-zinc-800 transition-colors"
      onClick={handlePlay}
    >
      {/* Cover */}
      <div className="aspect-square bg-zinc-800 relative">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📚</div>
        )}

        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
            {isActive && isPlaying ? (
              <Pause size={20} className="text-zinc-900" />
            ) : (
              <Play size={20} className="text-zinc-900 ml-0.5" />
            )}
          </div>
        </div>

        {/* Playing indicator */}
        {isActive && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        )}
      </div>

      {/* Progress bar */}
      {pct > 0 && (
        <div className="h-0.5 bg-zinc-800">
          <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Metadata */}
      <div className="p-3 relative">
        <p className="text-sm font-medium text-zinc-100 truncate leading-tight pr-6">{book.title}</p>
        {book.author && (
          <p className="text-xs text-zinc-400 truncate mt-0.5">{book.author}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-zinc-500">{formatDuration(book.duration)}</span>
          {pct > 0 && pct < 100 && (
            <span className="text-xs text-amber-600">{pct}%</span>
          )}
          {pct === 100 && (
            <span className="text-xs text-zinc-500">Finished</span>
          )}
        </div>
        <BookEditDialog book={book} onSaved={handleSaved} onDeleted={onDeleted ?? (() => {})} />
      </div>
    </div>
  )
}

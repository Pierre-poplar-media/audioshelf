'use client'

import { Play, Pause, SkipBack, SkipForward, ChevronUp } from 'lucide-react'
import { usePlayerStore } from '@/store/player'
import { useAudioContext } from '@/components/providers/AudioProvider'
import { formatDuration, percentComplete } from '@/lib/utils'
import Image from 'next/image'

export function MiniPlayer() {
  const {
    book,
    isPlaying,
    position,
    duration,
    setIsPlaying,
    setFullPlayerOpen,
  } = usePlayerStore()

  const { skip } = useAudioContext()

  if (!book) return null

  const pct = percentComplete(position, duration)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 shadow-2xl"
      onClick={() => setFullPlayerOpen(true)}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-zinc-800">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Cover */}
        <div className="w-10 h-10 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs">♪</div>
          )}
        </div>

        {/* Title + time */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-medium text-zinc-100 truncate">{book.title}</p>
          <p className="text-xs text-zinc-400">
            {formatDuration(position)} / {formatDuration(duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => skip(-30)}
            className="p-2 text-zinc-300 hover:text-white transition-colors"
            aria-label="Skip back 30 seconds"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={16} className="text-zinc-900" />
            ) : (
              <Play size={16} className="text-zinc-900 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => skip(30)}
            className="p-2 text-zinc-300 hover:text-white transition-colors"
            aria-label="Skip forward 30 seconds"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setFullPlayerOpen(true) }}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Open full player"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react'
import { usePlayerStore } from '@/store/player'
import { useAudioContext } from '@/components/providers/AudioProvider'
import { percentComplete } from '@/lib/utils'
import Image from 'next/image'

export function MiniPlayer() {
  const {
    book,
    isPlaying,
    position,
    duration,
    currentChapter,
    setIsPlaying,
    setFullPlayerOpen,
  } = usePlayerStore()

  const { skip } = useAudioContext()

  if (!book) return null

  const pct = percentComplete(position, duration)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 cursor-pointer"
      onClick={() => setFullPlayerOpen(true)}
    >
      {/* Progress bar — sits at very top of mini player */}
      <div className="h-0.5 bg-zinc-800">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          {/* Cover */}
          <div className="w-11 h-11 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 shadow-md">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-base">♪</div>
            )}
          </div>

          {/* Title + chapter */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">{book.title}</p>
            {currentChapter ? (
              <p className="text-xs text-amber-400 truncate mt-0.5">{currentChapter.title}</p>
            ) : (
              <p className="text-xs text-zinc-500 truncate mt-0.5">{book.author ?? ''}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => skip(-15)}
              className="p-2 text-zinc-300 hover:text-white transition-colors"
              aria-label="Skip back 15 seconds"
            >
              <RotateCcw size={20} />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors shadow-md"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={18} className="text-zinc-900" />
              ) : (
                <Play size={18} className="text-zinc-900 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skip(30)}
              className="p-2 text-zinc-300 hover:text-white transition-colors"
              aria-label="Skip forward 30 seconds"
            >
              <RotateCw size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

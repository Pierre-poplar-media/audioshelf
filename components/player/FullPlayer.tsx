'use client'

import { Play, Pause, SkipBack, SkipForward, ChevronDown, RotateCcw, RotateCw, BookOpen } from 'lucide-react'
import { usePlayerStore } from '@/store/player'
import { useAudioContext } from '@/components/providers/AudioProvider'
import { formatDuration, percentComplete } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'
import Image from 'next/image'
import { useState } from 'react'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export function FullPlayer() {
  const {
    book,
    isPlaying,
    position,
    duration,
    speed,
    chapters,
    currentChapter,
    isFullPlayerOpen,
    setIsPlaying,
    setFullPlayerOpen,
    setSpeed,
  } = usePlayerStore()

  const { skip, seek } = useAudioContext()
  const [showChapters, setShowChapters] = useState(false)

  if (!book || !isFullPlayerOpen) return null

  const pct = percentComplete(position, duration)
  const timeLeft = duration - position

  function cycleSpeed() {
    const idx = SPEEDS.indexOf(speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeed(next)
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={() => setFullPlayerOpen(false)}
          className="p-2 text-zinc-400 hover:text-white"
          aria-label="Close player"
        >
          <ChevronDown size={24} />
        </button>
        <p className="text-xs uppercase tracking-widest text-zinc-500">Now Playing</p>
        <button
          onClick={() => setShowChapters(!showChapters)}
          className="p-2 text-zinc-400 hover:text-white"
          aria-label="Chapters"
        >
          <BookOpen size={20} />
        </button>
      </div>

      {showChapters ? (
        <div className="flex-1 overflow-y-auto px-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Chapters</h3>
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => { seek(chapter.start_time); setShowChapters(false) }}
              className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors ${
                currentChapter?.id === chapter.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <p className="text-sm font-medium">{chapter.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{formatDuration(chapter.start_time)}</p>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Cover art */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl bg-zinc-800">
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl">📚</span>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="px-6 pt-4">
            <h2 className="text-xl font-bold text-white truncate">{book.title}</h2>
            {book.author && <p className="text-zinc-400 text-sm mt-0.5 truncate">{book.author}</p>}
            {currentChapter && (
              <p className="text-xs text-amber-500 mt-1 truncate">{currentChapter.title}</p>
            )}
          </div>

          {/* Scrubber */}
          <div className="px-6 pt-4">
            <Slider
              value={[position]}
              max={duration || 100}
              step={1}
              onValueChange={(val) => seek(Array.isArray(val) ? val[0] : val)}
              className="w-full"
              aria-label="Seek position"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>{formatDuration(position)}</span>
              <span>-{formatDuration(timeLeft)}</span>
            </div>
            <div className="text-center text-xs text-zinc-600 mt-0.5">
              {percentComplete(position, duration)}% complete
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-6 py-6">
            <button
              onClick={cycleSpeed}
              className="text-sm font-bold text-zinc-400 hover:text-white w-12 text-center"
              aria-label="Playback speed"
            >
              {speed}x
            </button>

            <button
              onClick={() => skip(-30)}
              className="p-3 text-zinc-300 hover:text-white"
              aria-label="Skip back 30 seconds"
            >
              <RotateCcw size={28} />
              <span className="text-[9px] block -mt-1">30</span>
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors shadow-lg"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={28} className="text-zinc-900" />
              ) : (
                <Play size={28} className="text-zinc-900 ml-1" />
              )}
            </button>

            <button
              onClick={() => skip(30)}
              className="p-3 text-zinc-300 hover:text-white"
              aria-label="Skip forward 30 seconds"
            >
              <RotateCw size={28} />
              <span className="text-[9px] block -mt-1">30</span>
            </button>

            <div className="w-12" />
          </div>

          <div className="pb-8" />
        </>
      )}
    </div>
  )
}

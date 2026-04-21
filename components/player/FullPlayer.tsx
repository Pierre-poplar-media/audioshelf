'use client'

import { Play, Pause, SkipBack, SkipForward, ChevronDown, RotateCcw, RotateCw, BookOpen, ListMusic } from 'lucide-react'
import { usePlayerStore, synthesiseChapters } from '@/store/player'
import { useAudioContext } from '@/components/providers/AudioProvider'
import { formatDuration } from '@/lib/utils'
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

  const effectiveChapters = chapters.length > 0 ? chapters : synthesiseChapters(book)
  const timeLeft = duration - position

  function cycleSpeed() {
    const idx = SPEEDS.indexOf(speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeed(next)
  }

  function prevChapter() {
    const prev = [...effectiveChapters].reverse().find(c => c.start_time < position - 3)
    seek(prev ? prev.start_time : (effectiveChapters[0]?.start_time ?? 0))
  }

  function nextChapter() {
    const next = effectiveChapters.find(c => c.start_time > position + 1)
    if (next) seek(next.start_time)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      {/* Blurred background — pointer-events-none so it never blocks taps */}
      <div className="absolute inset-0 pointer-events-none">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt=""
            fill
            className="object-cover scale-125 blur-3xl opacity-50"
            aria-hidden
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )}
        {/* Dark overlay so text is readable */}
        <div className="absolute inset-0 bg-zinc-950/70" />
      </div>

      {/* All content sits above the blurred bg */}
      <div className="relative z-10 flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-2">
          <button
            onClick={() => setFullPlayerOpen(false)}
            className="p-2 text-zinc-300 hover:text-white transition-colors"
            aria-label="Close player"
          >
            <ChevronDown size={24} />
          </button>
          <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Now Playing</p>
          <button
            onClick={() => setShowChapters(!showChapters)}
            className={`p-2 transition-colors ${showChapters ? 'text-amber-400' : 'text-zinc-300 hover:text-white'}`}
            aria-label="Chapters"
          >
            <ListMusic size={20} />
          </button>
        </div>

        {showChapters ? (
          /* Chapter list */
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 px-1">
              {effectiveChapters.length > 0 ? 'Chapters' : 'No chapters found'}
            </h3>
            {effectiveChapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => { seek(chapter.start_time); setShowChapters(false) }}
                className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-colors ${
                  currentChapter?.id === chapter.id
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-300 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-medium leading-tight">{chapter.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{formatDuration(chapter.start_time)}</p>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Cover art */}
            <div className="flex-1 flex items-center justify-center px-10 py-4">
              <div className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)] bg-zinc-800">
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

            {/* Book + chapter info */}
            <div className="px-6 pb-4 text-center">
              {currentChapter && (
                <p className="text-xs text-amber-400 font-medium mb-1 truncate uppercase tracking-wide">
                  {currentChapter.title}
                </p>
              )}
              <h2 className="text-xl font-bold text-white truncate leading-tight">{book.title}</h2>
              {book.author && (
                <p className="text-sm text-zinc-400 mt-0.5 truncate">{book.author}</p>
              )}
            </div>

            {/* Scrubber */}
            <div className="px-6 pb-2">
              <Slider
                value={[position]}
                max={duration || 100}
                step={1}
                onValueChange={(val) => seek(Array.isArray(val) ? val[0] : val)}
                className="w-full"
                aria-label="Seek position"
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-2">
                <span>{formatDuration(position)}</span>
                <span className="text-zinc-500">-{formatDuration(timeLeft)}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-between px-8 py-2">
              {/* Prev chapter */}
              <button
                onClick={prevChapter}
                disabled={effectiveChapters.length === 0}
                className="p-2 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Previous chapter"
              >
                <SkipBack size={28} />
              </button>

              {/* Skip back 15s */}
              <button
                onClick={() => skip(-15)}
                className="p-2 text-zinc-200 hover:text-white transition-colors flex flex-col items-center"
                aria-label="Skip back 15 seconds"
              >
                <RotateCcw size={28} />
                <span className="text-[10px] font-semibold mt-0.5 leading-none">15</span>
              </button>

              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center transition-colors shadow-xl"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={30} className="text-zinc-900" />
                ) : (
                  <Play size={30} className="text-zinc-900 ml-1" />
                )}
              </button>

              {/* Skip forward 30s */}
              <button
                onClick={() => skip(30)}
                className="p-2 text-zinc-200 hover:text-white transition-colors flex flex-col items-center"
                aria-label="Skip forward 30 seconds"
              >
                <RotateCw size={28} />
                <span className="text-[10px] font-semibold mt-0.5 leading-none">30</span>
              </button>

              {/* Next chapter */}
              <button
                onClick={nextChapter}
                disabled={effectiveChapters.length === 0}
                className="p-2 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Next chapter"
              >
                <SkipForward size={28} />
              </button>
            </div>

            {/* Bottom row: speed + chapters toggle */}
            <div className="flex items-center justify-between px-8 pb-10 pt-2">
              <button
                onClick={cycleSpeed}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Playback speed"
              >
                <span className="text-sm font-bold text-white">{speed}×</span>
              </button>

              <button
                onClick={() => setShowChapters(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-zinc-300 hover:text-white"
                aria-label="View chapters"
              >
                <BookOpen size={14} />
                <span className="text-xs font-medium">Chapters</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { create } from 'zustand'
import { BookWithProgress, Chapter } from '@/types'

// Turns book_parts into chapter-like objects for multi-file books with no embedded chapters
export function synthesiseChapters(book: BookWithProgress | null): Chapter[] {
  const parts = book?.book_parts ?? []
  if (parts.length <= 1) return []
  return [...parts]
    .sort((a, b) => a.part_index - b.part_index)
    .map((p, i) => ({
      id: p.id,
      book_id: p.book_id,
      // Derive a readable title from the filename
      title: p.audio_key.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Part ${i + 1}`,
      start_time: p.start_offset,
      end_time: p.start_offset + p.duration,
      chapter_index: p.part_index,
    }))
}

interface PlayerStore {
  book: BookWithProgress | null
  isPlaying: boolean
  position: number
  duration: number
  speed: number
  volume: number
  chapters: Chapter[]
  currentChapter: Chapter | null
  sleepTimerEnd: number | null
  isFullPlayerOpen: boolean

  setBook: (book: BookWithProgress, chapters?: Chapter[]) => void
  setIsPlaying: (v: boolean) => void
  setPosition: (v: number) => void
  setDuration: (v: number) => void
  setSpeed: (v: number) => void
  setVolume: (v: number) => void
  setSleepTimer: (end: number | null) => void
  setFullPlayerOpen: (v: boolean) => void
  updateCurrentChapter: (position: number) => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  book: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  speed: 1,
  volume: 1,
  chapters: [],
  currentChapter: null,
  sleepTimerEnd: null,
  isFullPlayerOpen: false,

  setBook: (book, chapters = []) => {
    set({
      book,
      chapters,
      position: book.progress?.position ?? 0,
      speed: book.progress?.speed ?? 1,
      isPlaying: false,
    })
  },

  setIsPlaying: (v) => set({ isPlaying: v }),
  setPosition: (v) => {
    set({ position: v })
    get().updateCurrentChapter(v)
  },
  setDuration: (v) => set({ duration: v }),
  setSpeed: (v) => set({ speed: v }),
  setVolume: (v) => set({ volume: v }),
  setSleepTimer: (end) => set({ sleepTimerEnd: end }),
  setFullPlayerOpen: (v) => set({ isFullPlayerOpen: v }),

  updateCurrentChapter: (position) => {
    const { chapters, book } = get()
    const effective = chapters.length > 0 ? chapters : synthesiseChapters(book)
    if (!effective.length) { set({ currentChapter: null }); return }
    const chapter = effective.findLast((c) => c.start_time <= position) ?? effective[0]
    set({ currentChapter: chapter })
  },
}))

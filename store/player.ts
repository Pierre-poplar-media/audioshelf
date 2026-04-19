import { create } from 'zustand'
import { BookWithProgress, Chapter } from '@/types'

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
    const { chapters } = get()
    if (!chapters.length) return
    const chapter = chapters.findLast((c) => c.start_time <= position) ?? chapters[0]
    set({ currentChapter: chapter })
  },
}))

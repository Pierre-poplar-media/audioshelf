export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  narrator: string | null
  cover_url: string | null
  audio_url: string
  duration: number // seconds
  file_size: number // bytes
  series_name: string | null
  series_index: number | null
  description: string | null
  year: number | null
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  book_id: string
  title: string
  start_time: number // seconds
  end_time: number // seconds
  chapter_index: number
}

export interface Progress {
  id: string
  user_id: string
  book_id: string
  position: number // seconds
  speed: number // 0.5–3.0
  device_id: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  book_id: string
  position: number // seconds
  note: string | null
  created_at: string
}

export interface Collection {
  id: string
  user_id: string
  name: string
  cover_url: string | null
  created_at: string
}

export interface BookPart {
  id: string
  book_id: string
  audio_key: string
  audio_url: string
  part_index: number
  duration: number
  file_size: number
  start_offset: number
}

export interface BookWithProgress extends Book {
  progress?: Progress | null
  chapters?: Chapter[]
  book_parts?: BookPart[]
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export interface UploadState {
  file: File
  status: UploadStatus
  progress: number // 0–100
  bookId?: string
  error?: string
}

export interface PlayerState {
  book: BookWithProgress | null
  isPlaying: boolean
  position: number
  duration: number
  speed: number
  volume: number
  chapters: Chapter[]
  currentChapter: Chapter | null
  sleepTimerEnd: number | null // epoch ms
}

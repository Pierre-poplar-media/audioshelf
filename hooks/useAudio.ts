'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/store/player'
import { createClient } from '@/lib/supabase/client'
import { generateDeviceId } from '@/lib/utils'
import type { BookPart } from '@/types'

const SAVE_INTERVAL_MS = 5000
const RESUME_PROMPT_THRESHOLD = 60 * 10 // 10 minutes in seconds

// Find which part a global position falls in
function resolvePartAt(
  globalPos: number,
  parts: BookPart[]
): { part: BookPart; localPos: number } {
  const sorted = [...parts].sort((a, b) => a.part_index - b.part_index)
  for (const part of sorted) {
    if (globalPos < part.start_offset + part.duration) {
      return { part, localPos: globalPos - part.start_offset }
    }
  }
  const last = sorted[sorted.length - 1]
  return { part: last, localPos: last.duration }
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentPartRef = useRef<BookPart | null>(null)

  const {
    book,
    isPlaying,
    position,
    speed,
    volume,
    sleepTimerEnd,
    setIsPlaying,
    setPosition,
    setDuration,
    updateCurrentChapter,
    setSleepTimer,
  } = usePlayerStore()

  const supabase = createClient()

  const saveProgress = useCallback(async (pos: number, spd: number) => {
    if (!book) return
    const deviceId = generateDeviceId()
    await supabase.from('progress').upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      book_id: book.id,
      position: pos,
      speed: spd,
      device_id: deviceId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,book_id' })
  }, [book, supabase])

  // Global position from audio element + current part offset
  const getGlobalPos = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return 0
    return (currentPartRef.current?.start_offset ?? 0) + audio.currentTime
  }, [])

  // Build a same-origin proxy URL for a book part — avoids CORS and presigned URL issues
  const partProxyUrl = useCallback((bookId: string, partIndex: number) => {
    return `/api/audio/${bookId}?part=${partIndex}`
  }, [])

  // Load a specific part into the audio element via the server-side proxy
  const loadPart = useCallback((part: BookPart, localPos: number, autoPlay: boolean, bookId: string) => {
    const audio = audioRef.current
    if (!audio) return
    currentPartRef.current = part
    const proxyUrl = partProxyUrl(bookId, part.part_index)
    if (audio.src !== proxyUrl) {
      audio.src = proxyUrl
    }
    audio.currentTime = localPos
    if (autoPlay) audio.play().catch((err) => {
      if (err.name === 'AbortError') return // harmless race between play/pause, self-resolves
      setIsPlaying(false)
    })
  }, [setIsPlaying, partProxyUrl])

  // Initialize or update audio source when book changes
  useEffect(() => {
    if (!book) return

    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
    }

    const audio = audioRef.current
    const parts = book.book_parts ?? []
    const startPos = book.progress?.position ?? 0

    // Set total duration — prefer book.duration, fall back to sum of parts
    const totalDuration = book.duration > 0
      ? book.duration
      : parts.reduce((sum, p) => sum + (p.duration ?? 0), 0)
    if (totalDuration > 0) setDuration(totalDuration)

    // Use same-origin proxy URL — avoids all presigned URL / CORS issues with R2
    const singleProxyUrl = `/api/audio/${book.id}`

    if (parts.length > 1) {
      const { part, localPos } = resolvePartAt(startPos, parts)
      loadPart(part, localPos, false, book.id)
    } else {
      // Single-file book
      currentPartRef.current = null
      if (audio.src !== singleProxyUrl) {
        audio.src = singleProxyUrl
        audio.currentTime = startPos
      }
    }

    audio.playbackRate = book.progress?.speed ?? 1

    const onLoadedMetadata = () => {
      if (!book.duration) setDuration(audio.duration)
      updateCurrentChapter(getGlobalPos())
    }

    const onTimeUpdate = () => {
      const global = getGlobalPos()
      setPosition(global)
      updateCurrentChapter(global)
    }

    const onEnded = () => {
      const parts = book.book_parts ?? []
      const current = currentPartRef.current
      if (current) {
        const sorted = [...parts].sort((a, b) => a.part_index - b.part_index)
        const nextPart = sorted.find(p => p.part_index === current.part_index + 1)
        if (nextPart) {
          loadPart(nextPart, 0, true, book.id)
          return
        }
      }
      setIsPlaying(false)
      saveProgress(getGlobalPos(), audio.playbackRate)
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [book, getGlobalPos, loadPart, saveProgress, setDuration, setIsPlaying, setPosition, updateCurrentChapter])

  // Play/pause — plain HTML5 Audio (no Web Audio API needed until volume boost is built)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.volume = Math.min(1, volume)
      audio.play().catch((err) => {
        if (err.name === 'AbortError') return // harmless race, self-resolves
        console.warn('AudioShelf: play failed —', err.name, err.message)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, volume, setIsPlaying])

  // Sync speed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, volume)
  }, [volume])

  // Progress auto-save every 5 seconds
  useEffect(() => {
    if (!isPlaying) return
    saveTimerRef.current = setInterval(() => {
      saveProgress(getGlobalPos(), audioRef.current?.playbackRate ?? 1)
    }, SAVE_INTERVAL_MS)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [isPlaying, saveProgress, getGlobalPos])

  // Sleep timer with 10s fade-out
  useEffect(() => {
    if (!sleepTimerEnd) return
    const now = Date.now()
    const msUntilEnd = sleepTimerEnd - now
    if (msUntilEnd <= 0) { setSleepTimer(null); return }

    const msUntilFade = Math.max(0, msUntilEnd - 10000)
    sleepTimerRef.current = setTimeout(() => {
      const audio = audioRef.current
      if (!audio) return
      const startVolume = audio.volume
      const fadeSteps = 100
      const stepMs = 10000 / fadeSteps
      let step = 0
      fadeIntervalRef.current = setInterval(() => {
        step++
        audio.volume = Math.max(0, startVolume * (1 - step / fadeSteps))
        if (step >= fadeSteps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
          audio.pause()
          setIsPlaying(false)
          saveProgress(getGlobalPos(), audio.playbackRate)
          // Restore volume from current store state (not stale closure value)
          setTimeout(() => { audio.volume = Math.min(1, usePlayerStore.getState().volume) }, 500)
          setSleepTimer(null)
        }
      }, stepMs)
    }, msUntilFade)

    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
    }
  }, [sleepTimerEnd, saveProgress, getGlobalPos, setIsPlaying, setSleepTimer])

  const seek = useCallback((globalSeconds: number) => {
    const audio = audioRef.current
    const parts = book?.book_parts ?? []
    if (!audio) return

    if (parts.length > 1) {
      const { part, localPos } = resolvePartAt(Math.max(0, globalSeconds), parts)
      if (audio.src !== part.audio_url) {
        loadPart(part, localPos, isPlaying)
      } else {
        audio.currentTime = Math.max(0, localPos)
      }
      setPosition(globalSeconds)
    } else {
      audio.currentTime = Math.max(0, Math.min(globalSeconds, audio.duration || Infinity))
      setPosition(audio.currentTime)
    }
  }, [book, isPlaying, loadPart, setPosition])

  const skip = useCallback((delta: number) => {
    seek(getGlobalPos() + delta)
  }, [seek, getGlobalPos])

  return { audioRef, seek, skip }
}

'use client'

import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'

export function useMediaSession(
  skip: (delta: number) => void,
  seek: (seconds: number) => void
) {
  const { book, isPlaying, position, duration, setIsPlaying } = usePlayerStore()

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!book) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: book.title,
      artist: book.author ?? 'Unknown',
      album: book.narrator ? `Narrated by ${book.narrator}` : undefined,
      artwork: book.cover_url
        ? [{ src: book.cover_url, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false))
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-30))
    navigator.mediaSession.setActionHandler('seekforward', () => skip(30))
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime)
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('seekbackward', null)
      navigator.mediaSession.setActionHandler('seekforward', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    }
  }, [book, setIsPlaying, skip, seek])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(position, duration),
    })
  }, [position, duration])
}

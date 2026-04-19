'use client'

import { createContext, useContext } from 'react'
import { useAudio } from '@/hooks/useAudio'
import { useMediaSession } from '@/hooks/useMediaSession'

interface AudioContextValue {
  seek: (seconds: number) => void
  skip: (delta: number) => void
}

const AudioContext = createContext<AudioContextValue>({
  seek: () => {},
  skip: () => {},
})

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { seek, skip } = useAudio()
  useMediaSession(skip, seek)

  return (
    <AudioContext.Provider value={{ seek, skip }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudioContext() {
  return useContext(AudioContext)
}

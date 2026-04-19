'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

interface Props {
  onUploadComplete: () => void
}

interface UploadBatch {
  id: string
  files: File[]
  progresses: number[]
  status: 'uploading' | 'processing' | 'done' | 'error'
  bookId?: string
  error?: string
}

const AUDIO_EXT = /\.(mp3|m4b|m4a|ogg)$/i

function naturalSort(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export function UploadZone({ onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [batches, setBatches] = useState<UploadBatch[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (rawFiles: File[]) => {
    const audioFiles = naturalSort(
      rawFiles.filter(f => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name))
    )
    if (!audioFiles.length) return

    const batchId = crypto.randomUUID()
    setBatches(prev => [...prev, {
      id: batchId,
      files: audioFiles,
      progresses: audioFiles.map(() => 0),
      status: 'uploading',
    }])

    const setProgress = (fileIndex: number, pct: number) =>
      setBatches(prev => prev.map(b =>
        b.id === batchId
          ? { ...b, progresses: b.progresses.map((p, i) => i === fileIndex ? pct : p) }
          : b
      ))

    // Upload all files to R2 sequentially
    const uploadedParts: Array<{ key: string; filename: string }> = []
    for (let i = 0; i < audioFiles.length; i++) {
      try {
        const key = await uploadToR2(audioFiles[i], pct => setProgress(i, pct))
        uploadedParts.push({ key, filename: audioFiles[i].name })
      } catch (err) {
        setBatches(prev => prev.map(b =>
          b.id === batchId
            ? { ...b, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
            : b
        ))
        return
      }
    }

    // Register as one book
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'processing' } : b))
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: uploadedParts }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to process book')
      const { book } = await res.json()
      setBatches(prev => prev.map(b =>
        b.id === batchId ? { ...b, status: 'done', bookId: book.id } : b
      ))
      onUploadComplete()
    } catch (err) {
      setBatches(prev => prev.map(b =>
        b.id === batchId
          ? { ...b, status: 'error', error: err instanceof Error ? err.message : 'Failed to process book' }
          : b
      ))
    }
  }, [onUploadComplete])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }, [processFiles])

  const dismiss = (id: string) => setBatches(prev => prev.filter(b => b.id !== id))

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload audiobook files"
      >
        <Upload className="mx-auto text-zinc-500 mb-3" size={28} />
        <p className="text-zinc-300 font-medium">Drop audiobooks here</p>
        <p className="text-zinc-500 text-sm mt-1">
          MP3, M4B, M4A — drop multiple files to add as one book
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.m4b,.m4a,.ogg,audio/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {batches.filter(b => b.status !== 'done').map(batch => (
        <UploadBatchItem key={batch.id} batch={batch} onDismiss={() => dismiss(batch.id)} />
      ))}
    </div>
  )
}

function UploadBatchItem({ batch, onDismiss }: { batch: UploadBatch; onDismiss: () => void }) {
  const overallProgress = batch.progresses.reduce((s, p) => s + p, 0) / batch.progresses.length
  const totalSize = batch.files.reduce((s, f) => s + f.size, 0)
  const isMulti = batch.files.length > 1

  return (
    <div className="bg-zinc-900 rounded-lg px-4 py-3 border border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 font-medium">
            {isMulti ? `${batch.files.length} files — 1 book` : batch.files[0].name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{formatFileSize(totalSize)}</p>

          {batch.status === 'uploading' && (
            <div className="mt-2 space-y-1">
              {isMulti && batch.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="tabular-nums">{batch.progresses[i]}%</span>
                </div>
              ))}
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}
          {batch.status === 'processing' && (
            <p className="text-xs text-amber-400 mt-1">Processing metadata…</p>
          )}
          {batch.status === 'error' && (
            <p className="text-xs text-red-400 mt-1">{batch.error}</p>
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          {batch.status === 'done' && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
          {batch.status === 'error' && <AlertCircle size={16} className="text-red-400 flex-shrink-0" />}
          {(batch.status === 'done' || batch.status === 'error') && (
            <button onClick={onDismiss} className="text-zinc-500 hover:text-white ml-1" aria-label="Dismiss">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

async function uploadToR2(file: File, onProgress: (pct: number) => void): Promise<string> {
  const presignRes = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'audio/mpeg', size: file.size }),
  })
  if (!presignRes.ok) throw new Error((await presignRes.json()).error || 'Failed to get upload URL')
  const { uploadUrl, key } = await presignRes.json()

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(95); resolve() }
      else reject(new Error(`Upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })

  return key
}

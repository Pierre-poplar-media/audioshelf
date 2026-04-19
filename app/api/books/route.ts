import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/r2'
import * as mm from 'music-metadata'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { r2, BUCKET } from '@/lib/r2'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: books, error } = await supabase
    .from('books')
    .select('*, progress(*), chapters(*), book_parts(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ books })
}

// Parse metadata and file size for one R2 object
async function parsePartMeta(key: string): Promise<{
  metadata: mm.IAudioMetadata | null
  duration: number
  fileSize: number
  audioUrl: string
}> {
  const audioUrl = await getDownloadUrl(key, 86400)

  let fileSize = 0
  try {
    const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    fileSize = head.ContentLength ?? 0
  } catch {}

  let metadata: mm.IAudioMetadata | null = null
  try {
    const res = await fetch(audioUrl, { headers: { Range: 'bytes=0-10485760' } })
    const buffer = Buffer.from(await res.arrayBuffer())
    metadata = await mm.parseBuffer(buffer, { mimeType: 'audio/mp4', size: buffer.length })
  } catch {}

  return { metadata, duration: metadata?.format?.duration ?? 0, fileSize, audioUrl }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Accept both old single-key format and new multi-part format
  let parts: Array<{ key: string; filename: string }>
  if (Array.isArray(body.parts) && body.parts.length > 0) {
    parts = body.parts
  } else if (body.key) {
    parts = [{ key: body.key, filename: body.filename ?? body.key }]
  } else {
    return NextResponse.json({ error: 'Missing key or parts' }, { status: 400 })
  }

  // Verify all objects exist first
  for (const part of parts) {
    try {
      await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: part.key }))
    } catch {
      return NextResponse.json({ error: `File not found: ${part.filename}` }, { status: 404 })
    }
  }

  // Parse metadata for all parts (first part provides book-level metadata)
  const parsedParts = await Promise.all(parts.map(p => parsePartMeta(p.key)))
  const first = parsedParts[0]

  const title = first.metadata?.common?.title || parts[0].filename.replace(/\.[^.]+$/, '') || 'Untitled'
  const author = first.metadata?.common?.artist || first.metadata?.common?.albumartist || null
  const narrator = first.metadata?.common?.composer || null
  const year = first.metadata?.common?.year ?? null
  const commonAny = first.metadata?.common as unknown as Record<string, unknown> | undefined
  const seriesName = (commonAny?.series as string) ?? null
  const seriesIndex = (commonAny?.seriesIndex as number) ?? null
  const totalDuration = parsedParts.reduce((sum, p) => sum + p.duration, 0)
  const totalFileSize = parsedParts.reduce((sum, p) => sum + p.fileSize, 0)

  // Cover art from first file
  let coverUrl: string | null = null
  const pictures = first.metadata?.common?.picture
  if (pictures && pictures.length > 0) {
    const pic = pictures[0]
    const coverKey = `${user.id}/covers/${Date.now()}-${crypto.randomUUID()}.jpg`
    try {
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: coverKey,
        Body: pic.data,
        ContentType: pic.format || 'image/jpeg',
      }))
      coverUrl = await getDownloadUrl(coverKey, 31536000) // 1 year
    } catch {}
  }

  // Insert book (audio_key/url = first part for backward compat)
  const { data: book, error: bookError } = await supabase
    .from('books')
    .insert({
      user_id: user.id,
      title,
      author,
      narrator,
      cover_url: coverUrl,
      audio_key: parts[0].key,
      audio_url: parsedParts[0].audioUrl,
      duration: totalDuration,
      file_size: totalFileSize,
      series_name: seriesName,
      series_index: seriesIndex,
      year,
    })
    .select()
    .single()

  if (bookError || !book) return NextResponse.json({ error: bookError?.message }, { status: 500 })

  // Insert book_parts for multi-file books
  if (parts.length > 1) {
    let offset = 0
    const partRows = parsedParts.map((p, i) => {
      const row = {
        book_id: book.id,
        audio_key: parts[i].key,
        audio_url: p.audioUrl,
        part_index: i,
        duration: p.duration,
        file_size: p.fileSize,
        start_offset: offset,
      }
      offset += p.duration
      return row
    })
    await supabase.from('book_parts').insert(partRows)
  }

  // Chapters from first file (m4b chapter markers)
  const metaAny = first.metadata as unknown as Record<string, unknown> | null
  const chapterMarkers = metaAny?.chapter as Array<{ title?: string; start: number; end: number }> | undefined
  if (chapterMarkers && chapterMarkers.length > 0) {
    await supabase.from('chapters').insert(
      chapterMarkers.map((c, i) => ({
        book_id: book.id,
        title: c.title || `Chapter ${i + 1}`,
        start_time: c.start / 1000,
        end_time: c.end / 1000,
        chapter_index: i,
      }))
    )
  }

  return NextResponse.json({ book }, { status: 201 })
}

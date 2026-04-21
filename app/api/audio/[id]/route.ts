import { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import { createClient } from '@/lib/supabase/server'
import { r2, BUCKET } from '@/lib/r2'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// Stream audio from R2 through this API so the browser never touches presigned URLs.
// This avoids CORS issues, presigned URL expiry, and m4b moov-atom seeking problems.
// The browser can request any Range; we forward it directly to R2.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Allow a ?part=N query param for multi-part books
  const partIndex = request.nextUrl.searchParams.get('part')

  const { data: book } = await supabase
    .from('books')
    .select('audio_key, book_parts(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!book) return new Response('Not found', { status: 404 })

  // Pick the right key: specific part or the top-level book key
  let audioKey = book.audio_key
  if (partIndex !== null) {
    const parts = (book.book_parts ?? []) as Array<{ part_index: number; audio_key: string }>
    const part = parts.find(p => p.part_index === Number(partIndex))
    if (!part) return new Response('Part not found', { status: 404 })
    audioKey = part.audio_key
  }

  const rangeHeader = request.headers.get('range')

  try {
    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: audioKey,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    })

    const r2Res = await r2.send(cmd)
    if (!r2Res.Body) return new Response('No content', { status: 204 })

    const headers: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    }

    if (r2Res.ContentType) headers['Content-Type'] = r2Res.ContentType
    if (r2Res.ContentLength) headers['Content-Length'] = String(r2Res.ContentLength)
    if (r2Res.ContentRange) headers['Content-Range'] = r2Res.ContentRange

    const status = rangeHeader ? 206 : 200

    // AWS SDK returns a Node.js Readable in server environments.
    // Convert to a Web ReadableStream for the Response constructor.
    const webStream = Readable.toWeb(r2Res.Body as Readable) as ReadableStream

    return new Response(webStream, { status, headers })
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NoSuchKey') {
      return new Response('Audio not found', { status: 404 })
    }
    console.error('R2 audio proxy error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

// HEAD is used by the browser to get Content-Length before streaming
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 401 })

  const partIndex = request.nextUrl.searchParams.get('part')
  const { data: book } = await supabase
    .from('books')
    .select('audio_key, book_parts(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!book) return new Response(null, { status: 404 })

  let audioKey = book.audio_key
  if (partIndex !== null) {
    const parts = (book.book_parts ?? []) as Array<{ part_index: number; audio_key: string }>
    const part = parts.find(p => p.part_index === Number(partIndex))
    if (!part) return new Response(null, { status: 404 })
    audioKey = part.audio_key
  }

  try {
    const cmd = new HeadObjectCommand({ Bucket: BUCKET, Key: audioKey })
    const r2Res = await r2.send(cmd)

    const headers: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    }
    if (r2Res.ContentType) headers['Content-Type'] = r2Res.ContentType
    if (r2Res.ContentLength) headers['Content-Length'] = String(r2Res.ContentLength)

    return new Response(null, { status: 200, headers })
  } catch {
    return new Response(null, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { r2, BUCKET } from '@/lib/r2'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Stream audio from R2 through this API so the browser never touches presigned URLs.
// We generate a short-lived presigned URL server-side and fetch() from it, then forward
// the native Web ReadableStream body. This avoids the Node.js stream → ReadableStream
// conversion which doesn't flow reliably through Vercel Lambda.
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
    // Generate a short-lived presigned URL so we can fetch() from it server-side.
    // fetch() returns a native Web ReadableStream body that streams cleanly through
    // Vercel's Lambda — unlike wrapping the AWS SDK's Node.js EventEmitter stream.
    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: audioKey }),
      { expiresIn: 300 } // 5 minutes — only needs to last for this server-side fetch
    )

    const fetchHeaders: Record<string, string> = {}
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader

    const r2Res = await fetch(signedUrl, { headers: fetchHeaders })

    if (!r2Res.ok && r2Res.status !== 206) {
      console.error('R2 fetch error:', r2Res.status, await r2Res.text())
      return new Response('R2 error', { status: 502 })
    }

    const responseHeaders: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    }

    const ct = r2Res.headers.get('content-type')
    const cl = r2Res.headers.get('content-length')
    const cr = r2Res.headers.get('content-range')
    if (ct) responseHeaders['Content-Type'] = ct
    if (cl) responseHeaders['Content-Length'] = cl
    if (cr) responseHeaders['Content-Range'] = cr

    return new Response(r2Res.body, { status: r2Res.status, headers: responseHeaders })
  } catch (err: unknown) {
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

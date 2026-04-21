import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/r2'

// Debug endpoint: generate a presigned URL and HEAD-test it from the server side
// GET /api/debug/r2?bookId=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookId = request.nextUrl.searchParams.get('bookId')
  if (!bookId) return NextResponse.json({ error: 'Missing bookId' }, { status: 400 })

  const { data: book } = await supabase
    .from('books')
    .select('audio_key, title')
    .eq('id', bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await getDownloadUrl(book.audio_key, 3600)

  // Check for %0A in credential (the bug we're fixing)
  const has0A = url.includes('%0A')
  const credMatch = url.match(/X-Amz-Credential=([^&]+)/)

  // GET the URL (small range) from the server to check R2 responds correctly
  let r2Status: number | null = null
  let r2Headers: Record<string, string> = {}
  let r2Body: string | null = null
  let r2Error: string | null = null
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-255' } })
    r2Status = res.status
    res.headers.forEach((v, k) => { r2Headers[k] = v })
    // Read first 500 chars of body (will be XML error or audio data)
    r2Body = (await res.text()).substring(0, 500)
  } catch (e) {
    r2Error = String(e)
  }

  return NextResponse.json({
    title: book.title,
    urlLength: url.length,
    has0A,
    credential: credMatch?.[1],
    r2Status,
    r2Headers,
    r2Body,
    r2Error,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book, error } = await supabase
    .from('books')
    .select('audio_key, book_parts(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parts = (book.book_parts ?? []) as Array<{
    id: string; audio_key: string; part_index: number; start_offset: number; duration: number
  }>

  if (parts.length > 1) {
    // Multi-part: refresh all part URLs in parallel
    const refreshed = await Promise.all(
      parts
        .sort((a, b) => a.part_index - b.part_index)
        .map(async (p) => {
          const url = await getDownloadUrl(p.audio_key, 86400)
          await supabase.from('book_parts').update({ audio_url: url }).eq('id', p.id)
          return { part_index: p.part_index, start_offset: p.start_offset, duration: p.duration, url }
        })
    )
    return NextResponse.json({ url: refreshed[0].url, parts: refreshed })
  }

  // Single-file book
  const url = await getDownloadUrl(book.audio_key, 86400)
  await supabase.from('books').update({ audio_url: url }).eq('id', id)
  return NextResponse.json({ url, parts: [] })
}

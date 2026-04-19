import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { r2, BUCKET } from '@/lib/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch book + parts so we can clean up storage
  const { data: book } = await supabase
    .from('books')
    .select('audio_key, cover_url, book_parts(audio_key)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete audio files from R2
  const audioKeys: string[] = [
    book.audio_key,
    ...((book.book_parts as { audio_key: string }[] | null ?? []).map(p => p.audio_key)),
  ].filter(Boolean)

  await Promise.allSettled(
    audioKeys.map(key => r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })))
  )

  // Delete cover from Supabase storage
  if (book.cover_url) {
    const url = new URL(book.cover_url)
    const storagePath = url.pathname.split('/object/public/covers/')[1]
    if (storagePath) {
      await supabase.storage.from('covers').remove([decodeURIComponent(storagePath)])
    }
  }

  // Delete book (cascade removes chapters, progress, bookmarks)
  const { error } = await supabase.from('books').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, author, narrator } = body

  const { data: book, error } = await supabase
    .from('books')
    .update({
      ...(title !== undefined && { title: title.trim() || 'Untitled' }),
      ...(author !== undefined && { author: author.trim() || null }),
      ...(narrator !== undefined && { narrator: narrator.trim() || null }),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ book })
}

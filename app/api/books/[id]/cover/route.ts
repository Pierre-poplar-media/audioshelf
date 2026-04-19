import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS for storage uploads
const admin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, author } = await request.json()

    const query = encodeURIComponent(`${title} ${author ?? ''}`.trim())
    let gbData: { items?: unknown[] } = {}
    try {
      const gbRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10&printType=books`
      )
      if (gbRes.ok) gbData = await gbRes.json()
    } catch {
      // network error — fall through to "No cover found"
    }

    const items = gbData.items ?? []
    let imageUrl: string | null = null
    for (const item of items) {
      const links = (item as { volumeInfo?: { imageLinks?: Record<string, string> } })
        .volumeInfo?.imageLinks
      const img = links?.thumbnail || links?.smallThumbnail
      if (img) {
        imageUrl = img.replace('http://', 'https://').replace('&zoom=1', '&zoom=2')
        break
      }
    }

    if (!imageUrl) return NextResponse.json({ error: 'No cover found for this title' }, { status: 404 })

    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Failed to download cover image' }, { status: 502 })

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const path = `${user.id}/${id}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('covers')
      .upload(path, buffer, { contentType, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage.from('covers').getPublicUrl(path)

    const { error: dbError } = await supabase
      .from('books')
      .update({ cover_url: publicUrl })
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ cover_url: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[cover route]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

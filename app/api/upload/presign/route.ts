import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrl } from '@/lib/r2'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { filename, contentType, size } = await request.json()

  if (!filename || !contentType || !size) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const MAX_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 2GB)' }, { status: 400 })
  }

  const allowed = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4b', 'audio/x-m4b', 'audio/ogg']
  if (!allowed.includes(contentType) && !filename.match(/\.(mp3|m4b|m4a|ogg)$/i)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp3'
  const key = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const uploadUrl = await getUploadUrl(key, contentType, 7200)

  return NextResponse.json({ uploadUrl, key })
}

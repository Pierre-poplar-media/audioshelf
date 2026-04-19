import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookId, position, speed, deviceId } = await request.json()

  if (!bookId || position === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabase.from('progress').upsert({
    user_id: user.id,
    book_id: bookId,
    position,
    speed: speed ?? 1,
    device_id: deviceId ?? 'unknown',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

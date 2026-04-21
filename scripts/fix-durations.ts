#!/usr/bin/env npx tsx
/**
 * fix-durations.ts
 *
 * Probes every book's audio file(s) via ffprobe and writes the correct
 * duration values back to Supabase. Runs on the GCP VM (or locally if
 * ffprobe is installed). Uses presigned R2 URLs so ffprobe only fetches
 * the file headers — it doesn't download the full audio.
 *
 * Usage (from the audioshelf directory):
 *   npx tsx scripts/fix-durations.ts
 *
 * Requirements:
 *   ffprobe  (apt install ffmpeg  or  brew install ffmpeg)
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { spawn } from 'child_process'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local (works whether run locally or on the VM with a copied .env file)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const trim = (s: string | undefined) => (s ?? '').trim()

const SUPABASE_URL        = trim(process.env.NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_SERVICE_KEY = trim(process.env.SUPABASE_SERVICE_ROLE_KEY)
const R2_ENDPOINT         = trim(process.env.R2_ENDPOINT)
const R2_ACCESS_KEY_ID    = trim(process.env.R2_ACCESS_KEY_ID)
const R2_SECRET_ACCESS_KEY = trim(process.env.R2_SECRET_ACCESS_KEY)
const BUCKET              = trim(process.env.R2_BUCKET_NAME)

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, BUCKET })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1) }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

// Generate a short-lived presigned URL for ffprobe to fetch from
async function presign(key: string): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 300 })
}

// Ask ffprobe for duration in seconds. It only fetches the file headers so it's fast.
function ffprobeDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      url,
    ])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${stderr.slice(0, 300)}`))
      const dur = parseFloat(stdout.trim())
      if (isNaN(dur) || dur <= 0) return reject(new Error(`Bad duration value: "${stdout.trim()}"${stderr ? ' — ' + stderr.slice(0, 100) : ''}`))
      resolve(dur)
    })
    proc.on('error', (e) => reject(new Error(`ffprobe not found: ${e.message} — install it with: apt install ffmpeg`)))
  })
}

async function main() {
  console.log('Fetching books from Supabase...\n')

  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, audio_key, duration, book_parts(*)')
    .order('created_at')

  if (error) throw new Error(`Supabase: ${error.message}`)
  if (!books?.length) { console.log('No books found.'); return }

  console.log(`Found ${books.length} book(s)\n${'─'.repeat(60)}`)

  let updated = 0
  let failed = 0

  for (const book of books) {
    const parts = ((book.book_parts ?? []) as Array<{
      id: string
      part_index: number
      audio_key: string
      duration: number
      start_offset: number
    }>).sort((a, b) => a.part_index - b.part_index)

    console.log(`\n📚  ${book.title}`)

    if (parts.length > 1) {
      // Multi-part audiobook: probe each part, update duration + start_offset, sum total
      let totalDuration = 0
      let offset = 0
      let anyFailed = false
      // Track the new durations so we can rebuild chapter timestamps accurately
      const newDurations: Array<{ partIndex: number; startOffset: number; duration: number }> = []

      for (const part of parts) {
        process.stdout.write(`    Part ${String(part.part_index).padStart(2)}: `)
        try {
          const url = await presign(part.audio_key)
          const dur = await ffprobeDuration(url)
          const { error: updateErr } = await supabase
            .from('book_parts')
            .update({ duration: dur, start_offset: offset })
            .eq('id', part.id)
          if (updateErr) throw new Error(updateErr.message)
          console.log(`${dur.toFixed(1)}s  (offset ${offset.toFixed(1)}s)`)
          newDurations.push({ partIndex: part.part_index, startOffset: offset, duration: dur })
          totalDuration += dur
          offset += dur
        } catch (e) {
          console.log(`FAILED — ${(e as Error).message}`)
          anyFailed = true
          failed++
        }
      }

      if (!anyFailed) {
        await supabase.from('books').update({ duration: totalDuration }).eq('id', book.id)

        // Rebuild per-part chapter timestamps using the corrected offsets.
        // If the chapter count matches the part count, the chapters were generated
        // from parts during upload — it's safe to overwrite their start/end times.
        // Embedded M4B chapter markers (single-file books) are handled in the else
        // branch below and are not touched here.
        const { data: existingChapters } = await supabase
          .from('chapters')
          .select('id, chapter_index')
          .eq('book_id', book.id)

        if (existingChapters && existingChapters.length === parts.length) {
          process.stdout.write(`    Rebuilding ${parts.length} chapter timestamps... `)
          await Promise.all(
            newDurations.map(({ partIndex, startOffset, duration }) =>
              supabase
                .from('chapters')
                .update({ start_time: startOffset, end_time: startOffset + duration })
                .eq('book_id', book.id)
                .eq('chapter_index', partIndex)
            )
          )
          console.log('done')
        }

        console.log(`    ✓ Total: ${formatDuration(totalDuration)}`)
        updated++
      }
    } else {
      // Single-file book: probe the top-level audio_key
      process.stdout.write(`    Probing... `)
      try {
        const key = book.audio_key
        if (!key) throw new Error('No audio_key set on book')
        const url = await presign(key)
        const dur = await ffprobeDuration(url)
        const { error: updateErr } = await supabase
          .from('books')
          .update({ duration: dur })
          .eq('id', book.id)
        if (updateErr) throw new Error(updateErr.message)
        console.log(`✓ ${formatDuration(dur)}`)
        updated++
      } catch (e) {
        console.log(`FAILED — ${(e as Error).message}`)
        failed++
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Done. Updated: ${updated}  Failed: ${failed}`)
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })

'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookWithProgress } from '@/types'
import { BookCard } from '@/components/library/BookCard'
import { UploadZone } from '@/components/library/UploadZone'
import { LogOut, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LibraryPage() {
  const [books, setBooks] = useState<BookWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const loadBooks = useCallback(async () => {
    const { data } = await supabase
      .from('books')
      .select('*, progress(*), chapters(*), book_parts(*)')
      .order('created_at', { ascending: false })

    if (data) {
      setBooks(data.map(b => ({
        ...b,
        progress: Array.isArray(b.progress) ? b.progress[0] ?? null : b.progress,
        chapters: Array.isArray(b.chapters) ? b.chapters : [],
        book_parts: Array.isArray(b.book_parts) ? b.book_parts : [],
      })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadBooks() }, [loadBooks])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inProgress = books.filter(b => {
    const pct = b.progress?.position && b.duration ? (b.progress.position / b.duration) * 100 : 0
    return pct > 0 && pct < 95
  })

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-900 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AudioShelf</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold"
            >
              <Upload size={14} className="mr-1.5" />
              Upload
            </Button>
            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6">
        {/* Upload zone */}
        {showUpload && (
          <div className="mb-8">
            <UploadZone onUploadComplete={() => { loadBooks(); setShowUpload(false) }} />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📚</div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-2">Your shelf is empty</h2>
            <p className="text-zinc-500 text-sm mb-6">Upload your first audiobook to get started</p>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold"
            >
              <Upload size={14} className="mr-1.5" />
              Upload audiobook
            </Button>
          </div>
        ) : (
          <>
            {/* In Progress section */}
            {inProgress.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                  Continue Listening
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {inProgress.map(book => (
                    <BookCard key={book.id} book={book} onDeleted={() => setBooks(prev => prev.filter(b => b.id !== book.id))} />
                  ))}
                </div>
              </section>
            )}

            {/* All books */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                All Books
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {books.map(book => (
                  <BookCard key={book.id} book={book} onDeleted={() => setBooks(prev => prev.filter(b => b.id !== book.id))} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

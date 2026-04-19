-- Enable UUID extension


-- Books
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  narrator text,
  cover_url text,
  audio_key text not null, -- R2 object key
  audio_url text not null, -- signed URL (refreshed on demand)
  duration numeric not null default 0, -- seconds
  file_size bigint not null default 0, -- bytes
  series_name text,
  series_index numeric,
  description text,
  year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table books enable row level security;
create policy "Users can manage their own books" on books
  for all using (auth.uid() = user_id);

-- Chapters
create table chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  title text not null,
  start_time numeric not null,
  end_time numeric not null,
  chapter_index integer not null
);

alter table chapters enable row level security;
create policy "Users can read chapters for their books" on chapters
  for select using (
    exists (select 1 from books where books.id = chapters.book_id and books.user_id = auth.uid())
  );
create policy "Users can insert chapters for their books" on chapters
  for insert with check (
    exists (select 1 from books where books.id = chapters.book_id and books.user_id = auth.uid())
  );
create policy "Users can delete chapters for their books" on chapters
  for delete using (
    exists (select 1 from books where books.id = chapters.book_id and books.user_id = auth.uid())
  );

-- Progress
create table progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  position numeric not null default 0,
  speed numeric not null default 1.0,
  device_id text not null default 'unknown',
  updated_at timestamptz not null default now(),
  unique(user_id, book_id)
);

alter table progress enable row level security;
create policy "Users can manage their own progress" on progress
  for all using (auth.uid() = user_id);

-- Bookmarks
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  position numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table bookmarks enable row level security;
create policy "Users can manage their own bookmarks" on bookmarks
  for all using (auth.uid() = user_id);

-- Collections
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cover_url text,
  created_at timestamptz not null default now()
);

alter table collections enable row level security;
create policy "Users can manage their own collections" on collections
  for all using (auth.uid() = user_id);

-- Collection books (many-to-many)
create table collection_books (
  collection_id uuid not null references collections(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, book_id)
);

alter table collection_books enable row level security;
create policy "Users can manage collection books" on collection_books
  for all using (
    exists (select 1 from collections where collections.id = collection_books.collection_id and collections.user_id = auth.uid())
  );

-- Indexes for common queries
create index books_user_id_idx on books(user_id);
create index progress_user_book_idx on progress(user_id, book_id);
create index bookmarks_user_book_idx on bookmarks(user_id, book_id);
create index chapters_book_id_idx on chapters(book_id, chapter_index);

-- Auto-update updated_at on books
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger books_updated_at
  before update on books
  for each row execute procedure update_updated_at();

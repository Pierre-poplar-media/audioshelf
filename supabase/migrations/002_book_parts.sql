-- Book parts: each row is one audio file in a multi-file audiobook
create table book_parts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  audio_key text not null,
  audio_url text not null,
  part_index integer not null,
  duration numeric not null default 0,
  file_size bigint not null default 0,
  start_offset numeric not null default 0 -- cumulative seconds before this part
);

alter table book_parts enable row level security;

create policy "Users can read parts for their books" on book_parts
  for select using (
    exists (select 1 from books where books.id = book_parts.book_id and books.user_id = auth.uid())
  );
create policy "Users can insert parts for their books" on book_parts
  for insert with check (
    exists (select 1 from books where books.id = book_parts.book_id and books.user_id = auth.uid())
  );
create policy "Users can delete parts for their books" on book_parts
  for delete using (
    exists (select 1 from books where books.id = book_parts.book_id and books.user_id = auth.uid())
  );

create index book_parts_book_id_idx on book_parts(book_id, part_index);

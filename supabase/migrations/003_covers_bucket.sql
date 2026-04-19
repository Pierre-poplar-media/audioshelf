-- Public storage bucket for book cover images (no expiry, no auth needed to view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view covers (they're public)
CREATE POLICY "covers_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

-- Authenticated users can upload covers
CREATE POLICY "covers_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

-- Authenticated users can update covers (re-upload)
CREATE POLICY "covers_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'covers');

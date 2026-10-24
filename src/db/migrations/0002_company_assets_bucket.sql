-- Private bucket for the company logo and signature (SPEC §12, §13).
-- No storage.objects policies: anon and authenticated can't read or write it;
-- only the server, with the secret key, can.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  false,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

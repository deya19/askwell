-- Knowledge file bucket (project.md §6.4, §9 File upload).
--
-- A private bucket for uploaded knowledge files (PDF, Markdown, TXT). The bucket enforces the
-- same limits the API checks: MAX_KNOWLEDGE_FILE_BYTES (10 MB) and the MIME types in
-- KNOWLEDGE_FILE_MIME_TYPES (packages/shared). Keep them in sync.
--
-- Access: this migration adds NO storage.objects policies for `anon` or `authenticated`, on
-- purpose. With RLS on storage.objects and no policy, those roles can't list, read, write or
-- delete any object here. Only the server, with the service role (which bypasses RLS), reads,
-- writes, deletes and signs one-time upload URLs, after the route checks project ownership.
-- The browser only ever uploads through a signed URL the server issued.
--
-- Additive and idempotent: it only inserts (or re-asserts) this one bucket row.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge',
  'knowledge',
  false,
  10485760, -- 10 MB = MAX_KNOWLEDGE_FILE_BYTES
  array['application/pdf', 'text/markdown', 'text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

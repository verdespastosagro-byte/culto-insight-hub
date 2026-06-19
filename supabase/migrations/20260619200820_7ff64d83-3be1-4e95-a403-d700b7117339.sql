CREATE POLICY "posts-audios: usuário envia em sua pasta"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts-audios'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "posts-audios: usuário gerencia seus áudios"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'posts-audios' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'posts-audios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "posts-audios: usuário exclui seus áudios"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'posts-audios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "posts-audios: autenticados leem"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'posts-audios');
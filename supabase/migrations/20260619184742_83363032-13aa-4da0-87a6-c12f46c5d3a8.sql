ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url text;

-- Storage policies para perfil-fotos
-- Convenção de path: <user_id>/<arquivo> — primeiro segmento do path = dono
CREATE POLICY "perfil fotos read auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'perfil-fotos');

CREATE POLICY "perfil fotos insert owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'perfil-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "perfil fotos update owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'perfil-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'perfil-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "perfil fotos delete owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'perfil-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
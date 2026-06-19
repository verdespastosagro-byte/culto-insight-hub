
CREATE POLICY "cong fotos read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'congregacoes-fotos');
CREATE POLICY "cong fotos insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'congregacoes-fotos');
CREATE POLICY "cong fotos update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'congregacoes-fotos');
CREATE POLICY "cong fotos delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'congregacoes-fotos');

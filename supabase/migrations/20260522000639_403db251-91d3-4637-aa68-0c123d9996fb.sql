
-- Tighten notifications INSERT: require an explicit recipient user_id (no blanket TRUE check)
DROP POLICY IF EXISTS notif_insert_any ON public.notifications;
CREATE POLICY notif_insert_authenticated ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NOT NULL);

-- Restrict patient-photos public listing: signed-in users only (kept public bucket for direct URL usage when needed via storage public access toggle is unchanged; this revokes anon listing)
DROP POLICY IF EXISTS patient_photos_public_read ON storage.objects;
CREATE POLICY patient_photos_authenticated_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-photos');

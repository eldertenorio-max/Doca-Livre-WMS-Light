-- Habilita Realtime na tabela `contagens_inventario`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contagens_inventario'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contagens_inventario;
  END IF;
END $$;

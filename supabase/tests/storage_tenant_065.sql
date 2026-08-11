-- Executar apenas em branch Supabase descartável após a migration 065.
-- A transação cria dois tenants e dois usuários; ROLLBACK remove tudo.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(p_sql text, p_expected bigint, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_actual bigint;
BEGIN
  EXECUTE p_sql INTO v_actual;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: esperado %, obtido %', p_label, p_expected, v_actual;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_error(p_sql text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL %: operação deveria ser bloqueada', p_label;
END $$;

INSERT INTO public.empresas (id, slug, razao_social, nome_fantasia) VALUES
  ('f0650000-0000-0000-0000-000000000001', 'codex-storage-a', 'Codex Storage A', 'Codex A'),
  ('f0650000-0000-0000-0000-000000000002', 'codex-storage-b', 'Codex Storage B', 'Codex B');

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('f0652000-0000-0000-0000-000000000001', 'codex-storage-viewer-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0652000-0000-0000-0000-000000000002', 'codex-storage-admin-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0652000-0000-0000-0000-000000000003', 'codex-storage-admin-b@example.invalid', '{}'::jsonb, '{}'::jsonb);

INSERT INTO public.usuarios (id, auth_user_id, nome, email, perfil) VALUES
  ('f0651000-0000-0000-0000-000000000001', 'f0652000-0000-0000-0000-000000000001', 'Viewer A', 'codex-storage-viewer-a@example.invalid', 'visualizador'),
  ('f0651000-0000-0000-0000-000000000002', 'f0652000-0000-0000-0000-000000000002', 'Admin A', 'codex-storage-admin-a@example.invalid', 'visualizador'),
  ('f0651000-0000-0000-0000-000000000003', 'f0652000-0000-0000-0000-000000000003', 'Admin B', 'codex-storage-admin-b@example.invalid', 'visualizador');

INSERT INTO public.empresa_usuarios (empresa_id, usuario_id, papel_id) VALUES
  ('f0650000-0000-0000-0000-000000000001', 'f0651000-0000-0000-0000-000000000001', (SELECT id FROM public.papeis WHERE codigo='visualizador' AND escopo='COMPANY' LIMIT 1)),
  ('f0650000-0000-0000-0000-000000000001', 'f0651000-0000-0000-0000-000000000002', (SELECT id FROM public.papeis WHERE codigo='admin_empresa' AND escopo='COMPANY' LIMIT 1)),
  ('f0650000-0000-0000-0000-000000000002', 'f0651000-0000-0000-0000-000000000003', (SELECT id FROM public.papeis WHERE codigo='admin_empresa' AND escopo='COMPANY' LIMIT 1));

INSERT INTO public.propostas (id, empresa_id) VALUES
  ('f0653000-0000-0000-0000-000000000001', 'f0650000-0000-0000-0000-000000000001'),
  ('f0653000-0000-0000-0000-000000000002', 'f0650000-0000-0000-0000-000000000002');

INSERT INTO public.contratacoes_online (id, empresa_id, public_token, protocolo, origem) VALUES
  ('f0654000-0000-0000-0000-000000000001', 'f0650000-0000-0000-0000-000000000001', 'codex-storage-token-a', 'CODEX-STORAGE-A', 'simulador'),
  ('f0654000-0000-0000-0000-000000000002', 'f0650000-0000-0000-0000-000000000002', 'codex-storage-token-b', 'CODEX-STORAGE-B', 'simulador');

INSERT INTO storage.objects (bucket_id, name) VALUES
  ('propostas-pdf', 'f0653000-0000-0000-0000-000000000001.pdf'),
  ('propostas-pdf', 'f0653000-0000-0000-0000-000000000002.pdf'),
  ('contratacoes-documentos', 'f0654000-0000-0000-0000-000000000001/cpf_a.pdf'),
  ('contratacoes-documentos', 'f0654000-0000-0000-0000-000000000002/cpf_b.pdf');

SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM pg_temp.assert_count($q$SELECT count(*) FROM storage.objects WHERE bucket_id IN ('propostas-pdf','contratacoes-documentos')$q$, 0, 'anon private storage');
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f0652000-0000-0000-0000-000000000001', true);
SELECT pg_temp.assert_count($q$SELECT count(*) FROM storage.objects WHERE bucket_id='propostas-pdf'$q$, 1, 'viewer A proposal own only');
SELECT pg_temp.assert_count($q$SELECT count(*) FROM storage.objects WHERE bucket_id='contratacoes-documentos'$q$, 1, 'viewer A documents own only');

SELECT set_config('request.jwt.claim.sub', 'f0652000-0000-0000-0000-000000000002', true);
SELECT pg_temp.assert_count($q$SELECT count(*) FROM storage.objects WHERE bucket_id='propostas-pdf'$q$, 1, 'admin A proposal own only');
SELECT pg_temp.assert_count($q$SELECT count(*) FROM storage.objects WHERE bucket_id='contratacoes-documentos'$q$, 1, 'admin A documents own only');
INSERT INTO storage.objects (bucket_id, name) VALUES ('contratacoes-documentos', 'f0654000-0000-0000-0000-000000000001/admin_a.pdf');
SELECT pg_temp.assert_error($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('contratacoes-documentos', 'f0654000-0000-0000-0000-000000000002/admin_a_cross.pdf')$q$, 'admin A cross-tenant upload');

RESET ROLE;
ROLLBACK;

SELECT 'PASS' AS resultado, 'Storage privado: anon bloqueado; tenant A isolado de B; viewer leitura; admin escrita própria' AS matriz;

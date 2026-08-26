-- 104 — Flexibilização do check constraint de participantes comerciais (aceita e-mail ou CPF além de telefone/whatsapp/usuario_id)
BEGIN;

ALTER TABLE public.participantes_comerciais
  DROP CONSTRAINT IF EXISTS participantes_comerciais_contato_chk,
  DROP CONSTRAINT IF EXISTS participantes_comerciais_contato_ou_usuario_chk,
  ADD CONSTRAINT participantes_comerciais_contato_ou_usuario_chk CHECK (
    usuario_id IS NOT NULL
    OR NULLIF(trim(coalesce(telefone, '')), '') IS NOT NULL
    OR NULLIF(trim(coalesce(whatsapp, '')), '') IS NOT NULL
    OR NULLIF(trim(coalesce(email, '')), '') IS NOT NULL
    OR NULLIF(trim(coalesce(cpf, '')), '') IS NOT NULL
  );

COMMIT;

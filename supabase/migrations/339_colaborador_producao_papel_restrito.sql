-- Perfil exclusivo do app: sem permissões internas de ERP ou financeiras.
-- Nenhum usuário existente é alterado e não são concedidas permissões.
BEGIN;
INSERT INTO public.papeis (empresa_id,codigo,nome,descricao,escopo,ativo)
SELECT NULL,'colaborador_producao','Colaborador — somente produção',
       'App de indicações: produção própria, etapas do funil e valor fechado. Sem acesso financeiro ou ERP.', 'COMPANY',true
WHERE NOT EXISTS (SELECT 1 FROM public.papeis WHERE empresa_id IS NULL AND codigo='colaborador_producao');
COMMIT;

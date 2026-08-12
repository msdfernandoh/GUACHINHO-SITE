-- 070 — Governança da Plataforma SaaS Master. Não altera runtime tenant.
BEGIN;

CREATE TABLE public.site_modelos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text NOT NULL UNIQUE, nome text NOT NULL,
 descricao text, status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN('RASCUNHO','PUBLICADO','INATIVO')),
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0), campos_tenant_permitidos jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.empresa_site_modelos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE RESTRICT,
 modelo_id uuid NOT NULL REFERENCES public.site_modelos(id) ON DELETE RESTRICT, status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN('RASCUNHO','PUBLICADO','SUSPENSO')),
 configuracao_platform jsonb NOT NULL DEFAULT '{}', configuracao_tenant jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_modulos_catalogo (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text NOT NULL UNIQUE, nome text NOT NULL, descricao text,
 status text NOT NULL DEFAULT 'ATIVO' CHECK(status IN('ATIVO','INATIVO')), estado_produto text NOT NULL DEFAULT 'PRODUCAO' CHECK(estado_produto IN('BETA','PRODUCAO')),
 ordem_padrao integer NOT NULL DEFAULT 0, dependencias text[] NOT NULL DEFAULT '{}', observacao text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.saas_planos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text NOT NULL UNIQUE, nome text NOT NULL, descricao text,
 status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN('RASCUNHO','ATIVO','INATIVO')),
 valor_mensal numeric(15,2), taxa_implantacao numeric(15,2), limite_usuarios integer,
 recursos jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valor_mensal IS NULL OR valor_mensal>=0), CHECK(taxa_implantacao IS NULL OR taxa_implantacao>=0), CHECK(limite_usuarios IS NULL OR limite_usuarios>0)
);
CREATE TABLE public.saas_plano_modulos (
 plano_id uuid NOT NULL REFERENCES public.saas_planos(id) ON DELETE RESTRICT,
 modulo_id uuid NOT NULL REFERENCES public.erp_modulos_catalogo(id) ON DELETE RESTRICT,
 habilitado boolean NOT NULL DEFAULT true, limites jsonb NOT NULL DEFAULT '{}', PRIMARY KEY(plano_id,modulo_id)
);
CREATE TABLE public.saas_assinaturas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 plano_id uuid NOT NULL REFERENCES public.saas_planos(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN('RASCUNHO','ATIVA','SUSPENSA','CANCELADA')),
 data_inicio date, valor_mensal numeric(15,2), taxa_implantacao numeric(15,2), proximo_vencimento date,
 condicao_comercial text, observacao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valor_mensal IS NULL OR valor_mensal>=0), CHECK(taxa_implantacao IS NULL OR taxa_implantacao>=0)
);
CREATE UNIQUE INDEX saas_assinaturas_empresa_ativa_uidx ON public.saas_assinaturas(empresa_id) WHERE status='ATIVA';
CREATE TABLE public.saas_empresa_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 recurso_codigo text NOT NULL, efeito text NOT NULL CHECK(efeito IN('LIBERAR','BLOQUEAR')), motivo text NOT NULL,
 vigencia_inicio date NOT NULL DEFAULT current_date, vigencia_fim date, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(vigencia_fim IS NULL OR vigencia_fim>=vigencia_inicio)
);
CREATE TABLE public.plataforma_configuracoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chave text NOT NULL UNIQUE, descricao text, valor jsonb NOT NULL DEFAULT '{}',
 ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.plataforma_auditoria (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
 acao text NOT NULL, entidade_tipo text NOT NULL, entidade_id uuid, campos_alterados jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.registrar_auditoria_platform() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb; o jsonb; uid uuid; changed jsonb:='[]'; BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; o:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END;
 SELECT u.id INTO uid FROM public.usuarios u WHERE u.auth_user_id=auth.uid() LIMIT 1;
 IF TG_OP='UPDATE' THEN SELECT coalesce(jsonb_agg(k ORDER BY k),'[]') INTO changed FROM jsonb_each(r)e(k,v) WHERE v IS DISTINCT FROM o->k; END IF;
 INSERT INTO public.plataforma_auditoria(usuario_id,acao,entidade_tipo,entidade_id,campos_alterados) VALUES(uid,lower(TG_OP),TG_TABLE_NAME,nullif(r->>'id','')::uuid,changed);
 RETURN coalesce(NEW,OLD); END $$;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['site_modelos','empresa_site_modelos','erp_modulos_catalogo','saas_planos','saas_plano_modulos','saas_assinaturas','saas_empresa_overrides','plataforma_configuracoes','plataforma_auditoria'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
 EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_superadmin())',t||'_platform_select',t);
 EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin())',t||'_platform_insert',t);
 EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin())',t||'_platform_update',t);
 END LOOP; END $$;
REVOKE INSERT,UPDATE ON public.plataforma_auditoria FROM authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['site_modelos','empresa_site_modelos','erp_modulos_catalogo','saas_planos','saas_plano_modulos','saas_assinaturas','saas_empresa_overrides','plataforma_configuracoes'] LOOP
 EXECUTE format('CREATE TRIGGER trg_auditoria_platform AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_platform()',t);
 END LOOP; END $$;

INSERT INTO public.site_modelos(codigo,nome,descricao,status,campos_tenant_permitidos)
VALUES('gauchinho_default','Gauchinho Default','Modelo atual da primeira tenant; cadastro de governança, sem troca de runtime.','PUBLICADO','["logo","cores","textos","imagens","contatos","redes_sociais"]') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO public.empresa_site_modelos(empresa_id,modelo_id,status)
SELECT e.id,m.id,'PUBLICADO' FROM public.empresas e CROSS JOIN public.site_modelos m WHERE e.slug='gauchinho' AND m.codigo='gauchinho_default' ON CONFLICT(empresa_id) DO NOTHING;
INSERT INTO public.erp_modulos_catalogo(codigo,nome,ordem_padrao,dependencias) VALUES
('painel','Painel',10,'{}'),('leads','Leads / CRM',20,'{}'),('propostas','Propostas',30,ARRAY['leads']),('contratacoes','Contratações',40,ARRAY['propostas']),('vendas','Vendas e Cotas',50,ARRAY['contratacoes']),('grupos','Grupos operacional',60,'{}'),('comissoes','Comissões',70,ARRAY['vendas']),('financeiro','Financeiro e Caixa',80,ARRAY['comissoes']),('relatorios','Relatórios',90,'{}'),('metas','Metas',100,'{}'),('tarefas','Tarefas',110,'{}'),('usuarios','Usuários',120,'{}') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO public.saas_planos(codigo,nome,descricao,status) VALUES
('plano_1','PLANO 1','Estrutura comercial aguardando definição de preço e entitlements.','RASCUNHO'),('plano_2','PLANO 2','Estrutura comercial aguardando definição de preço e entitlements.','RASCUNHO'),('plano_3','PLANO 3','Estrutura comercial aguardando definição de preço e entitlements.','RASCUNHO') ON CONFLICT(codigo) DO NOTHING;

COMMIT;

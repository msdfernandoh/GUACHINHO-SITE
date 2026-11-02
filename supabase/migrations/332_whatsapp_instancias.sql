-- Expansão forward-only: apps globais, modelos e N instâncias por empresa.
-- Não remove conexões/mensagens legadas. Segredos só podem ser lidos por service_role.
BEGIN;
INSERT INTO public.erp_modulos_catalogo(codigo,nome,descricao,status,estado_produto,categoria)
VALUES ('whatsapp','WhatsApp','Atendimento e campanhas pela API oficial da Meta','ATIVO','PRODUCAO','CRM') ON CONFLICT(codigo) DO NOTHING;
CREATE TABLE public.whatsapp_apps_meta (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL CHECK(length(nome) BETWEEN 2 AND 120),
 app_id text NOT NULL UNIQUE CHECK(app_id ~ '^[0-9]{5,30}$'), app_secret_cifrado text,
 config_id text, graph_version text NOT NULL DEFAULT 'v26.0' CHECK(graph_version ~ '^v[0-9]{2}\.[0-9]+$'),
 webhook_verify_token_cifrado text, dominio_conexao text NOT NULL, ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.whatsapp_instancia_modelos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text UNIQUE, nome text NOT NULL CHECK(length(nome) BETWEEN 2 AND 120), descricao text,
 modo text NOT NULL DEFAULT 'coexistencia' CHECK(modo IN ('coexistencia','cloud_api','meta_teste')),
 coexistencia boolean NOT NULL DEFAULT true, permite_templates boolean NOT NULL DEFAULT true, permite_atendimento boolean NOT NULL DEFAULT true,
 limite_mensagens_mes integer CHECK(limite_mensagens_mes > 0), ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(coexistencia = (modo = 'coexistencia'))
);
INSERT INTO public.whatsapp_instancia_modelos(codigo,nome,descricao,modo,coexistencia) VALUES
 ('atendimento_campanhas','Atendimento + Campanhas','Número da franquia no WhatsApp Business com coexistência.','coexistencia',true),
 ('meta_teste','Teste Meta — demonstração','Número de teste fornecido pela Meta; credenciais no SaaS, sem QR.','meta_teste',false),
 ('cloud_api','Cloud API','Número exclusivo da API oficial, sem coexistência.','cloud_api',false);
CREATE TABLE public.whatsapp_instancias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 app_meta_id uuid REFERENCES public.whatsapp_apps_meta(id) ON DELETE RESTRICT,
 modelo_id uuid NOT NULL REFERENCES public.whatsapp_instancia_modelos(id) ON DELETE RESTRICT,
 nome text NOT NULL CHECK(length(nome) BETWEEN 2 AND 120), numero_celular text CHECK(numero_celular ~ '^\+[1-9][0-9]{7,14}$'),
 waba_id text, phone_number_id text, numero_exibicao text, verified_name text, token_cifrado text, token_expira_em timestamptz,
 coexistencia boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'aguardando_conexao' CHECK(status IN ('aguardando_conexao','conectado','erro','desconectado','suspenso')),
 ultimo_erro text, alerta_numero text, conectado_por_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
 conectado_em timestamptz, destinatarios_teste text[] NOT NULL DEFAULT '{}', ativo boolean NOT NULL DEFAULT true,
 revisao integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,id)
);
CREATE UNIQUE INDEX whatsapp_instancias_phone_unico ON public.whatsapp_instancias(phone_number_id) WHERE phone_number_id IS NOT NULL;
CREATE INDEX whatsapp_instancias_empresa_idx ON public.whatsapp_instancias(empresa_id,created_at);
-- IDs preservados: conexao_id continua apontando ao registro original.
INSERT INTO public.whatsapp_instancias(id,empresa_id,modelo_id,nome,numero_celular,waba_id,phone_number_id,numero_exibicao,verified_name,token_cifrado,token_expira_em,coexistencia,status,ultimo_erro,conectado_por_id,conectado_em,created_at,updated_at)
SELECT c.id,c.empresa_id,m.id,'Conexão migrada',
 CASE WHEN regexp_replace(c.numero_exibicao,'[^0-9]','','g') ~ '^[1-9][0-9]{7,14}$' THEN '+' || regexp_replace(c.numero_exibicao,'[^0-9]','','g') END,
 c.waba_id,c.phone_number_id,c.numero_exibicao,c.verified_name,c.token_cifrado,c.token_expira_em,c.coexistencia,
 CASE c.status WHEN 'pausado' THEN 'suspenso' ELSE c.status END,c.ultimo_erro,c.conectado_por_id,c.created_at,c.created_at,c.updated_at
FROM public.empresa_whatsapp_conexoes c JOIN public.whatsapp_instancia_modelos m ON m.codigo=CASE WHEN c.coexistencia THEN 'atendimento_campanhas' ELSE 'cloud_api' END;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN instancia_id uuid;
UPDATE public.whatsapp_mensagens m SET instancia_id=i.id FROM public.whatsapp_instancias i WHERE i.id=m.conexao_id AND i.empresa_id=m.empresa_id;
ALTER TABLE public.whatsapp_mensagens ADD CONSTRAINT whatsapp_mensagens_instancia_empresa_fk FOREIGN KEY(empresa_id,instancia_id) REFERENCES public.whatsapp_instancias(empresa_id,id) ON DELETE RESTRICT;
-- UNIQUE completo permite ON CONFLICT(wa_message_id), mantendo múltiplos NULLs.
CREATE UNIQUE INDEX whatsapp_mensagens_wamid_upsert ON public.whatsapp_mensagens(wa_message_id);
CREATE INDEX whatsapp_mensagens_instancia_data ON public.whatsapp_mensagens(empresa_id,instancia_id,criada_em DESC);
CREATE TABLE public.whatsapp_conexao_tentativas (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL, instancia_id uuid NOT NULL, usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 expira_em timestamptz NOT NULL, consumido_em timestamptz,
 FOREIGN KEY(empresa_id,instancia_id) REFERENCES public.whatsapp_instancias(empresa_id,id) ON DELETE RESTRICT
);
-- RLS e privilégios: Postgres RLS não protege colunas; revogar SELECT de tabela antes dos grants de colunas.
ALTER TABLE public.whatsapp_apps_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instancia_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conexao_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_apps_meta, public.whatsapp_instancia_modelos, public.whatsapp_instancias, public.whatsapp_conexao_tentativas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_apps_meta, public.whatsapp_instancia_modelos, public.whatsapp_instancias, public.whatsapp_conexao_tentativas TO service_role;
GRANT SELECT(id,empresa_id,app_meta_id,modelo_id,nome,numero_celular,waba_id,phone_number_id,numero_exibicao,verified_name,token_expira_em,coexistencia,status,ultimo_erro,alerta_numero,conectado_em,ativo,created_at,updated_at) ON public.whatsapp_instancias TO authenticated;
GRANT SELECT ON public.whatsapp_instancia_modelos TO authenticated;
CREATE POLICY whatsapp_instancias_select ON public.whatsapp_instancias FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id) OR (SELECT public.is_platform_superadmin()));
CREATE POLICY whatsapp_modelos_select ON public.whatsapp_instancia_modelos FOR SELECT TO authenticated USING((SELECT public.is_platform_superadmin()) OR EXISTS(SELECT 1 FROM public.whatsapp_instancias i WHERE i.modelo_id=whatsapp_instancia_modelos.id AND public.can_read_tenant_internal(i.empresa_id)));
-- Fechar exposição legada de tokens e escritas diretas de histórico.
REVOKE ALL ON public.empresa_whatsapp_conexoes FROM PUBLIC, anon, authenticated;
GRANT SELECT(id,empresa_id,waba_id,phone_number_id,numero_exibicao,verified_name,token_tipo,token_expira_em,coexistencia,status,ultimo_erro,created_at,updated_at) ON public.empresa_whatsapp_conexoes TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.whatsapp_mensagens FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.empresa_whatsapp_conexoes,public.whatsapp_mensagens TO service_role;
-- Auditoria existente registra somente nomes de campos; nunca valores de credenciais.
CREATE TRIGGER whatsapp_apps_meta_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_apps_meta FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_platform();
CREATE TRIGGER whatsapp_modelos_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_instancia_modelos FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_platform();
CREATE TRIGGER whatsapp_instancias_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_instancias FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_platform();
-- Status monotônico: retry/out-of-order não regride read/delivered para sent.
CREATE FUNCTION public.whatsapp_atualizar_status(p_empresa uuid,p_instancia uuid,p_wamid text,p_status text,p_erro text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 UPDATE public.whatsapp_mensagens SET status=p_status,erro=p_erro WHERE empresa_id=p_empresa AND instancia_id=p_instancia AND wa_message_id=p_wamid AND direcao='enviada'
 AND p_status IN('sent','delivered','read','failed') AND (status IS NULL OR status='accepted' OR status='pending' OR (status='sent' AND p_status IN('delivered','read','failed')) OR (status='delivered' AND p_status='read'));
$$;
REVOKE ALL ON FUNCTION public.whatsapp_atualizar_status(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_atualizar_status(uuid,uuid,text,text,text) TO service_role;
-- Ativa/desativa só whatsapp, com lock e preservação das demais configurações.
CREATE FUNCTION public.rpc_platform_whatsapp_modulo(p_empresa uuid,p_habilitar boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; e jsonb; m jsonb; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Acesso restrito à Platform'; END IF;
 SELECT coalesce(configuracoes,'{}') INTO c FROM public.empresas WHERE id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Empresa inexistente'; END IF;
 e:=coalesce(c->'erp_sistema',jsonb_build_object('habilitado',c->'erp_habilitado','modulos',coalesce(c->'modulos_erp_selecionados','[]'::jsonb)));
 IF coalesce((e->>'habilitado')::boolean,false)=false THEN RAISE EXCEPTION 'Habilite o ERP na franquia antes de liberar WhatsApp'; END IF;
 SELECT coalesce(jsonb_agg(v),'[]') INTO m FROM jsonb_array_elements_text(coalesce(e->'modulos','[]')) t(v) WHERE v<>'whatsapp';
 IF p_habilitar THEN m:=m || '["whatsapp"]'::jsonb; END IF;
 UPDATE public.empresas SET configuracoes=jsonb_set(c,'{erp_sistema}',jsonb_set(e,'{modulos}',m)),updated_at=now() WHERE id=p_empresa;
 INSERT INTO public.plataforma_auditoria(usuario_id,acao,entidade_tipo,entidade_id,campos_alterados) VALUES(public.current_usuario_id(),'WHATSAPP_MODULO','empresas',p_empresa,'["erp_sistema.modulos.whatsapp"]');
END; $$;
REVOKE ALL ON FUNCTION public.rpc_platform_whatsapp_modulo(uuid,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_whatsapp_modulo(uuid,boolean) TO authenticated;
-- Reserva serializada por instância: limite mensal e reenvio idempotente.
CREATE FUNCTION public.whatsapp_reservar_envio(p_id uuid,p_empresa uuid,p_instancia uuid,p_usuario uuid,p_para text,p_tipo text,p_conteudo text,p_template text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE i record; m record; total bigint; BEGIN
 SELECT * INTO i FROM public.whatsapp_instancias WHERE id=p_instancia AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND OR NOT i.ativo OR i.status<>'conectado' OR i.token_cifrado IS NULL OR i.token_expira_em<=now() THEN RAISE EXCEPTION 'Instância indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.empresa_usuarios eu JOIN public.usuarios u ON u.id=eu.usuario_id WHERE eu.empresa_id=p_empresa AND eu.usuario_id=p_usuario AND eu.ativo AND u.ativo) THEN RAISE EXCEPTION 'Vínculo inválido'; END IF;
 IF EXISTS(SELECT 1 FROM public.whatsapp_mensagens WHERE id=p_id) THEN RETURN false; END IF;
 SELECT * INTO m FROM public.whatsapp_instancia_modelos WHERE id=i.modelo_id;
 IF NOT m.ativo OR (p_tipo='text' AND NOT m.permite_atendimento) OR (p_tipo='template' AND NOT m.permite_templates) OR p_tipo NOT IN('text','template') THEN RAISE EXCEPTION 'Envio não permitido pelo modelo'; END IF;
 IF m.modo='meta_teste' AND NOT(p_para=ANY(i.destinatarios_teste)) THEN RAISE EXCEPTION 'Destinatário não autorizado para teste'; END IF;
 IF m.limite_mensagens_mes IS NOT NULL THEN
 SELECT count(*) INTO total FROM public.whatsapp_mensagens WHERE empresa_id=p_empresa AND instancia_id=p_instancia AND direcao='enviada' AND coalesce(status,'') NOT IN ('failed','reconciled') AND criada_em >= (date_trunc('month',now() AT TIME ZONE 'America/Cuiaba') AT TIME ZONE 'America/Cuiaba');
 IF total>=m.limite_mensagens_mes THEN RAISE EXCEPTION 'Limite mensal da instância atingido'; END IF;
 END IF;
 INSERT INTO public.whatsapp_mensagens(id,empresa_id,instancia_id,direcao,contato_numero,tipo,conteudo,template_nome,status) VALUES(p_id,p_empresa,p_instancia,'enviada',p_para,p_tipo,p_conteudo,p_template,'pending');RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.whatsapp_reservar_envio(uuid,uuid,uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_reservar_envio(uuid,uuid,uuid,uuid,text,text,text,text) TO service_role;
COMMIT;

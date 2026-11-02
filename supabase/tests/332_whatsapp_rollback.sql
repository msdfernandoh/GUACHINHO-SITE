-- Executar depois da migration em transação de homologação. Nada é apagado.
-- O wrapper deve iniciar BEGIN antes da migration (sem BEGIN/COMMIT) e terminar ROLLBACK.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename IN ('whatsapp_apps_meta','whatsapp_instancia_modelos','whatsapp_instancias','whatsapp_conexao_tentativas') AND NOT rowsecurity) THEN RAISE EXCEPTION 'RLS ausente'; END IF;
 IF has_column_privilege('authenticated','public.whatsapp_instancias','token_cifrado','SELECT') OR has_column_privilege('authenticated','public.empresa_whatsapp_conexoes','token_cifrado','SELECT') OR has_column_privilege('authenticated','public.whatsapp_apps_meta','app_secret_cifrado','SELECT') THEN RAISE EXCEPTION 'Credenciais expostas'; END IF;
 IF has_table_privilege('anon','public.whatsapp_instancias','SELECT') OR has_table_privilege('authenticated','public.whatsapp_mensagens','INSERT') THEN RAISE EXCEPTION 'Privilégios excessivos'; END IF;
 IF has_function_privilege('authenticated','public.whatsapp_reservar_envio(uuid,uuid,uuid,uuid,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC interna exposta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_instancia_modelos WHERE codigo='meta_teste' AND modo='meta_teste' AND coexistencia=false) THEN RAISE EXCEPTION 'Modelo de teste ausente'; END IF;
 IF EXISTS(SELECT 1 FROM public.empresa_whatsapp_conexoes c LEFT JOIN public.whatsapp_instancias i ON i.id=c.id AND i.empresa_id=c.empresa_id WHERE i.id IS NULL OR i.token_cifrado IS DISTINCT FROM c.token_cifrado OR i.phone_number_id IS DISTINCT FROM c.phone_number_id) THEN RAISE EXCEPTION 'Conexão legada não preservada'; END IF;
 IF EXISTS(SELECT 1 FROM public.whatsapp_mensagens m JOIN public.empresa_whatsapp_conexoes c ON c.id=m.conexao_id AND c.empresa_id=m.empresa_id WHERE m.instancia_id IS DISTINCT FROM c.id) THEN RAISE EXCEPTION 'Histórico não vinculado'; END IF;
END $$;

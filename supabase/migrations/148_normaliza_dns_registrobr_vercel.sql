-- 148: Corrige domínio raiz .com.br e padroniza o onboarding DNS Registro.br/Vercel.

BEGIN;

UPDATE public.empresa_dominios
SET dns_instrucoes = jsonb_set(
      COALESCE(dns_instrucoes, '{}'::jsonb),
      '{registros_esperados}',
      CASE
        WHEN tipo = 'SUBDOMINIO' THEN jsonb_build_array(
          jsonb_build_object('tipo', 'CNAME', 'host', valor, 'valor', 'cname.vercel-dns-0.com', 'origem', 'padrao_vercel')
        )
        ELSE jsonb_build_array(
          jsonb_build_object('tipo', 'A', 'host', '@', 'valor', '216.150.1.1', 'origem', 'padrao_vercel'),
          jsonb_build_object('tipo', 'CNAME', 'host', 'www', 'valor', 'cname.vercel-dns-0.com', 'origem', 'padrao_vercel')
        )
      END,
      true
    ) || jsonb_build_object(
      'nota',
      CASE
        WHEN tipo = 'SUBDOMINIO'
          THEN 'Mantenha o DNS principal e cadastre o CNAME em Configurar endereçamento.'
        ELSE 'No Registro.br, use ns1.vercel-dns.com e ns2.vercel-dns.com após o domínio ser aceito no projeto Vercel.'
      END
    ),
    ultima_mensagem_erro = CASE
      WHEN ultima_mensagem_erro = 'Sem permissão na API Vercel para este projeto.'
        THEN 'A credencial Vercel foi encontrada, mas o domínio ou projeto não está acessível. Confira se o domínio pertence a outro projeto e valide token, equipe e VERCEL_PROJECT_ID.'
      ELSE ultima_mensagem_erro
    END,
    updated_at = now();

-- Evidência operacional conferida no painel do projeto guachinho-site em 27/08/2026.
UPDATE public.empresa_dominios
SET status_vercel = 'ADICIONADO',
    ultima_mensagem_erro = NULL,
    updated_at = now()
WHERE lower(valor) = 'raconsorriso.com.br';

COMMIT;

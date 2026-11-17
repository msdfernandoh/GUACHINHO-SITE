-- 347 · QR impresso /qr/externo abre o check-in padrão do Encontro Método Herança Inteligente
-- (17/11/2026 19:30 em Sinop). O cadastro do Herança segue no link próprio (filhos.*).
-- O check-in SPL (Chaves para o Futuro) fica só em spl.raconsinop.com.br/evento.
-- Aplicado em produção em 17/11/2026.

BEGIN;

-- Herança: check-in conversacional padrão aberto agora.
UPDATE public.eventos
SET checkin_interativo_ativo = true, checkin_modo = 'ativo_agora'
WHERE slug = 'heranca-inteligente';

-- SPL sai do grupo de eventos externos (não disputa o /qr/externo); continua ativo.
UPDATE public.eventos SET tipo_checkin = 'evento' WHERE slug = 'chaves-para-o-futuro';

-- Vínculo manual do QR externo com o Herança até 18/11/2026 08:00 (Sinop).
UPDATE public.qr_codes_unicos_vinculos v SET ativo = false
FROM public.qr_codes_unicos q
WHERE q.id = v.qr_code_id AND q.slug = 'externo' AND v.ativo = true;

INSERT INTO public.qr_codes_unicos_vinculos (qr_code_id, evento_id, periodo_inicio, periodo_fim, ativo)
SELECT q.id, e.id, now(), '2026-11-18T12:00:00+00:00', true
FROM public.qr_codes_unicos q, public.eventos e
WHERE q.slug = 'externo' AND e.slug = 'heranca-inteligente';

COMMIT;

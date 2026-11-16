-- 346 · O QR impresso nos materiais é /qr/externo (evento externo ativo mais recente).
-- O check-in SPL "Chaves para o Futuro" passa a ser do tipo externo e o
-- "Sorteios e Oportunidades" é inativado para o QR abrir o cadastro do corretor.
-- Aplicado em produção em 16/11/2026. Reverter depois do evento reativando o
-- sorteios-e-oportunidades.
UPDATE public.eventos SET tipo_checkin = 'externo', updated_at = now() WHERE slug = 'chaves-para-o-futuro';
UPDATE public.eventos SET ativo = false WHERE slug = 'sorteios-e-oportunidades' AND ativo = true;

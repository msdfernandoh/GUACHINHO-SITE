-- Portfólio SPL: a imobiliária pode escolher o modelo de cada vendedor
-- ("POR_VENDEDOR"); o painel gera um convite assinado para cada modelo.
ALTER TABLE public.spl_imobiliarias DROP CONSTRAINT IF EXISTS spl_imobiliarias_modelo_vendedores_check;
ALTER TABLE public.spl_imobiliarias ADD CONSTRAINT spl_imobiliarias_modelo_vendedores_check CHECK (
  modelo_vendedores IN ('PROPRIO', 'GERADOR_NEGOCIOS', 'GERADOR_OPORTUNIDADES', 'POR_VENDEDOR')
);

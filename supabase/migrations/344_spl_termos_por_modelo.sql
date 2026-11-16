-- Portfólio SPL: endereço da imobiliária, usado na qualificação do termo de parceria.
-- Os termos por modelo (Parceiro Indicador, Parceiro de Negócio, Microfranquia) vêm das
-- minutas da rede e ficam no código (lib/spl/termos-padrao.json) até o master publicar
-- uma versão própria em Admin › Portfólio SPL (configuracoes_sistema 'spl_termos').
ALTER TABLE public.spl_imobiliarias ADD COLUMN IF NOT EXISTS endereco text;

-- 064 — Retenção de histórico comercial, financeiro e de auditoria.
--
-- Fatos históricos não podem desaparecer por exclusão administrativa de
-- empresa, venda ou lançamento pai. Este ajuste é forward-only e não altera
-- dados nem snapshots; apenas transforma cascades destrutivos em RESTRICT.

BEGIN;

-- Tenant → histórico operacional/comercial/financeiro/auditoria
ALTER TABLE public.contratacoes_online
  DROP CONSTRAINT IF EXISTS contratacoes_online_empresa_id_fkey,
  ADD CONSTRAINT contratacoes_online_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_empresa_id_fkey,
  ADD CONSTRAINT vendas_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.cotas_definitivas
  DROP CONSTRAINT IF EXISTS cotas_definitivas_empresa_id_fkey,
  ADD CONSTRAINT cotas_definitivas_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_previsoes_franquia
  DROP CONSTRAINT IF EXISTS comissao_previsoes_franquia_empresa_id_fkey,
  ADD CONSTRAINT comissao_previsoes_franquia_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_previsoes_participantes
  DROP CONSTRAINT IF EXISTS comissao_previsoes_participantes_empresa_id_fkey,
  ADD CONSTRAINT comissao_previsoes_participantes_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_recebimentos
  DROP CONSTRAINT IF EXISTS financeiro_recebimentos_empresa_id_fkey,
  ADD CONSTRAINT financeiro_recebimentos_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_pagamentos
  DROP CONSTRAINT IF EXISTS financeiro_pagamentos_empresa_id_fkey,
  ADD CONSTRAINT financeiro_pagamentos_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_compensacoes
  DROP CONSTRAINT IF EXISTS financeiro_compensacoes_empresa_id_fkey,
  ADD CONSTRAINT financeiro_compensacoes_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.caixa_movimentos
  DROP CONSTRAINT IF EXISTS caixa_movimentos_empresa_id_fkey,
  ADD CONSTRAINT caixa_movimentos_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.audit_logs_central
  DROP CONSTRAINT IF EXISTS audit_logs_central_empresa_id_fkey,
  ADD CONSTRAINT audit_logs_central_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

-- Gestão também compõe histórico do tenant.
ALTER TABLE public.equipes
  DROP CONSTRAINT IF EXISTS equipes_empresa_id_fkey,
  ADD CONSTRAINT equipes_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.metas_comerciais
  DROP CONSTRAINT IF EXISTS metas_comerciais_empresa_id_fkey,
  ADD CONSTRAINT metas_comerciais_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.tarefas_gestao
  DROP CONSTRAINT IF EXISTS tarefas_gestao_empresa_id_fkey,
  ADD CONSTRAINT tarefas_gestao_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

-- Pai histórico → detalhe histórico.
ALTER TABLE public.cotas_definitivas
  DROP CONSTRAINT IF EXISTS cotas_definitivas_venda_id_fkey,
  ADD CONSTRAINT cotas_definitivas_venda_id_fkey
    FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_previsoes_franquia
  DROP CONSTRAINT IF EXISTS comissao_previsoes_franquia_venda_id_fkey,
  ADD CONSTRAINT comissao_previsoes_franquia_venda_id_fkey
    FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_previsoes_participantes
  DROP CONSTRAINT IF EXISTS comissao_previsoes_participantes_venda_id_fkey,
  ADD CONSTRAINT comissao_previsoes_participantes_venda_id_fkey
    FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_recebimento_itens
  DROP CONSTRAINT IF EXISTS financeiro_recebimento_itens_recebimento_id_fkey,
  ADD CONSTRAINT financeiro_recebimento_itens_recebimento_id_fkey
    FOREIGN KEY (recebimento_id) REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_pagamento_itens
  DROP CONSTRAINT IF EXISTS financeiro_pagamento_itens_pagamento_id_fkey,
  ADD CONSTRAINT financeiro_pagamento_itens_pagamento_id_fkey
    FOREIGN KEY (pagamento_id) REFERENCES public.financeiro_pagamentos(id) ON DELETE RESTRICT;

COMMIT;

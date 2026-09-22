-- Restaura a regra de 12,5% de Imóvel inativada durante o diagnóstico visual.
-- As linhas de Imóvel e Veículo não são duplicatas: o motor resolve uma regra
-- homologada por programa da franqueadora.
update public.comissao_regras_participantes r
set ativa=true,status='HOMOLOGADA',updated_at=now()
where r.id='cf94cc66-d1c0-4fd2-bf31-1a077109a1ba'::uuid
  and r.perfil_id='de0a0e63-62a8-4b14-ac8f-6a0f900d01c7'::uuid
  and r.programa_id='0957ed7d-961a-432a-bb9d-de3a2b223984'::uuid
  and r.percentual_comissao=12.5;

notify pgrst, 'reload schema';

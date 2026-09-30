-- Habilita o cadastro do programa de indicação no tenant Racon Sorriso.
-- Perfis identificam funções comerciais; esta migration deliberadamente não
-- inventa percentuais nem cria regras financeiras sem homologação.
begin;

do $$
declare
  v_empresa_id uuid;
begin
  select id into strict v_empresa_id
  from public.empresas
  where id = '3b5d14ec-6e0f-4f8e-952a-75adbfaa0949'::uuid
    and slug = 'sorriso'
    and ativo;

  insert into public.comissao_perfis (
    empresa_id,
    nome,
    descricao,
    papel_base,
    ativo
  ) values
    (
      v_empresa_id,
      'Indicador',
      'Perfil canônico para cadastro público de indicadores da unidade Sorriso.',
      'INDICADOR',
      true
    ),
    (
      v_empresa_id,
      'Gerador de Oportunidades',
      'Perfil canônico para parceiros geradores de oportunidades da unidade Sorriso.',
      'SDR',
      true
    )
  on conflict (empresa_id, nome) do update
  set papel_base = excluded.papel_base,
      descricao = excluded.descricao,
      ativo = true,
      updated_at = now();
end $$;

commit;

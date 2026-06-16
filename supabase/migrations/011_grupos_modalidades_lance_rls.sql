-- Corrige RLS de grupos_modalidades_lance: perfis do app são minúsculos (master, srd).

drop policy if exists "grupos_modalidades_lance_staff_all" on public.grupos_modalidades_lance;

create policy "grupos_modalidades_lance_staff_all"
  on public.grupos_modalidades_lance
  for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd')
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd')
    )
  );

-- Gauchinho — usuário Master: Fernando (msdfernando@gmail.com)
-- Pré-requisito: migration 001_initial_schema.sql já aplicada.
--
-- Como usar: Supabase Dashboard → SQL → New query → colar este arquivo → Run.
--
-- ATENÇÃO: a senha aparece em texto claro neste script. Não publique em repositório
-- público; após rodar, troque a senha no Dashboard se o arquivo ficou exposto.
--
-- Se o login falhar após rodar só o SQL, crie o usuário manualmente:
--   Authentication → Users → Add user → e-mail abaixo, senha 159753, Auto Confirm User
-- e execute apenas o bloco "Vincular public.usuarios" no final deste arquivo.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Auth: auth.users + auth.identities (somente se o e-mail ainda não existir)
-- ---------------------------------------------------------------------------
do $$
declare
  v_email constant text := 'msdfernando@gmail.com';
  v_senha constant text := '159753';
  v_nome constant text := 'FERNANDO';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_senha, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', v_nome),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Vincular public.usuarios (perfil master)
-- ---------------------------------------------------------------------------
insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
select id, 'FERNANDO', email, 'master', true
from auth.users
where lower(email) = lower('msdfernando@gmail.com')
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      nome = excluded.nome,
      perfil = 'master',
      ativo = true;

-- Conferência (opcional):
-- select u.email, u.email_confirmed_at, p.nome, p.perfil, p.ativo
-- from auth.users u
-- join public.usuarios p on p.auth_user_id = u.id
-- where lower(u.email) = lower('msdfernando@gmail.com');

-- Fase 9 — Conteúdo, prova social, FAQ e parceiros institucionais
-- (009 reservado a ia_conversas no repositório)

-- ---------------------------------------------------------------------------
-- casos_sucesso
-- ---------------------------------------------------------------------------
create table if not exists public.casos_sucesso (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  categoria text,
  nome_cliente text,
  cidade text,
  estado text,
  tipo_objetivo text,
  valor_credito numeric(15, 2),
  descricao_curta text,
  conteudo text,
  imagem_url text,
  video_url text,
  destaque boolean not null default false,
  publicado boolean not null default false,
  ordem integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists casos_sucesso_publicado_idx on public.casos_sucesso (publicado, destaque, ordem);
create index if not exists casos_sucesso_slug_idx on public.casos_sucesso (slug);

-- ---------------------------------------------------------------------------
-- depoimentos
-- ---------------------------------------------------------------------------
create table if not exists public.depoimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  estado text,
  texto text not null,
  foto_url text,
  video_url text,
  nota integer check (nota is null or (nota >= 1 and nota <= 5)),
  tipo_interesse text,
  destaque boolean not null default false,
  publicado boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists depoimentos_publicado_idx on public.depoimentos (publicado, destaque, ordem);

-- ---------------------------------------------------------------------------
-- dicas_tche
-- ---------------------------------------------------------------------------
create table if not exists public.dicas_tche (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  categoria text,
  descricao_curta text,
  conteudo text,
  imagem_url text,
  video_url text,
  publicado boolean not null default false,
  destaque boolean not null default false,
  ordem integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dicas_tche_publicado_idx on public.dicas_tche (publicado, destaque, ordem);
create index if not exists dicas_tche_slug_idx on public.dicas_tche (slug);

-- ---------------------------------------------------------------------------
-- perguntas_frequentes
-- ---------------------------------------------------------------------------
create table if not exists public.perguntas_frequentes (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  categoria text,
  publicado boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faq_publicado_idx on public.perguntas_frequentes (publicado, ordem);

-- ---------------------------------------------------------------------------
-- parceiros (institucionais — distinto de imobiliárias)
-- ---------------------------------------------------------------------------
create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text,
  descricao text,
  logo_url text,
  site_url text,
  whatsapp text,
  cidade text,
  estado text,
  destaque boolean not null default false,
  publicado boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parceiros_publicado_idx on public.parceiros (publicado, destaque, ordem);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.casos_sucesso enable row level security;
alter table public.depoimentos enable row level security;
alter table public.dicas_tche enable row level security;
alter table public.perguntas_frequentes enable row level security;
alter table public.parceiros enable row level security;

-- Leitura anônima: apenas publicados
create policy casos_sucesso_public_read on public.casos_sucesso for select to anon
  using (publicado = true);

create policy depoimentos_public_read on public.depoimentos for select to anon
  using (publicado = true);

create policy dicas_tche_public_read on public.dicas_tche for select to anon
  using (publicado = true);

create policy faq_public_read on public.perguntas_frequentes for select to anon
  using (publicado = true);

create policy parceiros_public_read on public.parceiros for select to anon
  using (publicado = true);

-- Staff lê tudo; master/srd gerenciam
create policy casos_sucesso_staff on public.casos_sucesso for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy depoimentos_staff on public.depoimentos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy dicas_tche_staff on public.dicas_tche for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy faq_staff on public.perguntas_frequentes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy parceiros_staff on public.parceiros for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('conteudo', 'conteudo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]),
  ('depoimentos', 'depoimentos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]),
  ('parceiros', 'parceiros', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy conteudo_storage_public_read on storage.objects for select to public
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros'));

create policy conteudo_storage_staff_write on storage.objects for insert to authenticated
  with check (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());

create policy conteudo_storage_staff_update on storage.objects for update to authenticated
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());

create policy conteudo_storage_staff_delete on storage.objects for delete to authenticated
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());

-- FAQ institucional inicial (seguro — sem promessas)
insert into public.perguntas_frequentes (pergunta, resposta, categoria, publicado, ordem)
select * from (values
  (
    'O que é consórcio?'::text,
    'Consórcio é uma forma de compra planejada em grupo administrado por uma administradora. Você paga parcelas e, conforme as regras do grupo, pode ser contemplado por sorteio ou lance. Trata-se de simulação e orientação inicial até confirmação com especialista.'::text,
    'Consórcio'::text,
    true,
    10
  ),
  (
    'Qual a diferença entre consórcio e financiamento?'::text,
    'No consórcio você participa de um grupo e busca contemplação; no financiamento há contrato de crédito com análise bancária. Cada opção tem custos, prazos e exigências diferentes — use o simulador para estimativas e compare com orientação profissional.'::text,
    'Financiamento'::text,
    true,
    20
  ),
  (
    'O que é lance embutido?'::text,
    'Lance embutido é parte do lance que utiliza crédito da própria carta, conforme modalidade e regras do grupo. Os percentuais e limites variam — confirme sempre na simulação e com a administradora.'::text,
    'Lance'::text,
    true,
    30
  ),
  (
    'A contemplação é garantida?'::text,
    'Não. A contemplação em consórcio pode ocorrer por sorteio ou lance, conforme as regras do grupo e da administradora. Não existe garantia de contemplação em data específica. Analise prazo, lance e objetivo com um especialista.'::text,
    'Consórcio'::text,
    true,
    40
  ),
  (
    'O que é carta contemplada?'::text,
    'É uma cota já contemplada, oferecida conforme disponibilidade comercial. Condições, entrada e documentação devem ser confirmadas no momento do atendimento — sujeito à confirmação.'::text,
    'Cartas contempladas'::text,
    true,
    50
  ),
  (
    'Como funciona uma proposta personalizada?'::text,
    'Após simulação ou conversa comercial, montamos uma proposta em PDF com estimativas e dados informados. Valores finais dependem de confirmação com administradora, banco ou parceiros.'::text,
    'Atendimento'::text,
    true,
    60
  )
) as v(pergunta, resposta, categoria, publicado, ordem)
where not exists (select 1 from public.perguntas_frequentes limit 1);

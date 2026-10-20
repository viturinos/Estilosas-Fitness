-- ============================================================
-- Estilosas Fitness — schema do catálogo dinâmico (Supabase)
-- Rode este arquivo UMA vez no SQL Editor do seu projeto.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================

-- 1. Tabela de produtos -------------------------------------
create table if not exists public.products (
    id          uuid primary key default gen_random_uuid(),
    nome        text        not null,
    preco       numeric(10,2) not null,
    preco_de    numeric(10,2),
    categoria   text        not null,
    img_url     text        not null,
    alt         text        not null,
    tamanhos    text[]      not null,
    badge       text,
    ph          text,
    disponivel  boolean     not null default true,
    criado_em   timestamptz not null default now(),

    constraint products_nome_check      check (char_length(nome) between 1 and 120),
    constraint products_preco_check     check (preco >= 0),
    constraint products_preco_de_check  check (preco_de is null or preco_de > 0),
    constraint products_categoria_check check (char_length(categoria) between 1 and 60),
    constraint products_alt_check       check (char_length(alt) between 1 and 300),
    constraint products_badge_check     check (badge is null or char_length(badge) between 1 and 40),
    constraint products_tamanhos_check  check (cardinality(tamanhos) between 1 and 15),
    constraint products_ph_check        check (ph is null or ph ~ '^#[0-9A-Fa-f]{6}$'),
    constraint products_img_url_check   check (img_url like 'https://%/storage/v1/object/public/produtos/%')
);

create index if not exists products_criado_em_idx on public.products (criado_em);
create index if not exists products_categoria_idx on public.products (categoria);

-- 2. Row Level Security -------------------------------------
-- Leitura pública (catálogo). Escrita APENAS para usuário autenticado.
-- Para restringir a escrita a UM e-mail de administrador, rode
-- também supabase/seguranca-reforco.sql (veja as instruções nele).
alter table public.products enable row level security;
alter table public.products force row level security;

-- Endurecimento: anon não tem nenhuma permissão de escrita na tabela.
revoke insert, update, delete on public.products from anon;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "catalogo: leitura publica" on public.products;
create policy "catalogo: leitura publica" on public.products
    for select using (true);

drop policy if exists "catalogo: insercao autenticada" on public.products;
create policy "catalogo: insercao autenticada" on public.products
    for insert to authenticated with check (true);

drop policy if exists "catalogo: edicao autenticada" on public.products;
create policy "catalogo: edicao autenticada" on public.products
    for update to authenticated using (true) with check (true);

drop policy if exists "catalogo: remocao autenticada" on public.products;
create policy "catalogo: remocao autenticada" on public.products
    for delete to authenticated using (true);

-- 3. Bucket de imagens --------------------------------------
-- Leitura pública; escrita apenas autenticada.
-- Limites de 5 MB e tipos de imagem são ENFORÇADOS PELO SERVIDOR.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
    set public = true,
        file_size_limit = 5242880,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "produtos: leitura publica" on storage.objects;
create policy "produtos: leitura publica" on storage.objects
    for select using (bucket_id = 'produtos');

drop policy if exists "produtos: upload autenticado" on storage.objects;
create policy "produtos: upload autenticado" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'produtos'
        and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
    );

drop policy if exists "produtos: substituicao autenticada" on storage.objects;
create policy "produtos: substituicao autenticada" on storage.objects
    for update to authenticated
    using (bucket_id = 'produtos')
    with check (
        bucket_id = 'produtos'
        and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
    );

drop policy if exists "produtos: remocao autenticada" on storage.objects;
create policy "produtos: remocao autenticada" on storage.objects
    for delete to authenticated using (bucket_id = 'produtos');

-- 4. Tempo real ---------------------------------------------
-- Permite que o site seja avisado de INSERT/UPDATE/DELETE sem recarregar.
do $$
begin
    alter publication supabase_realtime add table public.products;
exception
    when duplicate_object then null;
    when undefined_object then null;
end $$;

-- 5. Conferência (mostra o que foi criado) ------------------
select
    (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'products')  as policies_produtos,
    (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'produtos:%')                      as policies_storage,
    (select public from storage.buckets where id = 'produtos')  as bucket_publico,
    (select file_size_limit from storage.buckets where id = 'produtos') as limite_bytes;

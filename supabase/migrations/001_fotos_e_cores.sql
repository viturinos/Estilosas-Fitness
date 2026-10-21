-- ============================================================
-- 001 · Fotos múltiplas e cores da peça
-- ------------------------------------------------------------
-- Objetivo:
--   - `imagens`: array jsonb com as URLs das fotos do produto, na
--     ordem de exibição. A primeira é a capa.
--   - `cores`: array jsonb com { "nome": "Preto", "hex": "#1F1420" }.
--   - `img_url` continua existindo e passa a ser SEMPRE igual a
--     imagens[0] (compatibilidade com a capa, o cache e o código
--     que já existia antes desta migração).
--
-- IMPORTANTE — RLS:
--   As policies do Supabase são por TABELA, não por coluna. As
--   colunas novas herdam automaticamente as mesmas permissões de
--   `products` (leitura pública para anon, escrita só para
--   authenticated/admin). NÃO é preciso mexer em policy, grant,
--   bucket ou publicação realtime nesta migração.
--
-- Como rodar:
--   1. Abra o SQL Editor do Supabase.
--   2. Cole ESTE arquivo inteiro e execute.
--   3. Só depois publique o código da fase (o `select` do site já
--      passa a pedir `imagens` e `cores`).
--
-- O arquivo é idempotente: pode rodar de novo sem quebrar nada.
-- O SQL Editor roda o script inteiro em UMA transação: se algo
-- falhar no meio, nada é gravado (basta corrigir e rodar de novo).
-- ============================================================


-- 1. Colunas novas ---------------------------------------------
alter table public.products
  add column if not exists imagens jsonb not null default '[]'::jsonb,
  add column if not exists cores   jsonb not null default '[]'::jsonb;


-- 2. Capa das peças que já existem -----------------------------
-- As peças cadastradas até aqui têm uma foto só (img_url).
-- Elas entram em `imagens` como lista de uma foto, para que a
-- galeria e a capa passem a ler do mesmo lugar.
update public.products
   set imagens = jsonb_build_array(img_url)
 where img_url is not null
   and img_url <> ''
   and imagens = '[]'::jsonb;


-- 3. Validação no banco ---------------------------------------
-- CHECK não aceita subconsulta, então a regra mora em funções
-- IMMUTABLE — o banco é a última linha de defesa: cliente
-- burlado não consegue gravar array inválido.
create or replace function public.produtos_imagens_ok(v jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
    item jsonb;
begin
    if v is null then return false; end if;
    if jsonb_typeof(v) <> 'array' then return false; end if;
    -- de 0 a 10 fotos: 0 só acontece em peça sem foto (o app exige
    -- pelo menos uma ao salvar; o banco só impede o excedente).
    if jsonb_array_length(v) > 10 then return false; end if;

    -- cada entrada precisa ser texto e URL do bucket `produtos`.
    -- Laço item a item de propósito: filtro de jsonpath invertido
    -- rejeitaria justamente as URLs boas.
    for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'string' then return false; end if;
        if (item #>> '{}') !~ '^https://[^/]+/storage/v1/object/public/produtos/.+$' then
            return false;
        end if;
    end loop;

    return true;
end;
$$;

create or replace function public.produtos_cores_ok(v jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
    item jsonb;
    nome text;
begin
    if v is null then return false; end if;
    if jsonb_typeof(v) <> 'array' then return false; end if;
    if jsonb_array_length(v) > 12 then return false; end if;

    for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' then return false; end if;

        nome := item ->> 'nome';
        if nome is null then return false; end if;
        if char_length(nome) < 1 or char_length(nome) > 24 then return false; end if;

        -- hex obrigatório, no formato #RRGGBB
        if coalesce(item ->> 'hex', '') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;

        -- nome repetido (ignorando maiúsculas) não entra
        if (select count(*) from jsonb_array_elements(v) x
             where lower(x ->> 'nome') = lower(nome)) > 1 then
            return false;
        end if;
    end loop;

    return true;
end;
$$;


-- 4. Conferência antes de apertar as regras --------------------
-- Se aparecer alguma linha aqui, é uma peça fora do padrão.
-- O passo 5 conserta sozinho; a lista serve de conferência.
select id, nome, img_url, imagens, cores
  from public.products
 where not public.produtos_imagens_ok(imagens)
    or not public.produtos_cores_ok(cores)
    or (imagens ->> 0) is distinct from img_url;


-- 5. Conserto das peças fora do padrão ------------------------
-- Reaproveita a capa que já existia e zera cores inválidas.
-- (Para as peças de hoje não muda nada: é o mesmo do passo 2.)
update public.products
   set imagens = jsonb_build_array(img_url)
 where not public.produtos_imagens_ok(imagens)
   and img_url is not null
   and img_url <> '';

update public.products
   set imagens = '[]'::jsonb
 where not public.produtos_imagens_ok(imagens);

update public.products
   set cores = '[]'::jsonb
 where not public.produtos_cores_ok(cores);

update public.products
   set img_url = imagens ->> 0
 where jsonb_array_length(imagens) > 0
   and (imagens ->> 0) is distinct from img_url;

update public.products
   set img_url = null
 where jsonb_array_length(imagens) = 0
   and img_url is not null;


-- 6. Constraints ----------------------------------------------
-- `drop ... if exists` antes de cada `add` deixa o arquivo
-- idempotente e permite ajustar a regra depois.
alter table public.products drop constraint if exists products_imagens_check;
alter table public.products drop constraint if exists products_cores_check;
alter table public.products drop constraint if exists products_capa_check;

alter table public.products
  add constraint products_imagens_check check (public.produtos_imagens_ok(imagens)),
  add constraint products_cores_check   check (public.produtos_cores_ok(cores)),
  -- a capa é sempre a primeira foto: (imagens->>0) e img_url são
  -- iguais, e peça sem foto tem os dois vazios.
  add constraint products_capa_check    check ((imagens ->> 0) is not distinct from img_url);


-- 7. Conferência final -----------------------------------------
-- Esperado: colunas_novas = 2, constraints_novas = 3,
-- capas_divergentes = 0 e invalidos = 0.
-- pecas_sem_foto = 0 é o esperado hoje (as peças cadastradas
-- têm foto); o banco tolera peça sem foto, o painel não.
select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'products'
        and column_name in ('imagens', 'cores'))                  as colunas_novas,
    (select count(*) from pg_constraint
      where conrelid = 'public.products'::regclass
        and conname in ('products_imagens_check',
                        'products_cores_check',
                        'products_capa_check'))                   as constraints_novas,
    (select count(*) from public.products
      where jsonb_array_length(imagens) = 0)                      as pecas_sem_foto,
    (select count(*) from public.products
      where imagens ->> 0 is distinct from img_url)               as capas_divergentes,
    (select count(*) from public.products
      where not public.produtos_imagens_ok(imagens)
         or not public.produtos_cores_ok(cores))                  as invalidos;

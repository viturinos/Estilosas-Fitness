-- ============================================================
-- 002 · Detalhes da peça, dois preços, ordem e configurações
-- ------------------------------------------------------------
-- Objetivo:
--   - `descricao`, `composicao`, `cuidados`: texto livre de cada
--     peça (opcional). Aparece na ficha da vitrine.
--   - `preco_cartao`: segundo preço da peça (opcional). `preco`
--     continua sendo o preço À VISTA (Pix ou dinheiro); quando
--     `preco_cartao` é nulo, cartão sai pelo mesmo valor.
--   - `ordem`: ordem manual das peças no índice (int).
--   - `settings`: tabela chave/valor com as configurações da loja
--     (WhatsApp, horário, faixa de avisos, peça em destaque e
--     link de contato).
--
-- IMPORTANTE — RLS:
--   `settings` é uma tabela nova, então PRECISA de policies e
--   grants próprios: leitura pública (o site lê), escrita só
--   para sessão autenticada (o painel grava). As colunas novas de
--   `products` herdam as policies que a tabela já tem.
--
-- Como rodar:
--   1. Abra o SQL Editor do Supabase.
--   2. Cole ESTE arquivo inteiro e execute.
--   3. Só depois publique o código da fase.
--
-- O arquivo é idempotente: pode rodar de novo sem quebrar nada.
-- O SQL Editor roda o script inteiro em UMA transação: se algo
-- falhar no meio, nada é gravado (basta corrigir e rodar de novo).
-- ============================================================


-- 1. Colunas novas de products ----------------------------------
alter table public.products
  add column if not exists descricao   text,
  add column if not exists composicao  text,
  add column if not exists cuidados   text,
  add column if not exists preco_cartao numeric(10,2),
  add column if not exists ordem       integer not null default 0;


-- 2. Conferência: peças fora do padrão antes de apertar as regras -
-- (Para as peças de hoje não muda nada: o preço de tabela e as
-- cores nunca ficaram sem a peça.)
select id, nome, preco, preco_de, preco_cartao
  from public.products
 where preco_cartao is not null
   and preco_cartao < preco;


-- 3. Conserto automático ----------------------------------------
-- Cartão nunca pode sair mais barato que o à vista: se alguém
-- cadastrou assim, o preço de cartão sobe para o preço à vista.
update public.products
   set preco_cartao = preco
 where preco_cartao is not null
   and preco_cartao < preco;


-- 4. Regras no banco --------------------------------------------
-- O banco é a última linha de defesa: cliente burlado não
-- consegue gravar texto gigante nem cartão mais barato que à vista.
alter table public.products drop constraint if exists products_descricao_check;
alter table public.products drop constraint if exists products_composicao_check;
alter table public.products drop constraint if exists products_cuidados_check;
alter table public.products drop constraint if exists products_preco_cartao_check;

alter table public.products
  add constraint products_descricao_check   check (char_length(coalesce(descricao, '')) <= 600),
  add constraint products_composicao_check  check (char_length(coalesce(composicao, '')) <= 200),
  add constraint products_cuidados_check   check (char_length(coalesce(cuidados, '')) <= 300),
  add constraint products_preco_cartao_check check (preco_cartao is null or preco_cartao >= preco);


-- 5. Ordem manual das peças -------------------------------------
-- O backfill preserva a ordem em que as peças já aparecem no site
-- (mais antiga primeiro): quem não mexe em nada continua vendo o
-- mesmo índice, e o painel passa a mandar na ordem a partir daqui.
--
-- Idempotente: só numera quando NENHUMA peça tem ordem ainda
-- (ordem = 0 em todas). Rodar o arquivo de novo não renumera nada
-- e não deixa duas peças com a mesma ordem.
update public.products p
   set ordem = sub.pos
  from (
      select id, row_number() over (order by criado_em asc, id asc) - 1 as pos
        from public.products
  ) sub
 where p.id = sub.id
   and p.ordem = 0
   and not exists (select 1 from public.products x where x.ordem > 0);

create index if not exists products_ordem_idx on public.products (ordem);


-- 6. Tabela de configurações da loja -----------------------------
-- chave/valor: uma configuração nova não pede migração.
create table if not exists public.settings (
    chave text primary key,
    valor jsonb not null,
    criado_em timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.settings force row level security;

grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;
-- O anônimo (o site público) nunca escreve configuração.
revoke insert, update, delete on public.settings from anon;

drop policy if exists "configuracoes: leitura publica" on public.settings;
create policy "configuracoes: leitura publica" on public.settings
    for select using (true);

drop policy if exists "configuracoes: insercao autenticada" on public.settings;
create policy "configuracoes: insercao autenticada" on public.settings
    for insert to authenticated with check (true);

drop policy if exists "configuracoes: edicao autenticada" on public.settings;
create policy "configuracoes: edicao autenticada" on public.settings
    for update to authenticated using (true) with check (true);

drop policy if exists "configuracoes: remocao autenticada" on public.settings;
create policy "configuracoes: remocao autenticada" on public.settings
    for delete to authenticated using (true);


-- 7. Conferência final -------------------------------------------
-- Esperado: colunas_novas = 5, settings_pronto = 1,
-- politicas_settings = 4, precos_invalidos = 0.
select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'products'
        and column_name in ('descricao', 'composicao', 'cuidados',
                            'preco_cartao', 'ordem'))                as colunas_novas,
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'settings')    as settings_pronto,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'settings')      as politicas_settings,
    (select count(*) from public.products
      where preco_cartao is not null and preco_cartao < preco)     as precos_invalidos,
    (select count(*) from public.products
      where char_length(coalesce(descricao, '')) > 600
         or char_length(coalesce(composicao, '')) > 200
         or char_length(coalesce(cuidados, '')) > 300)              as textos_grandes;

# Design — Catálogo dinâmico + painel admin (Supabase)

Data: 2026-10-19 · Status: aprovado pelo parceiro humano

## Objetivo

O site estático Estilosas Fitness (GitHub Pages, HTML/CSS/JS puro) ganha catálogo dinâmico em nuvem: um único administrador faz CRUD completo de produtos (foto, preço, tamanhos etc.) em `admin.html`, e visitantes com o site aberto veem qualquer mudança instantaneamente.

## Contexto e restrições

- Hospedagem: GitHub Pages → solução 100% client-side + BaaS.
- Backend: Supabase (Postgres, Auth, Storage, Realtime). Conta já existente.
- Sem etapa de build, sem npm. Caminhos relativos (subpasta de projeto).
- Escopo: CRUD completo · catálogo começa vazio · categorias livres · login e-mail/senha · **segurança em máxima prioridade**.
- Fora de escopo: checkout/pagamento, múltiplos admins, resize no servidor, CMS dos textos estáticos.

## Banco (Supabase)

Tabela `public.products`:

| Campo | Tipo | Regra |
|---|---|---|
| id | uuid | pk, `gen_random_uuid()` |
| nome | text | 1..120 chars, obrigatório |
| preco | numeric | `>= 0`, obrigatório |
| preco_de | numeric | `> 0`, opcional (preço riscado) |
| categoria | text | 1..60 chars, obrigatória, livre |
| img_url | text | obrigatório; precisa ser URL do bucket `produtos` |
| alt | text | 1..300 chars, obrigatório |
| tamanhos | text[] | 1..15 itens, obrigatório |
| badge | text | ≤ 40 chars, opcional |
| ph | text | cor `#RRGGBB` opcional (fundo da foto) |
| disponivel | boolean | default true |
| criado_em | timestamptz | default now() |

RLS ligado com FORCE. Policies: `SELECT` público; `INSERT/UPDATE/DELETE` somente `authenticated`.

Bucket `produtos`: público para leitura; `file_size_limit` 5 MB e `allowed_mime_types` jpeg/png/webp **enforçados pelo servidor**; escrita só autenticada, extensão do arquivo precisa estar na lista.

Realtime: tabela adicionada à publicação `supabase_realtime`.

## Segurança (requisito de primeira classe)

1. **Anti-XSS:** todo texto vindo do banco passa por `esc()` (entidades HTML) antes de qualquer `innerHTML`; `img_url` passa por `validarImgUrl()` (só prefixo do bucket público) antes de virar `src`.
2. **CSP via meta** (GitHub Pages não permite headers custom): `script-src 'self' https://cdn.jsdelivr.net`; `connect-src`/img apenas domínio `<ref>.supabase.co`; `style-src` self + inline + Google Fonts; `font-src fonts.gstatic.com`; `object-src 'none'`; `base-uri 'self'`. Sem scripts inline no HTML.
3. **Upload blindado nos dois lados:** validação client (tipo, ≤5 MB, recompressão webp) + limites do bucket no servidor; nome de arquivo gerado pelo app (`<uuid>.webp`), nunca nome do usuário.
4. **Auth:** session guard no painel, sign-out, reação a expiração; rate-limit de login do próprio GoTrue; erro de login genérico.
5. **Validação também no banco** (constraints): cliente burlado não corrompe dado; erro vira mensagem amigável.
6. **Zero segredos no repo:** `config.js` só URL + anon key (públicas por design); `service_role` nunca no front.
7. **Sacola localStorage:** schema validado com uuid; entradas antigas descartadas em silêncio.

## Site público

- `script.js` remove o array fixo; `carregarCatalogo()` lê cache local (`catalogo_v1`) e depois o banco; `assinarTempoReal()` reage a INSERT/UPDATE/DELETE com re-render de catálogo, filtros e capa.
- Categorias ordenadas por primeira aparição no banco; linha "Destaques" = produtos com badge.
- Estados: carregando → vazio ("Nenhuma peça no índice ainda") → conteúdo; capa com fallback se catálogo vazio; degradação com cache se a rede cair.

## Painel admin

- `admin.html` + `admin.js` + `admin.css`: login (Supabase Auth) → lista (miniatura, nome, preço, badge, disponível, editar/excluir) → formulário: nome*, preço*, preço "de", categoria* (datalist), foto* (upload + preview), alt* (sugestão do nome), tamanhos (chips ≤15), badge, toggle disponível.
- Excluir confirma nomeando o produto; imagem antiga é removida do storage.
- Visual alinhado ao DESIGN_DNA.md; HTML semântico, acessível; erros → toasts genéricos.

## Setup (parceiro humano)

1. Criar projeto Supabase (região São Paulo) — conta já existe.
2. Rodar `supabase/schema.sql` no SQL Editor.
3. Criar usuário admin (e-mail + senha forte; confirmação de e-mail desligada).
4. Colar URL + anon key em `supabase/config.js`.

## Critérios de aceite

- Site vazio mostra estado de vazio; produto criado no painel aparece no catálogo sem F5 em outra janela aberta.
- Escrita anônima via API rejeitada; upload de arquivo inválido/maior que 5 MB rejeitado pelo servidor; payload XSS em qualquer campo renderiza literal; console sem violações de CSP; `grep service_role` limpo.

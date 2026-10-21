# Fase 2 — Dois preços, detalhes, ordem e configurações · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à loja dois preços por peça (à vista/Pix/dinheiro e cartão), detalhes da peça (descrição, composição, cuidados), ordem manual, peça em destaque escolhida no painel e configurações (WhatsApp, horário, faixa, link de contato) — com a nota deixando a cliente escolher a forma de pagamento.

**Architecture:** Site estático no GitHub Pages, sem build. Dados novos em colunas de `public.products` (`descricao`, `composicao`, `cuidados`, `preco_cartao`, `ordem`) e em uma tabela nova `public.settings (chave, valor jsonb)` lida uma vez no start, com fallback no código quando a tabela não existe. A nota passa a ter forma de pagamento (Pix/Dinheiro/Cartão) guardada em `localStorage`, e o total/preço de cada linha seguem a escolha.

**Tech Stack:** HTML/CSS/JS puro (ES modules), Supabase (Postgres, Auth, Storage, Realtime), CDN jsDelivr.

**Spec:** `docs/superpowers/specs/2026-10-21-fase-2-design.md`

## Global Constraints
- Sem build/npm; caminhos relativos (GitHub Pages em subpasta).
- Todo texto do banco passa por `esc()` antes de `innerHTML`; `img_url` por `validarImgUrl()`; cor por `corSegura()`.
- CSP não muda: sem script inline, sem `onclick`, sem domínio externo novo.
- `service_role` nunca no repo; `config.js` só `url` + `anonKey`.
- UI/copy em pt-BR; paleta/tipografia conforme `DESIGN_DNA.md` (preço nunca é o maior texto da linha, nunca ganha cor de destaque).
- Sem inventar condições de parcelamento, escassez ou depoimento.
- SQL em `supabase/migrations/002_*.sql`, idempotente e comentado; **o parceiro humano roda no SQL Editor antes de publicar**.
- Cache bust: `?v=20261021b` em `style.css`, `script.js`, `admin.css`, `admin.js` e nos imports de `supabase/client.js`.
- Entrega por fase: arquivos + SQL + passo a passo de teste + o que ficou de fora → **parar e esperar aprovação**.

## Review Focus
1. Peça **sem** `preco_cartao` → o site não menciona cartão em lugar nenhum (nem card, nem ficha, nem nota) → Task 3.
2. `preco_cartao` **igual** ao à vista → o site não repete o mesmo valor duas vezes → Task 3.
3. Forma de pagamento trocada **depois** da nota montada → total e linha do WhatsApp recalculam na hora, sem recarregar → Task 3.
4. `settings` ausente/vazia (migration ainda não rodada) → site renderiza com WhatsApp, faixa e destaque de fallback, sem erro de console → Task 5.
5. Texto com acento no campo de busca ("macacao") → encontra "Macacão" → Task 5.

---

### Task 1: Migração SQL da Fase 2

**Files:** Create `supabase/migrations/002_detalhes_ordem_settings.sql`.

**Interfaces:** Produz em `public.products`: `descricao text`, `composicao text`, `cuidados text`, `preco_cartao numeric(10,2)`, `ordem int not null default 0`. Produz `public.settings (chave text primary key, valor jsonb not null)`.

- [ ] **Passo 1:** Escrever o arquivo com: `alter table` idempotente das 5 colunas; auto-correção `preco_cartao = preco` quando `preco_cartao < preco`; checks `char_length(descricao) <= 600`, `char_length(composicao) <= 200`, `char_length(cuidados) <= 300`, `preco_cartao is null or preco_cartao >= preco`; backfill de `ordem` preservando a ordem atual por `criado_em`; criação de `settings` com RLS (select público, escrita `authenticated`), `grant` de select para `anon`; índice em `products (ordem)`.
- [ ] **Passo 2:** Conferir o arquivo por consistência com `supabase/schema.sql` (nomes de policies, `force row level security`, grants).
- [ ] **Passo 3:** Entregar o passo a passo de execução (Supabase → SQL Editor → colar → Run) e o que conferir depois (`select column_name from information_schema.columns where table_name='products'`, `select * from settings`).
- [ ] **Passo 4:** Verificar via REST (após o usuário rodar): `GET /rest/v1/products?select=descricao,composicao,cuidados,preco_cartao,ordem&limit=1` → 200 com as colunas.

### Task 2: Módulo compartilhado

**Files:** Modify `supabase/client.js`.

**Interfaces:** Produz `COLUNAS_PRODUTO` estendido com `descricao,composicao,cuidados,preco_cartao,ordem`; `normalizarProduto(linha)` devolvendo `descricao`, `composicao`, `cuidados`, `precoCartao` (number ou `null`), `ordem` (int); `export async function lerSettings(): Promise<{ whatsapp: string, horario: string, faixa: string[], destaque: string|null, contato: string }>` — devolve os fallbacks do site quando a tabela não responde.

- [ ] **Passo 1:** Estender `COLUNAS_PRODUTO` e `normalizarProduto` (preço em número, `preco_cartao` null quando vazio, `ordem` int com 0 como padrão).
- [ ] **Passo 2:** Implementar `lerSettings()` com `db.from("settings").select("chave,valor")`; normalizar `valor` (string/número/array/objeto) por chave; em qualquer erro, devolver os fallbacks (`whatsapp: ""` → o site usa `CONFIG.whatsappFornecedor`).
- [ ] **Passo 3:** `node --check supabase/client.js` → sem erro.

### Task 3: Preços no site (card, ficha, nota)

**Files:** Modify `script.js`, `index.html`, `style.css`.

**Interfaces:** Produz `precoDeExibicao(p)` → `{ valor, de, percentual }`; `precoDaPeca(p, forma)` → number (à vista para `pix`/`dinheiro`, cartão para `cartao`); `estado.formaPagamento` (`"pix"` | `"dinheiro"` | `"cartao"`), persistido em `localStorage["pagamento_estilosasfitness_v1"]`; `atualizarNota()` recalcula a nota; `gerarMensagem()` inclui a forma e o total.

- [ ] **Passo 1:** Card: bloco de preço com valor à vista, apoio "à vista no Pix ou dinheiro" e, só se `precoCartao` existir e for diferente, "no cartão R$ X". "de" riscado + "−25%" quando houver `precoDe`.
- [ ] **Passo 2:** Ficha: mesmo bloco de preço, com o texto de apoio inteiro.
- [ ] **Passo 3:** Nota: grupo "Forma de pagamento" (Pix/Dinheiro/Cartão, Pix marcado), total por linha e total final conforme a escolha; troca recalcula na hora.
- [ ] **Passo 4:** `gerarMensagem()`: incluir forma escolhida e total correspondente.
- [ ] **Passo 5:** `style.css`: classes `preco-aux` (apoio), `preco-cartao`, `pagamento-opcoes` (mesma linguagem das `.opcao` existentes), sem cor de destaque no preço.
- [ ] **Passo 6:** `node --check script.js` → sem erro.

### Task 4: Detalhes, desconto, zoom e compartilhamento na ficha

**Files:** Modify `script.js`, `index.html`, `style.css`.

**Interfaces:** Produz `blocoDetalhes(p)` → string HTML (vazio quando não há texto); `estado.zoomAtivo`; `alternarZoom(img, evento)`; `compartilharPeca(id)`.

- [ ] **Passo 1:** Ficha: bloco "Detalhes" (descrição, composição, cuidados) só quando houver texto, com `max-width: 62ch`.
- [ ] **Passo 2:** Desconto "−X%" calculado de `precoDe`/`preco`, exibido no card e na ficha (sem cor de destaque).
- [ ] **Passo 3:** Zoom: clique na foto da ficha alterna `scale(2)` com `transform-origin` no ponto tocado; cursor `zoom-in`/`zoom-out`; sem transição sob `prefers-reduced-motion`.
- [ ] **Passo 4:** "Compartilhar esta peça": `navigator.share` quando existir; senão copiar o link e mostrar toast "Link copiado".
- [ ] **Passo 5:** `node --check script.js` → sem erro.

### Task 5: Catálogo — settings, busca sem acento, ordem e destaque

**Files:** Modify `script.js`, `index.html`, `style.css`.

**Interfaces:** Produz `estado.settings` (objeto de `lerSettings()`); `semAcento(texto)` → string normalizada; `aplicarBusca(termo)`; `ordenarProdutos(lista)`; `produtoDestaque()`.

- [ ] **Passo 1:** Ler `settings` no start (paralelo ao catálogo) e aplicar: WhatsApp (rodapé, ficha, nota), horário e link de contato (rodapé), faixa de avisos (substitui as 4 fixas; vazia = fallback).
- [ ] **Passo 2:** `semAcento()` (`normalize("NFD")` + remover `\p{Diacritic}`) nos dois lados da busca.
- [ ] **Passo 3:** Índice ordenado por `ordem` e depois `criado_em`; categorias pela menor `ordem` de suas peças.
- [ ] **Passo 4:** `produtoDestaque()`: `settings.destaque` se existir e ainda estiver no catálogo; senão a peça mais antiga.
- [ ] **Passo 5:** `node --check script.js` → sem erro.

### Task 6: Painel — abas, campos novos, ordem e configurações

**Files:** Modify `admin.html`, `admin.js`, `admin.css`.

**Interfaces:** Produz `abaAtual` (`"produtos"` | `"configuracoes"`), `estadoConfig` (cache de `settings`), `salvarConfiguracoes()`, `moverProduto(id, dir)`, campos `descricao`/`composicao`/`cuidados`/`preco_cartao` no formulário de produto e `ordem` no banco.

- [ ] **Passo 1:** Abas "Produtos | Configurações" (texto com filete embaixo) alternando as seções.
- [ ] **Passo 2:** Formulário de produto: 3 textareas com contador ("218 de 600") e o campo "Preço no cartão (opcional)" com dica.
- [ ] **Passo 3:** Lista de produtos com `↑`/`↓` (botão quadrado 2px) que trocam a ordem e salvam as duas peças de uma vez.
- [ ] **Passo 4:** Aba Configurações: WhatsApp, horário, link de contato, faixa (uma mensagem por linha) e seletor de peça em destaque (nome + miniatura); "Salvar configurações" grava cada chave.
- [ ] **Passo 5:** `node --check admin.js` → sem erro.

### Task 7: DNA, cache bust e documentação

**Files:** Modify `DESIGN_DNA.md`, `index.html`, `admin.html`.

- [ ] **Passo 1:** `DESIGN_DNA.md`: registrar o bloco de preço com dois valores, o bloco "Detalhes", o zoom e o compartilhamento.
- [ ] **Passo 2:** Cache bust `?v=20261021b` em todos os arquivos alterados e nos imports de `supabase/client.js`.
- [ ] **Passo 3:** `docs/superpowers/specs/2026-10-21-fase-2-design.md`: marcar o status da fase e anexar as notas de execução.

### Task 8: Verificação e publicação

**Files:** Modify `docs/superpowers/specs/2026-10-21-fase-2-design.md`.

- [ ] **Passo 1:** `node --check` nos 3 módulos → sem erro.
- [ ] **Passo 2:** Playwright com Supabase mockado: preços (card/ficha/nota nas 3 formas), forma de pagamento mudando o total, detalhes vazio e preenchido, desconto, zoom, compartilhar, busca sem acento, destaque, ordem, aba Configurações e o fallback sem `settings`.
- [ ] **Passo 3:** Após o usuário rodar o SQL: smoke test real (fotos, preços, nota com cartão, busca "macacao", destaque, Configurações).
- [ ] **Passo 4:** Commit da Fase 1 + Fase 2 e push para `main` (GitHub Pages), na ordem combinada com o parceiro humano.
- [ ] **Passo 5:** Entregar o resumo da fase: arquivos, SQL, passo a passo de teste e o que ficou de fora — e **parar**.

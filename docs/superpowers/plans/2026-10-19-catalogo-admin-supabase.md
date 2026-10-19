# Catálogo Dinâmico + Painel Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo do site passa a vir do Supabase com atualização em tempo real, e um painel `admin.html` com login dá CRUD completo de produtos a um único administrador.

**Architecture:** Site estático no GitHub Pages com `@supabase/supabase-js` via jsDelivr ESM (sem build). Postgres com RLS (leitura pública, escrita só autenticada), bucket de imagens com limites servidor-side, Realtime em `products`. Segurança: `esc()` sistemático, CSP via meta, validação client + constraints SQL.

**Tech Stack:** HTML/CSS/JS puro (ES modules), Supabase (Postgres, Auth, Storage, Realtime), CDN jsDelivr.

**Spec:** `docs/superpowers/specs/2026-10-19-catalogo-admin-supabase-design.md`

## Global Constraints
- Sem build/npm; caminhos relativos (GitHub Pages em subpasta).
- Todo texto do banco passa por `esc()` antes de `innerHTML`; `img_url` por `validarImgUrl()`.
- CSP: `script-src 'self' https://cdn.jsdelivr.net`; connect/img só `<ref>.supabase.co`; `object-src 'none'`; `base-uri 'self'`; sem scripts inline.
- `service_role` nunca no repo; `config.js` só `url` + `anonKey`.
- UI/copy em pt-BR; paleta/tipografia conforme DESIGN_DNA.md.
- Sem framework de testes → verificação por navegador MCP (Playwright) e `curl`; cada passo termina com verificação observável.

## Review Focus
1. Payload XSS em nome/categoria/badge/alt → texto literal. → Task 3/4.
2. Escrita anônima via API → rejeitada por RLS. → Task 1 (curl).
3. Tempo real entre duas janelas → sem F5. → Task 5.
4. Upload .html/6 MB que burla o client → recusado pelo servidor. → Task 1 (curl).
5. CSP quebra o site → console sem violações. → Task 3.

---

### Task 1: Projeto Supabase + schema (setup assistado)

**Files:** Create `supabase/schema.sql`; Modify `supabase/config.js` (credenciais reais).

**Interfaces:** Produz tabela `products`, bucket `produtos`, credenciais para Task 2.

- [ ] **Passo 1:** Escrever `supabase/schema.sql`: tabela com checks (nome ≤120, categoria ≤60, alt ≤300, badge ≤40, preco >= 0, preco_de > 0, tamanhos 1..15, ph `^#[0-9A-Fa-f]{6}$`, img_url só prefixo do bucket), RLS FORCE + policies (select público; write authenticated), bucket com `file_size_limit=5242880` e mime allowlist + policies, publicação realtime, índices.
- [ ] **Passo 2:** Orientar criação do projeto (região São Paulo) e execução do SQL.
- [ ] **Passo 3:** Usuário cria admin (e-mail/senha forte, auto-confirm); copiar URL + anon key → `config.js`.
- [ ] **Passo 4:** curl sem sessão: `POST /rest/v1/products` → 401/403; `GET` com anon → 200.
- [ ] **Passo 5:** Storage: `.html` recusado; `.webp` válido com sessão → aceito.
- [ ] **Passo 6:** Commit `feat: schema supabase com rls e bucket de imagens`.

### Task 2: Módulo compartilhado

**Files:** Create `supabase/client.js`.

**Interfaces:** Consumes `SUPABASE_URL`/`SUPABASE_ANON_KEY`. Produz: `export const db`, `export function esc(texto): string`, `export function validarImgUrl(url): boolean`.

- [ ] **Passo 1:** Implementar `esc` (entidades `& < > " '`) e `validarImgUrl` (prefixo `https://<host>/storage/v1/object/public/produtos/`).
- [ ] **Passo 2:** Verificar no navegador: XSS payload vira entidades; URL fora do bucket → false.
- [ ] **Passo 3:** Commit `feat: modulo compartilhado do supabase com escape anti-xss`.

### Task 3: Site público dinâmico + CSP

**Files:** Modify `script.js`, `index.html`; Create `head.js`.

**Interfaces:** Consumes `db`/`esc`/`validarImgUrl`. Produz `estado.produtos`, `carregarCatalogo()`, `assinarTempoReal()`, cache `catalogo_v1`.

- [ ] **Passo 1:** `carregarCatalogo()`: cache → render; `select` ordenado `criado_em`; salva snapshot; sem rede e sem cache → estado de erro/vazio.
- [ ] **Passo 2:** `assinarTempoReal()`: canal `postgres_changes` INSERT/UPDATE/DELETE → re-render (catálogo, filtros por primeira aparição, capa).
- [ ] **Passo 3:** `esc()` em todos os `innerHTML` com dados do banco + `validarImgUrl` em `src`; sacola com id antigo descartada.
- [ ] **Passo 4:** `index.html`: estados carregando/vazio, capa fallback, CSP meta com domínio real, scripts module, inline → `head.js`.
- [ ] **Passo 5:** Verificar: produto inserido no banco aparece sem F5; XSS literal; console limpo de CSP.
- [ ] **Passo 6:** Commit `feat: catalogo dinamico com tempo real e csp`.

### Task 4: Painel admin

**Files:** Create `admin.html`, `admin.js`, `admin.css`.

**Interfaces:** Consumes `db`/`esc`/`validarImgUrl`. Produz fluxo login → lista → form CRUD; storage `${crypto.randomUUID()}.webp`.

- [ ] **Passo 1:** HTML + CSS: login e área do painel oculta; tokens da marca; CSP.
- [ ] **Passo 2:** Auth: `signInWithPassword`, guard, `onAuthStateChange`, `signOut`; erro genérico.
- [ ] **Passo 3:** Lista com Editar/Excluir (confirmação nomeando o produto); erros → toast genérico.
- [ ] **Passo 4:** Formulário: campos do spec, datalist categorias, chips tamanhos, alt com sugestão, validação client + mensagens pt-BR.
- [ ] **Passo 5:** Upload: jpg/png/webp ≤5 MB, recompressão webp, preview, envio, `img_url` validado; excluir produto remove imagem do storage.
- [ ] **Passo 6:** Verificar CRUD no navegador; sem sessão a área não renderiza.
- [ ] **Passo 7:** Commit `feat: painel admin com auth e crud de produtos`.

### Task 5: Auditoria de segurança + E2E

**Files:** Modify correções; Create `.gitignore`.

- [ ] **Passo 1:** `grep -ri service_role` → nada.
- [ ] **Passo 2:** Payloads XSS em todos os campos → literais; `img_url` externo → bloqueado.
- [ ] **Passo 3:** Duas janelas: CRUD numa → atualização instantânea na outra.
- [ ] **Passo 4:** Offline → último cache aparece sem quebra.
- [ ] **Passo 5:** `.gitignore` (`.playwright-mcp/`) + commit `chore: auditoria de seguranca e ignore de logs`.

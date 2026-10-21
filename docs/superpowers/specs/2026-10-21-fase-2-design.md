# Design — Fase 2: dois preços, detalhes, ordem e configurações

Data: 2026-10-21 · Status: aprovado pelo parceiro humano (desenho aprovado na conversa; spec escrito para revisão)

Continua o documento `2026-10-21-ficha-da-peca-fotos-cores-design.md` (Fases 1 a 4). Aqui está a **Fase 2** detalhada, já com a decisão de **dois preços por peça** (à vista / Pix / dinheiro e cartão).

## Objetivo da fase

Dar à loja o que uma vitrine de WhatsApp precisa: **preço honesto por forma de pagamento**, **detalhes da peça** (descrição, composição, cuidados), **ordem controlada pelo painel**, **destaque escolhido à mão** e **configurações** (WhatsApp, horário, faixa de avisos, link de contato) fora do código.

## Decisões do parceiro humano (21/10/2026)

- **Dois preços por peça:** à vista (Pix ou dinheiro) e cartão. O cartão é **opcional**: vazio = mesmo valor do à vista, e o site nem menciona cartão naquela peça.
- **A nota deixa a cliente escolher** a forma de pagamento (Pix / Dinheiro / Cartão) e o total acompanha a escolha.
- **A peça em destaque** fica **só no herói da capa** (o bloco "Destaque" do topo do site). Sem fileira nova no índice.
- **O guia de medidas saiu da Fase 2** — a loja não precisa agora.
- **A aba Configurações** entra com: WhatsApp, horário de atendimento, faixa de avisos, peça em destaque e link de contato.
- **Publicação:** Fase 1 + Fase 2 vão ao ar **juntas**, no fim desta fase (um push só).

## Restrições permanentes (do spec da Fase 1, valem aqui)

- `DESIGN_DNA.md` é lei: raio 0/2px, sem gradiente, sem sombra, filete 1px, `#FCFAFC`/`#FFFFFF`/`#1F1420`/`#6B5A6C`/`#8E428B`/`#3E1B3D`, Archivo para dado e UI, Newsreader itálico só na voz da loja, **preço nunca é o maior texto de uma linha e nunca recebe cor de destaque**, máx. 3 ícones, setas `←/→`/`↑`/`↓` como glifos textuais em botão quadrado 2px, `prefers-reduced-motion` respeitado, honestidade (não inventar parcelamento, escassez ou depoimento).
- CSP não muda. Zero segredo no repo. Validação no cliente **e** no banco. `innerHTML` dinâmico por `esc()`, foto por `validarImgUrl()`, cor por `corSegura()`.
- SQL em `supabase/migrations/NNN_nome.sql`, idempotente e comentado; **o parceiro humano roda no SQL Editor antes de publicar**.
- Cache bust: uma string por página, sobe a cada arquivo alterado (`?v=`). Fase 2 usa `?v=20261021b`.

## Modelo de dados

### `public.products` — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `descricao` | text | opcional, ≤ 600 caracteres |
| `composicao` | text | opcional, ≤ 200 caracteres |
| `cuidados` | text | opcional, ≤ 300 caracteres |
| `preco_cartao` | numeric(10,2) | opcional, `null` ou ≥ `preco` |
| `ordem` | int | `not null default 0`; backfill preserva a ordem atual (por `criado_em`) |

Checks: `char_length(descricao) <= 600`, `char_length(composicao) <= 200`, `char_length(cuidados) <= 300`, `preco_cartao is null or preco_cartao >= preco`.

`preco` continua sendo o **preço à vista** (não muda de nome nem de papel). `preco_de` continua sendo o "de" riscado **do preço à vista** — o desconto "−25%" sai dele.

### `public.settings` — tabela nova

| Coluna | Tipo | Regra |
|---|---|---|
| `chave` | text | primary key, ≤ 40 caracteres |
| `valor` | jsonb | `not null` |

Chaves usadas na Fase 2:

| chave | formato | efeito no site |
|---|---|---|
| `whatsapp` | texto (só dígitos, com `55`) | número do WhatsApp em todo lugar (rodapé, ficha, nota) |
| `horario` | texto livre | linha no rodapé ("Atendimento seg a sex, 9h às 18h") |
| `faixa` | array de textos | mensagens da faixa de avisos (substitui as 4 fixas do código) |
| `destaque` | uuid | peça em destaque do herói |
| `contato` | url | link de contato no rodapé (ex.: Instagram) |

RLS igual ao de `products`: `select` público, escrita só `authenticated`; `anon` sem `insert/update/delete`.

Fallback (o site **não quebra** se a tabela não existir ou vier vazia): WhatsApp = `CONFIG.whatsappFornecedor`; faixa = as 4 mensagens de hoje; destaque = peça mais antiga; horário e contato = vazios (não mostram).

## Preços: como aparecem

- **Preço à vista** é o preço principal (o número grande, sem cor de destaque).
- Debaixo dele, em texto menor e discreto (`--tinta-fraca`): **"à vista no Pix ou dinheiro"**.
- Quando há `preco_cartao` diferente do à vista: **"no cartão R$ 149,90"** na mesma linha de apoio.
- **Nunca** inventar "3x sem juros" ou condições de parcelamento — o site promete que pagamento e frete se combinam na conversa.
- O "de" riscado e o "−25%" continuam se referindo ao preço à vista.
- Card, ficha e nota usam o mesmo bloco de preço (mesma fonte de verdade: `preco`, `preco_cartao`, `preco_de`).

### Nota de encomenda

- Novo bloco **"Forma de pagamento"** com 3 opções: **Pix / Dinheiro / Cartão** (radio, "Pix" marcado por padrão).
- A escolha é global do pedido (é uma decisão de pagamento, não da peça) e fica guardada em `localStorage` (`pagamento_estilosasfitness_v1`).
- O preço de cada linha e o total seguem a escolha: Pix e dinheiro → preço à vista; cartão → `preco_cartao` da peça (ou o à vista, se a peça não tiver preço de cartão).
- A nota mostra, no rodapé, uma linha de resumo: **"Total no Pix R$ 259,80"** ou **"Total no cartão R$ 299,80"**.
- A mensagem do WhatsApp manda a forma escolhida e o total correspondente.
- Trocar a forma recalcula a nota na hora, sem recarregar.

## Detalhes da peça

- Painel: três textareas (Descrição 600 / Composição 200 / Cuidados 300) com contador "218 de 600".
- Ficha: bloco **"Detalhes"** que só aparece se houver algum texto — descrição em parágrafo, composição e cuidados abaixo, em Archivo, com linha de no máximo **62ch** (`max-width: 62ch`).
- A ficha não ganha uma seção "Detalhes" vazia: peça sem texto mostra o bloco de price/cores/tamanhos como hoje.

## Zoom da foto (ficha)

- Clique ou toque na foto da ficha alterna **zoom 2×** com a origem no ponto tocado (`transform-origin` calculado do evento).
- Segundo clique volta ao enquadramento normal.
- Cursor `zoom-in` no estado normal, `zoom-out` no estado ampliado.
- Sem transição sob `prefers-reduced-motion` (o zoom entra de uma vez).
- Só na ficha — o card do índice não tem zoom.

## Compartilhar peça

- Link de texto "Compartilhar esta peça" no fim do bloco de informações da ficha.
- Com `navigator.share` (celular): compartilha `{ title, text, url }` com o link da peça.
- Sem `navigator.share` (desktop): **copia o link** para a área de transferência e avisa "Link copiado".
- Sem `wa.me` no fallback: compartilhar não é falar com a loja — o fallback é o clipboard.

## Ordem manual

- `products.ordem` (int). O painel lista os produtos com `↑` `↓` (glifos textuais em botão quadrado 2px, mesmo sistema das setas do índice); trocar salva as duas peças de uma vez (PATCH das duas ordens).
- O site ordena o índice por `ordem` e, na falta, por `criado_em`.
- As **categorias** passam a ordenar pela **menor `ordem`** de suas peças (hoje é a ordem de primeira aparição).

## Peça em destaque (herói)

- `settings.destaque` = uuid. O herói mostra essa peça (foto, nome, preço, número da ficha).
- Sem destaque escolhido — ou com a peça excluída — cai na peça mais antiga, como hoje.
- No painel, o seletor lista os produtos por nome com miniatura da capa.

## Configurações (painel)

- Abas **"Produtos | Configurações"** no topo do painel: texto com filete embaixo, sem pílula (DNA).
- Aba Configurações: WhatsApp, horário de atendimento, link de contato, mensagens da faixa (uma por linha) e o seletor de peça em destaque. Botão "Salvar configurações" grava as cinco chaves na tabela `settings` em **uma única requisição** (`upsert` com as cinco linhas), para a configuração nunca ficar salva pela metade.

## Busca sem acento

- `normalize("NFD")` + remoção de `\p{Diacritic}` **nos dois lados** (o que a cliente digita e o nome/categoria do produto). "macacao" acha "Macacão".

## SQL — `supabase/migrations/002_detalhes_ordem_settings.sql`

Ordem dentro do arquivo: colunas + checks → backfill da `ordem` → tabela `settings` + RLS + grants → índice de `ordem` → conferência final (`colunas_novas`, `settings_pronto`, `politicas_settings`).

Idempotente (`if not exists`, `drop ... if exists` antes de cada `create policy`), comentado, e com auto-correção de `preco_cartao` menor que `preco` (sobe para o valor do à vista) antes de criar o check.

## Fora da Fase 2

Guia de medidas (adiado), PWA, tabela de pedidos, filtros e ordenaçãoadvanced, "esgotados", "guardar peça", "lembrar meus dados", "mais da categoria", duplicar produto e ações em massa (Fases 3 e 4).

## Verificação

- `node --check` em `script.js`, `admin.js`, `supabase/client.js`.
- Playwright com Supabase mockado: preços (card, ficha, nota nas 3 formas), forma de pagamento mudando o total, detalhes aparecendo e sumindo, desconto, zoom, compartilhar, busca sem acento, destaque, ordem, aba Configurações gravando as chaves, e **fallback** quando `settings` não vem.
- Smoke test real depois que o parceiro humano rodar o SQL.

# Design — Ficha da peça, fotos múltiplas e cores

Data: 2026-10-21 · Status: Fase 1 implementada, aguardando aprovação do parceiro humano (rodar o SQL e publicar)

## Objetivo

Transformar o card simples do índice em uma **ficha da peça** (modal, no espírito Shopee): várias fotos, cores e informações completas, com o painel admin à altura. O site segue estático (HTML/CSS/JS puro, módulos ES, sem build) sobre Supabase (banco, storage, auth, realtime).

A entrega é **por fases**, cada uma com SQL, código e passo a passo de teste, e cada uma para no fim esperando aprovação.

## Restrições permanentes

- `DESIGN_DNA.md` é lei: raio 0 ou 2px, sem gradiente, sem sombra (a da nota é a única), filete 1px no lugar de caixa, `#FCFAFC` / `#FFFFFF` / `#1F1420` / `#6B5A6C` / `#8E428B` / `#3E1B3D`, Archivo para dado e UI, Newsreader itálico só na voz da loja, preço sem cor de destaque, máx. 3 ícones (sacola, X, WhatsApp), setas `←/→` como glifo de texto em botão quadrado 2px, easing `cubic-bezier(.2,.7,.2,1)` em 140/220/420ms, `prefers-reduced-motion` respeitado, honestidade (sem escassez ou depoimento inventado).
- CSP não muda: sem script inline, sem `onclick` no HTML, sem domínio externo novo.
- Segurança: dado dinâmico em `innerHTML` passa por `esc()`; foto por `validarImgUrl()`; cor por `corSegura()`; validação no cliente **e** no banco (check constraints); erro genérico via `mensagemErro()`.
- Sem dependência nova, sem build.
- Cache bust: `?v=` sobe a cada arquivo alterado; todos os imports de `supabase/client.js` na mesma página usam a mesma string.
- SQL é entregue em `supabase/migrations/NNN_nome.sql`, idempotente, comentado; **o parceiro humano roda no SQL Editor antes de publicar o código da fase**.

## Decisões de arquitetura (já tomadas — não reabrir)

- Fotos e cores ficam em colunas `jsonb` de `public.products` (mesmo padrão de `tamanhos`), sem tabelas novas.
  - `imagens`: array de URLs do bucket na ordem de exibição; a primeira é a capa.
  - `cores`: array de `{ "nome": "Preto", "hex": "#1F1420" }`.
  - `img_url` continua existindo e é **sempre** gravado igual a `imagens[0]`.
- `supabase/client.js` centraliza `COLUNAS_PRODUTO` (string do `select`) e `normalizarProduto(linha)`; `script.js` e `admin.js` importam os dois (elimina a duplicação que existe hoje).
- Ordem das fotos no admin é por **botões de texto** `←` `→` "Tornar capa" "Remover" (arrastar não funciona bem no celular). Arrastar e soltar fica opcional, por cima.
- Galeria da loja: scroll-snap horizontal nativo (o swipe vem de graça no celular), setas via `scrollBy`, miniaturas sincronizadas por `IntersectionObserver`.

## Fase 1 — Núcleo: fotos, cores, ficha da peça

### 1.1 Correções obrigatórias

- **Bug do cache (script.js):** `salvarCatalogo()` grava objetos já normalizados; `carregarCatalogoDoCache()` os passa de novo por `normalizar()`, que espera nomes do banco (`img_url`, `preco_de`, `criado_em`) → produto volta sem foto/preço. Correção: cachear **linhas cruas** do banco (e o normalizador tolera os dois formatos). Chave passa a `catalogo_v2` para descartar caches antigos.
- **Centralização:** `COLUNAS_PRODUTO` + `normalizarProduto(linha)` em `supabase/client.js`.

### 1.2 SQL — `supabase/migrations/001_fotos_e_cores.sql`

```sql
alter table public.products
  add column if not exists imagens jsonb not null default '[]'::jsonb,
  add column if not exists cores   jsonb not null default '[]'::jsonb;

update public.products
   set imagens = jsonb_build_array(img_url)
 where img_url is not null and img_url <> '' and imagens = '[]'::jsonb;
```

Checks: `jsonb_typeof = 'array'`; `imagens` ≤ 10 itens; `cores` ≤ 12 itens; cada URL de `imagens` no bucket; `hex` de cor em `#RRGGBB`.

**RLS:** as policies são de tabela (`products`), então as colunas novas herdam as mesmas permissões — `SELECT` público, escrita só autenticada/admin. **Nada muda no RLS.** O `grant select/insert/update/delete` continua válido. O que muda é só o `check` de `img_url`, que passa a ser redundante (o mesmo valor de `imagens[0]`).

### 1.3 Admin (`admin.html` + `admin.js` + `admin.css`)

- "Foto do produto" → **"Fotos do produto"**: `<input type="file" multiple>` + arrastar arquivos para a área.
- Estado `estado.fotos = [{ chave, url, arquivo, previewUrl }]` (`url` = já enviada; `arquivo` = nova, pendente).
- Grade de miniaturas 3:4, etiqueta "Capa" na primeira, contador "4 de 10", botões `←` `→` "Tornar capa" "Remover".
- Validação: até 10 fotos; JPG/PNG/WEBP; 5 MB cada; mensagem apontando **qual arquivo** falhou. Ao exceder o limite, aceita as que cabem e avisa.
- Mínimo de 1 foto (regra atual). Texto alternativo continua único; no site cada foto usa `"{alt} — foto N de M"`.
- Salvar: comprime e envia as novas (máx. 3 em paralelo, progresso "Enviando foto 3 de 6…"), monta `imagens` na ordem final, grava `img_url = imagens[0]` **no mesmo update**.
- **Sem órfãos:** se qualquer upload ou o insert/update falhar, apaga do storage o que foi enviado **nesta tentativa** e não toca no banco. Só depois do update bem-sucedido apaga do storage as fotos removidas pelo admin.
- Excluir produto apaga **todas** as fotos de `imagens`.
- Editar carrega fotos e cores existentes.
- Lista do admin: miniatura da capa + "4 fotos · 3 cores".
- **Cores**, no mesmo modelo dos tamanhos: campo de nome (máx. 24) + `<input type="color">` + botão Adicionar. Máx. 12, sem nome duplicado (ignorando maiúsculas), `hex` por `corSegura`. Chip mostra o quadradinho + nome. Cores são opcionais.

### 1.4 Loja — ficha da peça (`script.js` + `style.css` + `index.html`)

- Abre ao clicar na **foto** ou no **nome** do card; cada um é um `<button>` de verdade. Chips de tamanho e "+ sacola" continuam funcionando no card. O card mostra `imagens[0]` (fallback `img_url`).
- Reaproveita a mecânica do drawer da nota: mesmo fundo escurecido (`.nota-fundo`), mesmo controle de foco. Animação "papel assentando": desce poucos px em 420ms.
- Folha branca plana, filete 1px, **sem sombra**. Desktop: galeria 7/12 à esquerda, informações 5/12 à direita. Celular: quase tela cheia, galeria no topo, informações abaixo, rolagem interna.
- **Galeria:** foto grande 3:4 em faixa scroll-snap; miniaturas com a ativa marcada por filete 2px `#8E428B`; botões `←` `→`; teclado `←/→` navega, `ESC` fecha; indicador "2 / 5" em número tabular. Uma foto só: sem setas, sem miniaturas. Primeira foto `eager`, outras `lazy`; pré-carrega a vizinha; cor `ph` de fundo enquanto carrega.
- **Informações:** nome (h2), categoria, preço (+ "de" riscado), tamanhos (mesmos chips do card, sincronizados), **cores**, "+ sacola", e abaixo uma linha em Newsreader itálico "Dúvida de tamanho? A gente orienta no WhatsApp." com link "Perguntar sobre esta peça" (abre wa.me citando a peça e o link).
- **Cores na loja:** botões quadrados 2px, filete 1px `#C9B2CB`, **nome sempre visível** ao lado ou abaixo. Selecionada: borda 2px `#8E428B` + `aria-pressed`. A primeira vem pré-selecionada.
- **A cor entra na nota:** item `{ id, tamanho, cor }`; unicidade = id + tamanho + cor. `carregarNota` aceita itens antigos sem cor (`cor = ""`). Tabela mostra "Tam. M · Preto"; mensagem do WhatsApp inclui a cor e o link da peça (`origem/?peca=<id>`).
- **Acessibilidade:** `role="dialog"`, `aria-modal`, `aria-labelledby`; foco inicial no botão fechar; Tab preso (via `inert` em header/main/footer + armadilha de Tab); ao fechar, foco volta ao botão que abriu; X, ESC e clique no fundo fecham; scroll do body bloqueado com **contador** (nota e ficha não se atrapalham); toast acima da ficha; dentro da ficha, "Ver minha nota (N peças)" fecha a ficha e abre a nota.
- **Link e voltar:** `?peca=<id>` via `history.pushState`; o "voltar" do celular fecha a ficha; link direto abre a ficha após o catálogo carregar; id inválido é ignorado e a URL é limpa.
- **Realtime:** peça aberta editada → a ficha atualiza; excluída → fecha com aviso.
- **DESIGN_DNA.md** atualizado: ficha da peça, cores, galeria, correção do trecho sobre fotos locais em `img/` e sobre "carregando não se aplica".

## Fase 2 — Conteúdo da ficha e configurações

- `products`: `descricao` (600), `composicao` (200), `cuidados` (300) — texto, opcionais, com limite no banco; form no admin e seção "Detalhes" na ficha (Archivo, máx. 62ch).
- Tabela `guias_medidas (categoria text primary key, colunas jsonb, linhas jsonb)` — leitura pública, escrita só admin; editor simples no admin; exibição na ficha em `<table>` com `<caption>` e filetes.
- Desconto: texto "−25%" calculado de `preco_de` × `preco`, só quando `precoDe > preco`; Archivo, sem cor de destaque.
- Compartilhar: link de texto "Compartilhar esta peça" → `navigator.share` se existir, senão wa.me com o link.
- Ampliar foto: clique/toque alterna zoom 2× com origem seguindo o ponteiro; cursor zoom-in; respeita reduced-motion (desvio justificado no DNA).
- Tabela `settings (chave text primary key, valor jsonb)` — leitura pública, escrita só admin: whatsapp, mensagens da faixa, horário de atendimento, `capa_produto_id`; `script.js` lê daí com os valores atuais como fallback; admin ganha a aba "Configurações".
- Capa em destaque escolhida no admin (hoje é a peça mais antiga).
- `products.ordem int` inicializado preservando a ordem atual (por `criado_em`); botões `↑` `↓` no admin; ordem das categorias pela menor `ordem` de cada uma.
- Busca sem acento e sem diferenciar maiúsculas (`normalize("NFD")` + remoção de diacríticos): "macacao" acha "Macacão".
- Abas do admin ("Produtos | Configurações | …") como texto com filete embaixo, sem pílula.

## Fase 3 — Loja e admin completos

- `esgotados jsonb` `{ "tamanhos": [...], "cores": [...] }`: chips com alternância "esgotado" no admin; na loja texto riscado + disabled + rótulo "esgotado"; nunca pré-seleciona opção esgotada. Sem contagem de estoque, sem "últimas unidades".
- Filtros no índice (tamanho, cor, faixa de preço) e ordenação (novidades, menor preço, maior preço) **dentro de cada fileira**, mantendo a estrutura por categoria.
- "Guardar" / "Guardada" (texto, sem coração) na ficha, no localStorage; filtro "Guardadas (n)".
- "Lembrar meus dados" no formulário da nota (nome, telefone, endereço, bairro), desmarcado por padrão, com opção de limpar.
- "Mais da categoria": até 4 outras peças da mesma categoria no fim da ficha, em texto + miniatura, trocando a ficha ao clicar.
- Admin: busca e filtro na lista; "Duplicar produto" (copia dados e fotos para novos arquivos); ações em massa (marcar/indisponibilizar, reajustar preço em %, com confirmação mostrando antes e depois).

## Fase 4 — Caderno de encomendas de verdade

- Tabela `pedidos`: id uuid, criado_em, status (`novo|confirmado|enviado|entregue|cancelado`, default `novo`), nome, telefone, forma, endereco, bairro, observacoes, itens jsonb `[{id, nome, tamanho, cor, qtd, preco}]` (snapshot), total.
  - RLS: `anon` só INSERT (com check de tamanho de texto, `status = 'novo'`, itens ≤ 50, **sem SELECT público**); `authenticated` lê/atualiza/apaga.
  - O insert do `anon` **não** usa `.select()` (não existe policy de leitura).
- Fluxo no site: o `window.open` do WhatsApp continua **síncrono** dentro do submit (Safari bloqueia popup assíncrono). O insert do pedido roda em paralelo, sem `await` antes do open; se falhar, o WhatsApp abre do mesmo jeito (fonte da verdade) e o erro vai só para o console.
- Campo isca anti-spam (honeypot) invisível; se preenchido, não grava.
- LGPD: aviso curto no formulário ("A loja guarda estes dados só para atender o seu pedido") e atualização do rodapé e do DESIGN_DNA.
- Aba Pedidos no admin: do mais novo ao mais antigo, filtro por status, troca de status, "Abrir conversa" (wa.me do cliente), apagar pedido, "apagar pedidos com mais de N dias" (com confirmação). "Peças mais pedidas (últimos 30 dias)" a partir dos itens, em lista tabular, sem gráfico animado nem rastreamento extra.
- PWA: `manifest.webmanifest` + service worker (CSP já permite). Cache só do app shell, network-first para HTML/JS; imagens no cache HTTP normal (já têm `cacheControl` de 1 ano). Ícones 192/512 PNG dependem do logotipo: listar o que falta, não inventar.
- Miniaturas no upload: além da versão de 1600px, gerar ~480px (`{uuid}_m.webp`), usada no card e na lista do admin; a de 1600px na ficha. Remover as duas ao apagar. Fotos antigas (sem `_m`) usam a grande como fallback.

## Entrega de cada fase

1. Arquivos alterados/criados.
2. SQL a rodar (e em que ordem em relação ao deploy).
3. Passo a passo de teste (desktop e celular).
4. O que ficou de fora e por quê.

Depois: **parar** e esperar aprovação.

## Execução da Fase 1 — o que mudou do plano

- **Arrastar-e-soltar para REORDENAR** as fotos: fora da Fase 1 (decisão do parceiro humano). A ordem é por botões de texto. **Arrastar ARQUIVOS para a área de fotos** entrou, porque não conflita com a decisão e o painel fica mais rápido de usar.
- **Banco:** produtos_imagens_ok aceita de **0 a 10** fotos (peça sem foto é permitida no banco; o painel exige pelo menos uma ao salvar) e a capa usa `(imagens->>0) is not distinct from img_url` — assim a peça sem foto passa (capa vazia = img_url vazio) e a divergência entre capa e primeira foto é bloqueada.
- **Hex das cores** é gravado em maiúsculas (corSegura normaliza) — a validação do banco aceita as duas, mas o dado fica estável.
- **Alt das fotos da galeria:** a capa usa o alt da peça; as demais usam `alt — foto N de M`.
- **Cache bust** da Fase 1: ?v=20261021a em style.css, script.js, admin.css, admin.js e nos imports de supabase/client.js (mesma string em toda página).
- **Um só WhatsApp na ficha:** o botão "Falar no WhatsApp" (ícone) saiu e a entrada ficou na **voz da loja** — "Dúvida de tamanho? A gente orienta no WhatsApp." (Newsreader itálico) com o link "Perguntar sobre esta peça" em Archivo reto, que abre o WhatsApp já citando a peça e o tamanho que ela está olhando. A ficha fica com um CTA primário ("+ sacola"), uma voz e um link — sem repetir o mesmo pedido duas vezes na mesma folha.
- **Galeria:** `←`/`→` no teclado navegam, `Esc` fecha; com **uma foto só** as setas e as miniaturas somem (precisou de `.peca-seta[hidden]`/`.peca-minis[hidden] { display:none }` — o `display` do autor vencia o `[hidden]` do navegador).
- **Tempo real:** peça editada → a ficha aberta se atualiza; peça excluída → a ficha fecha **com aviso** ("Esta peça saiu do índice.").
- **"ver minha nota (N peças)"** mostra o total e some quando a nota está vazia.
- **Bug do SQL corrigido (21/10/2026):** `produtos_imagens_ok` usava `jsonb_path_exists` com o predicado invertido (reprovava as URLs **válidas** do bucket) e `produtos_cores_ok` deixava passar cor sem `hex` (NULL não dispara `!~`). A função foi reescrita com laço explícito sobre `jsonb_array_elements`, e a migração ganhou autodiagnóstico + autocorreção antes das constraints. O SQL Editor roda o script em uma transação: a falha anterior **não gravou nada**.

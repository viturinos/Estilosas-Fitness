# DESIGN DNA — Estilosas Fitness

Fonte de verdade visual deste projeto. Toda decisão de UI, motion ou front-end desvia daqui só com justificativa escrita.

---

## Identidade

- **Projeto / Empresa:** Estilosas Fitness — vitrine de moda fitness feminina (leggings, conjuntos, tops, shorts, macacões e blusinhas — moda praia e acessórios **fora do escopo desde 18/10/2026**) que **não processa pagamento no site**. O pedido é montado na sacola e entregue a uma pessoa no WhatsApp, onde pagamento e frete são combinados.
- **Brand Personality:**
  1. **Pessoal** — quem responde é gente, não um checkout. O site fala em primeira pessoa.
  2. **Cuidadosa** — orienta tamanho, troca e caimento antes de fechar.
  3. **Direta** — sem enrolação, sem cadastro, sem letra miúda.
  4. **Bem-vestida** — a peça é bem cortada e o site também.
  5. **Honestas** — não inventa depoimento, nota falso nem escassez.
- **Audience:** mulheres no Brasil que compram roupa fitness por conversa (Instagram/WhatsApp), valorizam caimento e orientação de tamanho, desconfiam de loja que só tem carrinho e ninguém para tirar dúvida; compram R$ 50–150 a peça, pedem 2–4 peças por vez.
- **Industry:** moda fitness feminina vendida via WhatsApp ("vitrine digital"). Convenção do setor no Brasil: tema de marketplace (Nuvemshop/FácilZap/Tá na Vitrine) — grade de cards iguais, pílula "Fale Conosco", carrossel, "Depoimentos", selo "Site Seguro". **A convenção é o template; quebrá-la é a oportunidade.**
- **Positioning:** *a única vitrine de moda fitness que funciona como caderno de encomendas — você folheia o índice, escolhe as peças e entrega a nota já escrita para a loja no WhatsApp.*
- **Visual Keywords:** caderno de encomendas / índice tipográfico / ficha editorial com foto / berinjela / condensada de cartaz / itálico que conversa / tabular / papel.
- **Referências e contexto** (pesquisa em 18/10/2026):
  - *Year of Ours* (yearofours.com) — catálogo organizado em capítulos com data ("CHAPTER 03: AFTER PRACTICE"). Empresta: **a coleção como edição numerada**.
  - *Aimé Leon Dore / Kith* — lookbook editorial: a loja lida como revista. Empresta: **índice tipográfico no lugar da gaveta de cards**.
  - *On Running* — arquitetura de categorias é o design; herói é ideia, não produto. Empresta: **capa que declara a edição, não um banner de promoção**.
  - *Pas Normal Studios* — equipamento tratado como moda, tabela técnica como elemento bonito. Empresta: **dado tabular com espaço e régua vira grafismo**.
  - *MWH of Sweden* (Awwwards HM, set/2025) — activewear com elegância de alfaiataria, preto/branco contido. Empresta: **contenção cromática e disciplina de filete**.
  - Concorrência BR estudada como **anti-referência**: SUF Moda Fitness, AS Moda Fitness, Belíssima Moda Fitness, Duo Fitness, Beauty Moda Fitness — todos em tema de plataforma, grade de cards, carrossel e botão pílula. Nenhum usa índice, ficha ou nota de encomenda.
- **Material de marca existente:** nome "Estilosas Fitness" e o par **roxo `#8E428B` + branco**, definido pelo cliente e obrigatório. Sem logotipo vetorial, sem fotografia de produto, sem guia de marca. O itálico de Newsreader assume o papel de assinatura até que exista logotipo.
- **Elemento proprietário candidato:** **a nota de encomenda** — a sacola renderizada como formulário de pedido em papel (colunas tabulares, pontilhado condutor, nº da ficha, carimbo do total). Nenhum concorrente faz isso; todos fazem carrinho de e-commerce.

---

## Typography

- **Heading font:** **Archivo** variável (`wdth 62–125`, `wght 400–800`). Display em **`font-stretch: 72%`**, `wght 700`, caixa alta, `letter-spacing: -0.01em`.
- **Body font:** **Archivo** na mesma família, largura normal (`font-stretch: 100%`), `wght 400–500`. Um grotesco trabalhando, dois pesos.
- **Supporting font / voz humana:** **Newsreader** **itálico** (`wght 300–700`, opsz variável). Usado **só onde a loja fala com a cliente**: selo da capa, frase de promessa, anotações do processo, estados vazios, nota do rodapé. Nunca em botão, label de formulário ou dado tabular.
- **Por que este par / contraste:** a loja tem duas vozes e o par as encena — o **catálogo fala em grotesca condensada** (índice, preço, ficha, etiqueta) e **a pessoa fala em itálico serifado**. Condensada de cartaz + serif itálico editorial é alfaiataria, não SaaS. Refutação: se a loja trocar de modelo para checkout autosserviço, o itálico perde a função e o par deve virar grotesca + mono técnica.
- **Type scale** (`clamp`, razão ≈1.3):
  - Capa (h1): `clamp(3.25rem, 9vw + 1rem, 8.5rem)`, `lh 0.86`, tracking `-0.02em`
  - Seção (h2): `clamp(1.75rem, 2.6vw + 0.6rem, 2.75rem)`, `lh 1.02`
  - Item de ficha (h3): `1.125rem`, `lh 1.3`
  - Corpo: `1rem` / `lh 1.6` / máx `62ch`
  - UI: `0.875rem` (nav, botões, filtros, links) · etiquetas: `0.75rem` caixa alta `letter-spacing 0.14em` · **inputs e busca: `1rem`** (evita zoom automático do iOS no foco)
  - Badge sobre foto: `0.75rem` (subiu de 11px em 19/10/2026)
  - Voz (Newsreader itálico): `1.125–1.625rem`, `lh 1.5`
- **Line height:** display `0.86` · corpo `1.6` · UI `1.4` · itálico `1.5` · nomes de peça `1.3` (mínimo 1.25 em corpo, por descendente do itálico).
- **Letter spacing:** display condensado `-0.02em` · corpo `0` · etiqueta uppercase `0.14em` · número de ficha `0.02em`.
- **Regras de hierarquia:** o que é **número** usa `font-variant-numeric: tabular-nums` e largura fixa; o que é **nome** escala; o que é **categoria/tamanho** recede em tamanho e sobe em tracking; **preço nunca ganha cor de destaque** — destaque é o filete.
- **Suporte PT-BR:** confirmado nas duas famílias (latin-ext) — ação, ç, ã, õ, R$, %, dígitos tabulares.

---

## Color

- **Primary:** `#8E428B` — ação, filete de destaque, número de ficha selecionado, foco. É a cor do cliente; não é escolha de segmento (roxo não é a paleta automática de moda fitness, que é preto+vermelho ou nude).
- **Secondary:** `#3E1B3D` **berinjela** — escuro estrutural (seção "Como funciona", faixa de anúncio, carimbo do total, texto sobre lilás). Por que berinjela e não preto: mantém a família roxa no escuro e recusa o "AI dark mode" neutro.
- **Accent:** **nenhum segundo accent ativo.** Toda ênfase sai de `#8E428B`, `#3E1B3D` ou peso tipográfico.
- **Background:** `#FCFAFC` — branco com vibra de lilás, papel do caderno. É a cor dominante; ocupa >70% da página.
- **Surface:** `#FFFFFF` — a nota de encomenda, os campos. Superfície = folha nova.
- **Text:** `#1F1420` (tinta berinjela-escura) — 16,4:1 sobre o fundo.
- **Muted:** `#6B5A6C` — 6,1:1 sobre `#FCFAFC`; legendas, categorias, notas. É roxo dessaturado, não cinza neutro.
- **Borders:** `#E2D4E3` filete padrão · `#C9B2CB` filete de ênfase. Sempre 1px, nunca sombra.
- **Semantic colors:** erro `#8E2F4E` texto + `#F7EAEE` fundo + borda 2px (11,0:1) — sinalizado por borda e mensagem, nunca só por cor. Sucesso usa `#3E1B3D` sobre `#F2ECF3`. Aviso = texto + etiqueta, sem amarelo (paleta fechada roxo/branco por decisão do cliente).
- **Por que esta paleta:** roxo do cliente + berinjela derivado dele + branco dominante. **Não** é a paleta automática de moda fitness (preto com vermelho-escudo "Oferta") nem a de "premium" (bege + latão). Refutação: se a cliente trouxer logotipo com cor fora da família roxa, a secundária recalcula a partir dele e `#8E428B` migra para accent.

---

## Iconography

- **Família iconográfica:** **nenhuma biblioteca.** Glifos desenhados sob demanda em SVG inline, traço `currentColor`, `stroke-width: 1.5`, cantos retos.
- **Stroke/fill:** linha (stroke) em tudo, exceto o glifo do WhatsApp (fill, por reconhecimento da marca).
- **Peso:** 1,5px em 24px de viewBox.
- **Escala:** 16px (inline em link) · 20px (ação) · 24px (cabeçalho).
- **Regras de uso:** **máximo 3 ícones na página inteira.** Ícone só quando carrega significado que o texto não carrega (abrir sacola, voltar, enviar). Nunca decora card, lista, número de passo ou rodapé.
- **Substitutos preferidos de ícone:** número da ficha (`01`–`15`), filete, palavra escrita, foto da peça.
- **Ícones banidos neste projeto:** estrela (qualidade), escudo (segurança/compra segura), coração (favoritar), lâmpada (dica), foguete (crescimento), sparkles (premium), sacola genérica de e-commerce ilustrada (a sacola do header é de traço, no mesmo sistema do X), qualquer emoji. Ícone excepcional: as setas `←/→` (fileiras do índice e galeria da ficha da peça) são **glifos textuais em botão quadrado 2px**, não biblioteca de ícones.

---

## Imagery

- **Direção fotográfica (quando existir foto real):** editorial de moda documental — corpo em movimento real ou peça em flat-lay sobre superfície branca. Não é catálogo de marketplace.
- **Subject matter:** a peça e o caimento. Caimento em movimento (agachamento, corrida, caminhada), detalhe de costura e cós, flat-lay dobrado. **Nada de:** esteira com sorriso para câmera, aperto de mão, garrafa com estrela, mãos segurando celular.
- **Pessoas:** sem contato visual forçado, sem pose de stock. Corpo em uso, enquadramento em corte (cintura para baixo ou ombro para corte de topo).
- **Ambiente / cenário:** parede clara de casa, chão de madeira, luz de janela, ou estúdio com fundo `#FCFAFC`.
- **Iluminação:** natural lateral, dura o suficiente para sombra de dobra no tecido. Sem flash de estúdio chapado.
- **Composição e enquadramento:** retrato **3:4** em todo slot de peça. Espaço negativo no topo para o número de ficha caber sobre a imagem.
- **Tratamento de cor:** uma grade só — temperatura levemente fria, contraste médio, sem preset. A mesma em todas as fotos.
- **Proporções e crop:** capa (destaque) 3:4 · card/ficha de peça 3:4 · faixa editorial full-bleed 16:9.
- **O que evitar:** banco de imagens de academia genérico, mulheres sorrindo para câmera em legging posando para o app, sobreposição de gradiente roxo sobre foto, texto de marca estampado na foto.
- **Ilustração:** não usar. O grafismo deste projeto é tipográfico + filete.
- **Assets reais:** as fotos vivem no **bucket `produtos` do Supabase** e entram pelo painel administrativo (upload múltiplo, até 10 por peça, otimizadas para 1600px em WEBP); a URL pública é gravada em `products.imagens` (jsonb) e a primeira é a capa (`products.img_url`). A pasta `img/` do repositório guardou as fotos de licença livre do catálogo de demonstração (Unsplash, 18/10/2026) e **não é mais a fonte do site** — os arquivos locais servem só de material de partida para subir no painel. `ph` (cor de fundo) permanece como placeholder de carregamento e as fotos continuam em 3:4. Refutação: quando a loja enviar fotos próprias, basta subir no painel — nenhuma referência de código muda.

---

## Layout

- **Grid:** 12 colunas, `gutter 24px`, breakpoints `760px` (fluxo único) — o breakpoint de 1100px (índice + preview) caiu junto com o painel de preview.
- **Container width:** `1320px`, margens laterais `clamp(20px, 5vw, 64px)`. A faixa "Como funciona" e a capa rompem o container (full-bleed).
- **Spacing rhythm** (escala 8): `8 · 16 · 24 · 40 · 64 · 96 · 144`. Entre seções: `96px` desktop / `64px` mobile. Interno de seção: `40px`.
- **Alignment:** **esquerda por padrão.** Centralizar só: total da nota de encomenda e mensagem de vazio. Se centralizar em outro lugar, é desvio. Os cards de uma fileira alinham à esquerda com o filete do cabeçalho da fileira.
- **Density:** capa **baixa** (muito ar) → índice **média-alta** (cards editorial com filete) → processo **média** → colofão **alta**. A densidade cai e sobe com o momento, não é constante.
- **Asymmetry rules:** capa divide 7/5 (texto | foto do destaque). Processo divide 3 colunas **iguais** — é a única simetria deliberada da página, porque passo sequencial pede igualdade.
- **Ritmo de seções / famílias de layout** (nenhuma família se repete):
  1. **Capa** — editorial assimétrica 7/5, full-bleed, tipografia gigante com foto real na coluna direita. Sem linha de edição ("Vitrine nº …") — saiu em 19/10/2026.
  2. **Índice** — fileiras por categoria (Destaques → Leggings → Conjuntos → Tops → Shorts → Macacões → Blusinhas), cada uma com cabeçalho (título + contagem + setas) e trilho horizontal de **cards editoriais**.
  3. **Como funciona** — faixa full-bleed berinjela, 3 colunas iguais separadas por filete vertical.
  4. **Colofão (rodapé)** — bloco tipográfico denso multi-coluna, sem caixa.
  5. **Nota de encomenda (drawer)** — folha de papel com colunas tabulares e pontilhado condutor.
  6. **Ficha da peça (drawer)** — folha branca plana sobre a página: galeria de fotos 3:4 à esquerda, dados da peça à direita (desktop); no celular, galeria no topo e ficha rolável por baixo. Sem sombra, sem cantos arredondados além de 2px, filete de 1px separando galeria e dados.
- **Estruturas proibidas neste projeto:** a escadinha (hero → 3 cards → números → cards → depoimento → CTA); grade de cards iguais em 2D (a do índice é **fileira horizontal por categoria com scroll-snap**, não grade); pílula arredondada; herói centralizado com dois botões; número de passo em círculo; seção de depoimento (a loja não tem depoimento real e não inventamos); contadores animados de métrica; painel de preview lateral (removido 18/10/2026 — a foto real no card o tornou redundante); **zoom em lightbox** (a ficha mostra as fotos numa faixa rolável com miniaturas, sem modal de tela cheia); carrossel rotativo dentro da ficha.

---

## Shape Language

- **Border radius:** escala de **2 pontos apenas** — `2px` (campos, chips de tamanho, botões, etiquetas) e `0` (painéis, faixas, filetes, a nota). **Raio `999px` é proibido.**
- **Borders:** filete `1px` é o elemento estruturário principal da página — separa linhas do índice, colunas do processo, campos da nota. `2px` só em foco e erro. Substitui card, sombra e caixa.
- **Shadows:** **uma só** no projeto inteiro — a nota de encomenda sobre a página (`0 24px 60px -24px rgba(18, 14, 19, .3)`, sombra neutra de elevação), porque é literalmente uma folha de papel por cima. Nenhum card flutua. Nenhuma sombra colorida (halo roxo é marca registrada de UI gerada por IA; foi neutralizada em 18/10/2026). **A ficha da peça também não tem sombra** — ela é uma folha branca encostada na página, separada por filete.
- **Surface treatment:** superfícies planas. A textura vem do filete e da amostra de cor, não de gradiente.
- **Consistência de forma:** se tem borda arredondada, é 2px; se é bloco estrutural, é 0; se é separação, é filete 1px. Três estados, sem exceção.

---

## Motion

- **Motion personality:** **papel assentando** — nada flutua, nada aparece do nada; as coisas descem pouco e param. Contida, com um único momento teatral (a nota).
- **Duração:** micro `140ms` · transição `220ms` · momento grande `420ms`. Nada acima de 500ms.
- **Easing:** um só — `cubic-bezier(.2, .7, .2, 1)`. Sem bounce, sem spring, sem ease-in-out padrão.
- **Entrance animations:** (a) capa — as letras de "ESTILOSAS" descem 12px em stagger de 26ms, 420ms, uma vez. (b) **ficha da peça** — a folha desce 18px e assenta em 420ms, no mesmo gesto de "papel assentando" da nota. Nenhuma outra seção anima entrada (o stagger de filetes do índice saiu junto com a lista antiga).
- **Hover behavior:** card — a foto faz zoom sutil `scale(1.03)` em 420ms (única escala do projeto, porque a foto é o produto); seta de fileira — borda/texto viram `#8E428B`, 140ms. Link — sublinhado desenha da esquerda, 220ms. Botão — inverte fundo/texto, 140ms. **Sem elevação, sem sombra.**
- **Scroll behavior:** **não há** reveal por seção, parallax, pin nem scrub. O header esconde ao descer e volta ao subir (220ms) — única liga/desliga de scroll.
- **Microinterações:** contador da sacola troca de número sem animação (dígito só muda). Chip de tamanho marcado preenche em 140ms. Toast entra 8px de baixo, 220ms.
- **prefers-reduced-motion:** tudo colapsa para estado final imediato; transições de transform viram `opacity` instantânea; o stagger da capa e do índice não executa.

---

## Components

- **Buttons:** dois níveis, **cantos 2px**, sem pílula. Primário: fundo `#3E1B3D`, texto `#FFFFFF`, altura 48px, padding 0 24px, etiqueta em Archivo 500 uppercase 0.1em + glifo de seta 16px. Secundário: texto `#1F1420` com sublinhado 1px que desenha no hover. **Um intento de CTA por função** — a página inteira tem uma ação primária visível ("Ver o índice") e o resto é texto.
- **Cards:** **ficha editorial**, não card de e-commerce — foto 3:4 sangrada (sem raio na foto), filete 1px separando foto do corpo (no lugar de borda/caixa), badge de texto caixa-alta 12px com fundo berinjela no canto da foto, nome 18px + preço 16px na linha de base, chips de tamanho 32px de altura, botão "+ sacola" full-width 36px. Raio máximo 2px nos elementos internos. Sem nº de ficha no card (saiu em 19/10/2026 — o número vive só na nota). A ficha completa da peça **não é esta página de card**: ela é o drawer "ficha da peça", que abre por cima da vitrine.
- **Ficha da peça (drawer, 21/10/2026):** folha branca plana, **sem sombra**, sem raio além de 2px, largura `min(86dvh, 780px)` de altura no desktop e tela cheia no celular. Galeria à esquerda (faixa horizontal com scroll-snap, foto 3:4, largura calculada para a proporção), **miniaturas** embaixo (borda 2px `#8E428B` na ativa), setas `←`/`→` como glifos textuais em botão quadrado 2px (mesmo sistema das setas do índice) e contador "2 / 5" em numeração tabular. À direita: categoria em etiqueta, nome, preço (com "de" riscado quando houver), chips de tamanho, **cores** (amostra quadrada + nome sempre visível; selecionada = borda 2px `#8E428B`), ação "+ sacola", a **voz da loja** (Newsreader itálico: "Dúvida de tamanho? A gente orienta no WhatsApp." com o link "Perguntar sobre esta peça" em Archivo reto, que abre o WhatsApp já citando a peça) e o link "ver minha nota (N peças)". Regra: **uma só entrada de WhatsApp na ficha** - o botão com ícone saiu para não repetir o mesmo pedido duas vezes na mesma folha; assim a ficha tem um CTA primário ("+ sacola"), uma voz e um link. Teclado: `←`/`→` navegam na galeria, `Esc` fecha. Com uma foto só, setas e miniaturas somem. Rules: a ficha e a nota são mutuamente exclusivas (só uma aberta por vez); enquanto uma está aberta, o resto da página fica `inert` e o scroll do corpo travado; fechar devolve o foco ao card de origem; a ficha aberta por link direto (`?peca=<id>`) é fechável com o botão do browser sem sair da página. A **cor escolhida** entra no item da nota de encomenda (`id + tamanho + cor`) e aparece no WhatsApp.
- **Navigation:** cabeçalho de 56px, sem blur, sem transparência — fundo `#FCFAFC` sólido, filete embaixo. Esquerda: wordmark em condensada com o itálico "fitness" embaixo. Direita: 3 links de texto + botão da sacola = **ícone de sacola** (SVG autoral de traço, 24px, grade 24, traço 1.5, mesmo sistema do X) seguido do contador como **número tabular** — nunca badge circular, e o número some quando a sacola está vazia. Esconde ao descer, volta ao subir. Mobile: wordmark + ícone da sacola com contador. **Sacola flutuante** (19/10/2026): botão fixo canto inferior direito, berinjela, 48px, aparece com fade+8px quando há ≥1 peça, mostra o total, abre a nota; some quando a nota esvazia; `aria-expanded` sincronizado com a nota; o toast sobe para 84px quando ela está visível (não se sobrepõem).
- **Forms:** campos retangulares 2px, fundo branco, filete 1px, altura 48px, label em uppercase 12px acima (não placeholder flutuando), input a 16px (sem zoom automático do iOS). Erro: borda 2px + mensagem em texto, sempre com `role="alert"`.
- **Preço em duas formas (21/10/2026):** o preço à vista (Pix ou dinheiro) é **o número principal**; o "de" riscado vem acima dele e a queda percentual (`−20%`) ao lado, no mesmo peso de tinta. O preço de cartão é **apoio, nunca protagonist**: entra como linha menor (12px, `#6B5A6C`) abaixo do valor, e **só aparece quando é diferente do à vista** — peça sem preço de cartão não fala de cartão. O preço nunca ganha cor de destaque (vale na capa também: saiu do `#8E428B` para a tinta). No card, a linha de apoio cabe em uma só linha; na ficha, a mesma regra com o "à vista no Pix ou dinheiro" explicitado.
- **Detalhes da peça (21/10/2026):** bloco opcional abaixo do preço, separado por **filete 1px** (sem caixa, sem sombra). Rótulo "Detalhes" em caixa-alta 12px tracking 0.14em na tinta fraca; dentro, três linhas com rótulo próprio (Descrição, Composição, Cuidados) em caixa-alta 12px. Texto corrido em 15px, linha 1.55, no máximo 62 caracteres de largura. Peça sem texto escrito **não mostra o bloco** (sem título vazio).
- **Zoom da foto (21/10/2026):** clicar na foto da ficha amplia **2× a partir do ponto tocado** (`transform-origin` no ponteiro), e clicar de novo desfaz. O cursor muda `zoom-in`/`zoom-out`; sob `prefers-reduced-motion` a transição some, mas o zoom continua. É um gesto, não uma animação decorativa.
- **Compartilhar peça (21/10/2026):** link de texto "Compartilhar esta peça" na ficha, em tinta fraca. No celular abre a folha de compartilhar do aparelho; no desktop vai para a área de transferência com o aviso "Link da peça copiado." — **não é o WhatsApp**: compartilhar peça não é falar com a loja.
- **Nota de encomenda — forma de pagamento (21/10/2026):** a escolha (Pix / Dinheiro / Cartão) é **do pedido inteiro**, não da peça, e fica guardada no aparelho para a cliente não repetir. As três opções são **rádios com rótulo**, não pílula; o total muda junto ("Total no Pix" / "Total no Cartão") e o texto enviado ao WhatsApp diz a forma escolhida. Peça sem preço de cartão paga o mesmo valor em qualquer forma — a escolha nunca inventa preço.
- **Painel em abas (21/10/2026):** "Produtos | Configurações" em **texto com filete embaixo** (aba ativa = filete de 2px na tinta), sem pílula e sem cartão. A ordem das peças é **manual**, com **setas `↑`/`↓` textuais em botão quadrado 2px** (mesmo sistema das setas da vitrine); a ordem gravada é sempre contígua (0, 1, 2…). Os textos da peça têm **contador de caracteres** (600 / 200 / 300) e o preço de cartão é **opcional**, nunca menor que o à vista.
- **Configurações da loja (21/10/2026):** WhatsApp (só dígitos, com o 55), horário de atendimento, link de contato (só `http`/`https`), faixa de avisos (uma mensagem por linha) e a **peça em destaque** — que ocupa a capa do site. Tudo numa **tabela `settings`** (chave + valor em jsonb) lida pelo site e gravada pelo painel; se a tabela ainda não existir, o site segue no ar com o WhatsApp e a faixa que já estavam no código. A busca ignora acento ("macacao" acha "Macacão").
- **Badges:** etiqueta tipográfica — uppercase **12px** (era 10px → 11px em 18/10 → 12px em 19/10/2026, cada subida por legibilidade), tracking 0.14em, **fundo berinjela `#3E1B3D` + texto branco**, padding 5px 10px, posicionado no canto superior esquerdo da foto. "Oferta", "Lançamento" e "Mais vendida" usam texto, não cor de destaque. "Indisponível" risca o nome da peça (a foto recebe `opacity .5`, o texto nunca — contraste preservado). **Exceção documentada:** a amostra de cor da peça usa a **cor real do produto** (hex vinda do painel, validada como `#RRGGBB`); é o único lugar do projeto em que uma cor fora da paleta roxo/branco aparece — e ela representa o item, não a interface.
- **Sections:** ver Layout — 6 famílias, nenhuma repetida.
- **Estados obrigatórios:** vazio de busca (fala em itálico), vazio de sacola (fala em itálico + link), erro de formulário (borda + texto), sucesso (toast + contador), indisponível (risca + texto), carregando (a vitrine e o painel esperam o Supabase — no site o `ph` segura o lugar da foto enquanto a imagem vem; no painel o botão "salvar" mostra "Salvando…").

---

## Anti-AI Rules do projeto

- **Padrões a evitar:** pílula arredondada; grade de cards iguais em 2D; número de passo em círculo; gradiente decorativo (nenhum gradiente no projeto); glassmorphism/blur de header; sombra de card; carrossel automático/rotativo (o trilho do índice é manual, por categoria, com setas e scroll-snap — não gira sozinho); contadores animados; depoimento inventado; selo "site seguro"; emoji; Inter/Poppins/Roboto/Montserrat/Open Sans; ícone por item; halo de sombra colorida; caixa-alta em frases longas (máx ~40 caracteres por elemento); texto abaixo de 12px em corpo e 11px só em badge sobre foto.
- **Padrões genéricos detectados na base atual (v1) e correção:**
  1. Grade de 12 cards idênticos → **linha de índice + preview fixo** (v1) → **fileiras por categoria com cards editoriais e foto real** (v2, 18/10/2026).
  2. Par Archivo 800 display + Inter corpo (par "moderno" de IA) → **Archivo condensada + Newsreader itálico**, com funções separadas.
  3. Botões pílula 999px → **blocos 2px**.
  4. Header sticky com `backdrop-filter` → **sólido, esconde no scroll**.
  5. Gradiente radial roxo no herói → **removido; capa é tipográfica**.
  6. "Como funciona" em 3 círculos numerados → **faixa berinjela de 3 colunas iguais com filete vertical**.
  7. Placeholder de produto como letra gigante sobre gradiente → **painel de amostra de cor com etiqueta honesta** (v1) → **foto real 3:4 com `ph` só como placeholder de carregamento** (v2).
  8. Contador da sacola como badge circular colorido → **número tabular ao lado do ícone de sacola**.
  9. Sublinhado em gradiente (4×low-contrast + 4×paleta no detector) → **`::after` 1px sólido com scaleX**, 18/10/2026.
  10. Sombra colorida da nota (`rgba(62,27,61,.28)` → dark-glow) → **sombra neutra**; primeira card colada na borda do trilho (edge-flush) → **inset `--margem` dos dois lados com `scroll-padding`**; faixa com frase ≥40 chars em caixa-alta → **mensagens curtas ≤33 chars**. Detector `impeccable detect` rodou limpo (exit 0) em 18/10/2026.
- **Regras específicas deste projeto:** nenhum elemento recebe cor de destaque sem função; o preço nunca é o maior texto de uma linha; o itálico nunca aparece dentro de botão ou formulário; nunca mais de 3 ícones na página; se um componente puder ser resolvido com filete, ele é resolvido com filete.
- **Teste "remove the logo":** **passa.** Sem o nome, o design ainda pertence a esta empresa por três elementos concretos: (1) a **nota de encomenda** como carrinho — inexistente em qualquer concorrente do segmento, que usa checkout de marketplace; (2) o **índice numerado de fichas** em condensada com preço tabular, que é linguagem de caderno de ateliê, não de loja virtual; (3) a **voz em itálico serifado** reservada para a pessoa que responde, que codifica o atendimento personalizado — o argumento comercial real do negócio.

---

## Assets que dependem da empresa

O catálogo roda hoje com as **fotos de licença livre que já estavam em `img/`** (Unsplash, 18/10/2026) — elas não são mais lidas pelo site: o catálogo vem do Supabase e as fotos são **subidas pelo painel** (bucket `produtos`, `products.imagens`). Para trocar pelas fotos reais da loja, basta subir as fotos de cada peça no painel, na ordem desejada, e definir as cores. Ainda pendente da loja: **fotos 3:4 próprias de cada peça** (flat-lay ou caimento, luz natural), confirmação do **número de WhatsApp** (`script.js` → `CONFIG.whatsappFornecedor`), e — opcional — **logotipo vetorial**; sem ele, o wordmark tipográfico permanece.

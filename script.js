/* ============================================================
   Estilosas Fitness — catálogo, nota de encomenda e envio
   ------------------------------------------------------------
   CONFIGURAÇÃO: edite apenas o bloco CONFIG e a lista PRODUTOS.
   ============================================================ */

"use strict";

/* ------------------------------------------------------------------
   CONFIGURAÇÃO CENTRAL
   ------------------------------------------------------------------ */
const CONFIG = {
    nomeEmpresa: "Estilosas Fitness",

    // Número internacional (55 + DDD + número), sem espaços/hífens.
    // IMPORTANTE: troque pelo número real da loja antes de publicar.
    whatsappFornecedor: "5589981425420"
};

const CHAVE_LOCALSTORAGE = "nota_estilosasfitness_v2";

/* ------------------------------------------------------------------
   PEÇAS — dados de demonstração (troque por fotos e preços reais)
   Formato: { id, nome, preco, precoDe?, categoria, img, alt, ph,
             tamanhos, badge?, disponivel }
   img = arquivo em img/ (retrato 3:4) · ph = cor de fundo da foto
   ------------------------------------------------------------------ */
const PRODUTOS = [
    { id: 1,  nome: "Legging Cintura Alta Preta", preco: 89.90, categoria: "Leggings",
      img: "img/01-legging-preta.jpg", alt: "Legging preta de cintura alta em pose de treino", ph: "#3B3B44",
      tamanhos: ["P","M","G","GG"], badge: "Mais vendida", disponivel: true },
    { id: 2,  nome: "Legging Compressão Vinho", preco: 94.90, categoria: "Leggings",
      img: "img/02-legging-vinho.jpg", alt: "Legging de compressão em tom vinho em treino ao ar livre", ph: "#6E1F35",
      tamanhos: ["P","M","G"], disponivel: true },
    { id: 3,  nome: "Legging Cropped Cinza", preco: 84.90, precoDe: 99.90, categoria: "Leggings",
      img: "img/03-legging-cinza.jpg", alt: "Legging cropped cinza com regata preta", ph: "#5C5C66",
      tamanhos: ["P","M","G","GG"], badge: "Oferta", disponivel: true },
    { id: 4,  nome: "Conjunto Cropped + Legging Rosa", preco: 129.90, precoDe: 149.90, categoria: "Conjuntos",
      img: "img/04-conjunto-rosa.jpg", alt: "Conjunto rosa de cropped e legging em pose de treino", ph: "#D17E9B",
      tamanhos: ["P","M","G"], badge: "Oferta", disponivel: true },
    { id: 5,  nome: "Conjunto Fitness Malva", preco: 139.90, categoria: "Conjuntos",
      img: "img/05-conjunto-malva.jpg", alt: "Conjunto fitness malva em exercício de treino", ph: "#B99BA8",
      tamanhos: ["M","G","GG"], disponivel: true },
    { id: 6,  nome: "Conjunto Seamless Caramelo", preco: 149.90, categoria: "Conjuntos",
      img: "img/06-conjunto-caramelo.jpg", alt: "Conjunto seamless caramelo de top e legging", ph: "#9A6A45",
      tamanhos: ["P","M","G"], badge: "Lançamento", disponivel: true },
    { id: 7,  nome: "Top Regata Cropped Preto", preco: 49.90, categoria: "Tops",
      img: "img/07-top-preto.jpg", alt: "Top regata cropped preto em treino de academia", ph: "#26262C",
      tamanhos: ["P","M","G"], disponivel: true },
    { id: 8,  nome: "Top Sun Off-White", preco: 54.90, categoria: "Tops",
      img: "img/08-top-offwhite.jpg", alt: "Top off-white de alça fina com legging clara", ph: "#8C8478",
      tamanhos: ["P","M","G"], badge: "Lançamento", disponivel: true },
    { id: 9,  nome: "Top Decote Ciclista Verde", preco: 52.90, categoria: "Tops",
      img: "img/09-top-verde.jpg", alt: "Top esportivo verde de decote ciclista", ph: "#2E5943",
      tamanhos: ["P","M","G","GG"], disponivel: true },
    { id: 10, nome: "Short Compressão Preto", preco: 59.90, categoria: "Shorts",
      img: "img/10-short-preto.jpg", alt: "Short preto de compressão com regata branca em exercício", ph: "#26262C",
      tamanhos: ["P","M","G","GG"], disponivel: true },
    { id: 11, nome: "Short Ciclista Vermelho", preco: 64.90, categoria: "Shorts",
      img: "img/11-short-vermelho.jpg", alt: "Short ciclista vermelho com top preto", ph: "#8E2F3E",
      tamanhos: ["M","G"], disponivel: false },
    { id: 12, nome: "Macacão Fitness Laranja", preco: 159.90, categoria: "Macacões",
      img: "img/12-macacao-laranja.jpg", alt: "Macacão fitness laranja em pose de yoga ao ar livre", ph: "#C4652E",
      tamanhos: ["P","M","G"], badge: "Lançamento", disponivel: true },
    { id: 13, nome: "Macacão Studio Roxo", preco: 169.90, categoria: "Macacões",
      img: "img/13-macacao-roxo.jpg", alt: "Macacão roxo de treino segurando haltere na academia", ph: "#5B3A73",
      tamanhos: ["P","M","G","GG"], disponivel: true },
    { id: 14, nome: "Blusinha Manga Longa Rosa", preco: 79.90, categoria: "Blusinhas",
      img: "img/14-blusinha-rosa.jpg", alt: "Blusinha rosa de manga longa com short combinando", ph: "#D17E9B",
      tamanhos: ["P","M","G"], disponivel: true },
    { id: 15, nome: "Blusinha Cropped Caramelo", preco: 69.90, categoria: "Blusinhas",
      img: "img/15-blusinha-caramelo.jpg", alt: "Blusinha cropped caramelo em look de treino", ph: "#9A6A45",
      tamanhos: ["P","M","G"], disponivel: true }
];

const ORDEM_CATEGORIAS = ["Leggings", "Conjuntos", "Tops", "Shorts", "Macacões", "Blusinhas"];

/* ------------------------------------------------------------------
   ESTADO
   ------------------------------------------------------------------ */
const estado = {
    nota: [],               // [{ id, tamanho, quantidade }]
    categoria: "Todas",
    busca: "",
    tamEscolhido: {}        // produtoId -> tamanho escolhido no catálogo
};

/* ------------------------------------------------------------------
   UTILITÁRIOS
   ------------------------------------------------------------------ */
const el = (id) => document.getElementById(id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatarMoeda = (v) => brl.format(v);

const dois = (n) => String(n).padStart(2, "0");

function buscarProduto(id) {
    return PRODUTOS.find((p) => p.id === id);
}

function ficha(p) {
    return dois(PRODUTOS.indexOf(p) + 1);
}

const semMovimento = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------
   PERSISTÊNCIA
   ------------------------------------------------------------------ */
function salvarNota() {
    try {
        localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(estado.nota));
    } catch (e) { /* armazenamento indisponível */ }
}

function carregarNota() {
    try {
        const bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
        if (!bruto) return;
        const dados = JSON.parse(bruto);
        if (!Array.isArray(dados)) throw new Error("formato inválido");
        estado.nota = dados.filter((it) =>
            it && typeof it.id === "number" && buscarProduto(it.id) &&
            typeof it.tamanho === "string" &&
            Number.isFinite(it.quantidade) && it.quantidade >= 1
        ).map((it) => ({ id: it.id, tamanho: it.tamanho, quantidade: Math.floor(it.quantidade) }));
    } catch (e) {
        estado.nota = [];
    }
}

/* ------------------------------------------------------------------
   NOTA — operações
   ------------------------------------------------------------------ */
function adicionar(id, tamanho) {
    const p = buscarProduto(id);
    if (!p || !p.disponivel) return false;
    const existente = estado.nota.find((i) => i.id === id && i.tamanho === tamanho);
    if (existente) existente.quantidade += 1;
    else estado.nota.push({ id, tamanho, quantidade: 1 });
    salvarNota();
    renderNota();
    return true;
}

function alterarQuantidade(id, tamanho, delta) {
    const item = estado.nota.find((i) => i.id === id && i.tamanho === tamanho);
    if (!item) return;
    item.quantidade += delta;
    if (item.quantidade < 1) { removerItem(id, tamanho); return; }
    salvarNota();
    renderNota();
}

function removerItem(id, tamanho) {
    estado.nota = estado.nota.filter((i) => !(i.id === id && i.tamanho === tamanho));
    salvarNota();
    renderNota();
}

const subtotal = () => estado.nota.reduce((s, it) => {
    const p = buscarProduto(it.id);
    return s + (p ? p.preco * it.quantidade : 0);
}, 0);

const contarPecas = () => estado.nota.reduce((s, it) => s + it.quantidade, 0);

/* ------------------------------------------------------------------
   CATÁLOGO — filtros, fileiras e cards
   ------------------------------------------------------------------ */
function categorias() {
    return ["Todas", ...ORDEM_CATEGORIAS];
}

function filtrados() {
    const termo = estado.busca.trim().toLowerCase();
    return PRODUTOS.filter((p) => {
        const okCat = estado.categoria === "Todas" || p.categoria === estado.categoria;
        const okBusca = !termo || (p.nome + " " + p.categoria).toLowerCase().includes(termo);
        return okCat && okBusca;
    });
}

function renderFiltros() {
    const caixa = el("filtrosCategorias");
    caixa.innerHTML = "";
    categorias().forEach((cat) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "filtro";
        b.textContent = cat;
        b.setAttribute("aria-pressed", String(cat === estado.categoria));
        b.addEventListener("click", () => {
            estado.categoria = cat;
            renderFiltros();
            renderCatalogo();
        });
        caixa.appendChild(b);
    });
}

function cardProduto(p) {
    if (!estado.tamEscolhido[p.id]) estado.tamEscolhido[p.id] = p.tamanhos[0];
    const tam = estado.tamEscolhido[p.id];

    const li = document.createElement("li");
    li.className = "card-item" + (p.disponivel ? "" : " card-item--indisponivel");
    li.dataset.id = String(p.id);
    li.innerHTML = `
        <article class="card">
            <div class="card-foto" style="--ph:${p.ph}">
                <img src="${p.img}" alt="${p.alt}" loading="lazy" width="800" height="1067">
                ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ""}
            </div>
            <div class="card-corpo">
                <div class="card-linha1">
                    <h3 class="card-nome">${p.nome}</h3>
                    <p class="card-preco">${p.precoDe ? `<span class="de">${formatarMoeda(p.precoDe)}</span>` : ""}${formatarMoeda(p.preco)}</p>
                </div>
                <p class="card-cat">${p.categoria}</p>
                <fieldset class="tams" ${p.disponivel ? "" : "disabled"}>
                    <legend class="sr-only">Tamanho de ${p.nome}</legend>
                    ${p.tamanhos.map((t) => `
                        <button type="button" class="tam" data-tam="${t}"
                            aria-pressed="${t === tam}">${t}</button>`).join("")}
                </fieldset>
                <button type="button" class="item-add" data-add="${p.id}" ${p.disponivel ? "" : "disabled"}>+ sacola</button>
                ${p.disponivel ? "" : `<p class="aviso-item">Indisponível nesta edição</p>`}
            </div>
        </article>`;
    return li;
}

function montarFileira(titulo, pecas) {
    const sec = document.createElement("section");
    sec.className = "fileira";
    sec.innerHTML = `
        <div class="fileira-cab">
            <h3 class="fileira-titulo">${titulo}</h3>
            <span class="fileira-n">${pecas.length === 1 ? "1 peça" : pecas.length + " peças"}</span>
            <div class="fileira-setas">
                <button type="button" class="fileira-seta" data-dir="-1" aria-label="Ver peças anteriores de ${titulo}">←</button>
                <button type="button" class="fileira-seta" data-dir="1" aria-label="Ver mais peças de ${titulo}">→</button>
            </div>
        </div>
        <ul class="carrossel"></ul>`;
    const trilho = sec.querySelector(".carrossel");
    pecas.forEach((p) => trilho.appendChild(cardProduto(p)));
    return sec;
}

function renderCatalogo() {
    const box = el("catalogo");
    box.innerHTML = "";
    const itens = filtrados();

    el("contagem").textContent =
        itens.length === 1 ? "1 peça no índice" : `${itens.length} peças no índice`;
    el("vazioBusca").hidden = itens.length > 0;

    if (estado.categoria === "Todas" && !estado.busca.trim()) {
        const destaques = itens.filter((p) => p.badge);
        if (destaques.length) box.appendChild(montarFileira("Destaques", destaques));
    }

    ORDEM_CATEGORIAS.forEach((cat) => {
        const pecas = itens.filter((p) => p.categoria === cat);
        if (pecas.length) box.appendChild(montarFileira(cat, pecas));
    });
}

function configurarCatalogo() {
    const box = el("catalogo");
    box.addEventListener("click", (e) => {
        const seta = e.target.closest(".fileira-seta");
        if (seta) {
            const trilho = seta.closest(".fileira").querySelector(".carrossel");
            const card = trilho.querySelector(".card-item");
            const passo = card ? card.getBoundingClientRect().width + 24 : 300;
            trilho.scrollBy({
                left: Number(seta.dataset.dir) * passo,
                behavior: semMovimento() ? "auto" : "smooth"
            });
            return;
        }

        const tamBtn = e.target.closest(".tam");
        if (tamBtn) {
            const cardItem = tamBtn.closest(".card-item");
            const id = Number(cardItem.dataset.id);
            estado.tamEscolhido[id] = tamBtn.dataset.tam;
            cardItem.querySelectorAll(".tam").forEach((b) =>
                b.setAttribute("aria-pressed", String(b.dataset.tam === tamBtn.dataset.tam)));
            return;
        }

        const addBtn = e.target.closest("[data-add]");
        if (addBtn && !addBtn.disabled) {
            const id = Number(addBtn.dataset.add);
            const p = buscarProduto(id);
            if (adicionar(id, estado.tamEscolhido[id])) {
                addBtn.dataset.estado = "ok";
                addBtn.textContent = "na nota ✓";
                mostrarToast(`${p.nome} (tam. ${estado.tamEscolhido[id]}) na nota`);
                setTimeout(() => {
                    delete addBtn.dataset.estado;
                    addBtn.textContent = "+ sacola";
                }, 1600);
            }
        }
    });
}

/* ------------------------------------------------------------------
   NOTA DE ENCOMENDA — render
   ------------------------------------------------------------------ */
function renderNota() {
    const total = contarPecas();
    const contador = el("contadorSacola");
    contador.textContent = String(total);
    contador.hidden = total === 0;
    el("contadorSacolaTexto").textContent =
        total === 0 ? "sacola: nenhuma peça na nota"
        : total === 1 ? "sacola: 1 peça na nota"
        : `sacola: ${total} peças na nota`;

    const flut = el("sacolaFlutuante");
    flut.hidden = total === 0;
    el("sacolaFlutuanteN").textContent = String(total);
    el("sacolaFlutuanteTexto").textContent =
        total === 1 ? "Abrir nota de encomenda com 1 peça"
        : `Abrir nota de encomenda com ${total} peças`;
    if (total > 0) requestAnimationFrame(() => flut.classList.add("visivel"));
    else flut.classList.remove("visivel");

    const tbody = el("listaItens");
    const vazio = el("notaVazio");
    const resumo = el("notaResumo");
    tbody.innerHTML = "";

    const tem = estado.nota.length > 0;
    vazio.hidden = tem;
    resumo.hidden = !tem;

    estado.nota.forEach((it) => {
        const p = buscarProduto(it.id);
        if (!p) return;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="peca-n">${ficha(p)}</td>
            <td>
                <span class="peca-nome">${p.nome}</span>
                <span class="peca-meta">Tam. ${it.tamanho} · ${formatarMoeda(p.preco)} un.</span>
                <button type="button" class="peca-remover">remover</button>
            </td>
            <td>
                <span class="qtd">
                    <button type="button" data-dim="-1" aria-label="Diminuir quantidade de ${p.nome}">−</button>
                    <span aria-label="Quantidade">${it.quantidade}</span>
                    <button type="button" data-dim="1" aria-label="Aumentar quantidade de ${p.nome}">+</button>
                </span>
            </td>
            <td class="peca-total">${formatarMoeda(p.preco * it.quantidade)}</td>
        `;
        tr.querySelector('[data-dim="-1"]').addEventListener("click", () => alterarQuantidade(it.id, it.tamanho, -1));
        tr.querySelector('[data-dim="1"]').addEventListener("click", () => alterarQuantidade(it.id, it.tamanho, 1));
        tr.querySelector(".peca-remover").addEventListener("click", () => removerItem(it.id, it.tamanho));
        tbody.appendChild(tr);
    });

    el("subtotalTexto").textContent = formatarMoeda(subtotal());
    el("totalFormTexto").textContent = formatarMoeda(subtotal());
}

/* ------------------------------------------------------------------
   NOTA — abrir/fechar e etapas
   ------------------------------------------------------------------ */
let ultimoFoco = null;

function abrirNota() {
    ultimoFoco = document.activeElement;
    el("notaFundo").hidden = false;
    requestAnimationFrame(() => el("notaFundo").classList.add("visivel"));
    const nota = el("nota");
    nota.classList.add("aberta");
    nota.setAttribute("aria-hidden", "false");
    el("abrirNotaBtn").setAttribute("aria-expanded", "true");
    el("sacolaFlutuante").setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    el("fecharNotaBtn").focus();
}

function fecharNota() {
    const nota = el("nota");
    nota.classList.remove("aberta");
    nota.setAttribute("aria-hidden", "true");
    el("abrirNotaBtn").setAttribute("aria-expanded", "false");
    el("sacolaFlutuante").setAttribute("aria-expanded", "false");
    el("notaFundo").classList.remove("visivel");
    setTimeout(() => { el("notaFundo").hidden = true; }, 300);
    document.body.style.overflow = "";
    const alvo = ultimoFoco && ultimoFoco.isConnected && typeof ultimoFoco.focus === "function"
        && ultimoFoco !== document.body ? ultimoFoco : el("abrirNotaBtn");
    alvo.focus();
}

function mostrarEtapaDados() {
    if (estado.nota.length === 0) return;
    el("etapaPecas").hidden = true;
    el("etapaDados").hidden = false;
    el("campoNome").focus();
}

function mostrarEtapaPecas() {
    el("etapaDados").hidden = true;
    el("etapaPecas").hidden = false;
    el("erroForm").hidden = true;
}

/* ------------------------------------------------------------------
   FORMULÁRIO
   ------------------------------------------------------------------ */
function formaRecebimento() {
    const marcado = document.querySelector('input[name="forma"]:checked');
    return marcado ? marcado.value : "entrega";
}

function atualizarBlocoEndereco() {
    const ehEntrega = formaRecebimento() === "entrega";
    el("blocoEndereco").hidden = !ehEntrega;
    el("campoEndereco").required = ehEntrega;
    if (!ehEntrega) {
        el("campoEndereco").removeAttribute("aria-invalid");
        el("campoBairro").removeAttribute("aria-invalid");
    }
}

function dadosDoFormulario() {
    return {
        nome: el("campoNome").value.trim(),
        telefone: el("campoTelefone").value.trim(),
        forma: formaRecebimento(),
        endereco: el("campoEndereco").value.trim(),
        bairro: el("campoBairro").value.trim(),
        observacoes: el("campoObs").value.trim()
    };
}

function validarFormulario(dados) {
    const pendentes = [];
    ["campoNome", "campoTelefone"].forEach((id) => {
        const campo = el(id);
        const vazio = campo.value.trim() === "";
        campo.setAttribute("aria-invalid", String(vazio));
        if (vazio) pendentes.push(campo);
    });
    if (dados.forma === "entrega" && !dados.endereco) {
        el("campoEndereco").setAttribute("aria-invalid", "true");
        pendentes.push(el("campoEndereco"));
    }
    if (pendentes.length > 0) {
        const erro = el("erroForm");
        const soEndereco = pendentes.length === 1 && pendentes[0] === el("campoEndereco");
        erro.textContent = soEndereco
            ? "Faltou o endereço de entrega."
            : "Faltou preencher os campos marcados com *.";
        erro.hidden = false;
        pendentes[0].focus();
        return false;
    }
    el("erroForm").hidden = true;
    return true;
}

/* ------------------------------------------------------------------
   MENSAGEM + WHATSAPP
   ------------------------------------------------------------------ */
const urlWhatsApp = () => "https://wa.me/" + CONFIG.whatsappFornecedor;

function gerarMensagem() {
    const d = dadosDoFormulario();
    const l = [];
    l.push(`Olá, ${CONFIG.nomeEmpresa}! Montei minha nota de encomenda pelo site.`);
    l.push("");
    l.push("*NOTA DE ENCOMENDA*");
    l.push("");
    l.push("*Cliente:* " + d.nome);
    l.push("*Telefone:* " + d.telefone);
    l.push("");
    l.push("*PEÇAS:*");

    estado.nota.forEach((it) => {
        const p = buscarProduto(it.id);
        if (!p) return;
        l.push(`${ficha(p)} · ${it.quantidade}x ${p.nome} (Tam. ${it.tamanho}) — ${formatarMoeda(p.preco * it.quantidade)}`);
    });

    l.push("");
    l.push("*Total das peças:* " + formatarMoeda(subtotal()));
    l.push("");
    l.push("*Recebimento:* " + (d.forma === "entrega" ? "Entrega" : "Retirada no local"));
    if (d.forma === "entrega") {
        l.push("Endereço: " + d.endereco + (d.bairro ? " — Bairro: " + d.bairro : ""));
    }
    if (d.observacoes) {
        l.push("");
        l.push("*Aviso para a loja:* " + d.observacoes);
    }
    l.push("");
    l.push("Pode confirmar disponibilidade, pagamento e frete?");
    return l.join("\n");
}

function enviarPedido(e) {
    e.preventDefault();
    const dados = dadosDoFormulario();
    if (!validarFormulario(dados)) return;
    window.open(urlWhatsApp() + "?text=" + encodeURIComponent(gerarMensagem()), "_blank", "noopener");
    mostrarToast("Abrindo o WhatsApp com a sua nota…");
    setTimeout(fecharNota, 900);
}

/* ------------------------------------------------------------------
   TOAST + FAIXA DE AVISOS
   ------------------------------------------------------------------ */
let toastTimer = null;

function mostrarToast(msg) {
    const toast = el("toast");
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("visivel"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("visivel");
        setTimeout(() => { toast.hidden = true; }, 300);
    }, 2600);
}

function rotacionarAvisos() {
    const mensagens = [
        "Atendimento direto com a loja",
        "Sem cadastro para montar sua nota",
        "Pagamento e frete no atendimento",
        "Orientação de tamanho no WhatsApp"
    ];
    let i = 0;
    const no = el("faixaMsg");
    setInterval(() => {
        i = (i + 1) % mensagens.length;
        no.classList.remove("ativa");
        setTimeout(() => {
            no.textContent = mensagens[i];
            no.classList.add("ativa");
        }, 400);
    }, 4600);
}

/* ------------------------------------------------------------------
   MOVIMENTO — capa, cabeçalho
   ------------------------------------------------------------------ */
function animarCapa() {
    const titulo = el("capaTitulo");
    if (!titulo) return;
    const letras = titulo.querySelectorAll(".capa-letra");
    letras.forEach((l, i) => { l.style.transitionDelay = `${i * 26}ms`; });
    requestAnimationFrame(() => requestAnimationFrame(() => titulo.classList.add("capa-titulo--dentro")));
}

function controleTopo() {
    const topo = el("topo");
    let anterior = window.scrollY;
    window.addEventListener("scroll", () => {
        const y = window.scrollY;
        const descendo = y > anterior;
        if (descendo && y > 220) topo.classList.add("topo--escondido");
        else topo.classList.remove("topo--escondido");
        anterior = y;
    }, { passive: true });
}

/* ------------------------------------------------------------------
   INICIALIZAÇÃO
   ------------------------------------------------------------------ */
function destacarCapa() {
    const p = PRODUTOS[0];
    const img = el("capaImg");
    img.src = p.img;
    img.alt = p.alt;
    el("capaFicha").textContent = ficha(p);
    el("capaDestaqueNome").textContent = p.nome;
    el("capaDestaquePreco").textContent = formatarMoeda(p.preco);
}

function configurarBusca() {
    const campo = el("buscaInput");
    campo.addEventListener("input", (e) => {
        estado.busca = e.target.value;
        renderCatalogo();
    });
    el("limparBusca").addEventListener("click", () => {
        estado.busca = "";
        estado.categoria = "Todas";
        campo.value = "";
        renderFiltros();
        renderCatalogo();
        campo.focus();
    });
}

function configurarEventos() {
    el("abrirNotaBtn").addEventListener("click", abrirNota);
    el("sacolaFlutuante").addEventListener("click", abrirNota);
    el("fecharNotaBtn").addEventListener("click", fecharNota);
    el("notaFundo").addEventListener("click", fecharNota);
    el("irParaIndice").addEventListener("click", () => {
        fecharNota();
        el("indice").scrollIntoView();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && el("nota").classList.contains("aberta")) fecharNota();
    });

    el("btnContinuar").addEventListener("click", mostrarEtapaDados);
    el("btnVoltar").addEventListener("click", mostrarEtapaPecas);
    el("etapaDados").addEventListener("submit", enviarPedido);

    document.querySelectorAll('input[name="forma"]').forEach((r) =>
        r.addEventListener("change", atualizarBlocoEndereco));

    el("rodapeWhatsLink").href = urlWhatsApp();
}

function iniciar() {
    carregarNota();
    destacarCapa();
    configurarBusca();
    configurarCatalogo();
    renderFiltros();
    renderCatalogo();
    renderNota();
    configurarEventos();
    atualizarBlocoEndereco();
    rotacionarAvisos();
    animarCapa();
    controleTopo();
    el("anoAtual").textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", iniciar);

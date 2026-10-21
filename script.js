/* ============================================================
   Estilosas Fitness — catálogo dinâmico, nota de encomenda e envio
   ------------------------------------------------------------
   O catálogo vem do Supabase (banco na nuvem) e é atualizado em
   tempo real em todos os aparelhos com o site aberto.
   Painel administrativo: admin.html
   ============================================================ */

"use strict";

import { db, esc, validarImgUrl, corSegura, COLUNAS_PRODUTO, COLUNAS_PRODUTO_SIMPLES, normalizarProduto, lerSettings, erroColunaFalta } from "./supabase/client.js?v=20261021c";
import {
    AVISOS_PADRAO,
    FORMAS_PAGAMENTO,
    ROTULO_PAGAMENTO,
    ordenarCategorias,
    ordenarProdutos,
    precoDaPeca,
    precosDeExibicao,
    semAcento
} from "./loja.js?v=20261021c";

/* ------------------------------------------------------------------
   CONFIGURAÇÃO CENTRAL
   ------------------------------------------------------------------ */
const CONFIG = {
    nomeEmpresa: "Estilosas Fitness",

    // Número internacional (55 + DDD + número), sem espaços/hífens.
    whatsappFornecedor: "5589981425420"
};

const CHAVE_LOCALSTORAGE = "nota_estilosasfitness_v2";
const CHAVE_CATALOGO = "catalogo_v2";
const CHAVE_PAGAMENTO = "pagamento_estilosasfitness_v1";

/* ------------------------------------------------------------------
   ESTADO
   ------------------------------------------------------------------ */
const estado = {
    produtos: [],           // já normalizados: [{ id, nome, preco, imagens, cores, ... }]
    carregando: true,       // ainda não temos nem cache nem banco
    nota: [],               // [{ id, tamanho, cor, quantidade }] — ids são uuid (text)
    categoria: "Todas",
    busca: "",
    tamEscolhido: {},       // produtoId -> tamanho escolhido no catálogo
    corEscolhida: {},       // produtoId -> nome da cor escolhida
    pecaId: null,           // id da peça aberta na ficha (null = fechada)
    pecaAssinatura: "",     // controle de mudanças enquanto a ficha está aberta
    formaPagamento: "pix",  // forma escolhida na nota (pix | dinheiro | cartao)
    settings: {             // configurações da loja (vindas do banco)
        whatsapp: "",
        horario: "",
        faixa: [],
        destaque: null,
        contato: ""
    }
};

/* ------------------------------------------------------------------
   UTILITÁRIOS
   ------------------------------------------------------------------ */
const el = (id) => document.getElementById(id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatarMoeda = (v) => brl.format(Number(v) || 0);

const dois = (n) => String(n).padStart(2, "0");

function buscarProduto(id) {
    return estado.produtos.find((p) => p.id === id);
}

function ficha(p) {
    return dois(estado.produtos.indexOf(p) + 1);
}

const semMovimento = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Normaliza a linha do banco para o formato usado na tela.
   A normalização mora em supabase/client.js (fonte única para o
   site e o painel). */
const normalizar = (linha) => normalizarProduto(linha);

function ordenar() {
    estado.produtos = ordenarProdutos(estado.produtos);
}

/* Tamanho marcado para a peça (o primeiro quando nenhum vale). */
function tamanhoEscolhido(p) {
    if (!p || !p.tamanhos.length) return "";
    const atual = estado.tamEscolhido[p.id];
    if (atual && p.tamanhos.includes(atual)) return atual;
    estado.tamEscolhido[p.id] = p.tamanhos[0];
    return p.tamanhos[0];
}

/* Cor marcada para a peça (a primeira quando nenhuma vale). */
function corEscolhida(p) {
    if (!p || !p.cores.length) return "";
    const atual = estado.corEscolhida[p.id];
    if (atual && p.cores.some((c) => c.nome === atual)) return atual;
    estado.corEscolhida[p.id] = p.cores[0].nome;
    return p.cores[0].nome;
}

/* Categorias na ordem do painel (a peça mais alta de cada
   categoria define a ordem da fileira). */
function categorias() {
    return ["Todas", ...ordenarCategorias(estado.produtos)];
}

/* ------------------------------------------------------------------
   PERSISTÊNCIA — sacola e cache do catálogo
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
            it && typeof it.id === "string" && buscarProduto(it.id) &&
            typeof it.tamanho === "string" &&
            Number.isFinite(it.quantidade) && it.quantidade >= 1
        ).map((it) => ({
            id: it.id,
            tamanho: it.tamanho,
            cor: typeof it.cor === "string" ? it.cor : "",
            quantidade: Math.floor(it.quantidade)
        }));
    } catch (e) {
        estado.nota = [];
    }
}

/* O cache guarda o catálogo JÁ NORMALIZADO. Reprocessar esse
   formato é seguro: normalizarProduto() aceita a linha do banco e
   o objeto normalizado sem perder foto, preço ou cor. */
function salvarCatalogo() {
    try {
        localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(estado.produtos));
    } catch (e) { /* armazenamento indisponível */ }
}

function carregarCatalogoDoCache() {
    try {
        const bruto = localStorage.getItem(CHAVE_CATALOGO);
        if (!bruto) return false;
        const dados = JSON.parse(bruto);
        if (!Array.isArray(dados) || dados.length === 0) return false;
        const validos = dados
            .filter((p) => p && typeof p.id === "string" && typeof p.nome === "string")
            .map(normalizar)
            .filter(Boolean);
        if (validos.length === 0) return false;
        estado.produtos = validos;
        ordenar();
        return true;
    } catch (e) {
        return false;
    }
}

/* ------------------------------------------------------------------
   NOTA — operações
   ------------------------------------------------------------------
   A chave de unicidade do item é id + tamanho + cor: a mesma peça
   em duas cores são duas linhas diferentes na nota.
   ------------------------------------------------------------------ */
function adicionar(id, tamanho, cor) {
    const p = buscarProduto(id);
    if (!p || !p.disponivel) return false;
    const corLimpa = cor || "";
    const existente = estado.nota.find((i) =>
        i.id === id && i.tamanho === tamanho && (i.cor || "") === corLimpa);
    if (existente) existente.quantidade += 1;
    else estado.nota.push({ id, tamanho, cor: corLimpa, quantidade: 1 });
    salvarNota();
    renderNota();
    return true;
}

function alterarQuantidade(id, tamanho, cor, delta) {
    const corLimpa = cor || "";
    const item = estado.nota.find((i) =>
        i.id === id && i.tamanho === tamanho && (i.cor || "") === corLimpa);
    if (!item) return;
    item.quantidade += delta;
    if (item.quantidade < 1) { removerItem(id, tamanho, corLimpa); return; }
    salvarNota();
    renderNota();
}

function removerItem(id, tamanho, cor) {
    const corLimpa = cor || "";
    estado.nota = estado.nota.filter((i) =>
        !(i.id === id && i.tamanho === tamanho && (i.cor || "") === corLimpa));
    salvarNota();
    renderNota();
}

/* Preço da peça conforme a forma de pagamento escolhida na nota. */
const precoItem = (p) => precoDaPeca(p, estado.formaPagamento);

const subtotal = () => estado.nota.reduce((s, it) => {
    const p = buscarProduto(it.id);
    return s + (p ? precoItem(p) * it.quantidade : 0);
}, 0);

const contarPecas = () => estado.nota.reduce((s, it) => s + it.quantidade, 0);

/* ------------------------------------------------------------------
   DADOS — banco + tempo real
   ------------------------------------------------------------------ */
async function buscarDoBanco() {
    const { data, error } = await db
        .from("products")
        .select(COLUNAS_PRODUTO)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizar).filter(Boolean);
}

/* Se as colunas da Fase 2 ainda não existirem no banco (a migração
   002 não rodou), o site continua no ar mostrando o catálogo
   antigo, sem preços de cartão, detalhes nem ordem manual. */
async function buscarDoBancoSimples() {
    const { data, error } = await db
        .from("products")
        .select(COLUNAS_PRODUTO_SIMPLES)
        .order("criado_em", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizar).filter(Boolean);
}

async function carregarCatalogo() {
    const tinhaCache = carregarCatalogoDoCache();
    if (tinhaCache) {
        estado.carregando = false;
        renderTudo();
    } else {
        renderTudo();
    }

    try {
        let doBanco;
        try {
            doBanco = await buscarDoBanco();
        } catch (e) {
            if (!erroColunaFalta(e)) throw e;
            doBanco = await buscarDoBancoSimples();
        }
        estado.produtos = doBanco;
        estado.carregando = false;
        ordenar();
        salvarCatalogo();
        renderTudo();
    } catch (e) {
        estado.carregando = estado.produtos.length === 0;
        renderTudo();
        if (!tinhaCache) {
            mostrarToast("Não conseguimos carregar o catálogo agora. Tente recarregar.");
        }
    }
}

function assinarTempoReal() {
    db.channel("catalogo-tempo-real")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
            const { eventType, new: novo, old: antigo } = payload;
            if (eventType === "INSERT" && novo) {
                if (!buscarProduto(novo.id)) estado.produtos.push(normalizar(novo));
            } else if (eventType === "UPDATE" && novo) {
                const i = estado.produtos.findIndex((p) => p.id === novo.id);
                if (i >= 0) estado.produtos[i] = normalizar(novo);
                else estado.produtos.push(normalizar(novo));
            } else if (eventType === "DELETE" && antigo) {
                estado.produtos = estado.produtos.filter((p) => p.id !== antigo.id);
            }
            ordenar();
            salvarCatalogo();
            renderTudo();
        })
        .subscribe();
}

/* ------------------------------------------------------------------
   CONFIGURAÇÕES DA LOJA
   ------------------------------------------------------------------
   Vêm da tabela settings. Se a tabela ainda não existir, o site
   segue no ar com o que está no código — nada quebra.
   ------------------------------------------------------------------ */
async function carregarConfiguracoes() {
    estado.settings = await lerSettings();
    aplicarConfiguracoes();
}

function aplicarConfiguracoes() {
    el("rodapeWhatsLink").href = urlWhatsApp();

    if (estado.settings.horario) {
        el("rodapeHorario").textContent = estado.settings.horario;
    }

    const contato = el("rodapeContato");
    if (estado.settings.contato) {
        contato.href = estado.settings.contato;
        contato.hidden = false;
    } else {
        contato.hidden = true;
    }
}

/* ------------------------------------------------------------------
   CATÁLOGO — filtros, fileiras e cards
   ------------------------------------------------------------------ */
function filtrados() {
    /* A busca ignora acento dos dois lados: "macacao" acha "Macacão". */
    const termo = semAcento(estado.busca.trim());
    return estado.produtos.filter((p) => {
        const okCat = estado.categoria === "Todas" || p.categoria === estado.categoria;
        const okBusca = !termo || semAcento(p.nome + " " + p.categoria).includes(termo);
        return okCat && okBusca;
    });
}

function renderFiltros() {
    const caixa = el("filtrosCategorias");
    caixa.innerHTML = "";
    const todas = categorias();
    if (!todas.includes(estado.categoria)) estado.categoria = "Todas";
    todas.forEach((cat) => {
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

/* Imagem opcional: só renderiza <img> se a URL for do bucket do projeto. */
function imagemDoCard(p) {
    if (!validarImgUrl(p.img)) return "";
    return `<img src="${esc(p.img)}" alt="${esc(p.alt)}" loading="lazy" width="800" height="1067">`;
}

/* ------------------------------------------------------------------
   PREÇO
   ------------------------------------------------------------------
   O preço à vista (Pix ou dinheiro) é o número principal. O preço
   riscado e a queda percentual vêm logo depois; o preço de cartão
   entra como apoio, só quando é diferente do à vista — peça sem
   preço de cartão não fala de cartão.
   ------------------------------------------------------------------ */
function blocoPreco(p, mostrarAvista) {
    const r = precosDeExibicao(p);
    const linha = [];
    if (r.de) linha.push(`<span class="de">${formatarMoeda(r.de)}</span>`);
    linha.push(`<span class="preco-valor">${formatarMoeda(r.valor)}</span>`);
    if (r.percentual !== null) {
        linha.push(`<span class="preco-desconto">−${r.percentual}%</span>`);
    }

    const apoio = [];
    if (mostrarAvista) apoio.push(`<span class="preco-aux">à vista no Pix ou dinheiro</span>`);
    if (r.cartao !== null) apoio.push(`<span class="preco-aux">no cartão ${formatarMoeda(r.cartao)}</span>`);

    return linha.join("")
        + (apoio.length ? `<span class="preco-aux-linha">${apoio.join("")}</span>` : "");
}

function cardProduto(p) {
    const tam = tamanhoEscolhido(p);
    const cor = corEscolhida(p);

    const li = document.createElement("li");
    li.className = "card-item" + (p.disponivel ? "" : " card-item--indisponivel");
    li.dataset.id = p.id;
    li.innerHTML = `
        <article class="card">
            <div class="card-foto" style="--ph:${esc(p.ph)}">
                <button type="button" class="card-abrir" data-peca="${esc(p.id)}">
                    ${imagemDoCard(p)}
                    <span class="sr-only">Ver a peça em detalhe</span>
                </button>
                ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ""}
            </div>
            <div class="card-corpo">
                <div class="card-linha1">
                    <h3 class="card-nome">
                        <button type="button" class="card-nome-btn" data-peca="${esc(p.id)}">${esc(p.nome)}<span class="sr-only"> — ver a peça em detalhe</span></button>
                    </h3>
                    <p class="card-preco">${blocoPreco(p, false)}</p>
                </div>
                <p class="card-cat">${esc(p.categoria)}</p>
                <fieldset class="tams" ${p.disponivel ? "" : "disabled"}>
                    <legend class="sr-only">Tamanho de ${esc(p.nome)}</legend>
                    ${p.tamanhos.map((t) => `
                        <button type="button" class="tam" data-tam="${esc(t)}"
                            aria-pressed="${t === tam}">${esc(t)}</button>`).join("")}
                </fieldset>
                <button type="button" class="item-add" data-add="${esc(p.id)}" ${p.disponivel ? "" : "disabled"}>+ sacola</button>
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
            <h3 class="fileira-titulo">${esc(titulo)}</h3>
            <span class="fileira-n">${pecas.length === 1 ? "1 peça" : pecas.length + " peças"}</span>
            <div class="fileira-setas">
                <button type="button" class="fileira-seta" data-dir="-1" aria-label="Ver peças anteriores de ${esc(titulo)}">←</button>
                <button type="button" class="fileira-seta" data-dir="1" aria-label="Ver mais peças de ${esc(titulo)}">→</button>
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
    el("vazioBusca").hidden = !(itens.length === 0 && estado.produtos.length > 0);
    el("catalogoCarregando").hidden = !estado.carregando;
    el("catalogoVazio").hidden = !(estado.produtos.length === 0 && !estado.carregando);

    if (estado.categoria === "Todas" && !estado.busca.trim()) {
        const destaques = itens.filter((p) => p.badge);
        if (destaques.length) box.appendChild(montarFileira("Destaques", destaques));
    }

    categorias().filter((c) => c !== "Todas").forEach((cat) => {
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

        const abrirBtn = e.target.closest("[data-peca]");
        if (abrirBtn) {
            abrirFicha(abrirBtn.dataset.peca);
            return;
        }

        const tamBtn = e.target.closest(".tam");
        if (tamBtn) {
            const cardItem = tamBtn.closest(".card-item");
            const id = cardItem.dataset.id;
            estado.tamEscolhido[id] = tamBtn.dataset.tam;
            cardItem.querySelectorAll(".tam").forEach((b) =>
                b.setAttribute("aria-pressed", String(b.dataset.tam === tamBtn.dataset.tam)));
            sincronizarTamanhoFicha(id);
            return;
        }

        const addBtn = e.target.closest("[data-add]");
        if (addBtn && !addBtn.disabled) {
            const id = addBtn.dataset.add;
            const p = buscarProduto(id);
            const tam = tamanhoEscolhido(p);
            const cor = corEscolhida(p);
            if (adicionar(id, tam, cor)) {
                addBtn.dataset.estado = "ok";
                addBtn.textContent = "na nota ✓";
                mostrarToast(`${p.nome} (tam. ${tam}${cor ? " · " + cor : ""}) na nota`);
                setTimeout(() => {
                    delete addBtn.dataset.estado;
                    addBtn.textContent = "+ sacola";
                }, 1600);
            }
        }
    });
}

/* ------------------------------------------------------------------
   FICHA DA PEÇA — galeria, cores e a peça em si
   ------------------------------------------------------------------
   A ficha e a nota nunca coexistem: uma fecha quando a outra abre.
   O fundo (#notaFundo) é compartilhado pelas duas.
   ------------------------------------------------------------------ */
let travaScroll = 0;
let fotoAtiva = 0;
let observadorFotos = null;
let focoAnteriorPeca = null;

function urlSemPeca() {
    const u = new URL(window.location.href);
    u.searchParams.delete("peca");
    return u.pathname + u.search + u.hash;
}

function pecaDaURL() {
    try {
        return new URL(window.location.href).searchParams.get("peca") || null;
    } catch (e) { return null; }
}

/* Trava a rolagem do fundo (contador: ficha e nota nunca ficam
   abertas ao mesmo tempo, mas a trava precisa ser simétrica). */
function travarScroll() {
    travaScroll += 1;
    if (travaScroll === 1) document.body.style.overflow = "hidden";
}

function destravarScroll() {
    travaScroll = Math.max(0, travaScroll - 1);
    if (travaScroll === 0) document.body.style.overflow = "";
}

/* Escala o resto da página enquanto um diálogo está aberto. */
function aplicarInert(ligado) {
    ["topo", "principal", "colofao", "sacolaFlutuante"].forEach((id) => {
        const alvo = el(id);
        if (alvo) alvo.inert = ligado;
    });
}

function prenderFoco(e, caixa) {
    const focaveis = Array.from(caixa.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
    }
}

/* Galeria ------------------------------------------------------------ */
function renderGaleria(p) {
    const faixa = el("galeriaFaixa");
    const minis = el("galeriaMinis");
    faixa.innerHTML = "";
    minis.innerHTML = "";
    if (observadorFotos) { observadorFotos.disconnect(); observadorFotos = null; }
    limparZoom();

    const fotos = p.imagens;
    const varias = fotos.length > 1;
    el("galeriaAnt").hidden = !varias;
    el("galeriaProx").hidden = !varias;
    el("galeriaMinis").hidden = !varias;

    if (fotos.length === 0) {
        const vazio = document.createElement("div");
        vazio.className = "peca-foto peca-foto--vazia";
        vazio.style.setProperty("--ph", p.ph);
        faixa.appendChild(vazio);
        el("galeriaContador").textContent = "";
        return;
    }

    fotos.forEach((url, i) => {
        const slide = document.createElement("div");
        slide.className = "peca-foto";
        slide.dataset.i = String(i);
        slide.style.setProperty("--ph", p.ph);

        const img = document.createElement("img");
        img.src = url;
        img.alt = i === 0 ? p.alt : `${p.alt} — foto ${i + 1} de ${fotos.length}`;
        img.loading = i === 0 ? "eager" : "lazy";
        img.width = 800;
        img.height = 1067;
        slide.appendChild(img);
        faixa.appendChild(slide);

        const mini = document.createElement("button");
        mini.type = "button";
        mini.className = "peca-mini";
        mini.dataset.i = String(i);
        mini.setAttribute("aria-label", `Ver a foto ${i + 1} de ${fotos.length}`);
        const miniImg = document.createElement("img");
        miniImg.src = url;
        miniImg.alt = "";
        miniImg.loading = "lazy";
        miniImg.width = 120;
        miniImg.height = 160;
        mini.appendChild(miniImg);
        minis.appendChild(mini);
    });

    /* Pré-carrega a próxima foto: ela aparece antes de o dedo chegar. */
    if (fotos[1]) { const pre = new Image(); pre.src = fotos[1]; }

    observadorFotos = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
            if (e.isIntersecting) marcarFoto(Number(e.target.dataset.i));
        });
    }, { root: faixa, threshold: 0.55 });
    faixa.querySelectorAll(".peca-foto").forEach((f) => observadorFotos.observe(f));

    faixa.scrollLeft = 0;
    marcarFoto(0);
}

function marcarFoto(i) {
    const total = el("galeriaFaixa").querySelectorAll(".peca-foto").length;
    if (!total) return;
    fotoAtiva = Math.max(0, Math.min(i, total - 1));
    el("galeriaContador").textContent = `${fotoAtiva + 1} / ${total}`;
    el("galeriaMinis").querySelectorAll(".peca-mini").forEach((b) => {
        const ativo = Number(b.dataset.i) === fotoAtiva;
        b.classList.toggle("ativa", ativo);
        if (ativo) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
    });
}

function irParaFoto(i) {
    const faixa = el("galeriaFaixa");
    const slide = faixa.querySelector(`.peca-foto[data-i="${i}"]`);
    if (!slide) return;
    faixa.scrollTo({
        left: slide.offsetLeft,
        behavior: semMovimento() ? "auto" : "smooth"
    });
}

function moverFoto(dir) {
    const faixa = el("galeriaFaixa");
    const slide = faixa.querySelector(`.peca-foto[data-i="${fotoAtiva}"]`);
    const passo = slide ? slide.getBoundingClientRect().width : faixa.clientWidth;
    faixa.scrollBy({
        left: dir * passo,
        behavior: semMovimento() ? "auto" : "smooth"
    });
}

/* ------------------------------------------------------------------
   ZOOM DA FOTO
   ------------------------------------------------------------------
   Clicar amplia 2× a partir do ponto tocado; clicar de novo
   volta ao enquadramento. Sem transição quando a pessoa pede
   menos movimento.
   ------------------------------------------------------------------ */
let fotoZoom = false;

function limparZoom() {
    const faixa = el("galeriaFaixa");
    if (faixa) {
        faixa.querySelectorAll(".peca-foto--zoom").forEach((f) => {
            f.classList.remove("peca-foto--zoom");
            const img = f.querySelector("img");
            if (img) img.style.transform = "";
        });
    }
    fotoZoom = false;
}

function alternarZoom(img, evento) {
    const slide = img.closest(".peca-foto");
    if (!slide) return;
    if (fotoZoom) { limparZoom(); return; }

    const caixa = img.getBoundingClientRect();
    const semPonteiro = !evento || (evento.clientX === 0 && evento.clientY === 0);
    const x = semPonteiro || !caixa.width ? 50 : ((evento.clientX - caixa.left) / caixa.width) * 100;
    const y = semPonteiro || !caixa.height ? 50 : ((evento.clientY - caixa.top) / caixa.height) * 100;

    slide.classList.add("peca-foto--zoom");
    img.style.transformOrigin = `${x}% ${y}%`;
    fotoZoom = true;
}

/* ------------------------------------------------------------------
   COMPARTILHAR A PEÇA
   ------------------------------------------------------------------
   No celular o próprio aparelho compartilha; no desktop o link
   vai para a área de transferência. Compartilhar peça não é
   falar com a loja: por isso o WhatsApp não entra aqui.
   ------------------------------------------------------------------ */
async function compartilharPeca(id) {
    const p = buscarProduto(id);
    if (!p) return;
    const url = linkDaPeca(p.id);
    const texto = `${p.nome} — ${formatarMoeda(p.preco)}${p.categoria ? " · " + p.categoria : ""} — ${CONFIG.nomeEmpresa}`;

    if (navigator.share) {
        try {
            await navigator.share({ title: p.nome, text: texto, url });
            return;
        } catch (e) {
            if (e && e.name === "AbortError") return;
        }
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            mostrarToast("Link da peça copiado.");
            return;
        }
    } catch (e) { /* o navegador bloqueou a cópia */ }

    mostrarToast("Não foi possível copiar o link desta peça.");
}

/* Tamanho e cor ----------------------------------------------------- */
function renderTamanhosFicha(p) {
    const box = el("pecaTams");
    box.innerHTML = "";
    const atual = tamanhoEscolhido(p);
    p.tamanhos.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tam";
        b.dataset.tam = t;
        b.setAttribute("aria-pressed", String(t === atual));
        b.textContent = t;
        box.appendChild(b);
    });
}

function renderCoresFicha(p) {
    const grupo = el("pecaGrupoCores");
    const box = el("pecaCores");
    box.innerHTML = "";
    if (p.cores.length === 0) { grupo.hidden = true; return; }
    grupo.hidden = false;
    const atual = corEscolhida(p);
    p.cores.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cor";
        b.dataset.cor = c.nome;
        b.setAttribute("aria-pressed", String(c.nome === atual));
        const amostra = document.createElement("span");
        amostra.className = "cor-amostra";
        amostra.style.background = c.hex;
        const nome = document.createElement("span");
        nome.className = "cor-nome";
        nome.textContent = c.nome;
        b.appendChild(amostra);
        b.appendChild(nome);
        box.appendChild(b);
    });
}

/* Mensagem de dúvida de tamanho para o WhatsApp */
function mensagemDuvida(p) {
    const tam = tamanhoEscolhido(p);
    return [
        `Olá, ${CONFIG.nomeEmpresa}! Tenho dúvida sobre o tamanho desta peça:`,
        "",
        `${p.nome}${p.categoria ? " (" + p.categoria + ")" : ""}`,
        tam ? `Tamanho que estou olhando: ${tam}` : "",
        "",
        linkDaPeca(p.id)
    ].filter(Boolean).join("\n");
}

/* Ficha -------------------------------------------------------------- */
function renderFicha(p) {
    el("pecaCategoria").textContent = p.categoria || "";
    el("pecaNome").textContent = p.nome;
    el("pecaPreco").innerHTML = blocoPreco(p, true);

    renderDetalhesFicha(p);
    renderGaleria(p);
    renderTamanhosFicha(p);
    renderCoresFicha(p);

    const add = el("pecaAdd");
    add.disabled = !p.disponivel;
    add.textContent = p.disponivel ? "+ sacola" : "esgotada";
    delete add.dataset.estado;

    el("pecaPerguntar").href = urlWhatsApp() + "?text=" + encodeURIComponent(mensagemDuvida(p));
    atualizarBotaoNota();
}

/* Detalhes da peça: só aparece quando a loja escreveu algo.
   O texto vai por textContent — nunca por innerHTML. */
function renderDetalhesFicha(p) {
    const bloco = el("pecaDetalhes");
    const descricao = String(p.descricao || "").trim();
    const composicao = String(p.composicao || "").trim();
    const cuidados = String(p.cuidados || "").trim();

    bloco.hidden = !(descricao || composicao || cuidados);

    el("pecaDescricaoLinha").hidden = !descricao;
    el("pecaDescricao").textContent = descricao;

    el("pecaComposicaoLinha").hidden = !composicao;
    el("pecaComposicao").textContent = composicao;

    el("pecaCuidadosLinha").hidden = !cuidados;
    el("pecaCuidados").textContent = cuidados;
}

/* Botão "ver minha nota": some quando a nota está vazia e mostra o total. */
function atualizarBotaoNota() {
    const b = el("pecaVerNota");
    const n = estado.nota.length;
    b.hidden = n === 0;
    b.textContent = n === 1 ? "ver minha nota (1 peça)" : `ver minha nota (${n} peças)`;
}

function abrirFicha(id, opcoes) {
    const p = buscarProduto(id);
    if (!p) return;
    const empurrar = !opcoes || opcoes.historico !== false;

    if (estado.pecaId === id) { renderFicha(p); return; }

    /* Ficha e nota são mutuamente exclusivas. */
    if (el("nota").classList.contains("aberta")) fecharNota();

    estado.pecaId = id;
    focoAnteriorPeca = document.activeElement;

    const dialogo = el("peca");
    dialogo.hidden = false;
    dialogo.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
        dialogo.classList.add("aberta");
        el("notaFundo").hidden = false;
        el("notaFundo").classList.add("visivel");
    });

    renderFicha(p);
    travarScroll();
    aplicarInert(true);
    el("fecharPecaBtn").focus();

    if (empurrar) {
        window.history.pushState({ peca: id, aberta: true }, "", "?peca=" + encodeURIComponent(id));
    }
}

function fecharFicha(opcoes) {
    if (!estado.pecaId) return;
    const mexerNoHistorico = !opcoes || opcoes.historico !== false;

    estado.pecaId = null;
    const dialogo = el("peca");
    dialogo.classList.remove("aberta");
    dialogo.setAttribute("aria-hidden", "true");
    if (!el("nota").classList.contains("aberta")) {
        el("notaFundo").classList.remove("visivel");
        setTimeout(() => {
            if (!estado.pecaId && !el("nota").classList.contains("aberta")) el("notaFundo").hidden = true;
        }, 300);
    }
    destravarScroll();
    aplicarInert(false);
    if (observadorFotos) { observadorFotos.disconnect(); observadorFotos = null; }

    if (mexerNoHistorico && window.history.state && window.history.state.aberta) {
        window.history.back();
    } else {
        window.history.replaceState({}, "", urlSemPeca());
    }

    const alvo = focoAnteriorPeca && focoAnteriorPeca.isConnected
        && typeof focoAnteriorPeca.focus === "function" && focoAnteriorPeca !== document.body
        ? focoAnteriorPeca : el("abrirNotaBtn");
    focoAnteriorPeca = null;
    alvo.focus();
}

/* Atualiza a ficha aberta quando o painel mexe na peça (tempo real). */
function atualizarFichaAberta() {
    if (!estado.pecaId) return;
    const p = buscarProduto(estado.pecaId);
    if (!p) {
        mostrarToast("Esta peça saiu do índice.");
        fecharFicha();
        return;
    }
    const assinatura = JSON.stringify([
        p.nome, p.preco, p.precoDe, p.precoCartao, p.imagens, p.cores,
        p.disponivel, p.descricao, p.composicao, p.cuidados
    ]);
    if (assinatura === estado.pecaAssinatura) return;
    estado.pecaAssinatura = assinatura;
    renderFicha(p);
}

/* Mantém o card e a ficha com a mesma escolha. */
function sincronizarTamanhoFicha(id) {
    if (estado.pecaId !== id) return;
    const p = buscarProduto(id);
    if (!p) return;
    el("pecaTams").querySelectorAll(".tam").forEach((x) =>
        x.setAttribute("aria-pressed", String(x.dataset.tam === tamanhoEscolhido(p))));
}

function sincronizarTamanhoCard(id) {
    const card = document.querySelector(`.card-item[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const p = buscarProduto(id);
    if (!p) return;
    const atual = tamanhoEscolhido(p);
    card.querySelectorAll(".tam").forEach((x) =>
        x.setAttribute("aria-pressed", String(x.dataset.tam === atual)));
}

function configurarFicha() {
    el("fecharPecaBtn").addEventListener("click", () => fecharFicha());
    el("galeriaAnt").addEventListener("click", () => moverFoto(-1));
    el("galeriaProx").addEventListener("click", () => moverFoto(1));
    el("galeriaMinis").addEventListener("click", (e) => {
        const b = e.target.closest(".peca-mini");
        if (b) irParaFoto(Number(b.dataset.i));
    });

    /* Zoom: clicar na foto amplia a partir do ponto tocado. */
    el("galeriaFaixa").addEventListener("click", (e) => {
        const img = e.target.closest("img");
        if (img) alternarZoom(img, e);
    });

    el("pecaTams").addEventListener("click", (e) => {
        const b = e.target.closest(".tam");
        if (!b) return;
        const p = buscarProduto(estado.pecaId);
        if (!p) return;
        estado.tamEscolhido[p.id] = b.dataset.tam;
        el("pecaTams").querySelectorAll(".tam").forEach((x) =>
            x.setAttribute("aria-pressed", String(x === b)));
        sincronizarTamanhoCard(p.id);
    });

    el("pecaCores").addEventListener("click", (e) => {
        const b = e.target.closest(".cor");
        if (!b) return;
        const p = buscarProduto(estado.pecaId);
        if (!p) return;
        estado.corEscolhida[p.id] = b.dataset.cor;
        el("pecaCores").querySelectorAll(".cor").forEach((x) =>
            x.setAttribute("aria-pressed", String(x === b)));
    });

    el("pecaAdd").addEventListener("click", () => {
        const p = buscarProduto(estado.pecaId);
        if (!p || !p.disponivel) return;
        const tam = tamanhoEscolhido(p);
        const cor = corEscolhida(p);
        if (adicionar(p.id, tam, cor)) {
            const add = el("pecaAdd");
            add.dataset.estado = "ok";
            add.textContent = "na nota ✓";
            mostrarToast(`${p.nome} (tam. ${tam}${cor ? " · " + cor : ""}) na nota`);
            setTimeout(() => {
                delete add.dataset.estado;
                add.textContent = "+ sacola";
            }, 1600);
        }
    });

    el("pecaVerNota").addEventListener("click", () => {
        fecharFicha();
        abrirNota();
    });

    el("pecaCompartilhar").addEventListener("click", () => {
        if (estado.pecaId) compartilharPeca(estado.pecaId);
    });

    window.addEventListener("popstate", (e) => {
        const st = e.state || {};
        if (st.aberta && st.peca) {
            if (estado.pecaId !== st.peca) abrirFicha(st.peca, { historico: false });
            return;
        }
        if (st.base) {
            fecharFicha({ historico: false });
            window.history.replaceState({}, "", urlSemPeca());
            return;
        }
        const id = pecaDaURL();
        if (id && buscarProduto(id)) abrirFicha(id, { historico: false });
        else fecharFicha({ historico: false });
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

    // Descarta itens cujo produto saiu do catálogo.
    const antes = estado.nota.length;
    estado.nota = estado.nota.filter((it) => buscarProduto(it.id));
    if (estado.nota.length !== antes) salvarNota();

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
                <span class="peca-nome">${esc(p.nome)}</span>
                <span class="peca-meta">Tam. ${esc(it.tamanho)}${it.cor ? " · " + esc(it.cor) : ""} · ${formatarMoeda(precoItem(p))} un.</span>
                <button type="button" class="peca-remover">remover</button>
            </td>
            <td>
                <span class="qtd">
                    <button type="button" data-dim="-1" aria-label="Diminuir quantidade de ${esc(p.nome)}">−</button>
                    <span aria-label="Quantidade">${it.quantidade}</span>
                    <button type="button" data-dim="1" aria-label="Aumentar quantidade de ${esc(p.nome)}">+</button>
                </span>
            </td>
            <td class="peca-total">${formatarMoeda(precoItem(p) * it.quantidade)}</td>
        `;
        tr.querySelector('[data-dim="-1"]').addEventListener("click", () => alterarQuantidade(it.id, it.tamanho, it.cor, -1));
        tr.querySelector('[data-dim="1"]').addEventListener("click", () => alterarQuantidade(it.id, it.tamanho, it.cor, 1));
        tr.querySelector(".peca-remover").addEventListener("click", () => removerItem(it.id, it.tamanho, it.cor));
        tbody.appendChild(tr);
    });

    el("subtotalTexto").textContent = formatarMoeda(subtotal());
    el("totalFormTexto").textContent = formatarMoeda(subtotal());

    /* O total diz em que forma ele foi calculado. */
    const rotulo = "Total no " + (ROTULO_PAGAMENTO[estado.formaPagamento] || "Pix");
    el("subtotalRotulo").textContent = rotulo;
    el("totalRotulo").textContent = rotulo;

    atualizarBotaoNota();
}

function renderTudo() {
    renderFiltros();
    renderCatalogo();
    renderNota();
    destacarCapa();
    atualizarFichaAberta();
}

/* ------------------------------------------------------------------
   NOTA — abrir/fechar e etapas
   ------------------------------------------------------------------ */
let ultimoFoco = null;

function abrirNota() {
    /* Ficha e nota nunca ficam abertas juntas. */
    if (estado.pecaId) fecharFicha();
    ultimoFoco = document.activeElement;
    el("notaFundo").hidden = false;
    requestAnimationFrame(() => el("notaFundo").classList.add("visivel"));
    const nota = el("nota");
    nota.classList.add("aberta");
    nota.setAttribute("aria-hidden", "false");
    el("abrirNotaBtn").setAttribute("aria-expanded", "true");
    el("sacolaFlutuante").setAttribute("aria-expanded", "true");
    travarScroll();
    aplicarInert(true);
    el("fecharNotaBtn").focus();
}

function fecharNota() {
    const nota = el("nota");
    nota.classList.remove("aberta");
    nota.setAttribute("aria-hidden", "true");
    el("abrirNotaBtn").setAttribute("aria-expanded", "false");
    el("sacolaFlutuante").setAttribute("aria-expanded", "false");
    if (!estado.pecaId) {
        el("notaFundo").classList.remove("visivel");
        setTimeout(() => {
            if (!estado.pecaId && !nota.classList.contains("aberta")) el("notaFundo").hidden = true;
        }, 300);
    }
    destravarScroll();
    aplicarInert(false);
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
   FORMA DE PAGAMENTO DA NOTA
   ------------------------------------------------------------------
   A escolha é do pedido inteiro (não da peça): Pix, dinheiro ou
   cartão. Fica guardada no aparelho para a cliente não ter de
   escolher de novo.
   ------------------------------------------------------------------ */
function salvarPagamento() {
    try {
        localStorage.setItem(CHAVE_PAGAMENTO, estado.formaPagamento);
    } catch (e) { /* armazenamento indisponível */ }
}

function carregarPagamento() {
    try {
        const bruto = localStorage.getItem(CHAVE_PAGAMENTO);
        if (FORMAS_PAGAMENTO.includes(bruto)) {
            estado.formaPagamento = bruto;
        }
    } catch (e) { /* armazenamento indisponível */ }
    sincronizarPagamento();
}

function sincronizarPagamento() {
    document.querySelectorAll('input[name="pagamento"]').forEach((r) => {
        r.checked = r.value === estado.formaPagamento;
    });
}

function configurarPagamento() {
    document.querySelectorAll('input[name="pagamento"]').forEach((r) => {
        r.addEventListener("change", () => {
            if (!r.checked) return;
            estado.formaPagamento = r.value;
            salvarPagamento();
            renderNota();
        });
    });
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
/* WhatsApp da loja: o número vem das configurações; sem
   configuração, vale o número que já estava no código. */
const urlWhatsApp = () => "https://wa.me/" + (estado.settings.whatsapp || CONFIG.whatsappFornecedor);

/* Link da peça: abre o site já na ficha (deep link da Fase 1). */
function linkDaPeca(id) {
    const base = window.location.origin + window.location.pathname;
    return base + "?peca=" + encodeURIComponent(id);
}

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
        l.push(`${ficha(p)} · ${it.quantidade}x ${p.nome} (Tam. ${it.tamanho}${it.cor ? " · " + it.cor : ""}) — ${formatarMoeda(precoItem(p) * it.quantidade)}`);
        l.push(linkDaPeca(it.id));
    });

    l.push("");
    l.push("*Pagamento:* " + (ROTULO_PAGAMENTO[estado.formaPagamento] || "Pix"));
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
    /* A faixa é da loja: vem das configurações. Sem configuração,
       valem os avisos de sempre. */
    const mensagens = estado.settings.faixa.length ? estado.settings.faixa : AVISOS_PADRAO;
    if (!mensagens.length) return;
    let i = 0;
    const no = el("faixaMsg");
    no.textContent = mensagens[0];
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

/* A peça em destaque é a que a loja escolheu no painel; sem
   escolha (ou se ela saiu do catálogo), vale a primeira peça. */
function produtoDestaque() {
    if (!estado.produtos.length) return null;
    const escolhido = estado.settings.destaque;
    if (escolhido) {
        const p = buscarProduto(escolhido);
        if (p) return p;
    }
    return estado.produtos[0];
}

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
    const p = produtoDestaque();
    const foto = el("capaAmostra");
    const img = el("capaImg");
    if (!p) {
        foto.classList.add("capa-foto--vazia");
        img.hidden = true;
        el("capaFicha").textContent = "—";
        el("capaDestaqueNome").textContent = "Novo catálogo chegando";
        el("capaDestaquePreco").textContent = "A loja está montando esta edição";
        return;
    }
    foto.classList.remove("capa-foto--vazia");
    if (validarImgUrl(p.img)) {
        img.hidden = false;
        img.src = p.img;
        img.alt = p.alt;
    } else {
        img.hidden = true;
        img.removeAttribute("src");
    }
    el("capaFicha").textContent = ficha(p);
    el("capaDestaqueNome").textContent = p.nome;
    el("capaDestaquePreco").innerHTML = blocoPreco(p, false);
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
    el("notaFundo").addEventListener("click", () => {
        if (estado.pecaId) fecharFicha();
        else fecharNota();
    });
    el("irParaIndice").addEventListener("click", () => {
        fecharNota();
        el("indice").scrollIntoView();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (estado.pecaId) { fecharFicha(); return; }
            if (el("nota").classList.contains("aberta")) { fecharNota(); return; }
            return;
        }
        /* Setas navegam na galeria da ficha. */
        if (estado.pecaId && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
            e.preventDefault();
            moverFoto(e.key === "ArrowLeft" ? -1 : 1);
            return;
        }
        if (e.key === "Tab") {
            const caixa = estado.pecaId ? el("peca")
                : (el("nota").classList.contains("aberta") ? el("nota") : null);
            if (caixa) prenderFoco(e, caixa);
        }
    });

    el("btnContinuar").addEventListener("click", mostrarEtapaDados);
    el("btnVoltar").addEventListener("click", mostrarEtapaPecas);
    el("etapaDados").addEventListener("submit", enviarPedido);

    document.querySelectorAll('input[name="forma"]').forEach((r) =>
        r.addEventListener("change", atualizarBlocoEndereco));

    el("rodapeWhatsLink").href = urlWhatsApp();
}

async function iniciar() {
    configurarBusca();
    configurarCatalogo();
    configurarFicha();
    configurarEventos();
    configurarPagamento();
    atualizarBlocoEndereco();
    animarCapa();
    controleTopo();
    el("anoAtual").textContent = String(new Date().getFullYear());

    await carregarConfiguracoes();
    rotacionarAvisos();

    await carregarCatalogo();
    carregarNota();
    carregarPagamento();
    renderNota();
    assinarTempoReal();
    abrirPecaDaURL();
}

/* Deep link: /?peca=<id> abre a ficha da peça. A entrada extra no
   histórico faz o "voltar" do celular fechar a ficha em vez de sair
   do site. */
function abrirPecaDaURL() {
    const id = pecaDaURL();
    if (!id || !buscarProduto(id)) return;
    window.history.replaceState({ peca: id, base: true }, "", "?peca=" + encodeURIComponent(id));
    window.history.pushState({ peca: id, aberta: true }, "", "?peca=" + encodeURIComponent(id));
    abrirFicha(id, { historico: false });
}

document.addEventListener("DOMContentLoaded", iniciar);

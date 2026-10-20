/* ============================================================
   Estilosas Fitness — catálogo dinâmico, nota de encomenda e envio
   ------------------------------------------------------------
   O catálogo vem do Supabase (banco na nuvem) e é atualizado em
   tempo real em todos os aparelhos com o site aberto.
   Painel administrativo: admin.html
   ============================================================ */

"use strict";

import { db, esc, validarImgUrl, corSegura } from "./supabase/client.js";

/* ------------------------------------------------------------------
   CONFIGURAÇÃO CENTRAL
   ------------------------------------------------------------------ */
const CONFIG = {
    nomeEmpresa: "Estilosas Fitness",

    // Número internacional (55 + DDD + número), sem espaços/hífens.
    whatsappFornecedor: "5589981425420"
};

const CHAVE_LOCALSTORAGE = "nota_estilosasfitness_v2";
const CHAVE_CATALOGO = "catalogo_v1";

/* ------------------------------------------------------------------
   ESTADO
   ------------------------------------------------------------------ */
const estado = {
    produtos: [],           // vem do banco: [{ id, nome, preco, ... }]
    carregando: true,       // ainda não temos nem cache nem banco
    nota: [],               // [{ id, tamanho, quantidade }] — ids são uuid (text)
    categoria: "Todas",
    busca: "",
    tamEscolhido: {}        // produtoId -> tamanho escolhido no catálogo
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

/* Normaliza a linha do banco para o formato usado na tela. */
function normalizar(linha) {
    return {
        id: String(linha.id),
        nome: String(linha.nome || ""),
        preco: Number(linha.preco) || 0,
        precoDe: linha.preco_de == null ? null : Number(linha.preco_de),
        categoria: String(linha.categoria || ""),
        img: String(linha.img_url || ""),
        alt: String(linha.alt || ""),
        tamanhos: Array.isArray(linha.tamanhos) ? linha.tamanhos.map(String) : [],
        badge: linha.badge ? String(linha.badge) : null,
        ph: corSegura(linha.ph),
        disponivel: linha.disponivel !== false,
        criadoEm: linha.criado_em || ""
    };
}

function ordenar() {
    estado.produtos.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}

/* Categorias na ordem em que aparecem no banco (admin controla a ordem). */
function categorias() {
    const vistas = [];
    estado.produtos.forEach((p) => {
        if (!vistas.includes(p.categoria)) vistas.push(p.categoria);
    });
    return ["Todas", ...vistas];
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
        ).map((it) => ({ id: it.id, tamanho: it.tamanho, quantidade: Math.floor(it.quantidade) }));
    } catch (e) {
        estado.nota = [];
    }
}

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
            .map(normalizar);
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
   DADOS — banco + tempo real
   ------------------------------------------------------------------ */
async function buscarDoBanco() {
    const { data, error } = await db
        .from("products")
        .select("id, nome, preco, preco_de, categoria, img_url, alt, tamanhos, badge, ph, disponivel, criado_em")
        .order("criado_em", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizar);
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
        const doBanco = await buscarDoBanco();
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
   CATÁLOGO — filtros, fileiras e cards
   ------------------------------------------------------------------ */
function filtrados() {
    const termo = estado.busca.trim().toLowerCase();
    return estado.produtos.filter((p) => {
        const okCat = estado.categoria === "Todas" || p.categoria === estado.categoria;
        const okBusca = !termo || (p.nome + " " + p.categoria).toLowerCase().includes(termo);
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

function cardProduto(p) {
    if (!estado.tamEscolhido[p.id] || !p.tamanhos.includes(estado.tamEscolhido[p.id])) {
        estado.tamEscolhido[p.id] = p.tamanhos[0];
    }
    const tam = estado.tamEscolhido[p.id];

    const li = document.createElement("li");
    li.className = "card-item" + (p.disponivel ? "" : " card-item--indisponivel");
    li.dataset.id = p.id;
    li.innerHTML = `
        <article class="card">
            <div class="card-foto" style="--ph:${esc(p.ph)}">
                ${imagemDoCard(p)}
                ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ""}
            </div>
            <div class="card-corpo">
                <div class="card-linha1">
                    <h3 class="card-nome">${esc(p.nome)}</h3>
                    <p class="card-preco">${p.precoDe ? `<span class="de">${formatarMoeda(p.precoDe)}</span>` : ""}${formatarMoeda(p.preco)}</p>
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

        const tamBtn = e.target.closest(".tam");
        if (tamBtn) {
            const cardItem = tamBtn.closest(".card-item");
            const id = cardItem.dataset.id;
            estado.tamEscolhido[id] = tamBtn.dataset.tam;
            cardItem.querySelectorAll(".tam").forEach((b) =>
                b.setAttribute("aria-pressed", String(b.dataset.tam === tamBtn.dataset.tam)));
            return;
        }

        const addBtn = e.target.closest("[data-add]");
        if (addBtn && !addBtn.disabled) {
            const id = addBtn.dataset.add;
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
                <span class="peca-meta">Tam. ${esc(it.tamanho)} · ${formatarMoeda(p.preco)} un.</span>
                <button type="button" class="peca-remover">remover</button>
            </td>
            <td>
                <span class="qtd">
                    <button type="button" data-dim="-1" aria-label="Diminuir quantidade de ${esc(p.nome)}">−</button>
                    <span aria-label="Quantidade">${it.quantidade}</span>
                    <button type="button" data-dim="1" aria-label="Aumentar quantidade de ${esc(p.nome)}">+</button>
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

function renderTudo() {
    renderFiltros();
    renderCatalogo();
    renderNota();
    destacarCapa();
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
    const p = estado.produtos[0];
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

async function iniciar() {
    configurarBusca();
    configurarCatalogo();
    configurarEventos();
    atualizarBlocoEndereco();
    rotacionarAvisos();
    animarCapa();
    controleTopo();
    el("anoAtual").textContent = String(new Date().getFullYear());

    await carregarCatalogo();
    carregarNota();
    renderNota();
    assinarTempoReal();
}

document.addEventListener("DOMContentLoaded", iniciar);

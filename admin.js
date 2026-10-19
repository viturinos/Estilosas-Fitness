/* ============================================================
   Estilosas Fitness — painel administrativo
   ------------------------------------------------------------
   Login (Supabase Auth) + CRUD de produtos + upload de imagem.
   Segurança: escape anti-XSS, validação client + banco, limites
   do bucket enforçados pelo servidor, erros genéricos.
   ============================================================ */

"use strict";

import { db, esc, validarImgUrl, mensagemErro, BUCKET } from "./supabase/client.js";

const el = (id) => document.getElementById(id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatarMoeda = (v) => brl.format(Number(v) || 0);

const TAM_MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];
const LADO_MAX = 1600;
const QUALIDADE_WEBP = 0.82;

const estado = {
    produtos: [],
    tamanhos: [],
    arquivoNovo: null,
    previewUrl: null,
    editando: null,
    canalAberto: false
};

/* ------------------------------------------------------------------
   AVISO (toast)
   ------------------------------------------------------------------ */
let avisoTimer = null;
function avisar(msg, ehErro = false) {
    const caixa = el("aviso");
    caixa.textContent = msg;
    caixa.classList.toggle("aviso--erro", ehErro);
    caixa.hidden = false;
    requestAnimationFrame(() => caixa.classList.add("visivel"));
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => {
        caixa.classList.remove("visivel");
        setTimeout(() => { caixa.hidden = true; }, 240);
    }, 3200);
}

/* ------------------------------------------------------------------
   SESSÃO
   ------------------------------------------------------------------ */
function aplicarSessao(session) {
    const logado = Boolean(session);
    el("telaCarregando").hidden = true;
    el("telaLogin").hidden = logado;
    el("telaPainel").hidden = !logado;
    el("btnSair").hidden = !logado;

    if (logado) {
        carregarLista();
        assinarTempoReal();
    } else {
        fecharForm();
        estado.produtos = [];
        el("admLista").innerHTML = "";
        el("admVazio").hidden = true;
        el("admContagem").textContent = "—";
    }
}

async function iniciarSessao() {
    const { data } = await db.auth.getSession();
    aplicarSessao(data.session);
    db.auth.onAuthStateChange((_evento, session) => aplicarSessao(session));
}

async function entrar(e) {
    e.preventDefault();
    const erro = el("loginErro");
    const email = el("loginEmail").value.trim();
    const senha = el("loginSenha").value;

    if (!email || !senha) {
        erro.textContent = "Preencha e-mail e senha.";
        erro.hidden = false;
        return;
    }

    const btn = el("btnEntrar");
    btn.disabled = true;
    btn.textContent = "Entrando…";
    const { error } = await db.auth.signInWithPassword({ email, password: senha });
    btn.disabled = false;
    btn.textContent = "Entrar";

    if (error) {
        // Mensagem genérica de propósito: não revela qual dado está errado.
        erro.textContent = "E-mail ou senha incorretos.";
        erro.hidden = false;
        el("loginSenha").value = "";
        el("loginSenha").focus();
        return;
    }
    erro.hidden = true;
}

async function sair() {
    await db.auth.signOut();
    avisar("Você saiu do painel.");
}

/* ------------------------------------------------------------------
   LISTA DE PRODUTOS
   ------------------------------------------------------------------ */
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
        badge: linha.badge ? String(linha.badge) : "",
        ph: linha.ph ? String(linha.ph) : "#E7E3E7",
        disponivel: linha.disponivel !== false,
        criadoEm: linha.criado_em || ""
    };
}

async function carregarLista() {
    const { data, error } = await db
        .from("products")
        .select("id, nome, preco, preco_de, categoria, img_url, alt, tamanhos, badge, ph, disponivel, criado_em")
        .order("criado_em", { ascending: true });

    if (error) {
        avisar(mensagemErro(error, "Não foi possível carregar os produtos."), true);
        return;
    }
    estado.produtos = (data || []).map(normalizar);
    renderLista();
    renderCategorias();
}

function renderLista() {
    const lista = el("admLista");
    lista.innerHTML = "";
    el("admVazio").hidden = estado.produtos.length > 0;
    el("admContagem").textContent = estado.produtos.length === 1
        ? "1 produto cadastrado" : `${estado.produtos.length} produtos cadastrados`;

    estado.produtos.forEach((p) => {
        const li = document.createElement("li");
        li.className = "adm-item" + (p.disponivel ? "" : " adm-item--off");
        const temFoto = validarImgUrl(p.img);
        li.innerHTML = `
            <div class="adm-item-foto" style="background:${esc(p.ph)}">
                ${temFoto ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ""}
            </div>
            <div class="adm-item-corpo">
                <p class="adm-item-nome">${esc(p.nome)}${p.badge ? `<span class="adm-item-selo">${esc(p.badge)}</span>` : ""}</p>
                <p class="adm-item-meta">${esc(p.categoria)} · ${formatarMoeda(p.preco)}${p.precoDe ? ` (de ${formatarMoeda(p.precoDe)})` : ""}</p>
                <p class="adm-item-meta">Tam.: ${p.tamanhos.map(esc).join(", ") || "—"}${p.disponivel ? "" : " · indisponível"}</p>
            </div>
            <div class="adm-item-acoes">
                <button type="button" class="acao-editar">Editar</button>
                <button type="button" class="acao-excluir">Excluir</button>
            </div>`;
        li.querySelector(".acao-editar").addEventListener("click", () => abrirEdicao(p));
        li.querySelector(".acao-excluir").addEventListener("click", () => excluir(p));
        lista.appendChild(li);
    });
}

function renderCategorias() {
    const dl = el("categoriasSugeridas");
    dl.innerHTML = "";
    const vistas = [];
    estado.produtos.forEach((p) => {
        if (p.categoria && !vistas.includes(p.categoria)) vistas.push(p.categoria);
    });
    vistas.forEach((c) => {
        const op = document.createElement("option");
        op.value = c;
        dl.appendChild(op);
    });
}

/* ------------------------------------------------------------------
   FORMULÁRIO
   ------------------------------------------------------------------ */
function renderChips() {
    const caixa = el("tamsChips");
    caixa.innerHTML = "";
    estado.tamanhos.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "tams-chip";
        li.innerHTML = `${esc(t)} <button type="button" aria-label="Remover tamanho ${esc(t)}">×</button>`;
        li.querySelector("button").addEventListener("click", () => {
            estado.tamanhos.splice(i, 1);
            renderChips();
        });
        caixa.appendChild(li);
    });
}

function adicionarTamanho() {
    const campo = el("campoTam");
    const valor = campo.value.trim();
    if (!valor) return;
    if (valor.length > 6) { avisar("Tamanho muito longo (máx. 6 caracteres).", true); return; }
    if (estado.tamanhos.length >= 15) { avisar("Máximo de 15 tamanhos.", true); return; }
    if (estado.tamanhos.some((t) => t.toLowerCase() === valor.toLowerCase())) {
        avisar("Esse tamanho já foi adicionado.", true);
        return;
    }
    estado.tamanhos.push(valor);
    campo.value = "";
    campo.focus();
    renderChips();
}

function limparPreview() {
    if (estado.previewUrl) {
        URL.revokeObjectURL(estado.previewUrl);
        estado.previewUrl = null;
    }
    el("previewImg").removeAttribute("src");
    el("preview").hidden = true;
}

function mostrarPreview(url) {
    el("previewImg").src = url;
    el("preview").hidden = false;
}

function abrirNovo() {
    estado.editando = null;
    estado.tamanhos = [];
    estado.arquivoNovo = null;
    el("formProduto").reset();
    el("campoId").value = "";
    el("campoPh").value = "#E7E3E7";
    el("campoDisponivel").checked = true;
    el("formErro").hidden = true;
    limparPreview();
    renderChips();
    el("fichaTitulo").textContent = "Novo produto";
    el("fichaProduto").hidden = false;
    el("campoNome").focus();
    el("fichaProduto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function abrirEdicao(p) {
    estado.editando = p;
    estado.tamanhos = [...p.tamanhos];
    estado.arquivoNovo = null;
    el("campoId").value = p.id;
    el("campoNome").value = p.nome;
    el("campoCategoria").value = p.categoria;
    el("campoPreco").value = p.preco.toFixed(2);
    el("campoPrecoDe").value = p.precoDe == null ? "" : p.precoDe.toFixed(2);
    el("campoBadge").value = p.badge;
    el("campoPh").value = /^#[0-9A-Fa-f]{6}$/.test(p.ph) ? p.ph : "#E7E3E7";
    el("campoAlt").value = p.alt;
    el("campoDisponivel").checked = p.disponivel;
    el("campoArquivo").value = "";
    el("formErro").hidden = true;
    limparPreview();
    if (validarImgUrl(p.img)) mostrarPreview(p.img);
    renderChips();
    el("fichaTitulo").textContent = "Editar produto";
    el("fichaProduto").hidden = false;
    el("campoNome").focus();
    el("fichaProduto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharForm() {
    el("fichaProduto").hidden = true;
    estado.editando = null;
    estado.arquivoNovo = null;
    limparPreview();
}

/* ------------------------------------------------------------------
   IMAGEM — validação, compressão e upload
   ------------------------------------------------------------------ */
function validarArquivo(arquivo) {
    if (!TIPOS_OK.includes(arquivo.type)) return "Formato não aceito. Use JPG, PNG ou WEBP.";
    if (arquivo.size > TAM_MAX_BYTES) return "Arquivo maior que 5 MB. Reduza a imagem.";
    return null;
}

async function comprimirImagem(arquivo) {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    if (typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", QUALIDADE_WEBP));
    if (!blob) throw new Error("Não foi possível otimizar a imagem.");
    return blob;
}

function caminhoDaImagem(url) {
    if (!validarImgUrl(url)) return null;
    const marcador = `/storage/v1/object/public/${BUCKET}/`;
    const i = url.indexOf(marcador);
    return i >= 0 ? url.slice(i + marcador.length) : null;
}

async function enviarImagem(blob) {
    const nome = `${crypto.randomUUID()}.webp`;
    const { error } = await db.storage.from(BUCKET).upload(nome, blob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false
    });
    if (error) throw error;

    const { data } = db.storage.from(BUCKET).getPublicUrl(nome);
    const url = data && data.publicUrl;
    if (!validarImgUrl(url)) throw new Error("URL de imagem inválida.");
    return url;
}

async function apagarImagem(url) {
    const caminho = caminhoDaImagem(url);
    if (!caminho) return;
    await db.storage.from(BUCKET).remove([caminho]);
}

/* ------------------------------------------------------------------
   VALIDAÇÃO DO FORMULÁRIO
   ------------------------------------------------------------------ */
function numeroOuNulo(valor) {
    const limpo = String(valor).trim().replace(",", ".");
    if (limpo === "") return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : NaN;
}

function marcar(campo, invalido) {
    campo.setAttribute("aria-invalid", String(invalido));
    return invalido;
}

function validarFormulario() {
    const pendentes = [];
    const nome = el("campoNome").value.trim();
    const categoria = el("campoCategoria").value.trim();
    const alt = el("campoAlt").value.trim();
    const badge = el("campoBadge").value.trim();
    const preco = numeroOuNulo(el("campoPreco").value);
    const precoDe = numeroOuNulo(el("campoPrecoDe").value);

    if (marcar(el("campoNome"), nome.length < 1)) pendentes.push(el("campoNome"));
    if (marcar(el("campoCategoria"), categoria.length < 1)) pendentes.push(el("campoCategoria"));
    if (marcar(el("campoPreco"), !(preco !== null && preco >= 0))) pendentes.push(el("campoPreco"));
    if (precoDe !== null && !(precoDe > 0)) { marcar(el("campoPrecoDe"), true); pendentes.push(el("campoPrecoDe")); }
    else marcar(el("campoPrecoDe"), false);
    if (marcar(el("campoAlt"), alt.length < 1)) pendentes.push(el("campoAlt"));
    if (marcar(el("campoBadge"), badge.length > 40)) pendentes.push(el("campoBadge"));

    const temImagemFinal = Boolean(estado.arquivoNovo) || Boolean(estado.editando && validarImgUrl(estado.editando.img));
    if (!temImagemFinal) {
        pendentes.push(el("campoArquivo"));
    }

    if (estado.tamanhos.length < 1) pendentes.push(el("campoTam"));

    if (pendentes.length > 0) {
        const erro = el("formErro");
        if (estado.tamanhos.length < 1) erro.textContent = "Adicione pelo menos um tamanho.";
        else if (!temImagemFinal) erro.textContent = "Escolha uma foto para o produto.";
        else erro.textContent = "Confira os campos marcados em vermelho.";
        erro.hidden = false;
        pendentes[0].focus();
        return null;
    }
    el("formErro").hidden = true;

    return { nome, categoria, alt, badge, preco, precoDe };
}

/* ------------------------------------------------------------------
   SALVAR / EXCLUIR
   ------------------------------------------------------------------ */
async function salvar(e) {
    e.preventDefault();
    const dados = validarFormulario();
    if (!dados) return;

    const btn = el("btnSalvar");
    btn.disabled = true;
    btn.textContent = "Salvando…";

    try {
        let imgUrl = estado.editando ? estado.editando.img : null;
        let imgAntiga = null;

        if (estado.arquivoNovo) {
            const blob = await comprimirImagem(estado.arquivoNovo);
            const nova = await enviarImagem(blob);
            if (estado.editando && validarImgUrl(estado.editando.img)) imgAntiga = estado.editando.img;
            imgUrl = nova;
        }

        const registro = {
            nome: dados.nome,
            preco: dados.preco,
            preco_de: dados.precoDe,
            categoria: dados.categoria,
            img_url: imgUrl,
            alt: dados.alt,
            tamanhos: estado.tamanhos,
            badge: dados.badge || null,
            ph: el("campoPh").value || null,
            disponivel: el("campoDisponivel").checked
        };

        if (estado.editando) {
            const { error } = await db.from("products").update(registro).eq("id", estado.editando.id);
            if (error) throw error;
        } else {
            const { error } = await db.from("products").insert(registro);
            if (error) throw error;
        }

        if (imgAntiga) await apagarImagem(imgAntiga);

        fecharForm();
        await carregarLista();
        avisar("Produto salvo.");
    } catch (erro) {
        avisar(mensagemErro(erro, "Não foi possível salvar o produto."), true);
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar produto";
    }
}

async function excluir(p) {
    const confirmado = window.confirm(`Excluir "${p.nome}"? Essa ação não pode ser desfeita.`);
    if (!confirmado) return;

    try {
        const { error } = await db.from("products").delete().eq("id", p.id);
        if (error) throw error;
        await apagarImagem(p.img);
        await carregarLista();
        avisar("Produto excluído.");
    } catch (erro) {
        avisar(mensagemErro(erro, "Não foi possível excluir o produto."), true);
    }
}

/* ------------------------------------------------------------------
   TEMPO REAL (duas abas de admin sincronizadas)
   ------------------------------------------------------------------ */
function assinarTempoReal() {
    if (estado.canalAberto) return;
    estado.canalAberto = true;
    db.channel("admin-produtos")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
            if (!el("telaPainel").hidden) carregarLista();
        })
        .subscribe();
}

/* ------------------------------------------------------------------
   EVENTOS
   ------------------------------------------------------------------ */
function configurarEventos() {
    el("formLogin").addEventListener("submit", entrar);
    el("btnSair").addEventListener("click", sair);
    el("btnNovo").addEventListener("click", abrirNovo);
    el("btnFecharForm").addEventListener("click", fecharForm);
    el("btnCancelar").addEventListener("click", fecharForm);
    el("formProduto").addEventListener("submit", salvar);

    el("btnAddTam").addEventListener("click", adicionarTamanho);
    el("campoTam").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); adicionarTamanho(); }
    });

    el("btnUsarNome").addEventListener("click", () => {
        const nome = el("campoNome").value.trim();
        if (nome) el("campoAlt").value = nome;
        el("campoAlt").focus();
    });

    el("campoArquivo").addEventListener("change", (e) => {
        const arquivo = e.target.files && e.target.files[0];
        estado.arquivoNovo = null;
        limparPreview();
        if (!arquivo) return;
        const problema = validarArquivo(arquivo);
        if (problema) {
            avisar(problema, true);
            e.target.value = "";
            return;
        }
        estado.arquivoNovo = arquivo;
        estado.previewUrl = URL.createObjectURL(arquivo);
        mostrarPreview(estado.previewUrl);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    configurarEventos();
    iniciarSessao();
});

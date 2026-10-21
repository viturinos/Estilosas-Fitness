/* ============================================================
   Estilosas Fitness — painel administrativo
   ------------------------------------------------------------
   Login (Supabase Auth) + CRUD de produtos + upload de imagens.
   Segurança: escape anti-XSS, validação client + banco, limites
   do bucket enforçados pelo servidor, erros genéricos.
   ============================================================ */

"use strict";

import { db, esc, validarImgUrl, corSegura, mensagemErro, BUCKET, COLUNAS_PRODUTO, normalizarProduto, lerSettings, erroColunaFalta } from "./supabase/client.js?v=20261021c";
import { CHAVES_CONFIG, moverNaOrdem, ordenarProdutos } from "./loja.js?v=20261021c";

/* Anti-clickjacking: se a página estiver num iframe, o quadro pai é
   redirecionado para o painel real. (CSP por meta não aceita
   frame-ancestors; este é o reforço possível em hosting estático.) */
if (window.top !== window.self) {
    try { window.top.location.replace(window.location.href); } catch { /* cross-origin: sem como redirecionar */ }
}

const el = (id) => document.getElementById(id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatarMoeda = (v) => brl.format(Number(v) || 0);

const TAM_MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];
const LADO_MAX = 1600;
const QUALIDADE_WEBP = 0.82;
const INATIVIDADE_MAX_MS = 30 * 60 * 1000;

const MAX_FOTOS = 10;
const FOTOS_EM_PARALELO = 3;
const MAX_CORES = 12;

const estado = {
    produtos: [],
    tamanhos: [],
    fotos: [],            // [{ chave, url, arquivo, previewUrl }]
    cores: [],            // [{ nome, hex }]
    editando: null,
    canalAberto: false,
    aba: "produtos",      // produtos | configuracoes
    ordemTrocando: false, // trava os botões de ordem durante a gravação
    config: {             // configurações da loja (cache de settings)
        whatsapp: "",
        horario: "",
        faixa: [],
        destaque: null,
        contato: ""
    }
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
let inatividadeTimer = null;

function encerrarPorInatividade() {
    db.auth.signOut().finally(() => {
        avisar("Sessão encerrada por inatividade. Entre de novo.", true);
    });
}

function reiniciarInatividade() {
    clearTimeout(inatividadeTimer);
    inatividadeTimer = setTimeout(encerrarPorInatividade, INATIVIDADE_MAX_MS);
}

function vigiarInatividade() {
    const reiniciar = () => { if (!el("telaPainel").hidden) reiniciarInatividade(); };
    document.addEventListener("pointerdown", reiniciar, { passive: true });
    document.addEventListener("keydown", reiniciar, { passive: true });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reiniciar();
    });
}

function aplicarSessao(session) {
    const logado = Boolean(session);
    el("telaCarregando").hidden = true;
    el("telaLogin").hidden = logado;
    el("telaPainel").hidden = !logado;
    el("btnSair").hidden = !logado;

    if (logado) {
        reiniciarInatividade();
        carregarLista();
        carregarConfig();
        assinarTempoReal();
    } else {
        clearTimeout(inatividadeTimer);
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
const normalizar = (linha) => normalizarProduto(linha);

async function carregarLista() {
    const { data, error } = await db
        .from("products")
        .select(COLUNAS_PRODUTO)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: true });

    if (error) {
        if (erroColunaFalta(error)) {
            avisar(
                "Faltam as colunas da Fase 2 no banco. Rode supabase/migrations/002_detalhes_ordem_settings.sql no Supabase.",
                true
            );
            return;
        }
        avisar(mensagemErro(error, "Não foi possível carregar os produtos."), true);
        return;
    }
    estado.produtos = (data || []).map(normalizar).filter(Boolean);
    renderLista();
    renderCategorias();
    renderDestaques();
}

function renderLista() {
    const lista = el("admLista");
    lista.innerHTML = "";
    el("admVazio").hidden = estado.produtos.length > 0;
    el("admContagem").textContent = estado.produtos.length === 1
        ? "1 produto cadastrado" : `${estado.produtos.length} produtos cadastrados`;

    /* A lista segue a ordem manual do site (ordem, depois o mais
       antigo primeiro). */
    const ordenados = ordenarProdutos(estado.produtos);

    ordenados.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "adm-item" + (p.disponivel ? "" : " adm-item--off");
        const temFoto = validarImgUrl(p.img);
        const cartao = p.precoCartao && p.precoCartao !== p.preco
            ? ` · cartão ${formatarMoeda(p.precoCartao)}` : "";
        li.innerHTML = `
            <div class="adm-item-foto" style="background:${esc(p.ph)}">
                ${temFoto ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ""}
            </div>
            <div class="adm-item-corpo">
                <p class="adm-item-nome">${esc(p.nome)}${p.badge ? `<span class="adm-item-selo">${esc(p.badge)}</span>` : ""}</p>
                <p class="adm-item-meta">${esc(p.categoria)} · ${formatarMoeda(p.preco)}${cartao}${p.precoDe ? ` (de ${formatarMoeda(p.precoDe)})` : ""}</p>
                <p class="adm-item-meta">Tam.: ${p.tamanhos.map(esc).join(", ") || "—"}${p.disponivel ? "" : " · indisponível"}</p>
                <p class="adm-item-meta">${p.imagens.length} ${p.imagens.length === 1 ? "foto" : "fotos"}${p.cores.length ? ` · ${p.cores.length} ${p.cores.length === 1 ? "cor" : "cores"}` : ""}</p>
            </div>
            <div class="adm-item-acoes">
                <div class="adm-ordem">
                    <button type="button" class="adm-ordem-btn" data-dir="-1" aria-label="Subir ${esc(p.nome)}"${i === 0 || estado.ordemTrocando ? " disabled" : ""}>↑</button>
                    <button type="button" class="adm-ordem-btn" data-dir="1" aria-label="Descer ${esc(p.nome)}"${i === ordenados.length - 1 || estado.ordemTrocando ? " disabled" : ""}>↓</button>
                </div>
                <button type="button" class="acao-editar">Editar</button>
                <button type="button" class="acao-excluir">Excluir</button>
            </div>`;
        li.querySelector(".acao-editar").addEventListener("click", () => abrirEdicao(p));
        li.querySelector(".acao-excluir").addEventListener("click", () => excluir(p));
        li.querySelectorAll(".adm-ordem-btn").forEach((b) => {
            b.addEventListener("click", () => moverProduto(p, Number(b.dataset.dir)));
        });
        lista.appendChild(li);
    });
}

/* Troca a ordem de uma peça com a vizinha. A ordem é sempre
   reescrita de forma contígua (0, 1, 2…), para o site mostrar
   exatamente a ordem escolhida aqui.

   Cada peça é gravada por conta: se a segunda escrita falhar, a
   primeira continua no banco. Por isso, no erro a lista é recarregada
   do banco (a ordem real é a que vale) e os botões ficam travados
   durante a operação. */
async function moverProduto(p, dir) {
    if (estado.ordemTrocando) return;
    const nova = moverNaOrdem(estado.produtos, p.id, dir);
    if (!nova) return;

    const antes = new Map(estado.produtos.map((x) => [x.id, x.ordem]));
    const mudancas = nova.filter((m) => antes.get(m.id) !== m.ordem);
    if (!mudancas.length) return;

    estado.ordemTrocando = true;
    renderLista();
    try {
        for (const m of mudancas) {
            const { error } = await db.from("products").update({ ordem: m.ordem }).eq("id", m.id);
            if (error) throw error;
        }
        for (const m of mudancas) {
            const alvo = estado.produtos.find((x) => x.id === m.id);
            if (alvo) alvo.ordem = m.ordem;
        }
        renderLista();
    } catch (error) {
        avisar(mensagemErro(error, "Não foi possível mudar a ordem. A lista voltou ao que está no banco."), true);
        await carregarLista();
    } finally {
        estado.ordemTrocando = false;
        renderLista();
    }
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
    estado.fotos.forEach((f) => {
        if (f.previewUrl) { URL.revokeObjectURL(f.previewUrl); f.previewUrl = null; }
    });
    estado.fotos = [];
    renderFotos();
}

/* ------------------------------------------------------------------
    FOTOS — lista, ordem e capa
   ------------------------------------------------------------------
   estado.fotos = [{ chave, url, arquivo, previewUrl }]
   `url` preenchida = foto já no storage; `arquivo` = ainda local.
   ------------------------------------------------------------------ */
function nomeDaFoto(foto) {
    if (foto.arquivo) return foto.arquivo.name;
    const caminho = caminhoDaImagem(foto.url);
    return caminho ? caminho.split("/").pop() : "foto";
}

function renderFotos() {
    const grade = el("fotosGrade");
    grade.innerHTML = "";

    estado.fotos.forEach((foto, i) => {
        const li = document.createElement("li");
        li.className = "foto-item";
        const src = foto.previewUrl || foto.url || "";
        li.innerHTML = `
            <img src="${esc(src)}" alt="">
            ${i === 0 ? '<span class="foto-capa">capa</span>' : ""}
            <div class="foto-acoes">
                <button type="button" class="foto-mover" data-mover="-1" aria-label="Mover para a esquerda">←</button>
                <button type="button" class="foto-mover" data-mover="1" aria-label="Mover para a direita">→</button>
                <button type="button" class="foto-capa-btn" ${i === 0 ? "disabled" : ""}>Tornar capa</button>
                <button type="button" class="foto-remover" aria-label="Remover ${esc(nomeDaFoto(foto))}">×</button>
            </div>`;
        li.querySelectorAll(".foto-mover").forEach((b) => {
            b.addEventListener("click", () => moverFoto(i, Number(b.dataset.mover)));
        });
        li.querySelector(".foto-capa-btn").addEventListener("click", () => moverFoto(i, -i));
        li.querySelector(".foto-remover").addEventListener("click", () => removerFoto(i));
        grade.appendChild(li);
    });

    el("fotosContador").textContent = `${estado.fotos.length} de ${MAX_FOTOS} fotos`;
    el("campoArquivos").disabled = estado.fotos.length >= MAX_FOTOS;
}

function moverFoto(indice, passo) {
    const alvo = indice + passo;
    if (indice < 0 || indice >= estado.fotos.length) return;
    if (alvo < 0 || alvo >= estado.fotos.length) return;
    const [foto] = estado.fotos.splice(indice, 1);
    estado.fotos.splice(alvo, 0, foto);
    renderFotos();
}

function removerFoto(indice) {
    const [foto] = estado.fotos.splice(indice, 1);
    if (foto && foto.previewUrl) URL.revokeObjectURL(foto.previewUrl);
    renderFotos();
}

function adicionarFotos(arquivos) {
    const problemas = [];
    for (const arquivo of arquivos) {
        if (estado.fotos.length >= MAX_FOTOS) {
            problemas.push(`Máximo de ${MAX_FOTOS} fotos por peça.`);
            break;
        }
        const problema = validarArquivo(arquivo);
        if (problema) {
            problemas.push(`${arquivo.name}: ${problema}`);
            continue;
        }
        estado.fotos.push({
            chave: crypto.randomUUID(),
            url: null,
            arquivo,
            previewUrl: URL.createObjectURL(arquivo)
        });
    }
    renderFotos();
    if (problemas.length > 0) {
        const texto = problemas.slice(0, 3).join(" · ");
        avisar(problemas.length > 3 ? `${texto} · e mais ${problemas.length - 3}` : texto, true);
    }
}

/* ------------------------------------------------------------------
    CORES — editor
   ------------------------------------------------------------------ */
function renderCores() {
    const caixa = el("coresChips");
    caixa.innerHTML = "";
    estado.cores.forEach((cor, i) => {
        const li = document.createElement("li");
        li.className = "cores-chip";
        li.innerHTML = `
            <span class="cores-amostra" style="background:${esc(cor.hex)}"></span>
            ${esc(cor.nome)}
            <button type="button" aria-label="Remover a cor ${esc(cor.nome)}">×</button>`;
        li.querySelector("button").addEventListener("click", () => {
            estado.cores.splice(i, 1);
            renderCores();
        });
        caixa.appendChild(li);
    });
    el("btnAddCor").disabled = estado.cores.length >= MAX_CORES;
}

function adicionarCor() {
    const nome = el("campoCorNome").value.trim();
    const hex = corSegura(el("campoCorHex").value, "");
    if (!nome) { avisar("Dê um nome para a cor.", true); el("campoCorNome").focus(); return; }
    if (!hex) { avisar("Escolha uma cor da amostra.", true); return; }
    if (nome.length > 24) { avisar("Nome da cor muito longo (máx. 24 caracteres).", true); return; }
    if (estado.cores.length >= MAX_CORES) { avisar(`Máximo de ${MAX_CORES} cores.`, true); return; }
    if (estado.cores.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
        avisar("Essa cor já foi adicionada.", true);
        return;
    }
    estado.cores.push({ nome, hex });
    el("campoCorNome").value = "";
    el("campoCorNome").focus();
    renderCores();
}

function abrirNovo() {
    estado.editando = null;
    estado.tamanhos = [];
    estado.cores = [];
    el("formProduto").reset();
    el("campoId").value = "";
    el("campoPh").value = "#E7E3E7";
    el("campoCorHex").value = "#1F1420";
    el("campoDisponivel").checked = true;
    el("formErro").hidden = true;
    el("fotosProgresso").hidden = true;
    atualizarContadores();
    limparPreview();
    renderChips();
    renderCores();
    el("fichaTitulo").textContent = "Novo produto";
    el("fichaProduto").hidden = false;
    el("campoNome").focus();
    el("fichaProduto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function abrirEdicao(p) {
    estado.editando = p;
    estado.tamanhos = [...p.tamanhos];
    estado.cores = p.cores.map((c) => ({ nome: c.nome, hex: c.hex }));
    el("campoId").value = p.id;
    el("campoNome").value = p.nome;
    el("campoCategoria").value = p.categoria;
    el("campoPreco").value = p.preco.toFixed(2);
    el("campoPrecoCartao").value = p.precoCartao == null ? "" : p.precoCartao.toFixed(2);
    el("campoPrecoDe").value = p.precoDe == null ? "" : p.precoDe.toFixed(2);
    el("campoBadge").value = p.badge;
    el("campoDescricao").value = p.descricao || "";
    el("campoComposicao").value = p.composicao || "";
    el("campoCuidados").value = p.cuidados || "";
    atualizarContadores();
    el("campoPh").value = corSegura(p.ph);
    el("campoAlt").value = p.alt;
    el("campoDisponivel").checked = p.disponivel;
    el("campoArquivos").value = "";
    el("formErro").hidden = true;
    el("fotosProgresso").hidden = true;
    limparPreview();
    /* Fotos já publicadas entram na lista com a URL do storage. */
    p.imagens.forEach((url) => {
        if (validarImgUrl(url)) estado.fotos.push({ chave: crypto.randomUUID(), url, arquivo: null, previewUrl: null });
    });
    renderFotos();
    renderChips();
    renderCores();
    el("fichaTitulo").textContent = "Editar produto";
    el("fichaProduto").hidden = false;
    el("campoNome").focus();
    el("fichaProduto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharForm() {
    el("fichaProduto").hidden = true;
    estado.editando = null;
    limparPreview();
    estado.cores = [];
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
    const precoCartao = numeroOuNulo(el("campoPrecoCartao").value);
    const precoDe = numeroOuNulo(el("campoPrecoDe").value);
    const descricao = el("campoDescricao").value.trim();
    const composicao = el("campoComposicao").value.trim();
    const cuidados = el("campoCuidados").value.trim();

    if (marcar(el("campoNome"), nome.length < 1)) pendentes.push(el("campoNome"));
    if (marcar(el("campoCategoria"), categoria.length < 1)) pendentes.push(el("campoCategoria"));
    if (marcar(el("campoPreco"), !(preco !== null && preco >= 0))) pendentes.push(el("campoPreco"));
    if (precoCartao !== null && !(precoCartao > 0)) { marcar(el("campoPrecoCartao"), true); pendentes.push(el("campoPrecoCartao")); }
    else marcar(el("campoPrecoCartao"), false);
    /* O cartão nunca sai mais barato que o à vista: o site mostra o
       à vista como preço principal. */
    if (precoCartao !== null && preco !== null && precoCartao < preco) {
        marcar(el("campoPrecoCartao"), true);
        pendentes.push(el("campoPrecoCartao"));
    }
    if (precoDe !== null && !(precoDe > 0)) { marcar(el("campoPrecoDe"), true); pendentes.push(el("campoPrecoDe")); }
    else marcar(el("campoPrecoDe"), false);
    if (marcar(el("campoAlt"), alt.length < 1)) pendentes.push(el("campoAlt"));
    if (marcar(el("campoBadge"), badge.length > 40)) pendentes.push(el("campoBadge"));
    if (descricao.length > 600) pendentes.push(el("campoDescricao"));
    if (composicao.length > 200) pendentes.push(el("campoComposicao"));
    if (cuidados.length > 300) pendentes.push(el("campoCuidados"));

    const temFotoFinal = estado.fotos.length > 0;
    if (!temFotoFinal) {
        pendentes.push(el("campoArquivos"));
    }

    if (estado.tamanhos.length < 1) pendentes.push(el("campoTam"));

    if (pendentes.length > 0) {
        const erro = el("formErro");
        if (estado.tamanhos.length < 1) erro.textContent = "Adicione pelo menos um tamanho.";
        else if (!temFotoFinal) erro.textContent = "Escolha pelo menos uma foto para o produto.";
        else if (precoCartao !== null && preco !== null && precoCartao < preco) erro.textContent = "O preço no cartão não pode ser menor que o à vista.";
        else erro.textContent = "Confira os campos marcados em vermelho.";
        erro.hidden = false;
        pendentes[0].focus();
        return null;
    }
    el("formErro").hidden = true;

    return { nome, categoria, alt, badge, preco, precoCartao, precoDe, descricao, composicao, cuidados };
}

/* ------------------------------------------------------------------
   UPLOAD DAS FOTOS — até 3 por vez, com rollback
   ------------------------------------------------------------------
   Se qualquer foto falhar, as que já subiram são apagadas do
   storage e o banco não é tocado: não fica foto órfã.
   ------------------------------------------------------------------ */
async function subirFotosNovas() {
    const novas = estado.fotos.filter((f) => !f.url && f.arquivo);
    if (novas.length === 0) return { enviadas: [], falhas: [] };

    const progresso = el("fotosProgresso");
    const enviadas = [];
    const falhas = [];
    let i = 0;

    const worker = async () => {
        while (i < novas.length) {
            const foto = novas[i++];
            try {
                const blob = await comprimirImagem(foto.arquivo);
                foto.url = await enviarImagem(blob);
                enviadas.push(foto);
                progresso.textContent = `Enviando foto ${enviadas.length} de ${novas.length}…`;
            } catch (e) {
                falhas.push(foto);
            }
        }
    };

    const n = Math.min(FOTOS_EM_PARALELO, novas.length);
    await Promise.all(Array.from({ length: n }, worker));
    return { enviadas, falhas };
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
    const progresso = el("fotosProgresso");
    const fotosAntes = estado.editando ? [...estado.editando.imagens] : [];

    try {
        const { enviadas, falhas } = await subirFotosNovas();

        if (falhas.length > 0) {
            /* Rollback: apaga do storage o que subiu e não grava nada. */
            for (const foto of enviadas) await apagarImagem(foto.url);
            for (const foto of falhas) foto.url = null;
            throw new Error("upload");
        }

        const imagens = estado.fotos.map((f) => f.url).filter(Boolean);
        const registro = {
            nome: dados.nome,
            preco: dados.preco,
            preco_cartao: dados.precoCartao,
            preco_de: dados.precoDe,
            categoria: dados.categoria,
            img_url: imagens[0] || null,
            imagens: imagens,
            cores: estado.cores,
            alt: dados.alt,
            tamanhos: estado.tamanhos,
            badge: dados.badge || null,
            ph: corSegura(el("campoPh").value),
            descricao: dados.descricao || null,
            composicao: dados.composicao || null,
            cuidados: dados.cuidados || null,
            disponivel: el("campoDisponivel").checked
        };

        if (estado.editando) {
            const { error } = await db.from("products").update(registro).eq("id", estado.editando.id);
            if (error) {
                /* O banco não aceitou: desfaz as fotos novas. */
                for (const foto of enviadas) await apagarImagem(foto.url);
                for (const foto of enviadas) foto.url = null;
                throw error;
            }
        } else {
            /* Produto novo entra no fim da ordem do site. */
            const maior = estado.produtos.reduce((max, p) => Math.max(max, Number(p.ordem) || 0), -1);
            registro.ordem = maior + 1;
            const { error } = await db.from("products").insert(registro);
            if (error) {
                for (const foto of enviadas) await apagarImagem(foto.url);
                for (const foto of enviadas) foto.url = null;
                throw error;
            }
        }

        /* Gravado: agora apaga do storage as fotos que saíram da peça. */
        const mantidas = new Set(imagens);
        for (const url of fotosAntes) {
            if (!mantidas.has(url)) await apagarImagem(url);
        }

        fecharForm();
        await carregarLista();
        avisar("Produto salvo.");
    } catch (erro) {
        if (erro && erro.message === "upload") {
            avisar("Não foi possível enviar as fotos. Nenhuma alteração foi gravada.", true);
        } else {
            avisar(mensagemErro(erro, "Não foi possível salvar o produto."), true);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar produto";
        progresso.hidden = true;
        progresso.textContent = "";
    }
}

async function excluir(p) {
    const confirmado = window.confirm(`Excluir "${p.nome}"? Essa ação não pode ser desfeita.`);
    if (!confirmado) return;

    try {
        const { error } = await db.from("products").delete().eq("id", p.id);
        if (error) throw error;
        for (const url of p.imagens) await apagarImagem(url);
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
/* ------------------------------------------------------------------
   ABAS — produtos e configurações
   ------------------------------------------------------------------ */
function trocarAba(aba) {
    estado.aba = aba;
    const produtos = aba === "produtos";
    el("secaoProdutos").hidden = !produtos;
    el("secaoConfig").hidden = produtos;
    el("abaProdutos").classList.toggle("ativa", produtos);
    el("abaConfig").classList.toggle("ativa", !produtos);
    el("abaProdutos").setAttribute("aria-selected", String(produtos));
    el("abaConfig").setAttribute("aria-selected", String(!produtos));
    /* Só a aba ativa entra na sequência de tabulação; as setas do
       teclado trocam de aba (padrão ARIA). */
    el("abaProdutos").tabIndex = produtos ? 0 : -1;
    el("abaConfig").tabIndex = produtos ? -1 : 0;
}

function moverAbaComTeclado(evento) {
    if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
    evento.preventDefault();
    const proxima = estado.aba === "produtos" ? "config" : "produtos";
    trocarAba(proxima);
    el(proxima === "config" ? "abaConfig" : "abaProdutos").focus();
}

/* ------------------------------------------------------------------
   CONFIGURAÇÕES DA LOJA — tabela settings
   ------------------------------------------------------------------
   Cada chave é gravada por conta (upsert). Se a tabela ainda não
   existir, o aviso aponta a migração em vez de quebrar o painel.
   ------------------------------------------------------------------ */
async function carregarConfig() {
    const config = await lerSettings();
    estado.config = config;
    el("configWhatsapp").value = config.whatsapp || "";
    el("configHorario").value = config.horario || "";
    el("configContato").value = config.contato || "";
    el("configFaixa").value = (config.faixa || []).join("\n");
    renderDestaques();
}

function renderDestaques() {
    const sel = el("configDestaque");
    if (!sel) return;
    const atual = sel.value || estado.config.destaque || "";
    sel.innerHTML = "";
    const nenhuma = document.createElement("option");
    nenhuma.value = "";
    nenhuma.textContent = "Nenhuma — vale a primeira do índice";
    sel.appendChild(nenhuma);
    ordenarProdutos(estado.produtos).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nome;
        sel.appendChild(opt);
    });
    sel.value = atual;
}

function erroDeConfig(texto) {
    const erro = el("configErro");
    erro.textContent = texto;
    erro.hidden = false;
}

async function salvarConfig(e) {
    e.preventDefault();
    el("configErro").hidden = true;

    const rawWhats = el("configWhatsapp").value.trim();
    const digitos = rawWhats.replace(/\D/g, "");
    if (rawWhats && !/^\d{10,15}$/.test(digitos)) {
        erroDeConfig("O WhatsApp deve ter só números, com o 55 na frente (ex.: 5589981425420).");
        return;
    }

    const contato = el("configContato").value.trim();
    if (contato && !/^https?:\/\/[^\s]+$/i.test(contato)) {
        erroDeConfig("O link de contato precisa começar com http:// ou https://.");
        return;
    }

    const faixa = el("configFaixa").value
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean)
        .slice(0, 8);

    const valores = {
        whatsapp: digitos,
        horario: el("configHorario").value.trim(),
        faixa: faixa,
        destaque: el("configDestaque").value || null,
        contato: contato
    };

    const btn = el("btnSalvarConfig");
    btn.disabled = true;
    btn.textContent = "Salvando…";
    try {
        /* Uma única gravação: as cinco chaves entram juntas, para a
           configuração não ficar salva pela metade. */
        const linhas = CHAVES_CONFIG.map((chave) => ({ chave: chave, valor: valores[chave] }));
        const { error } = await db.from("settings").upsert(linhas);
        if (error) throw error;
        await carregarConfig();
        avisar("Configurações salvas.");
    } catch (erro) {
        erroDeConfig(erroColunaFalta(erro)
            ? "A tabela de configurações não existe. Rode supabase/migrations/002_detalhes_ordem_settings.sql no Supabase."
            : mensagemErro(erro, "Não foi possível salvar as configurações."));
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar configurações";
    }
}

/* Contadores dos textos da peça. */
const CAMPOS_CONTADOR = [
    ["campoDescricao", "contadorDescricao", 600],
    ["campoComposicao", "contadorComposicao", 200],
    ["campoCuidados", "contadorCuidados", 300]
];

function atualizarContadores() {
    CAMPOS_CONTADOR.forEach(([campo, contador, max]) => {
        const c = el(campo);
        const n = el(contador);
        if (!c || !n) return;
        n.textContent = `${c.value.length} de ${max}`;
    });
}

function configurarEventos() {
    el("formLogin").addEventListener("submit", entrar);
    el("btnSair").addEventListener("click", sair);
    el("btnNovo").addEventListener("click", abrirNovo);
    el("btnFecharForm").addEventListener("click", fecharForm);
    el("btnCancelar").addEventListener("click", fecharForm);
    el("formProduto").addEventListener("submit", salvar);
    el("abaProdutos").addEventListener("click", () => trocarAba("produtos"));
    el("abaConfig").addEventListener("click", () => trocarAba("config"));
    el("abaProdutos").addEventListener("keydown", moverAbaComTeclado);
    el("abaConfig").addEventListener("keydown", moverAbaComTeclado);
    el("formConfig").addEventListener("submit", salvarConfig);
    CAMPOS_CONTADOR.forEach(([campo]) => {
        el(campo).addEventListener("input", atualizarContadores);
    });

    el("btnAddTam").addEventListener("click", adicionarTamanho);
    el("campoTam").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); adicionarTamanho(); }
    });

    el("btnUsarNome").addEventListener("click", () => {
        const nome = el("campoNome").value.trim();
        if (nome) el("campoAlt").value = nome;
        el("campoAlt").focus();
    });

    el("btnAddCor").addEventListener("click", adicionarCor);
    el("campoCorNome").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); adicionarCor(); }
    });

    el("campoArquivos").addEventListener("change", (e) => {
        const arquivos = Array.from(e.target.files || []);
        e.target.value = "";
        if (arquivos.length > 0) adicionarFotos(arquivos);
    });

    /* Arrastar arquivos para a área de fotos. */
    const area = el("fotosArea");
    area.addEventListener("dragover", (e) => {
        e.preventDefault();
        area.classList.add("fotos-area--sobre");
    });
    area.addEventListener("dragleave", (e) => {
        if (area.contains(e.relatedTarget)) return;
        area.classList.remove("fotos-area--sobre");
    });
    area.addEventListener("drop", (e) => {
        e.preventDefault();
        area.classList.remove("fotos-area--sobre");
        const arquivos = Array.from(e.dataTransfer.files || []);
        if (arquivos.length > 0) adicionarFotos(arquivos);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    configurarEventos();
    vigiarInatividade();
    trocarAba("produtos");
    iniciarSessao();
});

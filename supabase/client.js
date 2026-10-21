/* ============================================================
   Estilosas Fitness — módulo compartilhado do Supabase
   ------------------------------------------------------------
   Usado pelo site público (script.js) e pelo painel (admin.js).
   Contém: cliente Supabase, escape anti-XSS e validação de URL
   de imagem do bucket.
   ============================================================ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
/* O `?v=` no config.js é obrigatório: sem ele o navegador guarda a
   versão antiga do arquivo (com a chave de exemplo) e o site passa a
   responder 401 "Expected 3 parts in JWT". */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js?v=20261021c";
import { normalizarSettings } from "../loja.js?v=20261021c";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Login é só e-mail/senha: não processamos tokens vindos da URL.
        detectSessionInUrl: false
    }
});

export const BUCKET = "produtos";

const CAMINHO_PUBLICO_BUCKET = `/storage/v1/object/public/${BUCKET}/`;

/* Colunas lidas de public.products — fonte única para o site e o painel. */
export const COLUNAS_PRODUTO = "id, nome, preco, preco_de, preco_cartao, categoria, img_url, alt, tamanhos, badge, ph, disponivel, criado_em, imagens, cores, descricao, composicao, cuidados, ordem";

/* Lista reduzida: usada quando as colunas da Fase 2 ainda não
   existem no banco (a migração 002 não rodou). O site continua
   no ar mostrando o catálogo antigo. */
export const COLUNAS_PRODUTO_SIMPLES = "id, nome, preco, preco_de, categoria, img_url, alt, tamanhos, badge, ph, disponivel, criado_em, imagens, cores";

/* Escapa texto que vai para innerHTML. */
export function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[c]));
}

/* Só aceita https no host do NOSSO projeto e dentro do bucket de produtos. */
export function validarImgUrl(url) {
    if (typeof url !== "string" || url.length === 0 || url.length > 600) return false;
    let alvo;
    let base;
    try {
        alvo = new URL(url);
        base = new URL(SUPABASE_URL);
    } catch {
        return false;
    }
    return alvo.protocol === "https:"
        && alvo.hostname === base.hostname
        && alvo.pathname.startsWith(CAMINHO_PUBLICO_BUCKET);
}

/* Cor em atributo `style` só se for #RRGGBB puro; caso contrário, o padrão.
   Evita injeção de CSS mesmo que o banco venha adulterado. */
export function corSegura(valor, padrao = "#E7E3E7") {
    return typeof valor === "string" && /^#[0-9A-Fa-f]{6}$/.test(valor) ? valor.toUpperCase() : padrao;
}

/* Mensagem legível e sem detalhe interno para erros do Supabase. */
export function mensagemErro(erro, padrao = "Não foi possível concluir. Tente de novo.") {
    if (!erro) return padrao;
    const codigo = erro.code || "";
    if (codigo === "23505") return "Já existe um registro com esses dados.";
    if (codigo === "42501" || erro.status === 401 || erro.status === 403) {
        return "Sua sessão expirou ou você não tem permissão. Entre de novo.";
    }
    if (erro.message && /row-level security|policy/i.test(erro.message)) {
        return "Sem permissão para essa alteração. Entre de novo.";
    }
    return padrao;
}

/* ------------------------------------------------------------------
   PRODUTO — normalização compartilhada
   ------------------------------------------------------------------
   Converte a linha do banco no formato usado na tela. Aceita também
   um objeto já normalizado (o cache do site guarda essa forma), para
   que reprocessar um snapshot não apague foto, preço ou cor.
   ------------------------------------------------------------------ */
export function erroColunaFalta(erro) {
    if (!erro) return false;
    const codigo = String(erro.code || "");
    if (codigo === "42703" || codigo === "42P01") return true;
    if (codigo === "PGRST200" || codigo === "PGRST203" || codigo === "PGRST205") return true;
    const mensagem = String(erro.message || "");
    return /could not find the (column|table)|does not exist|schema cache/i.test(mensagem);
}

export function normalizarProduto(linha) {
    if (!linha || typeof linha !== "object") return null;

    const precoDeBruto = linha.preco_de !== undefined ? linha.preco_de : linha.precoDe;
    const precoCartaoBruto = linha.preco_cartao !== undefined ? linha.preco_cartao : linha.precoCartao;
    const imgBruta = linha.img_url !== undefined ? linha.img_url : linha.img;
    const criadoBruto = linha.criado_em !== undefined ? linha.criado_em : linha.criadoEm;

    /* Fotos: só entram URLs do bucket; a capa vem de imagens[0]. */
    const fotos = (Array.isArray(linha.imagens) ? linha.imagens : [])
        .filter((u) => typeof u === "string" && validarImgUrl(u));
    const capa = typeof imgBruta === "string" && validarImgUrl(imgBruta) ? imgBruta : "";
    const imagens = fotos.length > 0 ? fotos : (capa ? [capa] : []);

    /* Cores: nome obrigatório, hex sempre passado pelo corSegura. */
    const vistas = new Set();
    const cores = [];
    (Array.isArray(linha.cores) ? linha.cores : []).forEach((c) => {
        if (!c || typeof c.nome !== "string") return;
        const nome = c.nome.trim();
        if (!nome) return;
        const chave = nome.toLowerCase();
        if (vistas.has(chave)) return;
        vistas.add(chave);
        cores.push({ nome, hex: corSegura(c.hex) });
    });

    return {
        id: String(linha.id || ""),
        nome: String(linha.nome || ""),
        preco: Number(linha.preco) || 0,
        precoDe: precoDeBruto == null ? null : Number(precoDeBruto),
        precoCartao: precoCartaoBruto == null || precoCartaoBruto === ""
            ? null
            : Number(precoCartaoBruto),
        categoria: String(linha.categoria || ""),
        img: imagens[0] || "",
        imagens,
        cores,
        alt: String(linha.alt || ""),
        tamanhos: (Array.isArray(linha.tamanhos) ? linha.tamanhos : []).map(String),
        badge: linha.badge ? String(linha.badge) : null,
        ph: corSegura(linha.ph),
        disponivel: linha.disponivel !== false,
        criadoEm: String(criadoBruto || ""),
        descricao: String(linha.descricao || ""),
        composicao: String(linha.composicao || ""),
        cuidados: String(linha.cuidados || ""),
        ordem: Math.trunc(Number(linha.ordem)) || 0
    };
}

/* ------------------------------------------------------------------
   CONFIGURAÇÕES DA LOJA
   ------------------------------------------------------------------
   Lê a tabela settings. Se ela ainda não existir (a migração 002
   não rodou), devolve os valores vazios: o site segue no ar com o
   WhatsApp e a faixa que já estavam no código.
   ------------------------------------------------------------------ */
export async function lerSettings() {
    try {
        const { data, error } = await db.from("settings").select("chave,valor");
        if (error) return normalizarSettings([]);
        return normalizarSettings(data || []);
    } catch (e) {
        return normalizarSettings([]);
    }
}

/* A tabela de configurações existe? Serve para o painel avisar que
   falta a migração em vez de mostrar um erro genérico. */
export async function settingsExiste() {
    try {
        const { error } = await db.from("settings").select("chave", { count: "exact", head: true });
        return !error;
    } catch (e) {
        return false;
    }
}

/* ============================================================
   Estilosas Fitness — módulo compartilhado do Supabase
   ------------------------------------------------------------
   Usado pelo site público (script.js) e pelo painel (admin.js).
   Contém: cliente Supabase, escape anti-XSS e validação de URL
   de imagem do bucket.
   ============================================================ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

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

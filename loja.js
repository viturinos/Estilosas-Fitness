/* ============================================================
   Estilosas Fitness — regras de negócio da vitrine
   ------------------------------------------------------------
   Lógica pura: sem DOM, sem rede, sem banco. Reúne o que o
   site, o painel e os testes precisam concordar — preços por
   forma de pagamento, desconto, busca sem acento, ordem das
   peças e leitura das configurações da loja.

   Testes: node --test tests/loja.test.js
   ============================================================ */

"use strict";

/* Formas de pagamento da nota de encomenda. */
export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao"];
export const ROTULO_PAGAMENTO = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    cartao: "Cartão"
};

/* Faixa de avisos usada quando a loja ainda não configurou a dela. */
export const AVISOS_PADRAO = [
    "Atendimento direto com a loja",
    "Sem cadastro para montar sua nota",
    "Pagamento e frete no atendimento",
    "Orientação de tamanho no WhatsApp"
];

/* Chaves da tabela settings (fonte única: painel grava, site lê). */
export const CHAVES_CONFIG = ["whatsapp", "horario", "faixa", "destaque", "contato"];

/* ------------------------------------------------------------------
   TEXTO
   ------------------------------------------------------------------
   "macacao" precisa achar "Macacão": a comparação ignora o acento
   dos dois lados.
   ------------------------------------------------------------------ */
export function semAcento(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/* ------------------------------------------------------------------
   DESCONTO
   ------------------------------------------------------------------
   Só existe desconto quando há preço de tabela ("de") maior que o
   preço à vista. O número mostrado é inteiro.
   ------------------------------------------------------------------ */
export function descontoPercentual(preco, precoDe) {
    const p = Number(preco);
    const d = Number(precoDe);
    if (!Number.isFinite(p) || !Number.isFinite(d)) return null;
    if (d <= 0 || d <= p) return null;
    const inteiro = Math.round((1 - p / d) * 100);
    /* Desconto de menos de 1% não se anuncia: vira "-0%". */
    return inteiro > 0 ? inteiro : null;
}

/* ------------------------------------------------------------------
   PREÇO POR FORMA DE PAGAMENTO
   ------------------------------------------------------------------
   Pix e dinheiro pagam o preço à vista; cartão paga o preço de
   cartão quando a peça tem um. Peça sem preço de cartão paga o
   mesmo valor nos dois casos — e o site nem menciona o cartão.
   ------------------------------------------------------------------ */
export function precoDaPeca(p, forma) {
    if (!p || typeof p !== "object") return 0;
    const base = Number(p.preco) || 0;
    if (forma === "cartao") {
        const cartao = Number(p.precoCartao);
        /* Cartão mais barato que o à vista é erro de cadastro: o
           à vista é o piso e nunca sai acima dele. */
        if (Number.isFinite(cartao) && cartao >= base && cartao > 0) return cartao;
    }
    return base;
}

/* ------------------------------------------------------------------
   BLOCO DE PREÇO
   ------------------------------------------------------------------
   O que a vitrine mostra de uma peça: valor à vista, preço de
   tabela riscado, a queda percentual e o preço de cartão (só
   quando é diferente do à vista).
   ------------------------------------------------------------------ */
export function precosDeExibicao(p) {
    const valor = p && typeof p === "object" ? Number(p.preco) || 0 : 0;

    const deBruto = p && p.precoDe != null ? Number(p.precoDe) : null;
    /* "de" só aparece quando é MAIOR que o preço: riscado embaixo
       do valor não quer dizer nada. */
    const de = deBruto !== null && Number.isFinite(deBruto) && deBruto > valor
        ? deBruto
        : null;

    const cartaoBruto = p && p.precoCartao != null ? Number(p.precoCartao) : null;
    /* O cartão é só apoio: aparece quando é maior que o à vista —
       igual não se anuncia, menor é erro de cadastro. */
    const cartao = cartaoBruto !== null && Number.isFinite(cartaoBruto) && cartaoBruto > valor
        ? cartaoBruto
        : null;

    return {
        valor,
        de,
        percentual: descontoPercentual(valor, de),
        cartao
    };
}

/* ------------------------------------------------------------------
   ORDEM DAS PEÇAS
   ------------------------------------------------------------------
   A ordem manual do painel manda; no empate, vale a data de
   cadastro. A lista recebida não é alterada.
   ------------------------------------------------------------------ */
export function ordenarProdutos(lista) {
    const copia = Array.isArray(lista) ? [...lista] : [];
    return copia.sort((a, b) => {
        const oa = Number(a && a.ordem) || 0;
        const ob = Number(b && b.ordem) || 0;
        if (oa !== ob) return oa - ob;
        const ca = String((a && a.criadoEm) || "");
        const cb = String((b && b.criadoEm) || "");
        if (ca !== cb) return ca < cb ? -1 : 1;
        return 0;
    });
}

/* ------------------------------------------------------------------
   ORDEM DAS CATEGORIAS
   ------------------------------------------------------------------
   Cada categoria entra na ordem da sua peça mais alta na ordem
   manual; empate mantém a ordem em que apareceram.
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   MOVER UMA PEÇA NA ORDEM
   ------------------------------------------------------------------
   Troca a peça com a vizinha (para cima ou para baixo) e devolve a
   nova ordem, sempre contígua (0, 1, 2…). Devolve null quando não
   há para onde mover. A lista recebida não é alterada.
   ------------------------------------------------------------------ */
export function moverNaOrdem(lista, id, dir) {
    const ordenados = ordenarProdutos(lista);
    const i = ordenados.findIndex((x) => x && x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordenados.length) return null;

    const trocado = ordenados[i];
    ordenados[i] = ordenados[j];
    ordenados[j] = trocado;

    return ordenados.map((x, idx) => ({ id: x.id, ordem: idx }));
}

export function ordenarCategorias(produtos) {
    const menorOrdem = new Map();
    const ordemVista = new Map();
    let contador = 0;

    (Array.isArray(produtos) ? produtos : []).forEach((p) => {
        const cat = p && typeof p.categoria === "string" ? p.categoria.trim() : "";
        if (!cat) return;
        const ordem = Number(p.ordem) || 0;
        if (!menorOrdem.has(cat) || ordem < menorOrdem.get(cat)) menorOrdem.set(cat, ordem);
        if (!ordemVista.has(cat)) ordemVista.set(cat, contador++);
    });

    return [...menorOrdem.keys()].sort((a, b) => {
        const oa = menorOrdem.get(a);
        const ob = menorOrdem.get(b);
        if (oa !== ob) return oa - ob;
        return ordemVista.get(a) - ordemVista.get(b);
    });
}

/* ------------------------------------------------------------------
   CONFIGURAÇÕES DA LOJA
   ------------------------------------------------------------------
   Lê as linhas da tabela settings e devolve um objeto pronto:
   chave WhatsApp só com dígitos, faixa como lista de mensagens,
   destaque como id de peça (ou null).
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   LINK SEGURO
   ------------------------------------------------------------------
   Link de contato da loja: só http ou https entram no site. Qualquer
   outra coisa (javascript:, data:) é descartada.
   ------------------------------------------------------------------ */
export function linkSeguro(valor) {
    if (typeof valor !== "string") return "";
    const alvo = valor.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(alvo)) return "";
    return alvo;
}

export function normalizarSettings(linhas) {    const saida = {
        whatsapp: "",
        horario: "",
        faixa: [],
        destaque: null,
        contato: ""
    };

    const valores = new Map();
    (Array.isArray(linhas) ? linhas : []).forEach((linha) => {
        if (!linha || typeof linha.chave !== "string") return;
        valores.set(linha.chave, linha.valor);
    });

    const whats = valores.get("whatsapp");
    if (typeof whats === "string" || typeof whats === "number") {
        saida.whatsapp = String(whats).replace(/\D/g, "");
    }

    const horario = valores.get("horario");
    if (typeof horario === "string") saida.horario = horario.trim();

    const faixa = valores.get("faixa");
    if (Array.isArray(faixa)) {
        saida.faixa = faixa.map((m) => String(m ?? "").trim()).filter(Boolean);
    } else if (typeof faixa === "string") {
        saida.faixa = faixa.split(/\r?\n/).map((m) => m.trim()).filter(Boolean);
    }

    const destaque = valores.get("destaque");
    if (typeof destaque === "string" && destaque.trim()) saida.destaque = destaque.trim();

    const contato = valores.get("contato");
    if (typeof contato === "string") saida.contato = linkSeguro(contato);

    return saida;
}

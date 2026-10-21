/* ============================================================
   Estilosas Fitness — testes da lógica pura (loja.js)
   ------------------------------------------------------------
   Rodar: node --test tests/
   Sem dependências: usa o test runner do próprio Node.
   ============================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import {
    AVISOS_PADRAO,
    FORMAS_PAGAMENTO,
    ROTULO_PAGAMENTO,
    descontoPercentual,
    linkSeguro,
    moverNaOrdem,
    normalizarSettings,
    ordenarCategorias,
    ordenarProdutos,
    precoDaPeca,
    precosDeExibicao,
    semAcento
} from "../loja.js";

/* ------------------------------------------------------------------
   SEM ACENTO
   ------------------------------------------------------------------ */
test("semAcento tira o acento e mantém o texto minúsculo", () => {
    assert.equal(semAcento("Macacão"), "macacao");
    assert.equal(semAcento("LEGging"), "legging");
    assert.equal(semAcento("Blusa Manga Longa"), "blusa manga longa");
    assert.equal(semAcento(""), "");
});

test("semAcento sobrevive a valor que não é texto", () => {
    assert.equal(semAcento(null), "");
    assert.equal(semAcento(undefined), "");
    assert.equal(semAcento(42), "42");
});

/* ------------------------------------------------------------------
   DESCONTO
   ------------------------------------------------------------------ */
test("descontoPercentual calcula a queda do preço de tabela", () => {
    assert.equal(descontoPercentual(100, 133.33), 25);
    assert.equal(descontoPercentual(75, 100), 25);
});

test("descontoPercentual devolve null quando não há preço riscado", () => {
    assert.equal(descontoPercentual(100, null), null);
    assert.equal(descontoPercentual(100, undefined), null);
    assert.equal(descontoPercentual(100, 0), null);
});

test("descontoPercentual devolve null quando o preço de tabela não é maior", () => {
    assert.equal(descontoPercentual(100, 100), null);
    assert.equal(descontoPercentual(100, 90), null);
});

/* ------------------------------------------------------------------
   PREÇO POR FORMA DE PAGAMENTO
   ------------------------------------------------------------------ */
test("precoDaPeca usa o preço de cartão só na forma cartão", () => {
    const p = { preco: 100, precoCartao: 130 };
    assert.equal(precoDaPeca(p, "cartao"), 130);
    assert.equal(precoDaPeca(p, "pix"), 100);
    assert.equal(precoDaPeca(p, "dinheiro"), 100);
});

test("precoDaPeca cai no preço à vista quando a peça não tem preço de cartão", () => {
    assert.equal(precoDaPeca({ preco: 100 }, "cartao"), 100);
    assert.equal(precoDaPeca({ preco: 100, precoCartao: null }, "cartao"), 100);
});

test("precoDaPeca devolve 0 quando a peça não tem preço", () => {
    assert.equal(precoDaPeca({}, "pix"), 0);
    assert.equal(precoDaPeca(null, "pix"), 0);
});

test("as formas de pagamento são as três combinadas, com rótulo próprio", () => {
    assert.deepEqual(FORMAS_PAGAMENTO, ["pix", "dinheiro", "cartao"]);
    assert.equal(ROTULO_PAGAMENTO.pix, "Pix");
    assert.equal(ROTULO_PAGAMENTO.dinheiro, "Dinheiro");
    assert.equal(ROTULO_PAGAMENTO.cartao, "Cartão");
});

/* ------------------------------------------------------------------
   BLOCO DE PREÇO
   ------------------------------------------------------------------ */
test("precosDeExibicao monta valor, preço riscado e desconto", () => {
    const p = { preco: 100, precoDe: 133.33, precoCartao: 130 };
    const r = precosDeExibicao(p);
    assert.equal(r.valor, 100);
    assert.equal(r.de, 133.33);
    assert.equal(r.percentual, 25);
    assert.equal(r.cartao, 130);
});

test("precosDeExibicao não repete o cartão quando ele é igual ao à vista", () => {
    const r = precosDeExibicao({ preco: 100, precoCartao: 100 });
    assert.equal(r.cartao, null);
});

test("precosDeExibicao não inventa cartão nem desconto", () => {
    const r = precosDeExibicao({ preco: 100 });
    assert.equal(r.cartao, null);
    assert.equal(r.de, null);
    assert.equal(r.percentual, null);
});

/* ------------------------------------------------------------------
   ORDEM
   ------------------------------------------------------------------ */
test("ordenarProdutos respeita a ordem manual e, no empate, a data", () => {
    const lista = [
        { id: "b", nome: "B", ordem: 2, criadoEm: "2026-01-01" },
        { id: "a", nome: "A", ordem: 1, criadoEm: "2026-02-01" },
        { id: "c", nome: "C", ordem: 1, criadoEm: "2026-01-01" }
    ];
    assert.deepEqual(ordenarProdutos(lista).map((p) => p.id), ["c", "a", "b"]);
});

test("ordenarProdutos não mexe na lista recebida", () => {
    const lista = [
        { id: "b", ordem: 2, criadoEm: "2026-01-01" },
        { id: "a", ordem: 1, criadoEm: "2026-01-01" }
    ];
    ordenarProdutos(lista);
    assert.equal(lista[0].id, "b");
});

test("ordenarCategorias segue a menor ordem de cada categoria", () => {
    const produtos = [
        { id: "1", categoria: "Legging", ordem: 5 },
        { id: "2", categoria: "Top", ordem: 1 },
        { id: "3", categoria: "Legging", ordem: 9 }
    ];
    assert.deepEqual(ordenarCategorias(produtos), ["Top", "Legging"]);
});

test("ordenarCategorias não repete categoria nem inventa categoria", () => {
    const produtos = [
        { id: "1", categoria: "Top", ordem: 1 },
        { id: "2", categoria: "Top", ordem: 2 },
        { id: "3", categoria: "", ordem: 0 }
    ];
    assert.deepEqual(ordenarCategorias(produtos), ["Top"]);
});

/* ------------------------------------------------------------------
   CONFIGURAÇÕES
   ------------------------------------------------------------------ */
test("normalizarSettings lê as chaves que a loja gravou", () => {
    const s = normalizarSettings([
        { chave: "whatsapp", valor: "55 (11) 99814-2542" },
        { chave: "horario", valor: "Segunda a sábado, 9h às 19h" },
        { chave: "faixa", valor: ["Primeira mensagem", "Segunda mensagem"] },
        { chave: "destaque", valor: "abc-123" },
        { chave: "contato", valor: "https://instagram.com/estilosas" }
    ]);
    assert.equal(s.whatsapp, "5511998142542");
    assert.equal(s.horario, "Segunda a sábado, 9h às 19h");
    assert.deepEqual(s.faixa, ["Primeira mensagem", "Segunda mensagem"]);
    assert.equal(s.destaque, "abc-123");
    assert.equal(s.contato, "https://instagram.com/estilosas");
});

test("normalizarSettings aceita a faixa como texto de uma linha por mensagem", () => {
    const s = normalizarSettings([{ chave: "faixa", valor: "Uma\n\nDuas  " }]);
    assert.deepEqual(s.faixa, ["Uma", "Duas"]);
});

test("normalizarSettings devolve os valores vazios quando a loja não configurou nada", () => {
    const s = normalizarSettings([]);
    assert.equal(s.whatsapp, "");
    assert.equal(s.horario, "");
    assert.deepEqual(s.faixa, []);
    assert.equal(s.destaque, null);
    assert.equal(s.contato, "");
});

test("normalizarSettings ignora chave desconhecida e valor sem sentido", () => {
    const s = normalizarSettings([
        { chave: "inventada", valor: "qualquer coisa" },
        { chave: "destaque", valor: "" },
        { chave: "faixa", valor: "   " }
    ]);
    assert.deepEqual(Object.keys(s).sort(), ["contato", "destaque", "faixa", "horario", "whatsapp"]);
    assert.equal(s.destaque, null);
    assert.deepEqual(s.faixa, []);
});

test("os avisos padrão existem para quando a loja não grava a faixa", () => {
    assert.ok(Array.isArray(AVISOS_PADRAO));
    assert.ok(AVISOS_PADRAO.length >= 2);
    assert.ok(AVISOS_PADRAO.every((m) => typeof m === "string" && m.length > 0));
});

/* ------------------------------------------------------------------
   MOVER NA ORDEM
   ------------------------------------------------------------------ */
test("moverNaOrdem troca a peça com a vizinha e renumera a ordem", () => {
    const lista = [
        { id: "a", nome: "A", ordem: 0 },
        { id: "b", nome: "B", ordem: 1 },
        { id: "c", nome: "C", ordem: 2 }
    ];
    const nova = moverNaOrdem(lista, "b", 1);
    assert.deepEqual(nova, [
        { id: "a", ordem: 0 },
        { id: "c", ordem: 1 },
        { id: "b", ordem: 2 }
    ]);
});

test("moverNaOrdem sobe a peça e devolve a ordem contígua", () => {
    const lista = [
        { id: "a", nome: "A", ordem: 5 },
        { id: "b", nome: "B", ordem: 9 },
        { id: "c", nome: "C", ordem: 40 }
    ];
    const nova = moverNaOrdem(lista, "c", -1);
    assert.deepEqual(nova.map((x) => x.ordem), [0, 1, 2]);
    assert.deepEqual(nova.map((x) => x.id), ["a", "c", "b"]);
});

test("moverNaOrdem não mexe no fim da lista nem no começo", () => {
    const lista = [{ id: "a", ordem: 0 }, { id: "b", ordem: 1 }];
    assert.equal(moverNaOrdem(lista, "a", -1), null);
    assert.equal(moverNaOrdem(lista, "b", 1), null);
    assert.equal(moverNaOrdem(lista, "z", 1), null);
});

test("moverNaOrdem não altera a lista recebida", () => {
    const lista = [{ id: "a", ordem: 0 }, { id: "b", ordem: 1 }];
    const copia = JSON.stringify(lista);
    moverNaOrdem(lista, "a", 1);
    assert.equal(JSON.stringify(lista), copia);
});

/* ------------------------------------------------------------------
   LINK SEGURO
   ------------------------------------------------------------------ */
test("linkSeguro aceita http e https e recusa o resto", () => {
    assert.equal(linkSeguro("https://instagram.com/estilosas"), "https://instagram.com/estilosas");
    assert.equal(linkSeguro("http://estilosas.com.br"), "http://estilosas.com.br");
    assert.equal(linkSeguro("javascript:alert(1)"), "");
    assert.equal(linkSeguro("data:text/html,<script>"), "");
    assert.equal(linkSeguro("/rota-interna"), "");
    assert.equal(linkSeguro(""), "");
    assert.equal(linkSeguro(null), "");
});

test("normalizarSettings descarta link de contato fora de http", () => {
    const s = normalizarSettings([
        { chave: "contato", valor: "javascript:alert(1)" },
        { chave: "whatsapp", valor: "5511999998888" }
    ]);
    assert.equal(s.contato, "");
    assert.equal(s.whatsapp, "5511999998888");
});

/* ------------------------------------------------------------------
   PRE�O: O QUE A PE�A FALA
   ------------------------------------------------------------------ */
test("precosDeExibicao esconde o 'de' quando ele n�o � maior que o pre�o", () => {
    const menor = precosDeExibicao({ preco: 120, precoDe: 100 });
    assert.equal(menor.de, null);
    assert.equal(menor.percentual, null);

    const igual = precosDeExibicao({ preco: 120, precoDe: 120 });
    assert.equal(igual.de, null);
    assert.equal(igual.percentual, null);
});

test("precosDeExibicao n�o fala de cart�o com pre�o zero ou negativo", () => {
    const zero = precosDeExibicao({ preco: 120, precoCartao: 0 });
    assert.equal(zero.cartao, null);

    const negativo = precosDeExibicao({ preco: 120, precoCartao: -10 });
    assert.equal(negativo.cartao, null);
});

test("precosDeExibicao n�o fala de cart�o mais barato que o � vista", () => {
    const r = precosDeExibicao({ preco: 120, precoCartao: 100 });
    assert.equal(r.cartao, null);
});

test("descontoPercentual n�o devolve zero", () => {
    assert.equal(descontoPercentual(100, 100.4), null);
    assert.equal(descontoPercentual(100, 101), 1);
});

test("precoDaPeca nunca cobra menos que o � vista", () => {
    const p = { preco: 120, precoCartao: 100 };
    assert.equal(precoDaPeca(p, "cartao"), 120);
    assert.equal(precoDaPeca(p, "pix"), 120);
});
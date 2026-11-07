import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jwtVerify } from "jose";
import { parseCsv } from "../src/lib/csv";
import { gerarSenhaTemporaria } from "../src/lib/senha";
import { urlEmbedMetabase } from "../src/lib/metabase";

describe("parseCsv", () => {
  it("detecta ';' e converte vírgula decimal", () => {
    const t = parseCsv("Data;Preço\n02/01/2015;4,53\n05/01/2015;4.6\n");
    assert.deepEqual(t.colunas, ["Data", "Preço"]);
    assert.deepEqual(t.linhas, [["02/01/2015", 4.53], ["05/01/2015", 4.6]]);
  });

  it("detecta ',' e respeita aspas", () => {
    const t = parseCsv('nome,valor\n"Silva, João",10\n"aspas ""duplas""",\n');
    assert.deepEqual(t.linhas, [["Silva, João", 10], ['aspas "duplas"', null]]);
  });

  it("ignora BOM e linhas vazias, completa colunas faltantes", () => {
    const t = parseCsv("﻿a;b;c\n\n1;2\n");
    assert.deepEqual(t.colunas, ["a", "b", "c"]);
    assert.deepEqual(t.linhas, [[1, 2, null]]);
  });

  it("recusa CSV sem linhas de dados", () => {
    assert.throws(() => parseCsv("so_cabecalho\n"), /cabeçalho e ao menos uma linha/);
  });
});

describe("gerarSenhaTemporaria", () => {
  it("gera senhas do tamanho pedido, sem caracteres ambíguos e diferentes entre si", () => {
    const senhas = Array.from({ length: 200 }, () => gerarSenhaTemporaria());
    for (const s of senhas) assert.match(s, /^[A-HJ-NP-Za-km-np-z2-9]{12}$/);
    assert.equal(new Set(senhas).size, senhas.length);
  });
});

describe("sessão", () => {
  it("token válido devolve o id; adulterado ou com outro segredo é recusado", async () => {
    process.env.SESSION_SECRET = "s".repeat(40);
    const { createSessionToken, readSessionToken } = await import("../src/lib/session");
    const token = await createSessionToken(42);
    assert.equal(await readSessionToken(token), 42);

    const [h, p, sig] = token.split(".");
    const outroPayload = Buffer.from(JSON.stringify({ sub: "1" })).toString("base64url");
    assert.equal(await readSessionToken(`${h}.${outroPayload}.${sig}`), null);
    assert.equal(await readSessionToken(`${h}.${p}.assinatura-falsa`), null);
    assert.equal(await readSessionToken(undefined), null);

    process.env.SESSION_SECRET = "t".repeat(40);
    assert.equal(await readSessionToken(token), null);
  });
});

describe("urlEmbedMetabase", () => {
  it("assina o dashboard e os parâmetros travados, com validade curta", async () => {
    const segredo = "segredo-do-metabase-de-teste-com-64-caracteres-aaaaaaaaaaaaaaaaaa";
    const url = await urlEmbedMetabase(12, { cliente: "granja-demo" }, { site: "https://bi.exemplo.com/", segredo });
    const m = url.match(/^https:\/\/bi\.exemplo\.com\/embed\/dashboard\/([^#]+)#bordered=false&titled=true$/);
    assert.ok(m, url);

    const { payload } = await jwtVerify(m[1], new TextEncoder().encode(segredo));
    assert.deepEqual(payload.resource, { dashboard: 12 });
    assert.deepEqual(payload.params, { cliente: "granja-demo" });
    const restante = payload.exp! - Math.floor(Date.now() / 1000);
    assert.ok(restante > 9 * 60 && restante <= 10 * 60, `expira em ${restante}s`);

    await assert.rejects(jwtVerify(m[1], new TextEncoder().encode("outro-segredo")));
  });

  it("falha claramente sem configuração", async () => {
    await assert.rejects(urlEmbedMetabase(1, {}, { site: "", segredo: "" }), /não configurado/);
  });
});

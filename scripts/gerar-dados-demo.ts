// Gera as séries de demonstração de seed/data: preços SINTÉTICOS no mesmo formato das planilhas do Cepea
// (Data;À vista R$[;À vista US$], dias úteis de 2015-01-02 a 2025-02-28). Nenhum valor real é usado.
// Determinístico: a mesma semente gera sempre os mesmos arquivos. Uso: npx tsx scripts/gerar-dados-demo.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..", "seed", "data");

// PRNG com semente (mulberry32) e normal padrão (Box-Muller)
function prng(semente: number) {
  let a = semente >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
}

const datas: Date[] = [];
for (let d = new Date(Date.UTC(2015, 0, 2)); d <= new Date(Date.UTC(2025, 1, 28)); d.setUTCDate(d.getUTCDate() + 1)) {
  const dia = d.getUTCDay();
  if (dia !== 0 && dia !== 6) datas.push(new Date(d));
}
const n = datas.length;
const fmtData = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

// Passeio aleatório em log, "amarrado" para sair de `inicio` e chegar em `fim` (ponte browniana)
function serie(inicio: number, fim: number, vol: number, choques: number[]) {
  const passeio = [0];
  for (let i = 1; i < n; i++) passeio.push(passeio[i - 1] + vol * choques[i]);
  const ultimo = passeio[n - 1];
  const a = Math.log(inicio), b = Math.log(fim);
  return passeio.map((w, i) => Math.exp(a + (b - a) * (i / (n - 1)) + w - ultimo * (i / (n - 1))));
}

function choques(semente: number) {
  const z = prng(semente);
  return Array.from({ length: n }, () => z());
}

function gravar(arquivo: string, cabecalho: string, colunas: number[][]) {
  const linhas = datas.map((d, i) => [fmtData(d), ...colunas.map((c) => c[i].toFixed(2))].join(";"));
  writeFileSync(join(DIR, arquivo), [cabecalho, ...linhas].join("\n") + "\n");
}

const dolar = serie(2.7, 5.9, 0.009, choques(1));
gravar("dolar.csv", "Data;À vista R$", [dolar]);

const milhoBRL = serie(29, 88, 0.014, choques(2));
gravar("milho.csv", "Data;À vista R$;À vista US$", [milhoBRL, milhoBRL.map((v, i) => v / dolar[i])]);

// suínos: um fator de mercado comum + ruído regional, para as praças andarem juntas
const mercado = choques(3);
const pracas: [string, number, number, number][] = [
  ["suino_PR.csv", 3.9, 8.9, 10], ["suino_SC.csv", 3.9, 8.7, 11], ["suino_RS.csv", 3.9, 8.6, 12],
  ["suino_SP.csv", 4.6, 9.2, 13], ["suino_MG.csv", 4.5, 9.1, 14],
];
for (const [arquivo, inicio, fim, semente] of pracas) {
  const regional = choques(semente);
  gravar(arquivo, "Data;À vista R$", [serie(inicio, fim, 0.012, mercado.map((m, i) => 0.85 * m + 0.53 * regional[i]))]);
}

console.log(`seed/data: ${2 + pracas.length} séries sintéticas, ${n} dias úteis cada.`);

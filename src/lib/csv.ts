// Leitor de CSV simples: detecta ';' ou ',' como separador, aceita aspas
// e converte números (com vírgula decimal quando o separador é ';').

export type Tabela = { colunas: string[]; linhas: (string | number | null)[][] };

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const NUMERO = /^-?\d+([.,]\d+)?$/;

function toValue(v: string, sep: string): string | number | null {
  if (v === "") return null;
  if (NUMERO.test(v)) return Number(sep === ";" ? v.replace(",", ".") : v);
  return v;
}

export function parseCsv(text: string): Tabela {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("O CSV precisa de um cabeçalho e ao menos uma linha.");
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const colunas = splitLine(lines[0], sep);
  const linhas = lines.slice(1).map((l) => {
    const cells = splitLine(l, sep).map((c) => toValue(c, sep));
    return colunas.map((_, i) => cells[i] ?? null);
  });
  return { colunas, linhas };
}

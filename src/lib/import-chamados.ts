import * as XLSX from "xlsx";
import type { RawChamado, UpsertRow } from "./chamados-api";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const FIELD_ALIASES: Record<keyof UpsertRow | "data", string[]> = {
  id_portal: ["id portal", "id do portal", "numero do chamado", "n chamado", "chamado"],
  ano: ["ano"],
  mes: ["mes"],
  dia: ["dia"],
  data: ["data de entrada", "data entrada", "data"],
  cliente: ["cliente", "loja"],
  cd: ["cd", "centro de distribuicao"],
  regiao: ["regiao"],
  conf_exp: ["conferente de expedicao", "conferente expedicao", "conf exp"],
  conf_check: ["conferente de checkout", "conferente checkout", "conf check", "conferente de check out"],
  tipo: ["tipo", "tipo de chamado"],
  grupo: ["grupo", "status"],
  subcategoria: ["subcategoria", "procedencia", "parecer"],
  causa_raiz: ["causa raiz", "causa"],
  valor: ["valor", "valor em r$", "valor r$"],
  modalidade: ["modalidade"],
};

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]): unknown {
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    if (keys.some((a) => nk === a)) return row[k];
  }
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    if (keys.some((a) => nk.includes(a))) return row[k];
  }
  return undefined;
}

const txt = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function parseDate(v: unknown): { ano: number | null; mes: number | null; dia: number | null } {
  if (v === null || v === undefined || v === "") return { ano: null, mes: null, dia: null };
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return { ano: d.y, mes: d.m, dia: d.d };
  }
  if (v instanceof Date) return { ano: v.getFullYear(), mes: v.getMonth() + 1, dia: v.getDate() };
  const m = String(v).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) return { dia: Number(m[1]), mes: Number(m[2]), ano: Number(m[3].padStart(4, "20")) };
  return { ano: null, mes: null, dia: null };
}

/** Regras de exclusão da base. */
export function isExcluded(tipo: string, status: string): boolean {
  const t = norm(tipo);
  const s = norm(status);
  if (t.includes("devolucao") && !t.includes("movidesk")) return true;
  if (s.includes("cancelado por tempo") || s.includes("em preparacao")) return true;
  return false;
}

export async function parseImportFile(file: File): Promise<UpsertRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });

  const out: UpsertRow[] = [];
  for (const row of raw) {
    const id = num(pick(row, FIELD_ALIASES.id_portal));
    if (!id) continue;
    const tipo = txt(pick(row, FIELD_ALIASES.tipo));
    const grupoRaw = txt(pick(row, FIELD_ALIASES.grupo));
    const subRaw = txt(pick(row, FIELD_ALIASES.subcategoria));
    if (isExcluded(tipo, grupoRaw) || isExcluded(tipo, subRaw)) continue;

    let ano = num(pick(row, FIELD_ALIASES.ano));
    let mes = num(pick(row, FIELD_ALIASES.mes));
    let dia = num(pick(row, FIELD_ALIASES.dia));
    if (!ano || !mes || !dia) {
      const d = parseDate(pick(row, FIELD_ALIASES.data));
      ano = ano || d.ano;
      mes = mes || d.mes;
      dia = dia || d.dia;
    }

    const ng = norm(grupoRaw);
    const grupo = ng.includes("aberto") ? "Aberto" : ng.includes("fechado") ? "Fechado" : grupoRaw;

    out.push({
      id_portal: id,
      ano,
      mes,
      dia,
      cliente: txt(pick(row, FIELD_ALIASES.cliente)),
      cd: txt(pick(row, FIELD_ALIASES.cd)),
      regiao: txt(pick(row, FIELD_ALIASES.regiao)),
      conf_exp: txt(pick(row, FIELD_ALIASES.conf_exp)),
      conf_check: txt(pick(row, FIELD_ALIASES.conf_check)),
      tipo,
      grupo,
      subcategoria: subRaw || grupoRaw,
      causa_raiz: txt(pick(row, FIELD_ALIASES.causa_raiz)),
      valor: num(pick(row, FIELD_ALIASES.valor)),
      modalidade: txt(pick(row, FIELD_ALIASES.modalidade)),
    });
  }
  return out;
}

const COMPARE_FIELDS: (keyof UpsertRow)[] = [
  "ano",
  "mes",
  "dia",
  "cliente",
  "cd",
  "regiao",
  "conf_exp",
  "conf_check",
  "tipo",
  "grupo",
  "subcategoria",
  "causa_raiz",
  "valor",
  "modalidade",
];

export type ImportDiff = {
  novos: UpsertRow[];
  atualizados: { row: UpsertRow; campos: string[] }[];
  iguais: number;
};

const same = (a: unknown, b: unknown) => {
  if (typeof a === "number" || typeof b === "number") {
    const na = num(a);
    const nb = num(b);
    if (na === null && nb === null) return true;
    if (na === null || nb === null) return false;
    return Math.abs(na - nb) < 0.005;
  }
  return norm(txt(a)) === norm(txt(b));
};

export function diffImport(parsed: UpsertRow[], existing: RawChamado[]): ImportDiff {
  const byId = new Map<number, RawChamado>();
  for (const e of existing) if (e.id_portal !== null) byId.set(Number(e.id_portal), e);

  const novos: UpsertRow[] = [];
  const atualizados: { row: UpsertRow; campos: string[] }[] = [];
  let iguais = 0;

  for (const r of parsed) {
    const cur = byId.get(r.id_portal);
    if (!cur) {
      novos.push(r);
      continue;
    }
    const campos = COMPARE_FIELDS.filter(
      (f) => !same(r[f], (cur as unknown as Record<string, unknown>)[f]),
    );
    if (campos.length) atualizados.push({ row: r, campos });
    else iguais++;
  }
  return { novos, atualizados, iguais };
}

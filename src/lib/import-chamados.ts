import * as XLSX from "xlsx";
import type { RawChamado, UpsertRow } from "./chamados-api";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Mapa Razao Social completa -> sigla curta do CD (identico ao dashboard HTML). */
const CD_MAP: Record<string, string> = {
  "rede ancora - go importadora, exportadora e distribuidora de auto pecas s.a": "GO",
  "rede ancora - es importadora, exportadora e distribuidora de auto pecas s.a": "ES",
  "rede ancora - mt importadora, exportadora e distribuidora de auto pecas s.a": "MT",
  "rede ancora - pr importadora, exportadora e distribuidora de auto pecas s.a": "PR",
  "rede ancora - mg importadora, exportadora e distribuidora de auto pecas s.a": "MG",
  "rede ancora - sc importadora, exportadora e distribuidora de auto pecas s.a": "SC",
  "rede ancora - ms importadora, exportadora e distribuidora de auto pecas s.a": "MS",
  "filial - ananindeua (pa)": "PA",
  "rede ancora - rj importadora, exportadora e distribuidora de auto pecas s.a": "RJ",
  "rede ancora - pe importadora, exportadora e distribuidora de auto pecas s.a": "PE",
  "rede ancora - al importadora, exportadora e distribuidora de autopecas s.a": "AL",
  "rede ancora distrito federal e goias importadora exp. e dist. de auto pecas s.a": "DF",
  "rede ancora - pa importadora, exportadora e distribuidora de autopecas s.a": "PA",
};

function cdShort(nameRaw: string): string {
  const name = (nameRaw || "").trim();
  if (!name) return "N/D";
  const key = norm(name);
  if (CD_MAP[key]) return CD_MAP[key];
  const m = name.match(/REDE ANCORA - (\w+) /i);
  if (m) return m[1].toUpperCase();
  if (key.includes("distrito federal")) return "DF";
  const m2 = name.match(/\((\w+)\)/);
  if (m2) return m2[1].toUpperCase();
  return name.slice(0, 6);
}

/** Mapas de classificacao Status -> Acao / Parecer (identicos ao dashboard HTML). */
const STATUS_ACAO: Record<string, string> = {
  "improcedente": "FINALIZADO", "resolvido": "FINALIZADO", "produtos recebidos": "ANCORA",
  "aguardando analise da nota fiscal": "ANCORA", "em analise": "ANCORA",
  "produtos enviados - aguardando recebimento no cd": "ANCORA", "em discordancia": "FINALIZADO",
  "aguardando conciliacao financeira": "ANCORA", "verificando com o fornecedor": "ANCORA",
  "emitindo nota fiscal de remessa": "ANCORA", "aguardando recebimento no cd": "ANCORA",
  "aguardando envio ao cd": "LOJA", "aguardando atendimento": "ANCORA",
  "aprovada - aguardando a nota fiscal de devolucao": "LOJA", "aguardando descarte": "LOJA",
  "discordancia aceita": "ANCORA", "nota fiscal com impedimentos": "LOJA",
  "organizar a coleta dos produtos": "ANCORA", "aguardando validacao do descarte": "ANCORA",
  "aguardando lista de itens": "LOJA", "com erros": "LOJA", "coleta de produto programada": "ANCORA",
  "verificando o interesse de outras lojas": "ANCORA", "verificando com a transportadora": "ANCORA",
  "aguardando emissao da nfe para itens que o franqueado possui interesse": "ANCORA",
  "aguardando chegada no cd": "ANCORA", "em tratativa com o gestor da filial": "ANCORA",
  "encerrado": "FINALIZADO", "problema com o descarte": "LOJA",
  "verificando estoque": "ANCORA", "recusa no sefaz realizada - validando": "ANCORA",
};
const STATUS_PARECER: Record<string, string> = {
  "resolvido": "Procedente", "improcedente": "Improcedente",
  "aprovada - aguardando a nota fiscal de devolucao": "Procedente", "encerrado": "Improcedente",
  "aguardando conciliacao financeira": "Procedente", "emitindo nota fiscal de remessa": "Procedente",
  "nota fiscal com impedimentos": "Procedente", "organizar a coleta dos produtos": "Procedente",
  "aguardando analise da nota fiscal": "Procedente", "verificando com o fornecedor": "Em tratativa",
  "em analise": "Em tratativa", "verificando com a transportadora": "Em tratativa",
  "discordancia aceita": "Procedente", "com erros": "Procedente", "em discordancia": "Improcedente",
  "aguardando validacao do descarte": "Procedente", "aguardando descarte": "Procedente",
  "problema com o descarte": "Procedente", "aguardando recebimento no cd": "Procedente",
  "coleta de produto programada": "Procedente",
  "aguardando emissao da nfe para itens que o franqueado possui interesse": "Procedente",
  "aguardando atendimento": "Em tratativa", "aguardando chegada no cd": "Procedente",
  "aguardando lista de itens": "Em tratativa", "produtos recebidos": "Procedente",
  "verificando o interesse de outras lojas": "Em tratativa",
  "produtos enviados - aguardando recebimento no cd": "Procedente", "aguardando envio ao cd": "Procedente",
  "em tratativa com o gestor da filial": "Em tratativa", "verificando estoque": "Em tratativa",
  "recusa no sefaz realizada - validando": "Procedente",
};

/** Reproduz exatamente a funcao classificar(status) do dashboard HTML. */
function classificar(statusRaw: string): { grupo: string; subcategoria: string } {
  const key = norm(statusRaw);
  const acao = STATUS_ACAO[key] ?? "ANCORA";
  const parecer = STATUS_PARECER[key] ?? "Em tratativa";
  if (acao === "FINALIZADO") {
    if (parecer === "Procedente") return { grupo: "Fechado", subcategoria: "Procedentes" };
    if (parecer === "Improcedente") return { grupo: "Fechado", subcategoria: "Improcedentes" };
    return { grupo: "Fechado", subcategoria: "Finalizados" };
  }
  if (parecer === "Em tratativa") return { grupo: "Aberto", subcategoria: "Em Tratativa" };
  if (acao === "ANCORA") return { grupo: "Aberto", subcategoria: "Procedente Ancora" };
  if (acao === "LOJA") return { grupo: "Aberto", subcategoria: "Procedente Loja" };
  return { grupo: "Aberto", subcategoria: "Em Tratativa" };
}

const FIELD_ALIASES: Record<string, string[]> = {
  id_portal: ["id portal", "id do portal", "numero do chamado", "n chamado", "chamado"],
  data: ["data de entrada", "data entrada", "data"],
  ano: ["ano"],
  mes: ["mes"],
  dia: ["dia"],
  cliente: ["cliente", "loja"],
  cd: ["cd", "centro de distribuicao"],
  regiao: ["regiao"],
  conf_exp: ["conferente de expedicao", "conferente expedicao", "conf exp"],
  conf_check: ["conferente de checkout", "conferente checkout", "conf check", "conferente de check out"],
  tipo: ["tipo", "tipo de chamado"],
  status: ["status", "no status atual"],
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

/** Regras de exclusao da base (identicas ao dashboard HTML): Tipo "Devolucao" (exceto
 * "Devolucao para HD(Movidesk)") e Status "Cancelado por tempo" / "Em Preparacao". */
export function isExcluded(tipo: string, statusRaw: string): boolean {
  const t = norm(tipo);
  const s = norm(statusRaw);
  if (t === "devolucao") return true;
  if (s.includes("cancelado por tempo") || s.includes("em preparacao")) return true;
  return false;
}

/** Resultado da leitura/normalizacao do arquivo: linhas validas + contagem do que foi
 * descartado (sem "Id Portal" ou com tipo/status irrelevante para a base). */
export type ParsedImport = {
  rows: UpsertRow[];
  /** Total de linhas descartadas (soma dos dois motivos abaixo). */
  descartados: number;
  /** Descartadas por nao terem "Id Portal" valido. */
  descartadosSemId: number;
  /** Descartadas por tipo "Devolucao" ou status "Cancelado por tempo"/"Em Preparacao". */
  descartadosStatus: number;
};

export async function parseImportFile(file: File): Promise<ParsedImport> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });

  const out: UpsertRow[] = [];
  let descartadosSemId = 0;
  let descartadosStatus = 0;
  for (const row of raw) {
    const id = num(pick(row, FIELD_ALIASES.id_portal));
    if (!id) {
      descartadosSemId++;
      continue;
    }

    const tipo = txt(pick(row, FIELD_ALIASES.tipo));
    const statusRaw = txt(pick(row, FIELD_ALIASES.status));
    if (isExcluded(tipo, statusRaw)) {
      descartadosStatus++;
      continue;
    }

    let ano = num(pick(row, FIELD_ALIASES.ano));
    let mes = num(pick(row, FIELD_ALIASES.mes));
    let dia = num(pick(row, FIELD_ALIASES.dia));
    if (!ano || !mes || !dia) {
      const d = parseDate(pick(row, FIELD_ALIASES.data));
      ano = ano || d.ano;
      mes = mes || d.mes;
      dia = dia || d.dia;
    }

    const { grupo, subcategoria } = classificar(statusRaw);

    out.push({
      id_portal: id,
      ano,
      mes,
      dia,
      cliente: txt(pick(row, FIELD_ALIASES.cliente)),
      cd: cdShort(txt(pick(row, FIELD_ALIASES.cd))),
      regiao: txt(pick(row, FIELD_ALIASES.regiao)),
      conf_exp: txt(pick(row, FIELD_ALIASES.conf_exp)) || "-",
      conf_check: txt(pick(row, FIELD_ALIASES.conf_check)) || "-",
      tipo,
      grupo,
      subcategoria,
      causa_raiz: txt(pick(row, FIELD_ALIASES.causa_raiz)) || "-",
      valor: num(pick(row, FIELD_ALIASES.valor)) ?? 0,
      modalidade: txt(pick(row, FIELD_ALIASES.modalidade)) || "N/D",
    });
  }
  return {
    rows: out,
    descartados: descartadosSemId + descartadosStatus,
    descartadosSemId,
    descartadosStatus,
  };
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

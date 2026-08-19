import type { Chamado } from "./chamados";

const SUPABASE_URL = "https://ewyabyjuwcojehqkhqji.supabase.co";
const SUPABASE_KEY = "sb_publishable_6SM6G3aVZujBmOjygB7jgg_kLhPbydy";
const TABLE = "Chamados";
const PAGE_SIZE = 1000;

type RawChamado = {
  id_portal: number | null;
  ano: number | null;
  mes: number | null;
  dia: number | null;
  cliente: string | null;
  cd: string | null;
  regiao: string | null;
  conf_exp: string | null;
  conf_check: string | null;
  tipo: string | null;
  grupo: string | null;
  subcategoria: string | null;
  causa_raiz: string | null;
  valor: number | null;
  modalidade: string | null;
};

const txt = (v: string | null | undefined) => (v ?? "").trim();

function mapParecer(grupo: string, sub: string): string {
  const s = sub.toLowerCase();
  if (s.startsWith("procedente")) return "Procedente";
  if (s.startsWith("improcedente")) return "Improcedente";
  if (grupo.toLowerCase() === "fechado") return "Procedente";
  return sub;
}

function mapAcao(grupo: string, sub: string): string {
  if (grupo.toLowerCase() === "fechado") return "FINALIZADO";
  const s = sub.toLowerCase();
  if (s.includes("ancora") || s.includes("âncora")) return "ANCORA";
  if (s.includes("loja")) return "LOJA";
  if (s.includes("terceiro")) return "TERCEIROS";
  return "EM TRATATIVA";
}

function pickConferente(exp: string, check: string): string {
  if (exp && exp !== "-") return exp;
  if (check && check !== "-") return check;
  return exp || check;
}

function toChamado(r: RawChamado): Chamado {
  const grupo = txt(r.grupo);
  const sub = txt(r.subcategoria);
  const ano = Number(r.ano) || 0;
  const mes = Number(r.mes) || 0;
  const dia = Number(r.dia) || 0;
  const data =
    ano && mes && dia
      ? `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`
      : null;
  return {
    mes,
    ano,
    idPortal: Number(r.id_portal) || 0,
    numeroBenner: null,
    cliente: txt(r.cliente),
    regiao: txt(r.regiao),
    cd: txt(r.cd),
    modalidade: txt(r.modalidade),
    parecer: mapParecer(grupo, sub),
    tipo: txt(r.tipo),
    status: grupo,
    acao: mapAcao(grupo, sub),
    conferente: pickConferente(txt(r.conf_exp), txt(r.conf_check)),
    causaRaiz: txt(r.causa_raiz),
    dia,
    data,
    valor: Number(r.valor) || 0,
    confExp: txt(r.conf_exp),
    confCheck: txt(r.conf_check),
    sub,
  };
}

export type UpsertRow = {
  id_portal: number;
  ano: number | null;
  mes: number | null;
  dia: number | null;
  cliente: string | null;
  cd: string | null;
  regiao: string | null;
  conf_exp: string | null;
  conf_check: string | null;
  tipo: string | null;
  grupo: string | null;
  subcategoria: string | null;
  causa_raiz: string | null;
  valor: number | null;
  modalidade: string | null;
};

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export async function fetchChamadosRaw(): Promise<RawChamado[]> {
  const out: RawChamado[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=id_portal.asc`,
      {
        headers: {
          ...HEADERS,
          Range: `${from}-${from + PAGE_SIZE - 1}`,
          "Range-Unit": "items",
        },
      },
    );
    if (!res.ok) throw new Error(`Falha ao carregar chamados (${res.status})`);
    const page = (await res.json()) as RawChamado[];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

export async function upsertChamados(rows: UpsertRow[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id_portal`,
      {
        method: "POST",
        headers: {
          ...HEADERS,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(rows.slice(i, i + CHUNK)),
      },
    );
    if (!res.ok) {
      throw new Error(`Falha ao gravar chamados (${res.status}): ${await res.text()}`);
    }
  }
}

export async function fetchChamados(): Promise<Chamado[]> {
  const out: Chamado[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=id_portal.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${to}`,
          "Range-Unit": "items",
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Falha ao carregar chamados (${res.status})`);
    }
    const page = (await res.json()) as RawChamado[];
    out.push(...page.map(toChamado));
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

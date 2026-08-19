export type Chamado = {
  mes: number;
  ano: number;
  idPortal: number;
  numeroBenner: number | null;
  cliente: string;
  regiao: string;
  cd: string;
  modalidade: string;
  parecer: string;
  tipo: string;
  status: string;
  acao: string;
  conferente: string;
  causaRaiz: string;
  dia: number;
  data: string | null;
  valor: number;
  confExp: string;
  confCheck: string;
  sub: string;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

export const DEFLATORES_CHECKOUT = [
  "FALTA CHECK OUT",
  "SOBRA CHECK OUT",
  "AVARIA CHECK OUT",
  "ERRO DE ETIQUETAGEM CHECK OUT",
  "INVERSÃO CHECK OUT",
  "LIDERANÇA CHECK OUT",
] as const;

export const DEFLATORES_EXPEDICAO = [
  "FALTA CROSSDOCKING",
  "SOBRA CROSSDOCKING",
  "AVARIA CROSSDOCKING",
  "ERRO DE ETIQUETAGEM CROSSDOCKING",
  "INVERSÃO CROSSDOCKING",
  "FALTA EXPEDIÇÃO",
  "ERRO DE ETIQUETAGEM EXPEDIÇÃO",
] as const;

export type DeflatorRank = {
  nome: string;
  regiao: string;
  qtd: number;
  breakdown: Record<string, number>;
};

export function deflatoresRank(
  rows: Chamado[],
  causas: readonly string[],
  pickNome: (r: Chamado) => string,
  limit = 20,
): DeflatorRank[] {
  const allow = new Set(causas.map(norm));
  const map = new Map<string, DeflatorRank>();
  const cdCount = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const causa = norm(r.causaRaiz);
    if (!allow.has(causa)) continue;
    const nome = pickNome(r);
    if (!nome || nome === "-") continue;
    const sigla = cdSigla(r.cd);
    let e = map.get(nome);
    if (!e) {
      e = {
        nome,
        regiao: sigla,
        qtd: 0,
        breakdown: Object.fromEntries(causas.map((c) => [c, 0])),
      };
      map.set(nome, e);
      cdCount.set(nome, new Map());
    }
    e.qtd += 1;
    const key = causas.find((c) => norm(c) === causa)!;
    e.breakdown[key] += 1;
    const rc = cdCount.get(nome)!;
    rc.set(sigla, (rc.get(sigla) ?? 0) + 1);
  }
  for (const e of map.values()) {
    const rc = cdCount.get(e.nome)!;
    let bestReg = e.regiao;
    let bestCount = -1;
    for (const [reg, c] of rc) {
      if (c > bestCount) {
        bestCount = c;
        bestReg = reg;
      }
    }
    e.regiao = bestReg;
  }
  return Array.from(map.values())
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, limit);
}


export const DEFLATORES = [
  "AVARIA CHECK OUT",
  "ERRO DE ETIQUETAGEM CHECK OUT",
  "FALTA CHECK OUT",
  "INVERSÃO CHECK OUT",
  "SOBRA CHECK OUT",
] as const;

export type DeflatorNome = (typeof DEFLATORES)[number];

export type DeflatorPorColaborador = {
  nome: string;
  regiao: string;
  qtd: number;
  breakdown: Record<DeflatorNome, number>;
};

export const CD_SIGLA: Record<string, string> = {
  "REDE ANCORA - GO IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "GO",
  "REDE ANCORA - ES IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "ES",
  "REDE ANCORA - MT IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "MT",
  "REDE ANCORA - PR IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "PR",
  "REDE ANCORA - MG IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "MG",
  "REDE ANCORA - SC IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "SC",
  "REDE ANCORA - MS IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "MS",
  "FILIAL - ANANINDEUA (PA)": "PA",
  "REDE ANCORA - RJ IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "RJ",
  "REDE ANCORA - PE IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTO PEÇAS S.A": "PE",
  "REDE ANCORA - AL IMPORTADORA, EXPORTADORA E DISTRIBUIDORA DE AUTOPEÇAS S.A": "AL",
  "REDE ANCORA DISTRITO FEDERAL E GOIÁS IMPORTADORA EXP. E DIST. DE AUTO PEÇAS S.A": "DF",
};

export function cdSigla(cd: string): string {
  if (!cd) return "";
  if (CD_SIGLA[cd]) return CD_SIGLA[cd];
  const m = cd.match(/-\s*([A-Z]{2})\b/);
  return m ? m[1] : cd.slice(0, 2).toUpperCase();
}

export function deflatoresPorColaborador(
  rows: Chamado[],
  limit = 20,
): DeflatorPorColaborador[] {
  const allow = new Set<string>(DEFLATORES);
  const map = new Map<string, DeflatorPorColaborador>();
  const cdCount = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!allow.has(r.causaRaiz)) continue;
    const nome = r.conferente;
    if (!nome || nome === "-") continue;
    const sigla = cdSigla(r.cd);
    let e = map.get(nome);
    if (!e) {
      e = {
        nome,
        regiao: sigla,
        qtd: 0,
        breakdown: Object.fromEntries(DEFLATORES.map((d) => [d, 0])) as Record<
          DeflatorNome,
          number
        >,
      };
      map.set(nome, e);
      cdCount.set(nome, new Map());
    }
    e.qtd += 1;
    e.breakdown[r.causaRaiz as DeflatorNome] += 1;
    const rc = cdCount.get(nome)!;
    rc.set(sigla, (rc.get(sigla) ?? 0) + 1);
  }
  for (const e of map.values()) {
    const rc = cdCount.get(e.nome)!;
    let bestReg = e.regiao;
    let bestCount = -1;
    for (const [reg, c] of rc) {
      if (c > bestCount) {
        bestCount = c;
        bestReg = reg;
      }
    }
    e.regiao = bestReg;
  }

  return Array.from(map.values())
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, limit);
}

export type Filters = {
  ano: string;
  mes: string;
  dia: string;
  cliente: string;
  cd: string;
  regiao: string;
  conferente: string;
  tipo: string;
  status: string;
  parecer: string;
  search: string;
};

export const emptyFilters: Filters = {
  ano: "all",
  mes: "all",
  dia: "all",
  cliente: "all",
  cd: "all",
  regiao: "all",
  conferente: "all",
  tipo: "all",
  status: "all",
  parecer: "all",
  search: "",
};

export const MESES = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
];

export function applyFilters(rows: Chamado[], f: Filters): Chamado[] {
  const s = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.ano !== "all" && String(r.ano) !== f.ano) return false;
    if (f.mes !== "all" && String(r.mes) !== f.mes) return false;
    if (f.dia !== "all" && String(r.dia) !== f.dia) return false;
    if (f.cliente !== "all" && r.cliente !== f.cliente) return false;
    if (f.cd !== "all" && r.cd !== f.cd) return false;
    if (f.regiao !== "all" && r.regiao !== f.regiao) return false;

    if (f.conferente !== "all" && r.conferente !== f.conferente) return false;
    if (f.tipo !== "all" && r.tipo !== f.tipo) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.parecer !== "all" && r.parecer !== f.parecer) return false;
    if (s) {
      const hit =
        String(r.idPortal).includes(s) ||
        r.cliente.toLowerCase().includes(s);
      if (!hit) return false;
    }
    return true;
  });
}


export function uniqueSorted<T extends string | number>(arr: T[]): T[] {
  const set = new Set(arr.filter((v) => v !== null && v !== undefined && v !== "" && v !== "-"));
  return Array.from(set).sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "pt-BR");
  });
}

export type Kpis = {
  normais: number;
  crossdocking: number;
  compraJunto: number;
  crossParticipacao: number;
  acaoAncora: number;
  acaoLoja: number;
  acaoTerceiros: number;
  procedentes: number;
  improcedentes: number;
  emTratativa: number;
  finalizados: number;
  total: number;
};

export function computeKpis(rows: Chamado[]): Kpis {
  let normais = 0, crossdocking = 0, compraJunto = 0, acaoAncora = 0, acaoLoja = 0, acaoTerceiros = 0;
  let procedentes = 0, improcedentes = 0, emTratativa = 0, finalizados = 0;
  for (const r of rows) {
    if (r.modalidade === "Crossdocking") crossdocking++;
    else if (r.modalidade === "Compra Junto") compraJunto++;
    else if (r.modalidade === "Normal") normais++;
    if (r.acao === "ANCORA") acaoAncora++;
    else if (r.acao === "LOJA") acaoLoja++;
    else if (r.acao === "TERCEIROS") acaoTerceiros++;
    else if (r.acao === "FINALIZADO") finalizados++;
    // Em tratativa = chamado ainda não finalizado (ação diferente de FINALIZADO)
    if (r.acao !== "FINALIZADO") emTratativa++;
    if (r.parecer === "Procedente") procedentes++;
    else if (r.parecer === "Improcedente") improcedentes++;
  }
  const total = rows.length;
  const crossParticipacao = normais ? ((crossdocking + compraJunto) / normais) * 100 : 0;
  return {
    normais, crossdocking, compraJunto, crossParticipacao,
    acaoAncora, acaoLoja, acaoTerceiros,
    procedentes, improcedentes, emTratativa, finalizados,
    total,
  };
}

export function groupCount<T>(rows: T[], key: (r: T) => string, limit = 15) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k || k === "-") continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, limit);
}

export const fmt = (n: number) => n.toLocaleString("pt-BR");
export const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export type Delta = { pct: number; direction: "up" | "down" | "flat" };

export function computeDelta(current: number, previous: number): Delta {
  if (!previous) {
    if (!current) return { pct: 0, direction: "flat" };
    return { pct: 100, direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  return { pct, direction };
}

export const fmtDelta = (d: Delta) => {
  const sign = d.direction === "up" ? "↑" : d.direction === "down" ? "↓" : "→";
  return `${sign} ${Math.abs(d.pct).toFixed(1).replace(".", ",")}%`;
};


// --- Decodificação da base compactada (formato colunar com dicionário) ---
type EncodedChamados = {
  dict: Record<string, string[]>;
  rows: (number | string | null)[][];
};

const DICT_KEYS = [
  "cliente","regiao","cd","modalidade","parecer","tipo","status","acao","conferente","causaRaiz",
] as const;

export function decodeChamados(data: unknown): Chamado[] {
  const enc = data as EncodedChamados;
  const d = enc.dict;
  return enc.rows.map((r) => {
    const o: Record<string, unknown> = {
      mes: r[0], ano: r[1], idPortal: r[2], numeroBenner: r[3],
    };
    DICT_KEYS.forEach((k, i) => {
      o[k] = d[k][r[4 + i] as number];
    });
    o.dia = r[14];
    o.data = r[15];
    return o as Chamado;
  });
}

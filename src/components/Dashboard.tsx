import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChamados } from "@/lib/chamados-api";

import {
  applyFilters,
  clienteRankComTipos,
  computeDelta,
  computeKpis,
  DEFLATORES_CHECKOUT,
  DEFLATORES_EXPEDICAO,
  deflatoresRank,
  emptyFilters,
  fmt,
  fmtDelta,
  fmtPct,
  MESES,
  uniqueSorted,
  type Chamado,
  type DeflatorRank,
  type Filters,
} from "@/lib/chamados";

import logoAncora from "@/assets/rede-ancora-logo.png";
import ImportDialog from "@/components/ImportDialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Filter,
  Hourglass,
  RotateCcw,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AMBER = "#E98A15";
const GREEN = "#0E8F5C";
const GRAY = "#6B7280";

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Combobox de multi-seleção — espelha exatamente o comportamento do dashboard HTML:
 * clique único seleciona apenas aquele valor; Ctrl+clique (ou Cmd+clique) adiciona/remove
 * da seleção; a lista tem busca; um botão "Aplicar" fecha o painel.
 */
function FilterMultiSelect({
  label,
  values,
  onChange,
  options,
  formatter,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: (string | number)[];
  formatter?: (v: string | number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtered = search
    ? options.filter((o) => {
        const lbl = formatter ? String(formatter(o)) : String(o);
        return lbl.toLowerCase().includes(search.toLowerCase());
      })
    : options;

  const toggle = (v: string, ctrl: boolean) => {
    if (ctrl) {
      if (values.includes(v)) onChange(values.filter((x) => x !== v));
      else onChange([...values, v]);
    } else {
      onChange([v]);
    }
  };

  const n = values.length;

  return (
    <div className="relative space-y-1.5" ref={ref}>
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-[12.5px] bg-card ${
          n ? "border-ancora-blue-light bg-[#F3F7FC]" : "border-border"
        }`}
      >
        <span className="truncate">{n ? `${n} selecionado${n > 1 ? "s" : ""}` : "Todos"}</span>
        {n ? (
          <span className="flex-shrink-0 rounded-full bg-ancora-red px-1.5 py-px text-[10px] font-semibold text-white">
            {n}
          </span>
        ) : (
          <span className="text-muted-foreground">▾</span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 flex w-[270px] max-h-[300px] flex-col rounded-[10px] border border-border bg-card p-2 shadow-card-hover">
          <div className="px-1 pb-1.5 text-[10px] text-muted-foreground">Ctrl+clique para marcar várias opções</div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Buscar..."
            className="mb-1.5 h-8 flex-shrink-0 rounded-md border border-border px-2 text-xs"
          />
          <div className="max-h-[190px] select-none overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-1.5 text-center text-[11.5px] text-muted-foreground">Nenhuma opção encontrada.</div>
            )}
            {filtered.map((o) => {
              const vs = String(o);
              const selected = values.includes(vs);
              return (
                <div
                  key={vs}
                  onClick={(e) => toggle(vs, e.ctrlKey || e.metaKey)}
                  className={`cursor-pointer truncate rounded-md px-2 py-1.5 text-xs ${
                    selected ? "bg-ancora-blue font-semibold text-white" : "hover:bg-ancora-surface"
                  }`}
                >
                  {formatter ? formatter(o) : o}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1.5 h-[30px] flex-shrink-0 rounded-[7px] bg-ancora-blue text-xs font-bold text-white hover:bg-ancora-blue-light"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valor,
  color,
  icon: Icon,
  onClick,
  active,
  compare,
}: {
  label: string;
  value: number;
  valor: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  compare?: { current: number; previous: number; currentLabel: string; previousLabel: string };
}) {
  const delta = compare ? computeDelta(compare.current, compare.previous) : null;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`rounded-xl border bg-card shadow-card transition hover:shadow-card-hover ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{
        borderColor: active ? color : "var(--border)",
        borderTop: `4px solid ${color}`,
        boxShadow: active ? `0 0 0 2px ${color}33` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-foreground">{fmt(value)}</p>
          {compare && (
            <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
              {compare.currentLabel}: <span className="font-semibold">{fmt(compare.current)}</span> ·{" "}
              {compare.previousLabel}: <span className="font-semibold">{fmt(compare.previous)}</span>
              {delta && <span className="ml-1 font-bold" style={{ color }}>{fmtDelta(delta)}</span>}
            </p>
          )}
        </div>
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}1F`, color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="border-t border-border px-4 py-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">
          Valor: <span className="font-semibold text-foreground">{fmtMoney(valor)}</span>
        </p>
      </div>
    </div>
  );
}

function StatusPanel({
  title,
  icon: Icon,
  color,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: { label: string; value: number }[];
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ backgroundColor: `${color}14`, borderBottom: `3px solid ${color}`, color }}
      >
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid divide-x divide-border" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const pct = total ? (it.value / total) * 100 : 0;
          return (
            <div key={it.label} className="p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color }}>
                {fmt(it.value)}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{fmtPct(pct)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge && (
          <Badge variant="secondary" className="font-medium">
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

/** Ranking por Cliente — agora com tooltip mostrando o detalhamento por Tipo de
 * Chamado ao passar o mouse, igual ao showTip(nome, tipoRows) do dashboard HTML. */
function RankRows({
  rows,
  total,
}: {
  rows: { nome: string; qtd: number; tipos: Record<string, number> }[];
  total: number;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.qtd), 0);
  return (
    <ScrollArea className="h-[380px]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nome</TableHead>
            <TableHead className="w-24 text-right text-xs uppercase tracking-wider text-muted-foreground">
              Qtd.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const tipoRows = Object.entries(r.tipos).sort((a, b) => b[1] - a[1]);
            const maxTipo = tipoRows.length ? tipoRows[0][1] : 1;
            return (
              <HoverCard key={r.nome} openDelay={80} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <TableRow className="cursor-default border-border/60 hover:bg-accent/40">
                    <TableCell className="max-w-0 truncate text-sm font-medium text-foreground">
                      <div className="truncate" title={r.nome}>
                        {r.nome}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-ancora-blue"
                          style={{ width: `${max ? Math.min(100, (r.qtd / max) * 100) : 0}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {fmt(r.qtd)}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {total ? fmtPct((r.qtd / total) * 100) : ""}
                      </span>
                    </TableCell>
                  </TableRow>
                </HoverCardTrigger>
                <HoverCardContent side="left" align="start" className="w-72 border border-border p-0 shadow-card-hover">
                  <div className="rounded-t-md bg-ancora-blue px-3 py-2 text-white">
                    <p className="truncate text-sm font-semibold" title={r.nome}>
                      {r.nome}
                    </p>
                    <p className="text-[11px] text-white/80">{fmt(r.qtd)} chamados</p>
                  </div>
                  <ul className="divide-y divide-border p-2">
                    {tipoRows.map(([tipo, q]) => {
                      const p = maxTipo ? (q / maxTipo) * 100 : 0;
                      return (
                        <li key={tipo} className="flex items-center justify-between gap-3 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-foreground">{tipo}</p>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-neutral-dark"
                                style={{ width: `${Math.min(100, p)}%` }}
                              />
                            </div>
                          </div>
                          <span className="tabular-nums text-[12px] font-semibold text-foreground">{fmt(q)}</span>
                        </li>
                      );
                    })}
                    {tipoRows.length === 0 && (
                      <li className="py-3 text-center text-[11.5px] text-muted-foreground">Sem tipos registrados.</li>
                    )}
                  </ul>
                </HoverCardContent>
              </HoverCard>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                Nenhum registro para os filtros atuais
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function DeflatoresPanel({
  title,
  rows,
  causas,
}: {
  title: string;
  rows: DeflatorRank[];
  causas: readonly string[];
}) {
  const total = rows.reduce((s, r) => s + r.qtd, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.qtd), 0);
  return (
    <PanelCard title={title} badge={`${fmt(total)} ocorrências`}>
      <ScrollArea className="h-[380px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Colaborador</TableHead>
              <TableHead className="w-12 text-center text-xs uppercase tracking-wider text-muted-foreground">
                CD
              </TableHead>
              <TableHead className="w-16 text-right text-xs uppercase tracking-wider text-muted-foreground">
                Qtd.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <HoverCard key={r.nome} openDelay={80} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <TableRow className="cursor-default border-border/60 hover:bg-accent/40">
                    <TableCell className="max-w-0 truncate text-sm font-medium text-foreground">
                      <div className="truncate" title={r.nome}>
                        {r.nome}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-ancora-red"
                          style={{ width: `${max ? Math.min(100, (r.qtd / max) * 100) : 0}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums text-foreground">
                      {r.regiao}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {fmt(r.qtd)}
                    </TableCell>
                  </TableRow>
                </HoverCardTrigger>
                <HoverCardContent side="left" align="start" className="w-72 border border-border p-0 shadow-card-hover">
                  <div className="rounded-t-md bg-ancora-blue px-3 py-2 text-white">
                    <p className="truncate text-sm font-semibold" title={r.nome}>
                      {r.nome}
                    </p>
                    <p className="text-[11px] text-white/80">
                      {fmt(r.qtd)} deflatores · {total ? fmtPct((r.qtd / total) * 100) : "0%"} do total
                    </p>
                  </div>
                  <ul className="divide-y divide-border p-2">
                    {causas.map((d) => {
                      const q = r.breakdown[d] ?? 0;
                      const p = r.qtd ? (q / r.qtd) * 100 : 0;
                      return (
                        <li key={d} className="flex items-center justify-between gap-3 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-foreground">{d}</p>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-ancora-red" style={{ width: `${Math.min(100, p)}%` }} />
                            </div>
                          </div>
                          <span className="tabular-nums text-[12px] font-semibold text-foreground">{fmt(q)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </HoverCardContent>
              </HoverCard>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador com deflatores para os filtros atuais
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </PanelCard>
  );
}

type QuickKey = "abertos" | "finalizados";
const QUICK_MATCH: Record<QuickKey, (r: Chamado) => boolean> = {
  abertos: (r) => r.acao !== "FINALIZADO",
  finalizados: (r) => r.acao === "FINALIZADO",
};

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["chamados"],
    queryFn: fetchChamados,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Carregando chamados…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-ancora-red" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Não foi possível carregar os dados dos chamados
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error)?.message ?? "Verifique sua conexão e tente novamente em alguns instantes."}
          </p>
          <Button className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  return <DashboardView rows={data} atualizadoEm={dataUpdatedAt} onReload={() => refetch()} />;
}

function DashboardView({
  rows: ROWS,
  atualizadoEm,
  onReload,
}: {
  rows: Chamado[];
  atualizadoEm: number;
  onReload: () => void;
}) {
  const ANOS = useMemo(() => uniqueSorted(ROWS.map((r) => r.ano)), [ROWS]);
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [compareMode, setCompareMode] = useState(false);
  const [semestre, setSemestre] = useState<"all" | "1" | "2">("all");
  const [quick, setQuick] = useState<QuickKey[]>([]);

  const setArr = (k: keyof Omit<Filters, "search">) => (v: string[]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const toggleQuick = (k: QuickKey) => () =>
    setQuick((q) => (q.includes(k) ? q.filter((x) => x !== k) : [...q, k]));

  const refine = (rows: Chamado[], keys: QuickKey[]) => {
    let out = rows;
    if (semestre !== "all") out = out.filter((r) => (semestre === "1" ? r.mes <= 6 : r.mes >= 7));
    if (keys.length) out = out.filter((r) => keys.some((k) => QUICK_MATCH[k](r)));
    return out;
  };

  const opts = useMemo(
    () => ({
      anos: ANOS,
      meses: uniqueSorted(ROWS.map((r) => r.mes)),
      dias: uniqueSorted(ROWS.map((r) => r.dia).filter((d) => d > 0)),
      clientes: uniqueSorted(ROWS.map((r) => r.cliente)),
      cds: uniqueSorted(ROWS.map((r) => r.cd)),
      regioes: uniqueSorted(ROWS.map((r) => r.regiao)),
      conferentes: uniqueSorted(ROWS.map((r) => r.conferente)),
      tipos: uniqueSorted(ROWS.map((r) => r.tipo)),
      statuses: uniqueSorted(ROWS.map((r) => r.status)),
      pareceres: uniqueSorted(ROWS.map((r) => r.parecer)),
    }),
    [ROWS, ANOS],
  );

  const filtered = useMemo(
    () => refine(applyFilters(ROWS, filters), quick),
    [ROWS, filters, quick, semestre],
  );
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);

  const { currentKpis, prevKpis, currentLabel, previousLabel } = useMemo(() => {
    const latest = ANOS[ANOS.length - 1];
    const currentYear = filters.ano.length === 1 ? filters.ano[0] : String(latest);
    const idx = ANOS.indexOf(Number(currentYear));
    const prev = idx > 0 ? ANOS[idx - 1] : (ANOS[idx + 1] ?? ANOS[idx]);
    const pick = (ano: string) => refine(applyFilters(ROWS, { ...filters, ano: [ano] }), quick);
    return {
      currentKpis: computeKpis(pick(currentYear)),
      prevKpis: computeKpis(pick(String(prev))),
      currentLabel: currentYear,
      previousLabel: String(prev),
    };
  }, [ROWS, ANOS, filters, quick, semestre]);

  const totals = useMemo(() => {
    let abertos = 0,
      finalizados = 0,
      valorTotal = 0,
      valorAbertos = 0,
      valorFinalizados = 0;
    let procAncora = 0,
      procLoja = 0,
      emTratativa = 0,
      procedentes = 0,
      improcedentes = 0;
    for (const r of filtered) {
      valorTotal += r.valor;
      const aberto = r.acao !== "FINALIZADO";
      if (aberto) {
        abertos++;
        valorAbertos += r.valor;
        const s = r.sub.toLowerCase();
        if (s.includes("ancora") || s.includes("âncora")) procAncora++;
        else if (s.includes("loja")) procLoja++;
        else emTratativa++;
      } else {
        finalizados++;
        valorFinalizados += r.valor;
        if (r.parecer === "Improcedente") improcedentes++;
        else procedentes++;
      }
    }
    return {
      abertos,
      finalizados,
      valorTotal,
      valorAbertos,
      valorFinalizados,
      procAncora,
      procLoja,
      emTratativa,
      procedentes,
      improcedentes,
    };
  }, [filtered]);

  const clientesRank = useMemo(() => clienteRankComTipos(filtered, 20), [filtered]);
  const defExp = useMemo(
    () => deflatoresRank(filtered, DEFLATORES_EXPEDICAO, (r) => r.confExp, 20),
    [filtered],
  );
  const defCheck = useMemo(
    () => deflatoresRank(filtered, DEFLATORES_CHECKOUT, (r) => r.confCheck, 20),
    [filtered],
  );

  const exportXlsx = () => {
    const data = filtered.map((r) => ({
      "Nº Chamado (Portal)": r.idPortal,
      Data: r.data ?? "",
      Ano: r.ano,
      Mês: r.mes,
      Dia: r.dia,
      Cliente: r.cliente,
      Região: r.regiao,
      CD: r.cd,
      Modalidade: r.modalidade,
      Tipo: r.tipo,
      Status: r.status,
      Procedência: r.sub,
      "Causa Raiz": r.causaRaiz,
      Valor: r.valor,
      "Conferente de Expedição": r.confExp,
      "Conferente de Checkout": r.confCheck,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chamados");
    XLSX.writeFile(wb, "chamados-helpdesk-ancora.xlsx");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFillColor(0, 43, 92);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, "F");
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.text("Análise Comparativa dos Chamados de Help Desk — ANCORA", 30, 28);
    doc.setFontSize(10);
    doc.text(`Total filtrado: ${fmt(kpis.total)} chamados`, 30, 46);

    autoTable(doc, {
      startY: 80,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Chamados", fmt(kpis.total)],
        ["Abertos", fmt(totals.abertos)],
        ["Finalizados", fmt(totals.finalizados)],
        ["Procedente Ancora", fmt(totals.procAncora)],
        ["Procedente Loja", fmt(totals.procLoja)],
        ["Em Tratativa", fmt(totals.emTratativa)],
        ["Procedentes", fmt(totals.procedentes)],
        ["Improcedentes", fmt(totals.improcedentes)],
        ["Valor total", fmtMoney(totals.valorTotal)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 43, 92] },
      styles: { fontSize: 9 },
      margin: { left: 30, right: 30 },
      tableWidth: 300,
    });
    autoTable(doc, {
      startY: 80,
      head: [["Cliente", "Qtd."]],
      body: clientesRank.slice(0, 15).map((r) => [r.nome, fmt(r.qtd)]),
      theme: "grid",
      headStyles: { fillColor: [0, 43, 92] },
      styles: { fontSize: 8 },
      margin: { left: 350, right: 30 },
      tableWidth: 460,
    });
    doc.save("chamados-helpdesk-ancora.pdf");
  };

  const semBtn = (v: "1" | "2", label: string) => (
    <button
      onClick={() => setSemestre((s) => (s === v ? "all" : v))}
      className={`h-9 px-3 text-xs font-semibold transition ${
        semestre === v ? "bg-white text-ancora-blue" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-ancora-surface">
      <header className="sticky top-0 z-30 bg-ancora-blue text-white shadow-md print:static">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 items-center justify-center rounded-lg bg-white px-3 shadow-sm">
              <img src={logoAncora} alt="Rede Ancora" width={1536} height={512} className="h-7 w-auto" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight sm:text-lg">
                Análise Comparativa dos Chamados de Help Desk
              </h1>
              <p className="text-[11px] text-white/60">
                Última atualização: {new Date(atualizadoEm).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Buscar por Nº chamado ou cliente…"
                className="h-9 w-64 border-white/20 bg-white/10 pl-9 text-sm text-white placeholder:text-white/60 focus-visible:ring-white/40"
              />
            </div>
            <div className="flex overflow-hidden rounded-md border border-white/20">
              {semBtn("1", "1º Semestre")}
              <span className="w-px bg-white/20" />
              {semBtn("2", "2º Semestre")}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className={`h-9 gap-1.5 ${compareMode ? "bg-white text-ancora-blue hover:bg-white/90" : "bg-white/15 text-white hover:bg-white/25"}`}
              onClick={() => setCompareMode((v) => !v)}
            >
              <Activity className="h-4 w-4" /> {compareMode ? "Comparando" : "Comparar"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 gap-1.5 bg-white/15 text-white hover:bg-white/25"
              onClick={exportXlsx}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <ImportDialog onDone={onReload} />
            <Button
              size="sm"
              variant="secondary"
              className="h-9 gap-1.5 bg-ancora-red text-white hover:bg-ancora-red-dark"
              onClick={exportPdf}
            >
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row">
        <aside className="lg:w-[260px] lg:shrink-0 print:hidden">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card lg:sticky lg:top-[76px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-ancora-blue" />
                <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setFilters(emptyFilters);
                  setQuick([]);
                  setSemestre("all");
                }}
              >
                <RotateCcw className="h-3 w-3" /> Limpar
              </Button>
            </div>
            <div className="space-y-3">
              <FilterMultiSelect label="Ano" values={filters.ano} onChange={setArr("ano")} options={opts.anos} />
              <FilterMultiSelect
                label="Mês"
                values={filters.mes}
                onChange={setArr("mes")}
                options={opts.meses}
                formatter={(v) => `${String(v).padStart(2, "0")} · ${MESES[Number(v) - 1] ?? ""}`}
              />
              <FilterMultiSelect label="Dia" values={filters.dia} onChange={setArr("dia")} options={opts.dias} />
              <FilterMultiSelect label="Cliente" values={filters.cliente} onChange={setArr("cliente")} options={opts.clientes} />
              <FilterMultiSelect label="CD" values={filters.cd} onChange={setArr("cd")} options={opts.cds} />
              <FilterMultiSelect label="Região" values={filters.regiao} onChange={setArr("regiao")} options={opts.regioes} />
              <FilterMultiSelect
                label="Conferente da Expedição"
                values={filters.conferente}
                onChange={setArr("conferente")}
                options={opts.conferentes}
              />
              <FilterMultiSelect label="Tipo de Chamado" values={filters.tipo} onChange={setArr("tipo")} options={opts.tipos} />
              <FilterMultiSelect label="Status" values={filters.status} onChange={setArr("status")} options={opts.statuses} />
              <FilterMultiSelect
                label="Procedência"
                values={filters.parecer}
                onChange={setArr("parecer")}
                options={opts.pareceres}
              />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Total de Chamados"
              value={kpis.total}
              valor={totals.valorTotal}
              color={GRAY}
              icon={Activity}
              onClick={() => setQuick([])}
              compare={
                compareMode
                  ? { current: currentKpis.total, previous: prevKpis.total, currentLabel, previousLabel }
                  : undefined
              }
            />
            <KpiCard
              label="Abertos"
              value={totals.abertos}
              valor={totals.valorAbertos}
              color={AMBER}
              icon={Hourglass}
              onClick={toggleQuick("abertos")}
              active={quick.includes("abertos")}
              compare={
                compareMode
                  ? {
                      current: currentKpis.emTratativa,
                      previous: prevKpis.emTratativa,
                      currentLabel,
                      previousLabel,
                    }
                  : undefined
              }
            />
            <KpiCard
              label="Finalizados"
              value={totals.finalizados}
              valor={totals.valorFinalizados}
              color={GREEN}
              icon={CheckCircle2}
              onClick={toggleQuick("finalizados")}
              active={quick.includes("finalizados")}
              compare={
                compareMode
                  ? {
                      current: currentKpis.finalizados,
                      previous: prevKpis.finalizados,
                      currentLabel,
                      previousLabel,
                    }
                  : undefined
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusPanel
              title="Chamados em Aberto"
              icon={Hourglass}
              color={AMBER}
              items={[
                { label: "Procedente Ancora", value: totals.procAncora },
                { label: "Procedente Loja", value: totals.procLoja },
                { label: "Em Tratativa", value: totals.emTratativa },
              ]}
            />
            <StatusPanel
              title="Chamados Fechados"
              icon={CheckCircle2}
              color={GREEN}
              items={[
                { label: "Procedentes", value: totals.procedentes },
                { label: "Improcedentes", value: totals.improcedentes },
              ]}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
            <PanelCard title="🏢 Ranking por Cliente" badge="Top 20">
              <RankRows rows={clientesRank} total={kpis.total} />
            </PanelCard>
            <DeflatoresPanel title="Deflatores · Expedição" rows={defExp} causas={DEFLATORES_EXPEDICAO} />
            <DeflatoresPanel title="Deflatores · Checkout" rows={defCheck} causas={DEFLATORES_CHECKOUT} />
          </section>

          <div className="flex flex-col items-center gap-1 pb-6 pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Fonte: base &quot;BI Help Desk - Claud&quot; · {fmt(filtered.length)} chamados na base filtrada
              {semestre === "1" ? " · 1º Semestre" : semestre === "2" ? " · 2º Semestre" : ""} (tipo
              &quot;Devolução&quot; e status &quot;Cancelado por tempo&quot;/&quot;Em Preparação&quot; desconsiderados)
            </p>
            <p className="text-[11px] text-muted-foreground/85">
              As informações são extraídas do B2B — podem existir pequenas diferenças nos valores em função de
              tributações.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

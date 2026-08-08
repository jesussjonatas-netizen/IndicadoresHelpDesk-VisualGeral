import { useMemo, useState } from "react";
import chamadosData from "@/data/chamados.json";
import {
  applyFilters,
  computeDelta,
  computeKpis,
  decodeChamados,

  DEFLATORES,
  fmtDelta,
  deflatoresPorColaborador,
  emptyFilters,
  fmt,
  fmtPct,
  groupCount,
  MESES,
  uniqueSorted,
  type Chamado,
  type Delta,
  type Filters,
} from "@/lib/chamados";

import logoAncora from "@/assets/rede-ancora-logo.png";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Activity,
  ArrowDownToLine,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Filter,
  Hourglass,
  AlertTriangle,
  PieChart,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ULTIMA_ATUALIZACAO = "08/08/2026 12:15";

const ROWS: Chamado[] = decodeChamados(chamadosData);


function FilterSelect({
  label,
  value,
  onChange,
  options,
  formatter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | number)[];
  formatter?: (v: string | number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 bg-card text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={String(o)} value={String(o)}>
              {formatter ? formatter(o) : String(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type KpiTone = "blue" | "red" | "neutral" | "success" | "warn";
const toneClasses: Record<KpiTone, string> = {
  blue: "from-ancora-blue to-ancora-blue-dark text-white",
  red: "from-ancora-red to-ancora-red-dark text-white",
  neutral: "bg-card text-foreground",
  success: "from-emerald-600 to-emerald-700 text-white",
  warn: "from-amber-500 to-amber-600 text-white",
};

function DeltaChip({ delta, isGradient }: { delta: Delta; isGradient: boolean }) {
  const base = "ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums";
  let cls: string;
  if (isGradient) {
    cls =
      delta.direction === "up"
        ? "bg-white/20 text-white"
        : delta.direction === "down"
          ? "bg-white/20 text-white"
          : "bg-white/15 text-white/80";
  } else {
    cls =
      delta.direction === "up"
        ? "bg-emerald-100 text-emerald-700"
        : delta.direction === "down"
          ? "bg-red-100 text-red-700"
          : "bg-muted text-muted-foreground";
  }
  return <span className={`${base} ${cls}`}>{fmtDelta(delta)}</span>;
}

function KpiCard({
  label,
  value2026,
  value2025,
  delta,
  icon: Icon,
  tone = "neutral",
  sublabel,
  single = false,
  singleValue,
  currentLabel = "2026",
  previousLabel = "2025",
  onClick,
  active = false,
}: {
  label: string;
  value2026?: string | number;
  value2025?: string | number;
  delta?: Delta;
  icon: React.ComponentType<{ className?: string }>;
  tone?: KpiTone;
  sublabel?: string;
  single?: boolean;
  singleValue?: string | number;
  currentLabel?: string;
  previousLabel?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const isGradient = tone !== "neutral";
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative overflow-hidden border-0 shadow-card transition hover:shadow-card-hover ${
        isGradient ? `bg-gradient-to-br ${toneClasses[tone]}` : "bg-card"
      } ${onClick ? "cursor-pointer" : ""} ${
        active ? "ring-2 ring-offset-2 ring-ancora-blue ring-offset-background" : ""
      }`}

    >
      <div className="flex items-start justify-between p-4">
        <div className="min-w-0">
          <p
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              isGradient ? "text-white/80" : "text-muted-foreground"
            }`}
          >
            {label}
          </p>
          {single ? (
            <p
              className={`mt-2 text-3xl font-bold leading-none tabular-nums ${
                isGradient ? "text-white" : "text-foreground"
              }`}
            >
              {singleValue}
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-1">
                <p
                  className={`text-2xl font-bold leading-none tabular-nums ${
                    isGradient ? "text-white" : "text-foreground"
                  }`}
                >
                  {value2026}
                </p>
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    isGradient ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  {currentLabel}
                </span>
                {delta && <DeltaChip delta={delta} isGradient={isGradient} />}
              </div>
              <p
                className={`mt-1.5 text-[11px] tabular-nums ${isGradient ? "text-white/75" : "text-muted-foreground"}`}
              >
                {previousLabel}: <span className="font-semibold">{value2025}</span>
              </p>
            </>
          )}
          {sublabel && (
            <p className={`mt-1 text-[10px] ${isGradient ? "text-white/60" : "text-muted-foreground"}`}>{sublabel}</p>
          )}
        </div>
        <div className={`rounded-lg p-2 ${isGradient ? "bg-white/15" : "bg-accent text-accent-foreground"}`}>
          <Icon className={`h-5 w-5 ${isGradient ? "text-white" : ""}`} />
        </div>
      </div>
      {isGradient && (
        <div className="pointer-events-none absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      )}
    </Card>
  );
}

function RankTable({
  title,
  icon: Icon,
  rows,
  header,
  total,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: { nome: string; qtd: number }[];
  header: string;
  total: number;
}) {
  return (
    <Card className="border-0 shadow-card">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-accent p-1.5 text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary" className="font-medium">
          Top {rows.length}
        </Badge>
      </div>
      <ScrollArea className="h-[380px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">{header}</TableHead>
              <TableHead className="w-32 text-right text-xs uppercase tracking-wider text-muted-foreground">
                Qtd. Chamados
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pct = total ? (r.qtd / total) * 100 : 0;
              return (
                <TableRow key={r.nome} className="border-border/50">
                  <TableCell className="max-w-0 truncate text-sm font-medium text-foreground">
                    <div className="truncate" title={r.nome}>
                      {r.nome}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ancora-blue to-ancora-blue-light"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {fmt(r.qtd)}
                  </TableCell>
                </TableRow>
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
    </Card>
  );
}

function DeflatoresRankTable({
  rows,
  total,
}: {
  rows: {
    nome: string;
    regiao: string;
    qtd: number;
    breakdown: Record<string, number>;
  }[];
  total: number;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.qtd), 0);
  return (
    <Card className="border-0 shadow-card">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-accent p-1.5 text-accent-foreground">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ranking de Deflatores</h3>
            <p className="text-[11px] text-muted-foreground">
              Por Conferente da Expedição · passe o cursor para ver detalhes
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="font-medium">
          {fmt(total)} ocorrências
        </Badge>
      </div>
      <ScrollArea className="h-[380px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Colaborador</TableHead>
              <TableHead className="w-16 text-center text-xs uppercase tracking-wider text-muted-foreground">
                CD
              </TableHead>
              <TableHead className="w-28 text-right text-xs uppercase tracking-wider text-muted-foreground">
                Qtd. Deflatores
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pct = max ? (r.qtd / max) * 100 : 0;
              const share = total ? (r.qtd / total) * 100 : 0;
              return (
                <HoverCard key={r.nome} openDelay={80} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <TableRow className="cursor-default border-border/50 hover:bg-accent/40">
                      <TableCell className="max-w-0 truncate text-sm font-medium text-foreground">
                        <div className="truncate" title={r.nome}>
                          {r.nome}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-ancora-blue to-ancora-blue-light"
                            style={{ width: `${Math.min(100, pct)}%` }}
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
                  <HoverCardContent side="left" align="start" className="w-72 border-0 p-0 shadow-card-hover">
                    <div className="rounded-t-md bg-gradient-to-r from-ancora-blue-dark to-ancora-blue px-3 py-2 text-white">
                      <p className="truncate text-sm font-semibold" title={r.nome}>
                        {r.nome}
                      </p>
                      <p className="text-[11px] text-white/80">
                        {fmt(r.qtd)} deflatores · {fmtPct(share)} do total
                      </p>
                    </div>
                    <ul className="divide-y divide-border/60 p-2">
                      {DEFLATORES.map((d) => {
                        const q = r.breakdown[d] ?? 0;
                        const p = r.qtd ? (q / r.qtd) * 100 : 0;
                        return (
                          <li key={d} className="flex items-center justify-between gap-3 py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-foreground">{d}</p>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-ancora-red"
                                  style={{ width: `${Math.min(100, p)}%` }}
                                />
                              </div>
                            </div>
                            <span className="tabular-nums text-[12px] font-semibold text-foreground">{fmt(q)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
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
    </Card>
  );
}

function StatusPanel({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warn" | "success";
  items: { label: string; value: number }[];
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const headerCls = tone === "warn" ? "from-amber-500 to-amber-600" : "from-emerald-600 to-emerald-700";
  const accentCls = tone === "warn" ? "text-amber-600" : "text-emerald-600";
  return (
    <Card className="overflow-hidden border-0 shadow-card">
      <div className={`flex items-center justify-between bg-gradient-to-r ${headerCls} px-4 py-2.5 text-white`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {items.map((it) => {
          const pct = total ? (it.value / total) * 100 : 0;
          return (
            <div key={it.label} className="p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums ${accentCls}`}>{fmt(it.value)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{fmtPct(pct)}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type QuickKey = "emTratativa" | "finalizados" | "procedentes" | "improcedentes";

const QUICK_MATCH: Record<QuickKey, (r: Chamado) => boolean> = {
  emTratativa: (r) => r.acao !== "FINALIZADO",
  finalizados: (r) => r.acao === "FINALIZADO",
  procedentes: (r) => r.parecer === "Procedente",
  improcedentes: (r) => r.parecer === "Improcedente",
};

const ANOS = uniqueSorted(ROWS.map((r) => r.ano));

export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [compareMode, setCompareMode] = useState(false);
  const [quick, setQuick] = useState<QuickKey[]>([]);

  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleQuick = (k: QuickKey) => () =>
    setQuick((q) => (q.includes(k) ? q.filter((x) => x !== k) : [...q, k]));
  const matchQuick = (rows: Chamado[], keys: QuickKey[]) =>
    keys.length ? rows.filter((r) => keys.some((k) => QUICK_MATCH[k](r))) : rows;

  // Options derived from full dataset so users can always pick.
  const opts = useMemo(() => {
    return {
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
    };
  }, []);

  const filtered = useMemo(() => {
    const base = applyFilters(ROWS, filters);
    return quick ? base.filter(QUICK_MATCH[quick]) : base;
  }, [filters, quick]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);

  const { currentKpis, prevKpis, currentLabel, previousLabel } = useMemo(() => {
    const latest = ANOS[ANOS.length - 1];
    const currentYear = filters.ano === "all" ? String(latest) : filters.ano;
    const idx = ANOS.indexOf(Number(currentYear));
    const prev = idx > 0 ? ANOS[idx - 1] : (ANOS[idx + 1] ?? ANOS[idx]);
    const previousYear = String(prev);
    const pick = (ano: string) => {
      const base = applyFilters(ROWS, { ...filters, ano });
      return quick ? base.filter(QUICK_MATCH[quick]) : base;
    };
    return {
      currentKpis: computeKpis(pick(currentYear)),
      prevKpis: computeKpis(pick(previousYear)),
      currentLabel: currentYear,
      previousLabel: previousYear,
    };
  }, [filters, quick]);


  const clientesRank = useMemo(() => groupCount(filtered, (r) => r.cliente, 20), [filtered]);
  const deflatoresList = useMemo(() => deflatoresPorColaborador(filtered, 20), [filtered]);
  const deflatoresTotal = useMemo(() => deflatoresList.reduce((s, r) => s + r.qtd, 0), [deflatoresList]);

  // Consolidated (S1/2025 + S1/2026) panels
  const consolidated = useMemo(() => {
    let procAncora = 0,
      procLoja = 0,
      emTratativa = 0,
      improcedentes = 0,
      finalizados = 0,
      procedentes = 0;
    for (const r of filtered) {
      if (r.parecer === "Procedente") procedentes++;
      if (r.parecer === "Procedente" && r.acao === "ANCORA") procAncora++;
      if (r.parecer === "Procedente" && r.acao === "LOJA") procLoja++;
      if (r.parecer === "Em tratativa") emTratativa++;
      if (r.parecer === "Improcedente") improcedentes++;
      if (r.acao === "FINALIZADO") finalizados++;
    }
    return { procAncora, procLoja, emTratativa, improcedentes, finalizados, procedentes };
  }, [filtered]);

  const exportXlsx = () => {
    const data = filtered.map((r) => ({
      "Nº Chamado (Portal)": r.idPortal,
      "Nº Benner": r.numeroBenner ?? "",
      Data: r.data ?? "",
      Ano: r.ano,
      Mês: r.mes,
      Dia: r.dia,
      Cliente: r.cliente,
      Região: r.regiao,
      Modalidade: r.modalidade,
      Tipo: r.tipo,
      Status: r.status,
      Ação: r.acao,
      Parecer: r.parecer,
      "Conferente de Expedição": r.conferente,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chamados");
    XLSX.writeFile(wb, "chamados-helpdesk-ancora.xlsx");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFillColor(30, 64, 130);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, "F");
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.text("Análise Comparativa dos Chamados de Help Desk — ANCORA", 30, 28);
    doc.setFontSize(10);
    doc.text(`Total filtrado: ${fmt(kpis.total)} chamados`, 30, 46);

    const kpiRows = [
      ["Chamados Normais", fmt(kpis.normais)],
      ["Chamados Crossdocking", fmt(kpis.crossdocking)],
      ["Participação Crossdocking", fmtPct(kpis.crossParticipacao)],
      ["Ação ANCORA (HD)", fmt(kpis.acaoAncora)],
      ["Ação Loja", fmt(kpis.acaoLoja)],
      ["Ação Terceiros", fmt(kpis.acaoTerceiros)],
      ["Procedentes", fmt(kpis.procedentes)],
      ["Improcedentes", fmt(kpis.improcedentes)],
      ["Em Tratativa", fmt(kpis.emTratativa)],
      ["Finalizados", fmt(kpis.finalizados)],
      ["Total de Chamados", fmt(kpis.total)],
    ];
    autoTable(doc, {
      startY: 80,
      head: [["Indicador", "Valor"]],
      body: kpiRows,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 130] },
      styles: { fontSize: 9 },
      margin: { left: 30, right: 30 },
      tableWidth: 300,
    });

    autoTable(doc, {
      startY: 80,
      head: [["Cliente", "Qtd."]],
      body: clientesRank.slice(0, 15).map((r) => [r.nome, fmt(r.qtd)]),
      theme: "grid",
      headStyles: { fillColor: [30, 64, 130] },
      styles: { fontSize: 8 },
      margin: { left: 350, right: 30 },
      tableWidth: 460,
    });

    doc.save("chamados-helpdesk-ancora.pdf");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-gradient-to-r from-ancora-blue-dark via-ancora-blue to-ancora-blue-dark text-white shadow-md">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 items-center justify-center rounded-lg bg-white px-3 shadow-sm">
              <img src={logoAncora} alt="Rede Ancora" width={1536} height={512} className="h-7 w-auto" />
            </div>
            <div>

              <h1 className="text-base font-semibold leading-tight sm:text-lg">
                Análise Comparativa dos Chamados de Help Desk da ANCORA
              </h1>
              <p className="text-[11px] text-white/60">Última atualização: {ULTIMA_ATUALIZACAO}</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              <Input
                value={filters.search}
                onChange={(e) => set("search")(e.target.value)}
                placeholder="Buscar por Nº chamado ou cliente…"
                className="h-9 w-64 border-white/20 bg-white/10 pl-9 text-sm text-white placeholder:text-white/60 focus-visible:ring-white/40"
              />
            </div>
            <Button
              size="sm"
              variant={compareMode ? "default" : "secondary"}
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
        {/* Sidebar filters */}
        <aside className="lg:w-64 lg:shrink-0">
          <Card className="border-0 p-4 shadow-card lg:sticky lg:top-[76px]">
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
                  setQuick(null);
                }}
              >
                <RotateCcw className="h-3 w-3" /> Limpar
              </Button>
            </div>
            <div className="space-y-3">
              <FilterSelect label="Ano" value={filters.ano} onChange={set("ano")} options={opts.anos} />
              <FilterSelect
                label="Mês"
                value={filters.mes}
                onChange={set("mes")}
                options={opts.meses}
                formatter={(v) => `${String(v).padStart(2, "0")} · ${MESES[Number(v) - 1] ?? ""}`}
              />
              <FilterSelect label="Dia" value={filters.dia} onChange={set("dia")} options={opts.dias} />
              <FilterSelect label="Cliente" value={filters.cliente} onChange={set("cliente")} options={opts.clientes} />
              <FilterSelect label="CD" value={filters.cd} onChange={set("cd")} options={opts.cds} />
              <FilterSelect label="Região" value={filters.regiao} onChange={set("regiao")} options={opts.regioes} />
              <FilterSelect
                label="Conferente da Expedição"
                value={filters.conferente}
                onChange={set("conferente")}
                options={opts.conferentes}
              />
              <FilterSelect label="Tipo de Chamado" value={filters.tipo} onChange={set("tipo")} options={opts.tipos} />
              <FilterSelect label="Status" value={filters.status} onChange={set("status")} options={opts.statuses} />
              <FilterSelect
                label="Procedência"
                value={filters.parecer}
                onChange={set("parecer")}
                options={opts.pareceres}
              />
            </div>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          {/* KPI cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Total de Chamados"
              single={!compareMode}
              singleValue={fmt(kpis.total)}
              value2026={fmt(currentKpis.total)}
              value2025={fmt(prevKpis.total)}
              delta={computeDelta(currentKpis.total, prevKpis.total)}
              icon={Activity}
              tone="blue"
              currentLabel={currentLabel}
              previousLabel={previousLabel}
              onClick={() => setQuick(null)}
              sublabel={quick ? "Clique para limpar o filtro dos cards" : undefined}
            />
            <KpiCard
              label="Em Tratativa"
              single={!compareMode}
              singleValue={fmt(kpis.emTratativa)}
              value2026={fmt(currentKpis.emTratativa)}
              value2025={fmt(prevKpis.emTratativa)}
              delta={computeDelta(currentKpis.emTratativa, prevKpis.emTratativa)}
              icon={Hourglass}
              tone="warn"
              currentLabel={currentLabel}
              previousLabel={previousLabel}
              onClick={toggleQuick("emTratativa")}
              active={quick === "emTratativa"}
            />
            <KpiCard
              label="Finalizados"
              single={!compareMode}
              singleValue={fmt(kpis.finalizados)}
              value2026={fmt(currentKpis.finalizados)}
              value2025={fmt(prevKpis.finalizados)}
              delta={computeDelta(currentKpis.finalizados, prevKpis.finalizados)}
              icon={CheckCircle2}
              tone="success"
              currentLabel={currentLabel}
              previousLabel={previousLabel}
              onClick={toggleQuick("finalizados")}
              active={quick === "finalizados"}
            />
            <KpiCard
              label="Procedentes"
              single={!compareMode}
              singleValue={fmt(kpis.procedentes)}
              value2026={fmt(currentKpis.procedentes)}
              value2025={fmt(prevKpis.procedentes)}
              delta={computeDelta(currentKpis.procedentes, prevKpis.procedentes)}
              icon={BadgeCheck}
              tone="success"
              currentLabel={currentLabel}
              previousLabel={previousLabel}
              onClick={toggleQuick("procedentes")}
              active={quick === "procedentes"}
            />
            <KpiCard
              label="Improcedentes"
              single={!compareMode}
              singleValue={fmt(kpis.improcedentes)}
              value2026={fmt(currentKpis.improcedentes)}
              value2025={fmt(prevKpis.improcedentes)}
              delta={computeDelta(currentKpis.improcedentes, prevKpis.improcedentes)}
              icon={XCircle}
              tone="red"
              currentLabel={currentLabel}
              previousLabel={previousLabel}
              onClick={toggleQuick("improcedentes")}
              active={quick === "improcedentes"}
            />

          </section>

          {/* Consolidated status panels (S1/2025 + S1/2026) */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusPanel
              title="Chamados em Aberto"
              icon={Hourglass}
              tone="warn"
              items={[
                { label: "Procedente ANCORA", value: consolidated.procAncora },
                { label: "Procedente Loja", value: consolidated.procLoja },
                { label: "Em Tratativa", value: consolidated.emTratativa },
              ]}
            />
            <StatusPanel
              title="Chamados Fechados"
              icon={CheckCircle2}
              tone="success"
              items={[
                { label: "Procedentes", value: consolidated.procedentes },
                { label: "Improcedentes", value: consolidated.improcedentes },
                { label: "Finalizados", value: consolidated.finalizados },
              ]}
            />
          </section>

          {/* Tables */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RankTable
              title="Ranking por Cliente"
              icon={Building2}
              rows={clientesRank}
              header="Cliente"
              total={kpis.total}
            />
            <DeflatoresRankTable rows={deflatoresList} total={deflatoresTotal} />
          </section>

          <p className="pb-6 pt-2 text-center text-xs text-muted-foreground">
            Fonte: aba <span className="font-medium text-foreground">"Rel. Cham. Atual 010726"</span> ·{" "}
            {fmt(ROWS.length)} chamados na base ·{" "}
            <span className="inline-flex items-center gap-1">
              <ArrowDownToLine className="h-3 w-3" /> Ban <Ban className="hidden" />
              Atualização automática ao alterar filtros
            </span>
          </p>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Combobox de multi-seleção que reproduz exatamente o comportamento do
 * dashboard HTML: clique único seleciona só aquele valor; Ctrl/Cmd+clique
 * alterna aquele valor dentro da seleção múltipla; campo de busca filtra as
 * opções; botão "Aplicar" fecha o painel (o filtro já é aplicado a cada
 * clique, então "Aplicar" é só uma conveniência para fechar).
 */
export function FilterMultiSelect<T extends string | number>({
  label,
  values,
  selected,
  onChange,
  formatter,
}: {
  label: string;
  values: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  formatter?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return values;
    const s = search.toLowerCase();
    return values.filter((v) => (formatter ? formatter(v) : String(v)).toLowerCase().includes(s));
  }, [values, search, formatter]);

  const toggle = (v: T, multi: boolean) => {
    if (multi) {
      const has = selected.some((s) => String(s) === String(v));
      onChange(has ? selected.filter((s) => String(s) !== String(v)) : [...selected, v]);
    } else {
      onChange([v]);
    }
  };

  const n = selected.length;

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-left text-sm transition ${
          n > 0 ? "border-ancora-blue-light bg-ancora-blue/5" : "border-input bg-card"
        }`}
      >
        <span className="truncate text-foreground">{n ? `${n} selecionado${n > 1 ? "s" : ""}` : "Todos"}</span>
        {n > 0 ? (
          <span className="ml-2 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-ancora-red px-1 text-[10px] font-bold text-white">
            {n}
          </span>
        ) : (
          <span className="ml-2 shrink-0 text-muted-foreground">▾</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex max-h-80 w-64 flex-col rounded-md border border-border bg-popover p-2 shadow-lg">
          <p className="mb-1.5 px-1 text-[10.5px] text-muted-foreground">Ctrl+clique para marcar várias opções</p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="mb-1.5 h-8 w-full rounded border border-input bg-background px-2 text-xs outline-none focus:border-ancora-blue-light"
          />
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</div>
            )}
            {filtered.map((v) => {
              const isSelected = selected.some((s) => String(s) === String(v));
              return (
                <div
                  key={String(v)}
                  onClick={(e) => toggle(v, e.ctrlKey || e.metaKey)}
                  className={`cursor-pointer rounded px-2 py-1.5 text-sm ${
                    isSelected ? "bg-ancora-blue text-white" : "text-foreground hover:bg-accent"
                  }`}
                >
                  {formatter ? formatter(v) : String(v)}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1.5 h-8 shrink-0 rounded bg-ancora-blue text-xs font-semibold text-white hover:bg-ancora-blue-light"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

/** Grade de botões para Ano/Mês (liga/desliga por clique, sem Ctrl), igual ao HTML. */
export function CalendarFilterGrid<T extends string | number>({
  label,
  values,
  selected,
  onToggle,
  formatter,
}: {
  label: string;
  values: T[];
  selected: T[];
  onToggle: (v: T) => void;
  formatter?: (v: T) => string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="grid grid-cols-4 gap-1.5">
        {values.map((v) => {
          const isSelected = selected.some((s) => String(s) === String(v));
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => onToggle(v)}
              className={`h-8 rounded-md border text-xs font-semibold transition ${
                isSelected
                  ? "border-ancora-blue bg-ancora-blue text-white"
                  : "border-input bg-card text-foreground hover:bg-accent"
              }`}
            >
              {formatter ? formatter(v) : String(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

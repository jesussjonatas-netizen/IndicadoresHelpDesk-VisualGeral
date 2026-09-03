import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { diffImport, parseImportFile, type ImportDiff } from "@/lib/import-chamados";
import { fetchChamadosRaw, upsertChamados } from "@/lib/chamados-api";
import { fmt } from "@/lib/chamados";

const SENHA = "chamadosbr";

type DiffState = ImportDiff & {
  descartados: number;
  descartadosSemId: number;
  descartadosStatus: number;
};

export default function ImportDialog({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffState | null>(null);
  const [senha, setSenha] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  const reset = () => {
    setDiff(null);
    setSenha("");
    setErro(null);
    setOk(null);
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    reset();
    setOpen(true);
    try {
      setBusy("Lendo e normalizando a planilha…");
      const parsed = await parseImportFile(file);
      if (!parsed.rows.length) {
        throw new Error(
          `Nenhuma linha válida encontrada na planilha (${fmt(parsed.descartados)} linha(s) descartada(s): ${fmt(
            parsed.descartadosSemId,
          )} sem Id Portal, ${fmt(parsed.descartadosStatus)} com tipo/status irrelevante).`,
        );
      }
      setBusy("Comparando com a base…");
      const existing = await fetchChamadosRaw();
      const d = diffImport(parsed.rows, existing);
      setDiff({
        ...d,
        descartados: parsed.descartados,
        descartadosSemId: parsed.descartadosSemId,
        descartadosStatus: parsed.descartadosStatus,
      });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmar = async () => {
    if (!diff) return;
    setErro(null);
    try {
      setBusy("Gravando no banco…");
      await upsertChamados([...diff.novos, ...diff.atualizados.map((a) => a.row)]);
      setOk(
        `${fmt(diff.novos.length)} novos e ${fmt(diff.atualizados.length)} atualizados gravados com sucesso.`,
      );
      setDiff(null);
      onDone();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const totalGravar = diff ? diff.novos.length + diff.atualizados.length : 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        className="h-9 gap-1.5 bg-white/15 text-white hover:bg-white/25"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" /> Importar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar planilha de chamados</DialogTitle>
            <DialogDescription>
              Nada é gravado até você confirmar com a senha de liberação.
            </DialogDescription>
          </DialogHeader>

          {busy && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {busy}
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {ok && (
            <div className="flex items-start gap-2 rounded-lg border p-3 text-sm" style={{ borderColor: "#0E8F5C40", color: "#0E8F5C" }}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ok}</span>
            </div>
          )}

          {diff && !busy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Novos", value: diff.novos.length, color: "#0E8F5C" },
                  { label: "Atualizados", value: diff.atualizados.length, color: "#E98A15" },
                  { label: "Sem alteração", value: diff.iguais, color: "#6B7280" },
                  { label: "Descartados", value: diff.descartados, color: "#B91C1C" },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color: c.color }}>
                      {fmt(c.value)}
                    </p>
                  </div>
                ))}
              </div>

              {diff.descartados > 0 && (
                <p className="text-xs text-muted-foreground">
                  Descartados: {fmt(diff.descartadosSemId)} sem Id Portal e{" "}
                  {fmt(diff.descartadosStatus)} com tipo "Devolução" ou status "Cancelado por
                  tempo"/"Em Preparação".
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Senha de liberação
                </label>
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite a senha para liberar a gravação"
                  className="h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!diff || senha !== SENHA || !!busy || totalGravar === 0}
              onClick={confirmar}
            >
              Confirmar e atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

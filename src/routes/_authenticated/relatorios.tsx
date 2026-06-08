import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { TIPOS_REUNIAO, formatDate } from "@/lib/constants";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Page });

function Page() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [congId, setCongId] = useState<string>("todas");

  const { data: congs } = useQuery({
    queryKey: ["congs-list"],
    queryFn: async () => (await supabase.from("congregacoes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: cultos } = useQuery({
    queryKey: ["rel-cultos"],
    queryFn: async () => (await supabase.from("cultos")
      .select("id, data, horario, tipo, cidade, participantes, observacoes, congregacao:congregacoes(nome)")
      .order("data", { ascending: false })).data ?? [],
  });

  const filt = useMemo(() => (cultos ?? []).filter((c: any) => {
    if (from && c.data < from) return false;
    if (to && c.data > to) return false;
    if (tipo !== "todos" && c.tipo !== tipo) return false;
    if (congId !== "todas" && c.congregacao_id !== congId) return false;
    return true;
  }), [cultos, from, to, tipo, congId]);

  const rows = filt.map((c: any) => ({
    Data: formatDate(c.data),
    Horario: c.horario?.slice(0, 5) ?? "",
    Tipo: TIPOS_REUNIAO[c.tipo] ?? c.tipo,
    Congregacao: c.congregacao?.nome ?? "",
    Cidade: c.cidade ?? "",
    Participantes: c.participantes ?? "",
    Observacoes: c.observacoes ?? "",
  }));

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text("Relatório de Cultos — CCB", 14, 14);
    doc.setFontSize(9); doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} registros`, 14, 20);
    autoTable(doc, {
      head: [Object.keys(rows[0] ?? { Data: "", Tipo: "" })],
      body: rows.map((r) => Object.values(r) as any),
      startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`cultos-${Date.now()}.pdf`);
  }
  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Cultos");
    XLSX.writeFile(wb, `cultos-${Date.now()}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
        <p className="text-sm text-muted-foreground">Filtre os cultos e exporte em PDF ou Excel.</p>
      </div>

      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-4">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(TIPOS_REUNIAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Congregação</Label>
          <Select value={congId} onValueChange={setCongId}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {(congs ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <div className="flex gap-2">
        <Button onClick={exportPDF} disabled={rows.length === 0}><FileText className="mr-2 h-4 w-4" />PDF</Button>
        <Button onClick={exportXLSX} variant="outline" disabled={rows.length === 0}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        <span className="ml-auto self-center text-sm text-muted-foreground">{rows.length} registros</span>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Prévia</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nada para mostrar.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>{Object.keys(rows[0]).map((k) => <th key={k} className="px-2 py-2">{k}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {Object.values(r).map((v, j) => <td key={j} className="px-2 py-2">{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

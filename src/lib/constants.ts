export const TIPOS_REUNIAO: Record<string, string> = {
  culto_oficial: "Culto Oficial",
  ensaio: "Ensaio",
  jovens_menores: "Jovens e Menores",
  santa_ceia: "Santa Ceia",
  ministerial: "Ministerial",
  evangelizacao: "Evangelização",
  especial: "Culto Especial",
  outro: "Outro",
};

export const MOMENTOS_HINO: Record<string, string> = {
  entrada: "Entrada",
  antes_palavra: "Antes da Palavra",
  apos_palavra: "Após a Palavra",
  encerramento: "Encerramento",
  outro: "Outro",
};

export const FUNCOES_VISITANTE: Record<string, string> = {
  irmao: "Irmão",
  cooperador: "Cooperador",
  diacono: "Diácono",
  anciao: "Ancião",
  encarregado: "Encarregado",
  cooperador_jovens: "Cooperador de Jovens",
  organista: "Organista",
  musico: "Músico",
  outro: "Outro",
};

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

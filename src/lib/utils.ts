import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Retorna os dois primeiros nomes (ex: "João Pedro Silva Souza" → "João Pedro"). */
export function primeirosDoisNomes(nome?: string | null): string {
  if (!nome) return "Irmão(ã)";
  const partes = nome.trim().split(/\s+/);
  return partes.slice(0, 2).join(" ") || "Irmão(ã)";
}

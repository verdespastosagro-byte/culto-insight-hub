import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { cn } from "@/lib/utils";

export function InstallPWA({ className }: { className?: string }) {
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm",
      className
    )}>
      <Download className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1 text-primary-foreground/90">
        Instale o app no celular para acesso rápido
      </span>
      <Button size="sm" variant="default" onClick={install}>
        Instalar
      </Button>
      <button
        onClick={dismiss}
        className="rounded p-1 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

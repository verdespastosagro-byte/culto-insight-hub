import { createFileRoute } from "@tanstack/react-router";
import CCBPerto from "@/components/CCBPerto";

export const Route = createFileRoute("/_authenticated/ccb-perto-de-mim")({
  component: CCBPertoPage,
});

function CCBPertoPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CCB perto de mim</h1>
        <p className="text-sm text-muted-foreground">
          Encontre Congregações Cristãs no Brasil próximas à sua localização.
        </p>
      </div>
      <CCBPerto />
    </div>
  );
}

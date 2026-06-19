import { useEffect, useMemo, useRef, useState } from "react";

export type EfeitoFundo = "nenhum" | "chuva" | "chuva_raio" | "neve";

interface Props {
  efeito: EfeitoFundo;
}

/** Fundo decorativo fixo, atrás do conteúdo. Sem interação. */
export function FundoAnimado({ efeito }: Props) {
  const [visivel, setVisivel] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    const onVis = () => setVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (efeito === "nenhum") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ animationPlayState: visivel ? "running" : "paused" }}
    >
      {(efeito === "chuva" || efeito === "chuva_raio") && (
        <Chuva pausado={!visivel} />
      )}
      {efeito === "chuva_raio" && visivel && <Raios />}
      {efeito === "neve" && <Neve pausado={!visivel} />}
    </div>
  );
}

function Chuva({ pausado }: { pausado: boolean }) {
  const gotas = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 0.6 + Math.random() * 0.6,
        opacity: 0.15 + Math.random() * 0.25,
        height: 14 + Math.random() * 16,
      })),
    [],
  );
  return (
    <>
      {gotas.map((g) => (
        <span
          key={g.id}
          style={{
            left: `${g.left}%`,
            top: `-${g.height}px`,
            width: 1,
            height: g.height,
            background:
              "linear-gradient(to bottom, rgba(180,200,230,0) 0%, rgba(180,200,230,1) 100%)",
            position: "absolute",
            opacity: g.opacity,
            animation: `fa-rain ${g.duration}s linear ${g.delay}s infinite`,
            animationPlayState: pausado ? "paused" : "running",
          }}
        />
      ))}
      <style>{`
        @keyframes fa-rain {
          0% { transform: translateY(0); }
          100% { transform: translateY(110vh); }
        }
      `}</style>
    </>
  );
}

function Raios() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const agendar = () => {
      const ms = 8000 + Math.random() * 12000;
      timeout = setTimeout(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 150);
        agendar();
      }, ms);
    };
    agendar();
    return () => clearTimeout(timeout);
  }, []);
  return (
    <div
      className="absolute inset-0 transition-opacity"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(220,235,255,0.55), rgba(180,210,255,0.15) 60%, transparent 80%)",
        opacity: flash ? 1 : 0,
        transitionDuration: flash ? "30ms" : "120ms",
      }}
    />
  );
}

function Neve({ pausado }: { pausado: boolean }) {
  const flocos = useMemo(
    () =>
      Array.from({ length: 45 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 10,
        size: 3 + Math.random() * 4,
        opacity: 0.25 + Math.random() * 0.35,
        sway: 10 + Math.random() * 20,
        swayDur: 3 + Math.random() * 3,
      })),
    [],
  );
  return (
    <>
      {flocos.map((f) => (
        <span
          key={f.id}
          style={{
            left: `${f.left}%`,
            top: `-10px`,
            width: f.size,
            height: f.size,
            position: "absolute",
            opacity: f.opacity,
            animation: `fa-snow ${f.duration}s linear ${f.delay}s infinite`,
            animationPlayState: pausado ? "paused" : "running",
          }}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(240,248,255,1) 0%, rgba(200,220,240,0.6) 100%)",
              animation: `fa-sway-${f.id % 4} ${f.swayDur}s ease-in-out infinite alternate`,
              animationPlayState: pausado ? "paused" : "running",
            }}
          />
        </span>
      ))}
      <style>{`
        @keyframes fa-snow {
          0% { transform: translateY(0); }
          100% { transform: translateY(110vh); }
        }
        @keyframes fa-sway-0 { from { transform: translateX(-8px); } to { transform: translateX(8px); } }
        @keyframes fa-sway-1 { from { transform: translateX(-14px); } to { transform: translateX(10px); } }
        @keyframes fa-sway-2 { from { transform: translateX(-6px); } to { transform: translateX(16px); } }
        @keyframes fa-sway-3 { from { transform: translateX(-18px); } to { transform: translateX(6px); } }
      `}</style>
    </>
  );
}

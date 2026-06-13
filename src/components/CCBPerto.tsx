/// <reference types="google.maps" />
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Loader2, Navigation, AlertTriangle, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buscarCongregacoes, type CCBChurch } from "@/lib/ccb.functions";

const RAIO_OPCOES = [1, 2, 3, 5, 10, 20, 30, 50] as const;
const DIAS = [
  { idx: -1, label: "Todos" },
  { idx: 0, label: "Dom" },
  { idx: 1, label: "Seg" },
  { idx: 2, label: "Ter" },
  { idx: 3, label: "Qua" },
  { idx: 4, label: "Qui" },
  { idx: 5, label: "Sex" },
  { idx: 6, label: "Sáb" },
] as const;

declare global {
  interface Window {
    google?: typeof google;
    __ccbInitMap?: () => void;
  }
}

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type ItemComDist = CCBChurch & { distancia: number };

export default function CCBPerto() {
  const buscar = useServerFn(buscarCongregacoes);
  const [igrejas, setIgrejas] = useState<ItemComDist[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [raio, setRaio] = useState<number>(10);
  const [diaFiltro, setDiaFiltro] = useState<number>(-1);
  const [mapsCarregado, setMapsCarregado] = useState(false);

  const hojeIdx = new Date().getDay();

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapaInstanceRef = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const marcadoresRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (window.google?.maps) {
      setMapsCarregado(true);
      return;
    }
    const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!browserKey) {
      setErro("Google Maps não está configurado.");
      return;
    }
    window.__ccbInitMap = () => setMapsCarregado(true);
    const existing = document.querySelector<HTMLScriptElement>("script[data-ccb-maps]");
    if (existing) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&loading=async&callback=__ccbInitMap${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.defer = true;
    script.dataset.ccbMaps = "1";
    script.onerror = () => setErro("Erro ao carregar Google Maps.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsCarregado || !coords || !mapRef.current || mapaInstanceRef.current) return;
    const map = new window.google!.maps.Map(mapRef.current, {
      center: coords,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    userMarkerRef.current = new window.google!.maps.Marker({
      position: coords,
      map,
      title: "Você está aqui",
      icon: {
        path: window.google!.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#3B82F6",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
    });
    mapaInstanceRef.current = map;
  }, [mapsCarregado, coords]);

  useEffect(() => {
    if (!mapaInstanceRef.current || !coords) return;
    mapaInstanceRef.current.setCenter(coords);
    if (userMarkerRef.current) userMarkerRef.current.setPosition(coords);
  }, [coords]);

  const igrejasFiltradas = useMemo(() => {
    if (diaFiltro === -1) return igrejas;
    return igrejas.filter((i) => i.horarios?.some((h) => h.diaSemana === diaFiltro));
  }, [igrejas, diaFiltro]);

  useEffect(() => {
    if (!mapaInstanceRef.current || !window.google) return;
    marcadoresRef.current.forEach((m) => m.setMap(null));
    marcadoresRef.current = [];
    if (!igrejasFiltradas.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (coords) bounds.extend(coords);
    igrejasFiltradas.forEach((ig, idx) => {
      const marker = new window.google!.maps.Marker({
        position: { lat: ig.lat, lng: ig.lng },
        map: mapaInstanceRef.current!,
        label: { text: String(idx + 1), color: "#fff", fontWeight: "600" },
        title: ig.name,
      });
      marcadoresRef.current.push(marker);
      bounds.extend({ lat: ig.lat, lng: ig.lng });
    });
    mapaInstanceRef.current.fitBounds(bounds, 60);
  }, [igrejasFiltradas, coords]);

  const buscarIgrejas = useCallback(
    async (c: { lat: number; lng: number }, r: number) => {
      setLoading(true);
      setErro(null);
      try {
        const resp = await buscar({ data: { lat: c.lat, lng: c.lng, radiusKm: r } });
        if (resp.error) {
          setErro(resp.error);
          setIgrejas([]);
          return;
        }
        const comDistancia = resp.items
          .map((i) => ({ ...i, distancia: distanciaKm(c.lat, c.lng, i.lat, i.lng) }))
          .filter((i) => i.distancia <= r)
          .sort((a, b) => a.distancia - b.distancia);
        setIgrejas(comDistancia);
        if (!comDistancia.length) setErro("Nenhuma congregação encontrada neste raio.");
      } catch (e) {
        console.error(e);
        setErro("Erro ao buscar congregações.");
        setIgrejas([]);
      } finally {
        setLoading(false);
      }
    },
    [buscar],
  );

  function usarMinhaLocalizacao() {
    setErro(null);
    if (!("geolocation" in navigator)) {
      setErro("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        buscarIgrejas(c, raio);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErro("Permissão de localização negada. Ative o GPS para o navegador.");
        } else {
          setErro("Não foi possível obter sua localização.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function trocarRaio(r: number) {
    setRaio(r);
    if (coords) buscarIgrejas(coords, r);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={usarMinhaLocalizacao} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Usar minha localização
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Raio:</span>
            {RAIO_OPCOES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => trocarRaio(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  raio === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Dia:</span>
          {DIAS.map((d) => (
            <button
              key={d.idx}
              type="button"
              onClick={() => setDiaFiltro(d.idx)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                diaFiltro === d.idx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        {erro && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div
          ref={mapRef}
          className="h-[360px] w-full bg-muted"
          aria-label="Mapa das congregações próximas"
        >
          {!coords && (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <MapPin className="mx-auto mb-2 h-6 w-6" />
                Clique em "Usar minha localização" para começar.
              </div>
            </div>
          )}
        </div>
      </Card>

      {igrejasFiltradas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {igrejasFiltradas.length}{" "}
            {igrejasFiltradas.length === 1 ? "congregação" : "congregações"} em até {raio} km
          </h2>
          <ul className="space-y-2">
            {igrejasFiltradas.map((ig, idx) => {
              const horariosHoje = ig.horarios?.filter((h) => h.diaSemana === hojeIdx) ?? [];
              const temCultoHoje = horariosHoje.length > 0;
              return (
                <li key={ig.id}>
                  <Card className="flex flex-col gap-3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{ig.name}</p>
                            {temCultoHoje && (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                Culto hoje
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{ig.address}</p>
                          {ig.bairro && (
                            <p className="text-xs text-muted-foreground">Bairro: {ig.bairro}</p>
                          )}
                          <p className="mt-0.5 text-xs font-medium text-primary">
                            {ig.distancia.toFixed(2)} km
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            Como chegar
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${ig.lat},${ig.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Google Maps
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://waze.com/ul?ll=${ig.lat},${ig.lng}&navigate=yes`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Waze
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://maps.apple.com/?daddr=${ig.lat},${ig.lng}&dirflg=d`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Apple Maps
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {ig.horarios && ig.horarios.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {Object.entries(
                          ig.horarios.reduce<Record<string, string[]>>((acc, h) => {
                            (acc[h.diaLabel] ||= []).push(h.hora);
                            return acc;
                          }, {}),
                        ).map(([dia, horas]) => (
                          <span
                            key={dia}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-xs",
                              DIAS.find((d) => d.label.startsWith(dia.slice(0, 3)))?.idx === hojeIdx
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "border-border bg-muted/40 text-foreground",
                            )}
                          >
                            <strong className="font-semibold">{dia}:</strong>{" "}
                            {[...new Set(horas)].sort().join(", ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

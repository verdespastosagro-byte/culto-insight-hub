import { StrictMode, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

type State = { error: Error | null };

class StartupBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Android] React startup failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif", background: "#f8fafc", color: "#0f172a" }}>
          <section style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>Deuteronômio 28</h1>
            <p style={{ lineHeight: 1.5 }}>Não foi possível iniciar a aplicação. Verifique a conexão e tente abrir novamente.</p>
            <button style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#0f172a", color: "white" }} onClick={() => location.reload()}>
              Tentar novamente
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Android root element #root was not found");

const router = getRouter();
createRoot(rootElement).render(
  <StrictMode>
    <StartupBoundary>
      <RouterProvider router={router} />
    </StartupBoundary>
  </StrictMode>,
);

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const err = this.state.error;
      return (
        <div
          style={{
            padding: 24,
            background: "#1e293b",
            border: "1px solid #dc2626",
            borderRadius: 12,
            color: "#f87171",
            marginTop: 16
          }}
        >
          <h3 style={{ margin: "0 0 8px 0" }}>Erro na simulação</h3>
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>{err.message}</p>
          {err.stack && (
            <pre style={{ margin: 0, fontSize: 11, overflow: "auto", maxHeight: 200, color: "#94a3b8" }}>
              {err.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('ContacNeed UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center text-white">
        <p className="text-lg font-bold">Se interrumpió la vista</p>
        <p className="max-w-sm text-sm text-purple-200/80">
          En iPhone a veces Safari recarga mal una pestaña en segundo plano. No te expulsamos de
          ContacNeed: pulsa para continuar en la pizarra.
        </p>
        <button
          type="button"
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
          onClick={() => {
            this.setState({ failed: false })
            window.location.assign('/')
          }}
        >
          Volver a la pizarra
        </button>
      </div>
    )
  }
}

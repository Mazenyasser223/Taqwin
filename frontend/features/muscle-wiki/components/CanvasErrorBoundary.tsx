import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface CanvasErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  onError?: () => void
}

interface State {
  hasError: boolean
}

/** Catches GLB / WebGL load failures so the muscle wiki page stays usable. */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError?.()
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logClientError } from '../lib/errorLog'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('House Care render error', error, info)
    logClientError(error, { area: 'React render', details: info.componentStack ?? undefined })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="center-page"><section className="card auth-card stack" role="alert"><div><div className="eyebrow">House Care</div><h1>Something went wrong</h1><p className="muted">Your stored household data was not deleted. Reload the app and try again. The local error log contains technical context.</p></div><button className="button primary" onClick={() => location.reload()}>Reload</button></section></main>
  }
}

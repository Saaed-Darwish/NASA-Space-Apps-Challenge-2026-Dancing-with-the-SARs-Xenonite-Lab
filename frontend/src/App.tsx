import { useCallback, useEffect, useState } from 'react'

type Connection = 'checking' | 'connected' | 'offline'

export default function App() {
  const [connection, setConnection] = useState<Connection>('checking')

  const checkConnection = useCallback(async (signal?: AbortSignal) => {
    setConnection('checking')
    try {
      const response = await fetch('/api/health', {
        signal: signal ?? AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Health check failed')
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
        throw new Error('Unexpected health response')
      }
      setConnection('connected')
    } catch {
      if (!signal?.aborted || signal.reason?.name === 'TimeoutError') setConnection('offline')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void checkConnection(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]))
    return () => controller.abort()
  }, [checkConnection])

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,#173252,transparent_60%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 px-6 py-6">
        <a href="/" className="text-sm font-semibold tracking-wide">◉ SAR EXPLORER</a>
        <span className="text-xs text-slate-400">SPACE APPS · 2026</span>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">A new perspective on Earth</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">Dancing with<br />the <span className="text-cyan-300">SARs.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">Your starting point for exploring synthetic aperture radar data. Build, experiment, and bring Earth's hidden stories into view.</p>
        <section aria-label="Application status" className="mt-14 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="text-lg font-medium">Ready for your next idea</h2>
              <p className="mt-2 text-sm text-slate-400">React + Vite + Tailwind CSS, powered by FastAPI.</p>
            </div>
            <button onClick={() => void checkConnection()} disabled={connection === 'checking'} className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:opacity-50">Check connection</button>
          </div>
          <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-slate-300">
            <span className={`h-2 w-2 rounded-full ${connection === 'connected' ? 'bg-emerald-400' : connection === 'offline' ? 'bg-amber-400' : 'animate-pulse bg-slate-400'}`} />
            {connection === 'checking' ? 'Connecting to backend…' : connection === 'connected' ? 'FastAPI backend is connected' : 'Backend unavailable. Start the API on port 8000, then retry.'}
          </div>
        </section>
      </main>
    </div>
  )
}

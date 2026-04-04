import { useEffect, useState } from "react"

import { AppInterface } from "../../../app/app/app-interface"
import { LocalEndpoint } from "../bindings/changeme/bridgeservice"

function App() {
  const [endpoint, setEndpoint] = useState("")
  const [error, setError] = useState("")
  const [path, setPath] = useState("/")

  useEffect(() => {
    let cancelled = false

    LocalEndpoint()
      .then((nextEndpoint) => {
        if (!cancelled) {
          setEndpoint(nextEndpoint)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(String(cause))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Desktop Runtime Error</p>
          <h1 className="mt-2 font-heading text-2xl">Failed to start app shell</h1>
          <p className="mt-3 break-words text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      </main>
    )
  }

  if (!endpoint) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Connecting to local runtime</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Preparing the embedded app interface.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-[color:color-mix(in_oklab,var(--background)_92%,white)] text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
              Desktop
            </p>
            <p className="font-heading text-lg leading-none">Otter Prompt</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-right">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Route
              </p>
              <p className="font-mono text-xs text-foreground">{path}</p>
            </div>
            <div className="hidden max-w-64 md:block">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Local API
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {endpoint}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <AppInterface
          serviceBaseUrl={endpoint}
          onNavigate={(nextPath) => setPath(nextPath)}
        />
      </div>
    </div>
  )
}

export default App

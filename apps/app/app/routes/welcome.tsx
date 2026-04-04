export default function WelcomePage() {
  return (
    <main className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="app-page-subtitle">Welcome</p>
          <h1 className="app-page-title">Otter Prompt Workspace</h1>
        </div>
      </div>

      <section className="settings-item">
        <h2 className="settings-item-title">Start Here</h2>
        <p className="settings-item-description">
          Select a project from the left sidebar, or add a new directory to
          create/import a project workspace.
        </p>
        <p className="text-sm text-muted-foreground">
          Project pages now use URL parameters. Each project opens at{" "}
          <code>/projects/:projectId</code>.
        </p>
      </section>
    </main>
  )
}

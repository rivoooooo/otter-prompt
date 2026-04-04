export default function WelcomePage() {
  return (
    <main className="min-h-svh p-4 md:p-6">
      <div className="mb-3 flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-[0.9375rem] text-muted-foreground">Welcome</p>
          <h1 className="font-heading text-[1.6rem] leading-[1.2] md:text-[2rem]">
            Otter Prompt Workspace
          </h1>
        </div>
      </div>

      <section className="flex flex-col gap-[14px] py-4">
        <h2 className="font-heading text-[1.5rem] leading-[1.2]">Start Here</h2>
        <p className="mt-1 mb-[14px] text-[0.9375rem] text-muted-foreground">
          Select a project from the left sidebar, or add a new directory to
          create/import a project workspace.
        </p>
        <p className="text-sm text-muted-foreground">
          Manage imported workspaces at <code>/projects</code>. Each project now
          opens at <code>/project/:projectId</code>.
        </p>
      </section>
    </main>
  )
}

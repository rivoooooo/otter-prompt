import { Link, useNavigate } from "react-router"
import { useEffect, useState } from "react"
import {
  ArrowRightIcon,
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { DirectoryBrowser } from "../components/directory-browser"
import { apiRequest } from "../lib/api-client"
import { createProject, listProjects, type Project } from "../lib/projects"

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newProjectPath, setNewProjectPath] = useState("")
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)

  useEffect(() => {
    setLoading(true)

    listProjects()
      .then((body) => setProjects(body.projects))
      .catch((cause) => setError(String(cause)))
      .finally(() => setLoading(false))
  }, [])

  async function addProject() {
    if (!newProjectPath.trim()) {
      return
    }

    const body = await createProject(newProjectPath)

    setProjects((current) => {
      if (current.some((project) => project.id === body.project.id)) {
        return current
      }

      return [body.project, ...current]
    })

    setNewProjectPath("")
    setAddProjectDialogOpen(false)
    navigate(`/project/${body.project.id}`)
  }

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-[18px] p-4 md:p-6">
      <section className="flex flex-wrap items-start justify-between gap-[18px] rounded-2xl border border-border bg-[radial-gradient(circle_at_top_left,rgb(201_100_66_/_12%),transparent_38%),linear-gradient(135deg,#faf9f5_0%,#f3efe5_100%)] p-5 shadow-[0_0_0_1px_#f0eee6,0_4px_24px_rgb(0_0_0_/_5%)] sm:p-6">
        <div className="flex max-w-[42rem] min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-[0.9375rem] text-muted-foreground">Projects</p>
            <Badge variant="outline">
              {loading ? "Loading..." : `${projects.length} tracked`}
            </Badge>
          </div>
          <h1 className="font-heading text-[clamp(2.4rem,4vw,3.4rem)] leading-[1.06]">
            Project Library
          </h1>
          <p className="max-w-[38rem] text-base leading-[1.65] text-muted-foreground">
            Keep every imported workspace in one place, then jump into the
            editor through the new <code>/project/:id</code> route.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-sm:w-full max-sm:justify-stretch max-sm:[&>*]:flex-1 max-sm:[&>*]:basis-full">
          <Button
            variant="outline"
            onClick={() =>
              navigate(projects[0] ? `/project/${projects[0].id}` : "/")
            }
            disabled={projects.length === 0}
          >
            Open Latest
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Dialog
            open={addProjectDialogOpen}
            onOpenChange={setAddProjectDialogOpen}
          >
            <DialogTrigger render={<Button />}>
              <PlusIcon data-icon="inline-start" />
              Add Project
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Project</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Default roots include <code>~</code> and your used project
                  directories.
                </p>
                <DirectoryBrowser
                  selectedPath={newProjectPath}
                  onSelect={setNewProjectPath}
                  onError={setError}
                />
                <Input
                  placeholder="/absolute/path/to/project"
                  value={newProjectPath}
                  onChange={(event) => setNewProjectPath(event.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() =>
                      apiRequest<{ path: string }>("/dialog/directory", {
                        method: "POST",
                      })
                        .then((body) => setNewProjectPath(body.path))
                        .catch((cause) => setError(String(cause)))
                    }
                  >
                    <FolderOpenIcon data-icon="inline-start" />
                    Use System Picker
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      addProject().catch((cause) => setError(String(cause)))
                    }
                    disabled={!newProjectPath.trim()}
                  >
                    Save Project
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[rgb(181_51_51_/_14%)] bg-[rgb(181_51_51_/_8%)] px-[14px] py-3 text-[0.92rem] text-[#8d2f2f]">
          {error}
        </div>
      ) : null}

      <section className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Card
          className="sticky top-6 bg-[linear-gradient(180deg,#f7f4ed_0%,#efe9df_100%)] max-lg:static"
          size="sm"
        >
          <CardHeader>
            <CardTitle className="text-[1.2rem]">Workspace Index</CardTitle>
            <CardDescription>
              Use this page as the stable entry for browsing projects and
              importing new directories.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-[14px]">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[2.35rem] leading-none text-foreground">
                {loading ? "..." : projects.length}
              </span>
              <span className="text-[0.84rem] tracking-[0.12px] text-muted-foreground">
                Known projects
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl bg-[rgb(255_255_255_/_72%)] px-[14px] py-3 text-[0.88rem] leading-[1.5] text-muted-foreground">
              <SparklesIcon />
              <span>
                Detail pages now live under <code>/project/:id</code>.
              </span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" render={<Link to="/" />}>
              Back to Welcome
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-[14px]">
          {loading ? (
            <Card className="min-h-56 justify-center">
              <CardHeader>
                <CardTitle>Loading projects</CardTitle>
                <CardDescription>
                  Reading the current workspace registry.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="min-h-56 justify-center">
              <CardHeader>
                <CardTitle>No projects yet</CardTitle>
                <CardDescription>
                  Add your first local directory to start editing prompts,
                  configs, and source files.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setAddProjectDialogOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  Add First Project
                </Button>
              </CardFooter>
            </Card>
          ) : (
            projects.map((project, index) => (
              <Card
                key={project.id}
                className="bg-[linear-gradient(180deg,rgb(250_249_245_/_92%)_0%,rgb(255_255_255_/_98%)_100%)]"
              >
                <CardHeader className="gap-3">
                  <div className="min-w-0">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="text-[0.78rem] tracking-[0.12px] text-muted-foreground">
                        {project.id}
                      </span>
                    </div>
                    <CardTitle className="text-[1.45rem]">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="font-mono text-[0.84rem] leading-[1.6] [overflow-wrap:anywhere]">
                      {project.localPath}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardFooter className="justify-end">
                  <Button render={<Link to={`/project/${project.id}`} />}>
                    Open Workspace
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

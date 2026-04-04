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
    <main className="app-page projects-page">
      <section className="projects-hero app-section-card">
        <div className="projects-hero-copy">
          <div className="projects-hero-kicker">
            <p className="app-page-subtitle">Projects</p>
            <Badge variant="outline">
              {loading ? "Loading..." : `${projects.length} tracked`}
            </Badge>
          </div>
          <h1 className="app-page-title projects-page-title">
            Project Library
          </h1>
          <p className="projects-hero-description">
            Keep every imported workspace in one place, then jump into the
            editor through the new <code>/project/:id</code> route.
          </p>
        </div>
        <div className="projects-hero-actions">
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

      {error ? <div className="projects-inline-error">{error}</div> : null}

      <section className="projects-grid">
        <Card className="projects-summary-card" size="sm">
          <CardHeader>
            <CardTitle className="projects-summary-title">
              Workspace Index
            </CardTitle>
            <CardDescription>
              Use this page as the stable entry for browsing projects and
              importing new directories.
            </CardDescription>
          </CardHeader>
          <CardContent className="projects-summary-metrics">
            <div className="projects-metric">
              <span className="projects-metric-value">
                {loading ? "..." : projects.length}
              </span>
              <span className="projects-metric-label">Known projects</span>
            </div>
            <div className="projects-summary-note">
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

        <div className="projects-list">
          {loading ? (
            <Card className="projects-empty-card">
              <CardHeader>
                <CardTitle>Loading projects</CardTitle>
                <CardDescription>
                  Reading the current workspace registry.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="projects-empty-card">
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
              <Card key={project.id} className="projects-list-card">
                <CardHeader className="projects-list-card-header">
                  <div className="min-w-0">
                    <div className="projects-list-card-topline">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="projects-list-card-id">
                        {project.id}
                      </span>
                    </div>
                    <CardTitle className="projects-list-card-title">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="projects-list-card-path">
                      {project.localPath}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardFooter className="projects-list-card-footer">
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

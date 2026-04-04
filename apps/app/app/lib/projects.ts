import { apiRequest } from "./api-client"
import { getAppSettings } from "./app-settings"

export type Project = {
  id: string
  name: string
  localPath: string
}

export function deriveProjectName(localPath: string) {
  return (
    localPath.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "Project"
  )
}

export function listProjects() {
  return apiRequest<{ projects: Project[] }>("/projects")
}

export function createProject(localPath: string) {
  const settings = getAppSettings()

  return apiRequest<{ project: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify({
      localPath,
      name: deriveProjectName(localPath),
      allowDuplicateLocalPath:
        settings.general.allowDuplicateLocalPathAsNewProject,
    }),
  })
}

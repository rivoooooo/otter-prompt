import { createRoutesFromElements, type RouteObject, Route } from "react-router"

import { AppRouteErrorBoundary } from "./error-view"
import ClusterPage from "./routes/cluster"
import HomePage from "./routes/home"
import ProjectsPage from "./routes/projects"
import SettingsGeneralPage from "./routes/settings-general"
import SettingsIndexPage from "./routes/settings-index"
import SettingsProviderDetailPage from "./routes/settings-provider-detail"
import SettingsProvidersPage from "./routes/settings-providers"
import SettingsRoute from "./routes/settings"
import WelcomePage from "./routes/welcome"
import WorkspaceRoute from "./routes/workspace"

export function createAppRouteObjects(): RouteObject[] {
  return createRoutesFromElements(
    <Route element={<WorkspaceRoute />} errorElement={<AppRouteErrorBoundary />}>
      <Route index element={<WelcomePage />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="project/:projectId" element={<HomePage />} />
      <Route path="settings" element={<SettingsRoute />}>
        <Route index element={<SettingsIndexPage />} />
        <Route path="general" element={<SettingsGeneralPage />} />
        <Route path="providers" element={<SettingsProvidersPage />} />
        <Route
          path="providers/:providerId"
          element={<SettingsProviderDetailPage />}
        />
      </Route>
      <Route path="cluster" element={<ClusterPage />} />
    </Route>
  )
}

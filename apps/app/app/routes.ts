import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes"

export default [
  layout("routes/workspace.tsx", [
    index("routes/welcome.tsx"),
    route("projects/:projectId", "routes/home.tsx"),
    route("settings", "routes/settings.tsx", [
      index("routes/settings-index.tsx"),
      route("general", "routes/settings-general.tsx"),
      route("providers", "routes/settings-providers.tsx"),
      route("providers/:providerId", "routes/settings-provider-detail.tsx"),
    ]),
    route("cluster", "routes/cluster.tsx"),
  ]),
] satisfies RouteConfig

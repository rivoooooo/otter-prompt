import { useMemo, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router"
import { MenuIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
} from "../lib/app-settings"
import {
  SETTINGS_NAV_ITEMS,
  type SettingsNavItem,
  type SettingsRouteContext,
} from "../lib/settings-route"

function SettingsNavigation({
  items,
  currentPath,
  onNavigate,
}: {
  items: SettingsNavItem[]
  currentPath: string
  onNavigate?: () => void
}) {
  return (
    <SidebarMenu className="settings-sidebar-menu">
      {items.map((item) => {
        const active = item.matchPrefix
          ? currentPath.startsWith(item.matchPrefix)
          : currentPath === item.to

        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              render={<NavLink to={item.to} />}
              isActive={active}
              className="settings-sidebar-button"
              onClick={onNavigate}
            >
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export default function SettingsRoute() {
  const location = useLocation()
  const [saved, setSaved] = useState<AppSettings>(() => getAppSettings())
  const [draft, setDraft] = useState<AppSettings>(() => getAppSettings())
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const canSave = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  )

  function saveDraft() {
    saveAppSettings(draft)
    setSaved(draft)
    setSavedAt(Date.now())
  }

  const context: SettingsRouteContext = {
    draft,
    saved,
    canSave,
    savedAt,
    setDraft,
    saveDraft,
  }

  return (
    <main className="settings-page settings-center-page">
      <div className="settings-page-header settings-page-header--top-level">
        <div className="settings-header-title-row">
          <div className="md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon-sm" />}>
                <MenuIcon />
                <span className="sr-only">Open settings sections</span>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                </SheetHeader>
                <div className="px-6 pt-2 pb-6">
                  <SettingsNavigation
                    items={SETTINGS_NAV_ITEMS}
                    currentPath={location.pathname}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <h1 className="settings-page-title">Settings</h1>
        </div>
        <div className="settings-state-line">
          {canSave ? "Unsaved changes" : "All changes saved"}
          {savedAt && !canSave
            ? ` at ${new Date(savedAt).toLocaleTimeString()}`
            : ""}
        </div>
      </div>

      <SidebarProvider defaultOpen className="settings-center-layout">
        <Sidebar
          collapsible="none"
          className="settings-center-sidebar-shell hidden bg-transparent text-foreground md:flex"
        >
          <SidebarContent className="settings-center-sidebar-content">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SettingsNavigation
                  items={SETTINGS_NAV_ITEMS}
                  currentPath={location.pathname}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="settings-center-inset">
          <Outlet context={context} />
        </SidebarInset>
      </SidebarProvider>
    </main>
  )
}

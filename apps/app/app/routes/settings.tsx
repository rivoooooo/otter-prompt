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
    <SidebarMenu className="gap-1.5">
      {items.map((item) => {
        const active = item.matchPrefix
          ? currentPath.startsWith(item.matchPrefix)
          : currentPath === item.to

        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              render={<NavLink to={item.to} />}
              isActive={active}
              className="min-h-[2.8rem] rounded-[18px] px-[14px] text-[0.95rem] text-foreground hover:bg-[#f0ece4] hover:text-foreground data-[active=true]:bg-[#e9e4db] data-[active=true]:font-medium data-[active=true]:text-foreground"
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
    <main className="mx-auto min-h-svh w-full max-w-[1380px] p-4 md:p-6">
      <div className="mb-[22px] flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                render={<Button variant="outline" size="icon-sm" />}
              >
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
          <h1 className="font-heading text-[clamp(2.1rem,3vw,2.5rem)] leading-[1.08]">
            Settings
          </h1>
        </div>
        <div className="text-[0.8125rem] text-muted-foreground">
          {canSave ? "Unsaved changes" : "All changes saved"}
          {savedAt && !canSave
            ? ` at ${new Date(savedAt).toLocaleTimeString()}`
            : ""}
        </div>
      </div>

      <SidebarProvider
        defaultOpen
        className="block w-full lg:flex lg:items-start lg:gap-7"
      >
        <Sidebar
          collapsible="none"
          className="hidden w-56 self-start bg-transparent text-foreground md:flex lg:sticky lg:top-6"
        >
          <SidebarContent className="pt-1.5">
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

        <SidebarInset className="min-w-0 bg-transparent lg:pt-1">
          <Outlet context={context} />
        </SidebarInset>
      </SidebarProvider>
    </main>
  )
}

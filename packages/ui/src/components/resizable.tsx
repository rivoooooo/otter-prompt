import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import {
  Group as ResizablePrimitiveGroup,
  Panel as ResizablePrimitivePanel,
  Separator as ResizablePrimitiveSeparator,
} from "react-resizable-panels"

import { cn } from "@workspace/ui/lib/utils"

type ResizablePanelGroupProps = React.ComponentProps<
  typeof ResizablePrimitiveGroup
> & {
  direction?: React.ComponentProps<
    typeof ResizablePrimitiveGroup
  >["orientation"]
}

function ResizablePanelGroup({
  className,
  direction = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  return (
    <ResizablePrimitiveGroup
      data-slot="resizable-panel-group"
      orientation={direction}
      className={cn(
        "flex h-full w-full",
        direction === "vertical" && "flex-col",
        className
      )}
      {...props}
    />
  )
}

const ResizablePanel = ResizablePrimitivePanel

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitiveSeparator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitiveSeparator
      data-slot="resizable-handle"
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:absolute aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-px aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:after:bg-border aria-[orientation=vertical]:w-px aria-[orientation=vertical]:after:absolute aria-[orientation=vertical]:after:inset-y-0 aria-[orientation=vertical]:after:left-1/2 aria-[orientation=vertical]:after:w-px aria-[orientation=vertical]:after:-translate-x-1/2 aria-[orientation=vertical]:after:bg-border aria-[orientation=horizontal]:[&>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs">
          <GripVerticalIcon className="size-3.5" />
        </div>
      ) : null}
    </ResizablePrimitiveSeparator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }

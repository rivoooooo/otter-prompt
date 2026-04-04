package main

import (
	"embed"
	_ "embed"
	"log"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	nodeRuntime := NewNodeRuntimeFromEnv()
	if err := nodeRuntime.Start(); err != nil {
		log.Fatal(err)
	}
	defer nodeRuntime.Stop()

	windowURL := os.Getenv("OTTER_APP_URL")
	if windowURL == "" {
		windowURL = "/"
	}

	app := application.New(application.Options{
		Name:        "otter-prompt",
		Description: "Desktop shell for Otter Prompt",
		Services: []application.Service{
			application.NewService(NewBridgeService(nodeRuntime.Endpoint)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Otter Prompt",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(247, 247, 248),
		URL:              windowURL,
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

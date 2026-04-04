package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type BridgeService struct {
	endpoint string
}

const keychainService = "otter-prompt"
const keychainAccount = "api-key"

func NewBridgeService(endpoint string) *BridgeService {
	return &BridgeService{endpoint: endpoint}
}

func (b *BridgeService) LocalEndpoint() string {
	return b.endpoint
}

func (b *BridgeService) OpenPath(targetPath string, customCommand string) error {
	if targetPath == "" {
		return fmt.Errorf("targetPath is required")
	}

	if customCommand != "" {
		parts := strings.Fields(customCommand)
		if len(parts) == 0 {
			return fmt.Errorf("invalid custom command")
		}
		args := append(parts[1:], targetPath)
		return exec.Command(parts[0], args...).Start()
	}

	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", targetPath).Start()
	case "windows":
		return exec.Command("cmd", "/c", "start", "", targetPath).Start()
	default:
		return exec.Command("xdg-open", targetPath).Start()
	}
}

func (b *BridgeService) SetApiKey(apiKey string) (string, error) {
	if strings.TrimSpace(apiKey) == "" {
		return "", fmt.Errorf("apiKey is required")
	}

	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("system keychain not supported on %s", runtime.GOOS)
	}

	cmd := exec.Command(
		"security",
		"add-generic-password",
		"-a",
		keychainAccount,
		"-s",
		keychainService,
		"-w",
		apiKey,
		"-U",
	)
	if err := cmd.Run(); err != nil {
		return "", err
	}

	return keychainService + ":" + keychainAccount, nil
}

func (b *BridgeService) GetApiKey() (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("system keychain not supported on %s", runtime.GOOS)
	}

	cmd := exec.Command(
		"security",
		"find-generic-password",
		"-a",
		keychainAccount,
		"-s",
		keychainService,
		"-w",
	)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func (b *BridgeService) ClearApiKey() error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("system keychain not supported on %s", runtime.GOOS)
	}
	cmd := exec.Command(
		"security",
		"delete-generic-password",
		"-a",
		keychainAccount,
		"-s",
		keychainService,
	)
	return cmd.Run()
}

func (b *BridgeService) ExportApiKeyToken() (string, error) {
	key, err := b.GetApiKey()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(bytes.TrimSpace([]byte(key))), nil
}

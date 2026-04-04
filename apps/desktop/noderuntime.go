package main

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

type NodeRuntime struct {
	Endpoint string
	Port     string
	NodeBin  string
	Entry    string
	proc     *exec.Cmd
}

func NewNodeRuntimeFromEnv() *NodeRuntime {
	endpoint := os.Getenv("OTTER_LOCAL_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://127.0.0.1:8787"
	}

	port := os.Getenv("OTTER_LOCAL_PORT")
	if port == "" {
		if parsed, err := url.Parse(endpoint); err == nil {
			if parsed.Port() != "" {
				port = parsed.Port()
			}
		}
	}
	if port == "" {
		port = "8787"
	}

	nodeBin := os.Getenv("OTTER_NODE_BIN")
	if nodeBin == "" {
		nodeBin = "node"
	}

	return &NodeRuntime{
		Endpoint: endpoint,
		Port:     port,
		NodeBin:  nodeBin,
		Entry:    os.Getenv("OTTER_NODE_ENTRY"),
	}
}

func (n *NodeRuntime) Start() error {
	if strings.TrimSpace(n.Entry) == "" {
		return nil
	}

	n.proc = exec.Command(n.NodeBin, n.Entry)
	n.proc.Stdout = os.Stdout
	n.proc.Stderr = os.Stderr
	n.proc.Env = append(os.Environ(), "PORT="+n.Port)

	if err := n.proc.Start(); err != nil {
		return fmt.Errorf("start node runtime: %w", err)
	}

	return nil
}

func (n *NodeRuntime) Stop() {
	if n.proc == nil || n.proc.Process == nil {
		return
	}
	_ = n.proc.Process.Kill()
	_, _ = n.proc.Process.Wait()
}

import { createError, defineEventHandler } from "h3"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

async function selectDirectory() {
  const platform = process.platform

  if (platform === "darwin") {
    const script =
      'POSIX path of (choose folder with prompt "Select project folder")'
    const { stdout } = await execFileAsync("osascript", ["-e", script])
    return stdout.trim()
  }

  if (platform === "win32") {
    const command = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      '$dialog.Description = "Select project folder"',
      "$dialog.ShowNewFolderButton = $false",
      "$result = $dialog.ShowDialog()",
      'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }',
    ].join("; ")

    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      command,
    ])
    return stdout.trim()
  }

  const { stdout } = await execFileAsync("zenity", [
    "--file-selection",
    "--directory",
    "--title=Select project folder",
  ])
  return stdout.trim()
}

export default defineEventHandler(async () => {
  try {
    const path = await selectDirectory()

    if (!path) {
      throw createError({ statusCode: 400, statusMessage: "No directory selected" })
    }

    return { path }
  } catch (cause) {
    const message = String(cause)

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to select directory: ${message}`,
    })
  }
})

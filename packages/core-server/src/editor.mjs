import { execFile } from "node:child_process"
import { platform } from "node:os"

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

export async function openInEditor(targetPath, customCommand) {
  if (customCommand) {
    const [command, ...args] = customCommand.split(" ")
    await run(command, [...args, targetPath])
    return
  }

  const current = platform()
  if (current === "darwin") {
    await run("open", [targetPath])
    return
  }

  if (current === "win32") {
    await run("cmd", ["/c", "start", "", targetPath])
    return
  }

  await run("xdg-open", [targetPath])
}

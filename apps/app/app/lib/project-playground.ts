import type { TreeNode } from "./fs-api"

export function getRootFileByName(tree: TreeNode | null, fileName: string) {
  return (
    tree?.children?.find(
      (child) => child.type === "file" && child.name === fileName
    ) || null
  )
}

export type Shape = {
  id: string
  kind: "pen" | "mark" | "circle"
  /** pen / mark：点坐标；circle：[左上, 右下]。单位是材料正文宽度。 */
  pts: [number, number][]
  dx: number
  dy: number
}

export type PaperState = {
  ink: Record<string, Shape[]>
  drafts: Record<string, string>
}

export const splitItem = storage.defineItem<number>("local:study-split", {
  fallback: 50
})

export const fontItem = storage.defineItem<number>("local:study-font", {
  fallback: 15
})

const empty = (): PaperState => ({ ink: {}, drafts: {} })

export async function loadState(paperId: string): Promise<PaperState> {
  const saved = await storage.getItem<PaperState>(`local:study:${paperId}`)
  return { ...empty(), ...saved }
}

export function saveState(paperId: string, state: PaperState) {
  return storage.setItem(`local:study:${paperId}`, state)
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

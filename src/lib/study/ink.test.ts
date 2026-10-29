import { beforeEach, describe, expect, it, vi } from "vitest"
import { createInk } from "./ink"
import type { Shape } from "./store"

function setup(initial: Shape[] = []) {
  const host = document.createElement("div")
  document.body.append(host)
  const onChange = vi.fn()
  const ink = createInk(host, initial, onChange)
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 200 }) as DOMRect
  const fire = (type: string, x: number, y: number, target: Element = svg) =>
    target.dispatchEvent(
      new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })
    )
  return { host, ink, svg, onChange, fire }
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe("createInk", () => {
  it("does not capture pointer events until a tool is chosen", () => {
    const { ink, svg } = setup()
    expect(svg.style.pointerEvents).toBe("none")
    ink.setTool("pen")
    expect(svg.style.pointerEvents).toBe("auto")
    ink.setTool("none")
    expect(svg.style.pointerEvents).toBe("none")
  })

  it("draws a freehand stroke in width units", () => {
    const { ink, svg, fire, onChange } = setup()
    ink.setTool("pen")
    fire("pointerdown", 10, 20)
    fire("pointermove", 30, 40)
    fire("pointerup", 50, 60)
    const shapes = onChange.mock.calls[0]![0] as Shape[]
    expect(shapes).toHaveLength(1)
    expect(shapes[0]!.kind).toBe("pen")
    expect(shapes[0]!.pts[0]).toEqual([0.1, 0.2])
    expect(svg.querySelectorAll("g[data-id] path").length).toBeGreaterThan(0)
  })

  it("draws a circle as an ellipse and ignores a bare click", () => {
    const { ink, svg, fire, onChange } = setup()
    ink.setTool("circle")
    fire("pointerdown", 10, 10)
    fire("pointerup", 10, 10)
    expect(onChange).toHaveBeenLastCalledWith([])
    fire("pointerdown", 10, 10)
    fire("pointermove", 50, 30)
    fire("pointerup", 50, 30)
    expect(svg.querySelectorAll("ellipse").length).toBeGreaterThan(0)
  })

  it("moves and erases an existing stroke", () => {
    const shape: Shape = {
      id: "a",
      kind: "pen",
      pts: [
        [0.1, 0.1],
        [0.4, 0.1]
      ],
      dx: 0,
      dy: 0
    }
    const { ink, svg, fire, onChange } = setup([shape])
    const hit = () => svg.querySelector("g[data-id] path")!

    ink.setTool("move")
    fire("pointerdown", 20, 10, hit())
    fire("pointermove", 40, 30)
    fire("pointerup", 40, 30)
    const moved = onChange.mock.calls.at(-1)![0] as Shape[]
    expect(moved[0]!.dx).toBeCloseTo(0.2)
    expect(moved[0]!.dy).toBeCloseTo(0.2)

    ink.setTool("erase")
    fire("pointerdown", 40, 30, hit())
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(svg.querySelector("g[data-id]")).toBeNull()
  })

  it("clears everything and removes its svg on destroy", () => {
    const shape: Shape = {
      id: "a",
      kind: "mark",
      pts: [[0, 0]],
      dx: 0,
      dy: 0
    }
    const { ink, host, onChange } = setup([shape])
    ink.clear()
    expect(onChange).toHaveBeenLastCalledWith([])
    ink.destroy()
    expect(host.querySelector("svg")).toBeNull()
  })
})

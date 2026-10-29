import type { Shape } from "./store"

export type Tool = "none" | "pen" | "circle" | "mark" | "move" | "erase"

const SVG_NS = "http://www.w3.org/2000/svg"

function el<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string>
) {
  const node = doc.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

function path(shape: Shape) {
  return shape.pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")
}

function draw(doc: Document, shape: Shape) {
  const g = el(doc, "g", {
    "data-id": shape.id,
    transform: `translate(${shape.dx} ${shape.dy})`
  })
  const make = (
    stroke: string,
    width: string,
    extra: Record<string, string>
  ) => {
    const common = {
      fill: "none",
      stroke,
      "stroke-width": width,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke",
      ...extra
    }
    if (shape.kind === "circle") {
      const [[x0, y0], [x1, y1]] = shape.pts as [
        [number, number],
        [number, number]
      ]
      return el(doc, "ellipse", {
        cx: String((x0 + x1) / 2),
        cy: String((y0 + y1) / 2),
        rx: String(Math.abs(x1 - x0) / 2),
        ry: String(Math.abs(y1 - y0) / 2),
        ...common
      })
    }
    return el(doc, "path", { d: path(shape), ...common })
  }
  const style =
    shape.kind === "mark"
      ? make("#ffd400", "14", {
          opacity: "0.45",
          style: "mix-blend-mode:multiply"
        })
      : make("#e5322d", "3", {})
  // 透明的宽描边，方便点中细线
  const hit = make("transparent", "16", { "pointer-events": "stroke" })
  g.append(style, hit)
  return g
}

export type Ink = {
  setTool(tool: Tool): void
  clear(): void
  destroy(): void
}

/**
 * 在 host 上叠一层 SVG 墨迹。坐标以 host 宽度为单位（viewBox 是 0 0 1 h），
 * 所以调整栏宽后笔迹会按比例缩放。
 */
export function createInk(
  host: HTMLElement,
  initial: Shape[],
  onChange: (shapes: Shape[]) => void
): Ink {
  const doc = host.ownerDocument
  const svg = el(doc, "svg", {
    class: "study-ink",
    preserveAspectRatio: "none",
    viewBox: "0 0 1 1"
  })
  svg.style.pointerEvents = "none"
  host.append(svg)

  let shapes = initial.map((s) => ({ ...s }))
  let tool: Tool = "none"
  let live: { shape: Shape; node: SVGElement } | null = null
  let dragging: {
    shape: Shape
    node: SVGElement
    x: number
    y: number
  } | null = null

  const render = () => {
    svg.replaceChildren(...shapes.map((s) => draw(doc, s)))
  }
  const commit = () => {
    render()
    onChange(shapes)
  }
  const point = (e: PointerEvent): [number, number] => {
    const rect = svg.getBoundingClientRect()
    const w = rect.width || 1
    return [(e.clientX - rect.left) / w, (e.clientY - rect.top) / w]
  }
  const target = (e: Event) => {
    const g = (e.target as Element | null)?.closest?.("g[data-id]")
    const shape = shapes.find((s) => s.id === g?.getAttribute("data-id"))
    return g && shape ? { g: g as SVGElement, shape } : null
  }

  const onDown = (e: PointerEvent) => {
    if (tool === "none") return
    e.preventDefault()
    svg.setPointerCapture?.(e.pointerId)
    const [x, y] = point(e)
    if (tool === "erase") {
      const hit = target(e)
      if (hit) {
        shapes = shapes.filter((s) => s !== hit.shape)
        commit()
      }
    } else if (tool === "move") {
      const hit = target(e)
      if (hit) dragging = { shape: hit.shape, node: hit.g, x, y }
    } else {
      const shape: Shape = {
        id: Math.random().toString(36).slice(2, 10),
        kind: tool,
        pts:
          tool === "circle"
            ? [
                [x, y],
                [x, y]
              ]
            : [[x, y]],
        dx: 0,
        dy: 0
      }
      const node = draw(doc, shape)
      svg.append(node)
      live = { shape, node }
    }
  }

  const onMove = (e: PointerEvent) => {
    const [x, y] = point(e)
    if (dragging) {
      const dx = dragging.shape.dx + x - dragging.x
      const dy = dragging.shape.dy + y - dragging.y
      dragging.node.setAttribute("transform", `translate(${dx} ${dy})`)
    } else if (live) {
      const { shape } = live
      if (shape.kind === "circle") shape.pts[1] = [x, y]
      else shape.pts.push([x, y])
      const next = draw(doc, shape)
      live.node.replaceWith(next)
      live.node = next
    }
  }

  const onUp = (e: PointerEvent) => {
    const [x, y] = point(e)
    if (dragging) {
      dragging.shape.dx += x - dragging.x
      dragging.shape.dy += y - dragging.y
      dragging = null
      commit()
    } else if (live) {
      const { shape } = live
      live = null
      const [a, b] = [shape.pts[0]!, shape.pts[shape.pts.length - 1]!]
      const tiny = Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.005
      if (!tiny) shapes.push(shape)
      commit()
    }
  }

  svg.addEventListener("pointerdown", onDown as EventListener)
  svg.addEventListener("pointermove", onMove as EventListener)
  svg.addEventListener("pointerup", onUp as EventListener)
  svg.addEventListener("pointercancel", onUp as EventListener)

  const fit = () => {
    const { width, height } = host.getBoundingClientRect()
    svg.setAttribute("viewBox", `0 0 1 ${width ? height / width : 1}`)
  }
  const resize =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit)
  resize?.observe(host)
  fit()
  render()

  return {
    setTool(next) {
      tool = next
      svg.style.pointerEvents = next === "none" ? "none" : "auto"
      svg.dataset.tool = next
    },
    clear() {
      shapes = []
      commit()
    },
    destroy() {
      resize?.disconnect()
      svg.remove()
    }
  }
}

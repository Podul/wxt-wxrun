/** 挂在面板内的模态弹窗；Esc、点遮罩、关闭按钮都能关。 */
export function openDialog(host: HTMLElement, title: string) {
  const doc = host.ownerDocument
  const dialog = doc.createElement("dialog")
  dialog.className = "study-dialog"

  const head = doc.createElement("div")
  head.className = "study-dialog-head"
  const heading = doc.createElement("h3")
  heading.textContent = title
  const close = doc.createElement("button")
  close.type = "button"
  close.className = "study-dialog-close"
  close.textContent = "×"
  close.setAttribute("aria-label", "关闭")
  head.append(heading, close)

  const body = doc.createElement("div")
  body.className = "study-dialog-body"
  dialog.append(head, body)

  // 直接移出 DOM 即关闭；Esc 触发的 close 事件同样移除
  const dismiss = () => dialog.remove()
  close.addEventListener("click", dismiss)
  dialog.addEventListener("close", dismiss)
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dismiss()
  })

  host.append(dialog)
  if (typeof dialog.showModal === "function") dialog.showModal()
  else dialog.setAttribute("open", "")
  return { body, close: dismiss }
}

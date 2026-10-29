import { themeItem } from "@/lib/theme"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import PopupPage from "./PopupPage"

describe("PopupPage", () => {
  it("selects the stored theme", async () => {
    await themeItem.setValue("green")
    render(<PopupPage />)
    await waitFor(() => expect(screen.getByLabelText("护眼绿")).toBeChecked())
  })

  it("stores the chosen theme", async () => {
    await themeItem.setValue("original")
    render(<PopupPage />)
    await userEvent.click(screen.getByLabelText("暗色"))
    await waitFor(async () => expect(await themeItem.getValue()).toBe("dark"))
  })
})

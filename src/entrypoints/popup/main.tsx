import "./style.css"
import PopupPage from "@/components/popup/PopupPage"
import { createRoot } from "react-dom/client"

const container = document.getElementById("root")!
createRoot(container).render(<PopupPage />)

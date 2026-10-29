import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "wxrun 主题",
    description: "为猫学网（wxrun.com）提供暗色、护眼绿、羊皮纸等可切换主题",
    permissions: ["storage"]
  }
})

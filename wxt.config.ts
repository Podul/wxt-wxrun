import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "wxrun 主题",
    description: "为猫学网（wxrun.com）提供桌面端网页布局与论文页双栏答题面板",
    permissions: ["storage"]
  }
})

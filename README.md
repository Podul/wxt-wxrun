# wxrun 主题

为猫学网（wxrun.com）提供桌面端网页布局和论文页双栏答题面板的浏览器扩展。基于 [WXT](https://wxt.dev) + React 构建，使用 Manifest V3，支持 Chrome 与 Edge（Chromium 内核）。

## 环境要求

* Node.js 22+
* pnpm

## 构建

```bash
pnpm install
pnpm build
```

构建产物位于 `.output/chrome-mv3/`，Chrome 和 Edge 共用这一份。

## 在 Chrome 中安装

1. 地址栏输入 `chrome://extensions` 并回车。
2. 打开右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择项目下的 `.output/chrome-mv3` 目录。
5. （可选）点击工具栏拼图图标，把「wxrun 主题」固定到工具栏。

## 在 Edge 中安装

1. 地址栏输入 `edge://extensions` 并回车。
2. 打开左侧（或页面底部）的「开发人员模式」。
3. 点击「加载解压缩的扩展」。
4. 选择项目下的 `.output/chrome-mv3` 目录。
5. （可选）点击工具栏扩展图标，把「wxrun 主题」固定到工具栏。

> Edge 基于 Chromium，可直接使用 Chrome 的构建产物。也可以执行 `pnpm build -b edge` 生成 `.output/edge-mv3`，二者功能一致。

## 通过 zip 包安装

```bash
pnpm package
```

会在 `.output/` 下生成 zip 包。zip 主要用于上架应用商店；本地使用请解压后按上面的步骤加载，Chrome 和 Edge 都不能直接拖入 zip 安装。

## 使用

安装后打开 [wxrun.com](https://wxrun.com)，扩展会自动应用网页布局，无需任何设置。

## 开发

```bash
pnpm dev          # 启动开发模式（自动打开带扩展的浏览器并热更新）
pnpm test         # 运行测试
pnpm typecheck    # 类型检查
pnpm lint         # 代码风格检查
```

## 常见问题

* **更新代码后没有生效**：重新执行 `pnpm build`，然后在扩展管理页点击该扩展的「重新加载」按钮，再刷新 wxrun.com 页面。
* **提示「清单文件缺失或不可读」**：选错了目录，应选择包含 `manifest.json` 的 `.output/chrome-mv3`，而不是项目根目录。
* **重启浏览器后出现「请停用开发者模式扩展」提示**（主要在 Chrome）：这是未上架商店的本地扩展的正常提示，忽略或关闭即可。

# gcake-dev

個人技術內容站。以 Markdown/Git 為內容來源，Astro 負責靜態網站，Vue 僅用於需要互動的 islands。

## 核心原則

- Git 是文章編輯歷史與主要內容來源。
- GitHub Pages 是最新正式閱讀版本與 SEO canonical。
- Paragraph 是同步發表／Arweave 永久保存層，不回寫文章來源。
- Series manifest 是連載企劃、章節編排、進度與網站導覽的單一來源。
- 舊的 2026 iThome 鐵人賽正文仍由 `gcake119/ithome-2026` 維護；本 repo 只在 build 時載入並渲染。

## 技術

- Astro
- Vue 3 islands
- pnpm
- Markdown
- GitHub Pages

完整架構請見 `docs/architecture.md`。

# 原生 Substack 身份與排程 PR 驗證

2026／10／13，獨立分支 codex/substack-native-scheduler-20261013，以 main ba08bcc（Paragraph 移除後）為基底。原已安裝 runtime 及 228 檔私人 pin 完整保留，不因提交本 PR 而更新。政策仍只允許 Substack。

## 本機驗證

- pnpm install --frozen-lockfile：通過。
- pnpm test：完整流程通過，包含 31 項 Python 及 94 項同步回歸。
- pnpm check：196 檔，零錯誤／警告／提示。
- pnpm build:all：公開網站及全部 workspace 建置通過。
- pnpm release:dry-run：通過，productionWrites=false、telegramNetworkCalls=0。
- spectra analyze complete-cross-platform-distribution：無問題。
- git diff --check：通過。

身份修正的第一筆索引快照單獨通過 66 項同步測試；原生傳輸的第二筆索引快照單獨通過 90 項。測試腳本保存紀錄後清理自有快照；未使用 Docker。

本機 Node／瀏覽器回歸涵蓋缺少公開 href、錯誤文章／刊物／canonical、重複或 malformed 公開資料、未知 archive 身份、分類／分頁不完整、非 checkbox 控制、設定欄位延遲載入、同 ID 更新一次及零寄送、來源變更／導向另一篇文章、不同 Chrome 程序、失效權限／舊授權及共享鎖。

## 平台與排程證據的界線

前一已安裝版本在實際 macOS 系統工作中完成原 ID 220011124 的編輯器身份與全文、匿名公開全文、分鐘日期及寄送控制唯讀驗收，articleWrites=0；其正式首輪 verified，D1 全在途為零，舊 heartbeat 已停用。私人驗收檔與 pin 保留，未納入 Git。

此 PR 將程式移植至 Substack-only main，以上本機結果是此候選的工程驗證。前一版本的系統驗收不是此 PR 已重新安裝或平台寫入驗收；本輪沒有 provider 寫入、排程切換、原文部署或合併。部署新版仍需新 pin、真實唯讀驗收及單一 writer 切換，不能修改舊 pin 繞過差異。

# 歸檔預檢警告修正紀錄（2026-10-20）

## 範圍與結論

以 main `cfa6465e98ecff7d955165630e1a97aca07730e2` 為基準，僅整理本 change 的 delta 與本機核對證據。已消除既有歸檔預檢警告；未歸檔、未同步或改寫主規格、未推送、未部署，也未讀寫正式 provider、修改排程或新增寄送。本次沒有新的產品決策或寫入授權。

任務 **5.3 仍未完成**。文章 **221098688** 的 **2026-10-22 07:00 Asia/Taipei** 排程與既有 everyone／email／App 承諾沿用先前唯讀快照；本次未重新讀取正式設定。**寄送結果與真人實收仍未知**，不能以規格檢查取代發布後實際驗收。

## 原因與修正

1. `quiet-background-distribution` 的四項 `ADDED` 需求已存在於主規格，內容與情境一致：`Scheduled-source observation reuses existing attention`、`Action-specific truthful attention reasons`、`Content attention requires confirmed meaningful drift`、`Queue revisions do not imply provider postponement`。先前草稿同步 change 歸檔後，這些需求已在主規格，舊 delta 分類卻未更新；預檢回報「4 ADDED operations，0 applied」。本次將四項完整需求保留在既有 `MODIFIED` 區段，未刪除或放寬內容。
2. `Explicit publication operations` 與 `Browser-free background execution` 的舊 `MODIFIED` 內容早於主規格的草稿工作者契約。僅修分類仍可能在未來同步時覆蓋較新的限制。本次以現有主規格完整契約及情境為底，保留原 delta 的排程、舊核准拒絕、精確承諾與零自動寄送限制。
3. 兩組同名但條件不同的歷史情境均保留 Given／When／Then 原文：原 delta 的 `Save article only` 改名為 `Source save never arms or delivers`；原 delta 的 `Browser operation is required` 改名為 `Anonymous observer requires foreground browser work`。主規格的同名情境保留。文字明確界定後者屬匿名觀察器：它仍不能登入、控制瀏覽器或寫入 provider；另行核准的工作者只沿用主規格已存在的未排程、未發布草稿權限，不能修改排程、公開文章或寄送。

主規格檔案與新增能力 `substack-scheduled-publication` 的八項需求均未改動。本次兩個既有能力的原 delta 共 35 組情境條件與結果完整保留；補回主規格既有情境後，這兩份 delta 共 42 組，沒有降低驗收門檻。

## 本機驗證

- `spectra validate schedule-substack-drafts-ahead`：通過，原預檢警告消失。
- `spectra analyze schedule-substack-drafts-ahead`：Coverage、Consistency、Ambiguity、Gaps 均無問題；Localization 因 artifacts 不足而跳過，照實保留，不能稱為已驗證。
- `spectra archive schedule-substack-drafts-ahead --preview --json`：僅唯讀預覽，沒有執行歸檔。辨識 publishing-operations 為 3 modified、quiet-background-distribution 為 6 modified、substack-scheduled-publication 為 8 added；仍有 1 項未完成任務。`conflict_source` 仍顯示較早的草稿同步歸檔來源；它是來源資訊，不代表上述較新契約可被覆蓋。
- 逐需求比對原 delta、目前主規格與候選 delta：原情境及主規格情境的 Given／When／Then 全數保留，主規格規範句保留；在記憶體內模擬替換 MODIFIED 區塊後，所有主規格情境與無關需求仍保留。沒有呼叫 sync 或實際 archive。
- 所有任務勾選、5.3 原文、舊唯讀核對 MD／JSON 與歷史警告紀錄不變；只有在 tasks 加入本次證據連結。
- `git diff --check` 與提交範圍核對通過。只修改規格與證據，沒有程式碼、相依套件或執行設定變更，因此本次使用 Spectra 與語意保留檢查，未重跑不受影響的程式測試、建置或部署檢查，亦未新增測試層或 CI。

注意：修正前 `validate` 雖結束碼為 0，仍帶有警告；修正前唯讀 preview 的 `warnings` 也已是空陣列，卻只辨識 2 項 quiet-background-distribution 修改。因此不能僅憑結束碼或 preview 的空警告判斷問題解決，必須同時核對 validate 訊息與操作數。

原始輸出、區塊雜湊與核對摘要見 [本次機器可讀證據](archive-preflight-reconciliation-20261020.json)。先前的警告與排程查核保留在 [原唯讀核對紀錄](schedule-readonly-221098688-20261020.md) 及其 JSON，未改寫歷史結果。

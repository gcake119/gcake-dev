# 2026 iThome 鐵人賽｜Editorial Archive

這個目錄保存 2026 iThome 鐵人賽在文章正文之外的寫作規劃、進度、交接與歷史資料。

## 正式文章來源

Day 1–30 正文不在此處重複保存。

正式來源：

- Repository: `gcake119/ithome-2026`
- Path: `src/content/ironman/day-01.md` ～ `day-30.md`

`gcake-dev` 只保存長期仍有價值的 editorial context，並在網站端以 external series 方式讀取舊文。

## 文件索引

### `final-series-structure.md`

30 篇全部完稿後重新整理出的正式五章結構。

需要判斷網站章節、系列導覽或整體敘事時，優先使用這份文件。

### `progress-and-handoff-day30.md`

30 天連載完整的實際寫作進度、各篇核心、前後篇銜接與避免重複事項。

規劃延伸文章或回查「當時已經寫過什麼」時使用。

### `series-plan-revised.md`

連載進行期間後期使用的新版 30 天企劃。

用來理解原本規劃與實際成稿之間的關係；若章節分類與 `final-series-structure.md` 不同，以最終章節文件為準。

### `series-plan-original.md`

較早版本的 30 天連載企劃。

保留作為規劃演進紀錄，不作為目前網站或後續系列結構的權威來源。

### `publishing-workflow.md`

當時整理的文章同步、自動發文與監控流程。

這是一份歷史交接快照。若後續要重新操作 `ithome-2026` 的自動發布工具，應先查看該 repo 最新程式與 commit，再以本文件補充背景，不要假設所有流程仍與快照完全相同。

## Sources

### `sources/sim-sik-git-history.md`

第一個產品相關 repo 的 Git commit 歷史與架構演進整理。主要用途是核對鐵人賽文章中的實作時間線與專案演進。

### `sources/tainan-city-git-history.md`

第二個委託專案相關 repo 的 Git commit 歷史與架構演進整理。主要用途是核對鐵人賽後半段的實作時間線與工程演進。

## 使用順序

如果要重新進入這個系列，建議依任務選擇最少必要 context：

```text
理解整個 30 天系列
→ final-series-structure.md
→ 必要時讀相關 Day 正文

規劃延伸文章
→ final-series-structure.md
→ progress-and-handoff-day30.md
→ 相關 Day 正文

查當時原本怎麼規劃
→ series-plan-revised.md
→ 必要時 series-plan-original.md

查專案實際演進與時間線
→ sources/*-git-history.md
→ 再查看對應專案 repo 最新 Git 歷史

查發布工具背景
→ publishing-workflow.md
→ 再查看 gcake119/ithome-2026 最新 repo 狀態
```

## Project 檔案遷移狀態

本目錄已接手原 Project 上傳空間中，除 Day 1–30 正文以外的 7 份 iThome 寫作／交接／專案歷史文件。

Day 1–30 正文已由 `gcake119/ithome-2026/src/content/ironman/` 保存，因此不在本 repo 再複製一份。

完成此遷移後，鐵人賽相關 Project 上傳檔不再是唯一資料來源。

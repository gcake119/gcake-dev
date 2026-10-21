# 公開文章詞義萃取紀錄

本次檢視現有公開文章庫的３３篇文章；來源為建置所用的釘選內容，不是另找外站教材補進文章。所有引句皆已逐字對回公開段落。

可作名稱對照的只有１組。另保存９組概念說明，供檢索情境整理使用，不加入同義詞庫，也不計入缺少的９題。

| 文章 | 詞語 | 原文依據 | 判定 |
| --- | --- | --- | --- |
| [ithome:day-30](https://gcake119.github.io/ithome-2026/day/30/) | 系統層級的理解 | 我已經有一部分系統層級的理解（system-level understanding）。 | 名稱對照 |
| [ithome:day-27](https://gcake119.github.io/ithome-2026/day/27/) | Happy Path | Happy Path 就是最正常的情況。 | 概念解釋 |
| [ithome:day-25](https://gcake119.github.io/ithome-2026/day/25/) | TDD | 我用 Spectra 規劃實作時，通常一開始就會要求採 TDD。 也就是先把這次預期成立的行為寫清楚，再讓實作去符合它。 | 概念解釋 |
| [local:ithome-2026-astro-choice](https://gcake119.github.io/gcake-dev/posts/ithome-2026-astro-choice/) | Vue islands | 但這次有些地方需要更多互動，就再加入 Vue islands，也就是只在需要互動的局部使用 Vue。 | 概念解釋 |
| [local:ithome-2026-astro-choice](https://gcake119.github.io/gcake-dev/posts/ithome-2026-astro-choice/) | 前端框架 | 前端框架可以先簡單理解成：一套幫忙組織網站畫面和互動功能的開發工具。 | 概念解釋 |
| [ithome:day-17](https://gcake119.github.io/ithome-2026/day/17/) | API Contract | 後來我才知道，可以用 API Contract 這類明確約定，把雙方交換的資料定義下來。 | 概念解釋 |
| [ithome:day-11](https://gcake119.github.io/ithome-2026/day/11/) | 狀態機 | 系統要記住一個人現在做到哪一步，本身就是一個需要處理的問題。 我那時候第一次知道「狀態機」這個詞。 | 概念解釋 |
| [ithome:day-22](https://gcake119.github.io/ithome-2026/day/22/) | multi-repo | 這時候，multi-repo 對我來說已經不只是「專案被分成好幾個 repo」。 | 概念解釋 |
| [ithome:day-26](https://gcake119.github.io/ithome-2026/day/26/) | 雙軸審查 | 我目前有一個自訂的雙軸審查方式。 所謂「雙軸」，就是 review 時固定看兩件事： | 概念解釋 |
| [ithome:day-14](https://gcake119.github.io/ithome-2026/day/14/) | 案件生命週期 | 準備提案時，我開始用「案件生命週期」的角度重新看前面的流程圖。 因為那些工作階段串起來，就是一個案件從進來、被處理，到最後完成的整個過程。 | 概念解釋 |

各筆的來源修訂、段落識別及閱讀連結見 `test/discovery/public-terminology-review.json`。原先預列 RAG、TDD、API 等全名的１０個位置只是待找來源的題目，並不表示文章本來有寫出這些全名。不能用常識把它們補成作者原文。

已採用的中英對照保存於 `src/data/discovery/terminology-reviewed.json`；修訂或引句不符、撤回公開後均不套用。評測 v5 在本次跑分之前凍結，保留先前題組已被觀察的狀態；３１題有固定來源，９題仍待來源，未降低原驗收門檻。

# 驗證紀錄

原 main CI 41016327285 在既有媒體期限測試收到 READ_INCONCLUSIVE，預期 BUDGET_EXHAUSTED；原日誌保留於本機 output/discovery/index-status-release/routing-main-ci-failed.log。本機 Node22.23.4 第13次重現，沒有重送失敗候選。

新增兩個既有 acceptance seam 案例，以可控時鐘與訊號區分整輪期限及較早呼叫者取消。Node24.19.0 下原碼 round 案例 RED、caller 案例 GREEN；修正後兩者與既有期限案例共6項 GREEN。均檢查零 provider 呼叫、未聲稱 observed、原 intent 不變。

Node24.19.0／pnpm10.17.1 完整 pnpm test、check、build:all、release:dry-run、editorial:rehearse 全數通過。原媒體案例修正後40次皆通過，這是有界樣本，不保證未來永不出現競態。原始收據位於 output/discovery/index-status-release/{deadline-controlled-red.log,deadline-controlled-green.log,deadline-node24-gates,main-deadline-node24-after-fix}。

Spectra validate／analyze 通過。未部署、安裝或呼叫 Substack runtime，未更動數值期限、權限、重試或 CI required checks。PR／main CI 仍待獨立證據。

# PR ＃7：無人值守準備與驗收

2026／10／12。擁有者沒有協作者，要求推進無人值守方案；這不是正式啟用授權。PR 不合併、正式 Pages 候選不部署、兩個正式開關不啟用。擁有者已授權透過 Computer Use 建立私人專用 App，並選擇保留 CMS 直接儲存方案。已完成 gcake-editorial-release（App ID 5276010／installation 170331414）只安裝 gcake-dev、main-only editorial-release 環境及 active main integrity／main review。擁有者親自產生與存入私鑰，代理只確認 environment Secret 名稱 EDITORIAL_APP_PRIVATE_KEY，未讀取內容或驗證私鑰有效性。真實發文身份寫入尚未執行。決策來源為 `integrate-editorial-release` 的 Unattended release preparation；repo 沒有 docs/decisions 索引，使用現有 Spectra 決策，不另建平行追蹤。

## 一次設定、後續不逐次核准

1. `editorial-release` 只允許 Branch `main`，沒有 required reviewer、wait timer 或自訂核准規則。先保持 `EDITORIAL_RELEASE_ENABLED` repository variable 未設定／false。移除 reviewer 是正式運作策略變更，不在此次代做。
2. 建立**專用** GitHub App，只安裝到 `gcake119/gcake-dev`，Repository Contents：read/write、Metadata：read。不要共用 CMS App，不給 Workflows、Administration、Actions、Secrets 或其他額外寫入權限。選 private App／僅自己可安裝、關閉未使用的 webhook，不需要 user OAuth。代理可在擁有者確認後註冊與限定安裝；私鑰產生與存入由擁有者親自操作，不把私鑰貼給代理。
3. Repository variables：`EDITORIAL_APP_CLIENT_ID`（App Client ID，不是數字 App ID）、`EDITORIAL_APP_SLUG`（網址中的 slug，供唯讀盤點）。只有 `editorial-release` environment secret 放 `EDITORIAL_APP_PRIVATE_KEY`。不要放 repository secret、Git、Telegram 或 Hermes 提示詞。App 私鑰可以 mint 安裝權限範圍的 token，不等同短期 token；它是持久敏感憑證。
4. 建立兩組**active branch ruleset**，target 精確 `refs/heads/main`，沒有排除條件：
   - main integrity：Block force pushes、Restrict deletions，bypass list 為空。專用 App 也不能 bypass 這組。
   - main review：Require a pull request、Require status checks（`validate`，選 GitHub Actions 作為來源），Require branches to be up to date。只列 gcake-editorial-release 與既有 gcake-publishing-cms-2026（App ID 5109954），bypass mode 均為 Always；不要加入 repository role、其他 App 或其他廣泛 bypass。兩個 App 會同時略過此組 PR 與 CI 要求，但均不能略過 main integrity。要求真人 approval 不適合目前無協作者的本人 PR，普通 PR 仍須完整 CI 與本人合併。
5. CMS 相容性：擁有者選擇保留直接儲存，不修改 CMS 寫入流程。程式建立單一 commit 並以 non-force PATCH 推進 default branch main；production 與 preview 使用相同 App ID 5109954／installation 165836027。GitHub 安裝畫面已確認僅 gcake-dev、Contents read/write、Actions／Metadata read。此例外無法由 GitHub 限到文章路徑；真實受保護 main 的 CMS 寫入仍待受控驗收。也須確認其他 inherited rules／classic protection 不會衝突。
6. Actions 中只有 prepare／confirm mint 短期 App token，限目前 repository 與 contents write；內建 GITHUB_TOKEN 全部只讀 content。checkout 不保存憑證，依賴安裝、完整 pnpm test／pnpm check（測試旗標強制 false）通過後才 mint token；token 不繼承到 Git 讀取／commit 或公開頁面驗證子程序，只有 release CLI 的 push 子程序收到臨時 HTTP header；push 介面另檢查啟用旗標、main 與所有 push URL，不傳到 build、Hermes 或 Telegram，沒有 GITHUB_TOKEN fallback。App token 使用官方 v3 action，pin `bcd2ba49218906704ab6c1aa796996da409d3eb1`，正常 job 結束預設撤銷。

App 的 contents write 是 repository 級權限，不能由 GitHub 限到文章／journal 路徑。程式路徑白名單只能限制正常 writer；私鑰或可信 main 程式遭改動仍可能修改其他內容。接受此風險或另行採用保護機制是正式授權前提。App commit 保留 `[skip ci]`，避免其 push 再啟動部署／CI，當次 prepare→build→deploy→confirm 及 scheduled/manual recovery 接續處理；不能把人寫 PR 的 CI 當作新 release commit 已跑過 CI。[GitHub token 事件說明](https://docs.github.com/en/actions/concepts/security/github_token)、[App token action](https://github.com/actions/create-github-app-token)、[跳過 workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)。

## 唯讀盤點

以擁有者 gh 登入執行：

```sh
pnpm editorial:unattended:check
```

自動讀取所有 API 分頁，只用 gh api GET 讀 environment、branch policies、repository variables、environment secret **名稱**、rulesets 與公開 App metadata；不讀私鑰、不 mint token、不改 GitHub 設定、不發文／推播。配置缺項／無讀取權限退出 1。配置齊全退出 0 只代表 `configurationReady`，`activationReady` 永遠為 false，列出供應商／人工驗收項目。工具不驗證 App installation 的 repo selection、私鑰有效性、真實 protected-main push、其他保護相容性或 CI 來源；這些仍需受控供應商驗收。盤點採保守的精確 main 規則，不宣稱能分析所有 glob/inherited 組合。

私人 App 的 metadata 可能對目前 gh owner session 回傳 HTTP 404，既有 CMS App 已實際遇到此情況。工具將 metadata 視為缺失，繼續列出其他設定並退出 1；不能為了得到綠燈改成公開 App、使用不明身份或自行 mint token。App 識別／權限須另保留 owner UI 驗收證據，CLI 未就緒不等同 UI 設定錯誤。

## 停止與恢復

- Queue 旗標 false 會停止新 prepare／confirm，但 Actions job 使用已快取旗標，已保留的 published intent 也可能被一般 Pages build 部署。緊急停止必須同時停用 Deploy GitHub Pages workflow、取消 active runs，觀察正在執行的 Pages deployment；已開始的供應商寫入不保證可撤回。這不是瞬時全域 kill switch。正式運作前，停止演練尚未通過時不能啟用。
- 保留 post／manifest／journal、pending identity 與來源 SHA。是否已公開以 RSS＋canonical HTML＋revision 核對，不能刪 pending 來重試。撤回文章須另外授權、一起修復三者並核對部署結果。
- 停止 Hermes 正式 job／live flag、保留 live SQLite，uncertain 必須人工對帳，不能改 DB 路徑或刪資料庫重送。
- 恢復先 ingest，startedAt 不回填舊時段；延遲不是準點失敗，週一／四 07：00 起，只選最新時段、一篇，不補發舊時段。
- 保留既有 CMS／Pages 非原子競爭窗口；不能宣稱無人值守消除了跨服務競爭。拒絕此窗口時須先完成 CMS 共用鎖方案，不能直接啟用。

## 目前真人回報的 Hermes 證據

hermes 帳號、Python `/Users/hermes/.hermes/hermes-agent/venv/bin/python3` 3.11.15、Hermes v0.21.4（2026.9.21）、default profile `/Users/hermes/.hermes`。兩次手動 dry-run exit 0，mode dry-run、initialized true、failures 0、文章數 0，第二次基線未重建。這是擁有者回報，代理沒有讀取私人 runtime DB。

唯一 dry-run job `ea3c550669f1`，script `gcake-rss-dry.sh`、no-agent、deliver local、failure delivery local，首次預定 2026／10／12 01：03（Asia/Taipei）；最後回報於 00：23 尚未執行。**自動排程成功仍待驗收**。此 job 使用獨立 `dry-review-5e16b6e.sqlite`，不是正式 live DB；空 RSS 試跑不是新文章去重或 Telegram 供應商驗收。既有 daemon／getUpdates 未更動。

## 仍需擁有者操作與簽核

- App 安裝 repo selection、最小權限、private key 保管與撤銷；editorial-release／兩組 main ruleset 的實際設定，CMS 寫入相容性決策。
- 另行授權 App protected-main 寫入、正式 Pages 版本、停止／競爭／故障恢復演練；今回不使用六篇正文作供應商測試。
- 簽核六篇內容、原順序、隔離桌面／手機畫面；實體手機／Safari 如需要另測。
- Hermes 第一次自動 dry-run 的 exit code／DB／唯一 job；私人普通 DM 的真實 Telegram 接法、憑證與收訊另行授權，目前隔離 RSS 只接 mock。
- 最後分開批准 PR 合併、正式部署、queue 旗標與唯一 live Hermes job。不要同時保留 dry/live 雙重工作當正式推播來源。

## 本機驗證紀錄

新行為先觀察失敗再修正：App push 憑證／目的地／錯誤保密、子程序 token 隔離、push URL override、直接介面的正式開關與 main、token mint 前完整來源驗證、配置未就緒及跨頁正式旗標。模擬 git／gh 的測試不 mint 真實 token、不對 GitHub 寫入。完整本機 219 項 Node、27 項 Python 通過；check 133 檔零錯誤／警告／提示、build 32 頁、actionlint、Spectra validate 及隔離部署演練通過。六篇正文／章序不變，真實 Telegram 呼叫零。Spectra analyze 僅保留原有四項已完成 task 名稱 coverage 警告，沒有新增一致性／歧義／缺口問題。

實際 gh 唯讀盤點：production disabled 通過，environment／App 身份／main rulesets 六項尚未通過，退出 1 為預期未就緒，不是測試失敗。後續精確 commit 與 CI 以 PR 說明為準。

後續 CMS 相容性補強：先觀察兩個新測試失敗，再修正精確雙 App 例外；完整本機 222 項 Node、27 項 Python 通過，check 133 檔零錯誤／警告／提示，build 32 頁，Spectra validate 通過。沙箱首次禁止 loopback 監聽而造成整合測試環境失敗；允許本機模擬伺服器後完整測試成功，不是真實 Telegram 測試。唯讀 provider 盤點確認正式停用、環境無逐次人工核准、僅 Branch main、禁止強推／刪除四項通過；私鑰／安裝、main review 與私人 App metadata 仍不完整。

後續 GitHub 設定驗收：main integrity（24885806）精確 main、active、deletion／non_fast_forward、bypass 空；main review（24886109）精確 main、active、0 required human approvals、validate 來源 GitHub Actions integration 15368、strict up-to-date true，Always bypass 僅 CMS 5109954 與 editorial 5276010。沒有 classic branch protection（該 API 404），main 的 protected 為 true。Repository EDITORIAL_RELEASE_ENABLED=false；未觸發候選部署、App token mint、內容寫入或 Telegram。CLI 私人 App metadata 仍不可讀，configurationReady=false／activationReady=false，不將 UI 配置驗收當成供應商寫入驗收。main 此時為 f9e8d461（另案 PR ＃10 的正式 CMS OAuth 修正），PR ＃7 尚未合併；正式合併前仍需更新到最新 main 並重新驗證。

## 同步最新 main 的驗收邊界

2026／10／12：同步 f9e8d461，保留 main 的人工 Pages 部署（只有 workflow_dispatch，沒有 push／schedule）。Git journal prepare／confirm 與 CMS D1 佇列均維持停用；兩者是不同發佈權威，不能同時替相同文章安排發佈。正式無人值守 Pages 接法尚未完成，不可因本次同步或 CI 成功啟用。共用 publishing-contract 排程器保留固定承諾，並補入嚴格日期／保留時段驗證；舊 editorial activeSeries 介面透過 adapter 相容，避免續刊順序遺失。六篇正文及 manifest 章序未改。

整合 RED：10 項中 4 項失敗，涵蓋人工 Pages 觸發、非法日期、非法保留時段及既有 active series；修正後 10 項通過。另以 foundation 整合檢查修復新增 job 的 main 限制，保留全部部署 job 都不能在其他分支執行。完整驗證與精確候選 CI 結果見 PR 說明。受控 CMS／App 寫入驗收只使用可回復的驗收草稿／標記，不使用六篇正文，不設定 published，不觸發 Pages 或 Telegram。

同步後完整本機：272 項 Node 測試執行及 31 項 Python 全部通過，check 152 檔零錯誤／警告／提示，build:all（Astro＋全部 workspace）、editorial:rehearse、release:dry-run、Worker production deploy --dry-run、actionlint 與兩份 active Spectra validate 通過。隔離演練六篇正文／閱讀順序保持，真實 Telegram 呼叫零；以上不代表正式部署或供應商寫入驗收。

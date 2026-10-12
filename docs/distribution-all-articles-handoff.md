
## 最新有效政策：2026／10／12 分鐘精度核准

使用者明確核准 Substack 顯示原文時間到分鐘。來源、Pages、Paragraph 保留 11：56：38；Substack 比對同一瞬間所屬分鐘 11：56，不比對平台內部秒數／毫秒。預設精確政策仍有效，只有明確 `displayedDatePrecision=minute` 綁定到 review 與 approval 的 Substack full-mirror 才使用此例外；舊授權不能重用。

正式 Substack 同一 ID 220011124 已保存原日期，重新載入設定為 2026-10-12T11:56；無 Cookie 匿名完整讀回為 2026-10-12T03:56:00.165Z，完整標題／正文／原文連結／平台 canonical 已通過。Paragraph ID J452GmnhN6v4Ooy8mXW8 已 verified。未寄電子郵件或 App 通知，未建立第二篇。原 metadata attempt 延續後結束。

日期控制流程：填入 datetime-local 後，必須用原生鍵盤變更事件確認實際 DOM 值已變更（可定位分鐘分段，上一步／下一步各自等待讀回，再恢復正確分鐘）。不能只信 fill 的畫面。完成後等已儲存，重新載入設定及匿名公開日期。已公開日期在「完成」後即保存，若仍需更新正文，繼續→確認 email／App 與排程都關閉→立即更新；禁止再次發布。日期已正確時 finalize 只匿名讀回，不再寫入。

匿名 Substack HTML 採唯一 verification 查詢避免 CDN 舊頁；仍驗證原公開 URL 的平台 canonical 與完整正文。實際獨立匿名結果見 `.distribution-handoff/live-acceptance-20261012/`。

以下是先前方案及歷史狀態，凡「未公開／待秒級驗收／舊排程 ACTIVE」皆由本節與最終切換紀錄取代。

# 所有正式文章的跨平台同步候選

2026／10／12。使用者最新要求取代單篇限制：所有正式 gcake-dev Markdown 在原文正常公開、匿名完整驗證後，自動同步 Paragraph／Substack；不逐篇詢問，不寄電子郵件或 Substack App 通知。

候選 checkout：`/Users/caiyijun/project/gcake-dev/.spectra/worktrees/distribution-all-articles-20261012`。branch：`codex/all-article-distribution-20261012`。固定整合及來源 commit：`bb241cb375c9d0b05c8301eba6e0d2cae2bab409`。沿用 PR #8 與先前未提交候選，沒有重建平台流程。所有工程仍未提交／推送。

## 本次候選範圍

- `distribution:snapshot`：從 gcake119/gcake-dev 遠端 main 取一次新快照，固定 detached commit。後續 inventory／all-plan／run 都讀同一份乾淨快照。
- `distribution:inventory`：递迴列出全部 Markdown／MDX，以及每份 external generated snapshot 的所有文章。只允許 published、日期已到、Pages 全文／標題／canonical／日期／圖片／連結精確一致的正式 Markdown。MDX、摘要 fallback、非正式聚合、重複 slug、來源錯誤均明確阻擋。
- `distribution:all-plan`：唯讀 D1 狀態、鎖與 checkpoint，產生每篇／每版／每平台／每操作的精確 scope。一般能力旗標仍為 false。單一平台讀取失敗不取消另一平台計畫。
- 相同版本 verified 只有 verify。新版本已公開文章沿用原 ID 做 prepare 更新，再匿名驗證，不再次 publish。未知 create／update／publish／metadata 只恢復原身份；不同版本的未完成意圖阻擋。
- 歷史文章先完整查 draft／published／scheduled／所有分頁。公开全文吻合才採用；衝突文章即使重跑 prepare 仍只讀回，不能覆寫或另建。
- 日期恢復延續原 attempt，publication→metadata 轉換與重啟不會生成第二個意圖。

所有實際寫入仍走既有 `run-distribution.ts`、D1 coordinator、Paragraph 官方 REST 與 Codex cua_repl 側邊交換。每次 provider 寫入和側邊動作之前，重新匿名驗證 Pages。Substack full-mirror 政策保留原文連結，但平台 canonical 指同篇 Substack 文章，不宣稱指向 Pages。

## 本次完整 dry run

固定 main 中有６篇本機 Markdown與１９篇聚合項目，共２５項；不是３０篇正式本機文章。系列總共３０篇不代表目前 snapshot 收錄３０篇。

| 類別 | 數量 | 結果 |
| --- | ---: | --- |
| 正式公開且 Pages 一致 | １ | 第一篇可進行首次受控驗收 |
| 正式來源尚未 published | ５ | 排除，維持正常原文發布順序 |
| 外部聚合 | １９ | 來源阻擋，不能用 snapshot／摘要代替正式 Markdown全文 |

第一篇：〈我是怎麼跟 ChatGPT 協作寫完 30 篇系列文的〉，`ithome-2026-chatgpt-writing-workflow`。正式原文時間：2026／10／12 11：56：38（Asia／Taipei）。版本：`sha256:ba1e53cbadcd3766141cb7f1f970a36b52187647844ef39938d15bdd62aeaa57`。匿名核對完整正文、標題、canonical、精確時間、連結與圖片已通過。

另５篇：`ithome-2026-publishing-toolchain`、`ithome-2026-astro-choice`、`ithome-2026-publishing-in-production`、`ithome-2026-tech-blog-boundary`、`ithome-2026-template-hardening`，皆未 published。第４篇仍 ready／無日期；不得回復誤發版。第２篇既有 10／15 07：00起的原文排程不受本候選影響。

詳列每項的來源與阻擋：`.distribution-handoff/all-articles-20261012/inventory.json`。正式唯讀證據：同目錄 `live-readonly-audit.json`。這兩份是本次快照，不能替代下一輪新驗證。

## 第一篇受控首次驗收方案

已生成零寫入計畫：`/private/tmp/gcake-final-all-plans-20261012/all-plan.json`，同目錄 `run-e6WcqR/` 是兩平台 review、prepare／publish 精確授權及 scoped config。這是可執行計畫，尚未執行 provider 寫入。不能拿這輪 source root 或 review 長期重播。

１．重新核對候選 pin、取得新的 fixed main snapshot、匿名讀 Pages。重新讀全部 D1 locks／checkpoints／未結束 attempts。先停止舊 heartbeat，再核對原程序已停止及 D1 無在途操作；不能同時有兩個 writer。
２．首次只執行第一篇 scope；不歷史批量發布。Paragraph 四種狀態完整查找及 me刊物 gcake身分核對已做唯讀查核；正式 prepare 必須保存完整草稿、canonical及原日期，publish前再次重讀，正式公開獨立讀回才 verified。
３．Substack 已登入，已發佈０、已排程０、草稿１；草稿只有診斷篇 `219884438`，不得編輯或刪除。首次 prepare從 shared D1 intent交換接手，完整查找後只建立一篇，保存 ID，貼受審 HTML，再重新載入讀回全部正文、links、images及 saved。
４．確認電子郵件／App傳送未勾選，沒有排程，網站公開只按一次。首次實際公開後從可見 DOM觀察唯一 publicTitle／publicBody／publicDate，寫入本輪 config，匿名 GET由 CLI獨立比對。缺少唯一 selector、全文、圖片或原日期精度就保留同 ID／checkpoint並停止。
５．原日期恢復只有在同篇完整匿名公開證據相符後操作；11：56：38精確時間不可自行降成分鐘或日期。能力不足須報告，不能改驗收或再發布。Substack平台 canonical例外須如實記錄。兩平台各自成功，不為單邊失敗撤回另一邊。

目前仍未完成正式 prepare／publish與公開讀回驗收。Substack實際公開DOM、原日期控制及秒級精度、圖片重新託管是否維持精確證據仍須首次受控流程取得。側邊登入目前有效，不需要重新提供憑證。

## 通用排程的正式交接

舊 heartbeat `pages-paragraph-substack` 仍 ACTIVE、每１５分鐘，只處理第４篇；舊 runtime釘選逐檔檢查全部一致。沒有更新舊政策、旧 runtime-sha256.json或建立競爭的 automation。

準備用新政策：`docs/distribution-general-config.example.json`，預設 unattended.enabled=false。已準備測試政策 `/private/tmp/gcake-general-policy-candidate-20261012.json`，僅生成本輪計畫，未安裝至現行私人政策。憑證沿用原 Git外 credentials.env，只由 Node --env-file載入；不要讀回或複製。

正式切換順序：保存舊政策與 pin→再次唯讀確認全部在途→用 automation_update更新同一 heartbeat為暫停→确认舊 writer已停止／D1無鎖→安裝候選的新 pin及政策→以第一篇完成受控公開驗收→更新同一 heartbeat的 prompt與目標對話→啟用通用範圍。不要另建排程。未完成驗收時保持新排程停用。rollback只停用寫入並保留 D1身份，不刪文章或重放意圖。

每輪排程：`distribution:snapshot <fresh-private-source>`→`distribution:all-plan <fixed-source-root> <private-policy> <private-output>`→依每篇 run.json逐平台執行精確 command。`retry`與`verify`只讀回；metadata checkpoint需要同 ID完整匿名驗證後，單独產生 finalize授權，不能重做publish。新版本遇到舊 checkpoint必須停下來，不能用新run繞過。

例行無變化保持安靜，只通知首次同步完成、失败、未知結果或需人工處理的具體阻擋。沒有正式切換、提交／推送、合併PR #8或部署原文。

## 審查與驗證

規格已在既有 complete-cross-platform-distribution補上通用 requirement與Given／When／Then，再產生11.x tasks。保留先前完成紀錄；6.3正式平台驗收仍未完成。

新增真實RED→GREEN：多文章盤點及精確政策、通用scope、已公開同ID更新、未知更新讀回、歷史衝突重跑防護、D1 metadata原attempt恢復、Paragraph官方me回應結構。完整分頁、圖片／連結／canonical／日期與部分平台失敗沿用既有 acceptance／browser fixtures。正式Paragraph回應證明刊物slug位於頂層，已修正錯讀publication.slug；一般provider能力仍未宣告verified。

本機通過與正式平台驗收分開，完整 gate與候選檔案hash見驗證證據檔。沒有 Docker資源或保留的測試伺服器。

最終驗證：360 Node tests、31 Python tests全通過；182-file TypeScript／Astro為0 errors／warnings／hints；網站＋五工作區build、完整release:dry-run（實際故障／同ID恢復／正文與順序不變）、git diff --check及Spectra validate／analyze通過。最後log已保存於`.distribution-handoff/all-articles-20261012/`。路徑搬入候選checkout時，發布模擬曾把`distribution`名稱誤當`dist`而漏複製來源；已恢復精確相對路徑segment檢查，補外層finally清理，並在最終實際路徑重跑通過。這個失敗屬測試工具問題，未拿來宣稱跨平台產品RED。

Decision context：Level 2，來源為本次使用者授權、既有controlled-distribution／publishing-operations規格、PR #8與兩份原runbook。docs/decisions未初始化；本次持久流程決策已補既有Spectra，不另外建平行規格。未提交，因此不宣稱已完成commit／archive。

候選runtime逐檔pin及停用中的正式切換資料放`/private/tmp/gcake-all-handover-20261012/`；沒有覆盖現行Application Support/gcake-distribution。`validation.json`记录本機與正式唯讀證據邊界。首次正式能力驗收與heartbeat切換仍待执行，21項tasks中6.3保持未完成。

通用metadata恢復計畫已由回歸測試確認：同版同ID且已有metadata checkpoint時，run.json另列finalize recovery；沒有其他create／publish授權。實際finalize仍先匿名確認同篇全文與原文連結。正式切換候選政策unattended.enabled=false，私人的測試政策只用於本次零寫入scope產生。

## 最終切換紀錄

2026／10／12兩平台正式匿名驗收通過，完整本機測試362 Node＋31 Python、182 files 0 errors／warnings／hints、build:all及release:dry-run通過。全D1鎖／checkpoint／未完成意圖皆0，同版重跑只有verify。原 heartbeat pages-paragraph-substack 以相同15分鐘頻率切換本對話及所有正式Markdown政策；新獨立安裝目錄為 Application Support/gcake-distribution/all-articles-20261012，舊政策與pin保留供回復。安裝與啟用證據存Git外及live-acceptance。

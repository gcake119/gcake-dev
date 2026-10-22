# 2026／10／22 分層驗收

後台正式版 f2bead75-bf5c-470b-9edb-902c7be66ff6 已由 Chrome 實際部署資產及兩個 GET 端點驗收，皆 200／no-store。原 ID 221098688 的原定台北 07：00、實際 07：01：02.155、晚 62.155 秒分開呈現。完整 ID／slug／canonical／Git 內容已由第 147 自然輪次驗證，未重新發布、排程或寄送訂閱者。

第 147 輪次的其他兩篇草稿讀取失敗仍保留，但不再阻擋本篇成功事件。第 148 輪次證明 producer 替換新快照的明確 Hermes read ACL 生效；之後於 sender 前的選用版本檢查停止。原 unknown 事件 6 保留，未自動重送。

根因：既有通知 daemon 釘選 f36ad05d，正式選用／ready gate 已為 4fe889d。原 consumer 精確 SHA256 與早於事件的 root-owned 設定證明會在 import／credential／transport 前拒絕。新版在建立 intent 前預檢，sender 前再檢；僅型別明確的傳送前拒絕可記為 not_sent。歷史 unknown 需管理員驗證原件後追加對帳，原列不改；Timeout／ACK／其他未知維持禁止重送。

管理員版本修正首次執行在 selected-runtime-access 預檢停止，尚未修改帳本、daemon 或 consumer；待實際 Hermes 帳戶階段診斷。最終自然輪次成功 ACK 尚未取得，不宣稱完成。新建與排程寫入仍停用，發文 timer／Hermes gateway 未重載。

凍結候選以 Node 24 的 check／test／build:all／release:dry-run／editorial:rehearse 全通過，來源雜湊在執行期間無變動；Hermes 23 項聚焦驗收於選用 Python 3.11 亦通過。較早候選的原有 updater test 曾發生 10 秒子程序逾時；保留失敗及未重現診斷，不將後續通過稱為根因修復。主工作樹原 65 份未提交檔案雜湊均保留。

Pages、Substack 公開驗證、Hermes ACK、訂閱者平台寄送及真人實收彼此獨立。寄送與真人實收仍 unknown，原排程試行 5.3 不提前勾選。詳見 [機器可讀驗收狀態](production-acceptance-20261022.json)。

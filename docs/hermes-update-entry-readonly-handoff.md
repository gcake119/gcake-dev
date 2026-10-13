> 歷史規劃／交接紀錄。文中 `/private/tmp` staging 已清除，不能再照舊命令執行；最新狀態與正式導入紀錄見 [hermes-production-rollout.md](hermes-production-rollout.md)。

# 給 Hermes 的唯讀覆核訊息

以下可由使用者自行轉貼；Codex 沒有發送 Telegram。此訊息不要求 Hermes 取代主使用者的 root 驗證。

---

請協助唯讀覆核 gcake 的 Hermes 更新入口隔離實作，先回報問題與證據，不修改檔案、不部署、不改正式 job、不連 Telegram／其他平台、不 commit／push，也不要自行 sudo 或提權。

審閱範圍：

- `/private/tmp/gcake-hermes-monitor-plan-20261012/scripts/hermes/update_entry.py`
- `/private/tmp/gcake-hermes-monitor-plan-20261012/scripts/hermes/verify_update_entry_privileged.py`
- `/private/tmp/gcake-hermes-monitor-plan-20261012/openspec/changes/add-hermes-publication-monitor/specs/hermes-update-entry-integration/spec.md`
- `/private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-monitor-evidence/README.md`

重點：root 是否獨占版本／核准／selector 寫入權；hermes 是否只讀並持有整輪共享鎖；更新中斷後是否先完整回復再啟動唯一 supervisor；回復是否保留最新 sent／unknown，不回復舊通知歷史；驗證腳本是否只操作唯一的隔離 test label，並正確清理。

完整 Python 3.11.15 CLI gateway／wrapper／runtime 回復已在隔離環境通過。root／hermes 與實際 launchd 探針必須依主使用者提供的 JSON 判定，不能由同一 UID 測試推論通過。先前 sandbox 啟動失敗屬驗證環境問題，已重現為 Python SIGABRT，修正後同一 UID 探針可讀版本／取得 lease，且 TCP／控制檔寫入被拒絕。

請區分「觀察到的問題」、「推測」與「尚未驗證」。檔案無權限讀取時只回報路徑與錯誤類型，不讀正式 env、憑證、job 或 DB，也不自行擴大查核範圍。

> 歷史規劃／交接紀錄。文中 `/private/tmp` staging 已清除，不能再照舊命令執行；最新狀態與正式導入紀錄見 [hermes-production-rollout.md](hermes-production-rollout.md)。

# 給 Hermes 的合併隔離驗證訊息

請協助 gcake 的完整隔離驗證，範圍是：真正 root／hermes 權限、唯一的測試 LaunchDaemon、完整 Python 3.11.15 Hermes CLI、真實 scheduler／wrapper／execution context、中斷回復，以及沿用 synthetic 舊狀態不重送。

唯一的執行命令是：

```sh
/bin/bash /private/tmp/gcake-hermes-monitor-plan-20261012/scripts/hermes/run-combined-gateway-owner.sh
```

它會核對 driver／模組／prepared manifest 摘要，使用 `/private/tmp/gcake-entry-combined-*` owned root 與 `system/local.gcake.hermes-test.<唯一識別>`，並由同一腳本清理。可能需要１５至２５分鐘；將最後 JSON（不含秘密）回傳即可。進度在 stderr，JSON 在 stdout。

這一步需要已授權的 root 執行權限。若 sudo 需要主使用者密碼、不可用，或命令檔沒有讀取權限，只回報具體阻擋，交回主使用者執行；不要更改 sudoers、帳號、檔案權限，或改用同一 UID／假 gateway 當作通過。若已由主使用者啟動，請勿再啟動第二份。

不部署、不修改正式 job／plist／gateway、不讀正式 env／credential／DB，不連正式 Telegram，不 commit／push。所有通知只走測試 transport，網路與正式 home 由 sandbox 封鎖。失敗時保留腳本回傳的診斷／cleanup 結果，不自行補 patch、擴權或重跑正式服務。

Codex 尚未傳送此訊息；由使用者決定是否轉貼。

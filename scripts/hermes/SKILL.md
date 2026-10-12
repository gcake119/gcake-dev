---
name: gcake-editorial-rss
description: Verify new gcake blog articles and deliver one Telegram success notification from a private persistent outbox.
---

Run the installed rss_monitor.py deterministically once per hourly job under the Hermes OS account. The operator must resolve the installed Python/script path in that account. Use dry-run until acceptance; live requires --live, HERMES_RSS_NOTIFY_ENABLED=true and private TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID. Never put credentials in a prompt or repository.

Do not create a second Telegram getUpdates poller. Only sendMessage is used by this program. One live job and one stable live SQLite database are required. The first successful feed poll silently initializes history. A new canonical local URL requires valid RSS plus successfully fetched canonical HTML before delivery. Do not send a separate conversational message on every check; unchanged states stay quiet.

Do not infer publication from Git, workflow success, planned date or feed outage. A failed check is monitoring unavailable, not proven publishing failure. Honor the program's persistent backoff. Preserve uncertain delivery rows and report operator action; never delete state or resend automatically after an ambiguous Telegram result. Keep dry-run and live state separate, and preserve state across upgrades/restarts.

Use --status for private reconciliation. Do not modify blog content, queue flags, GitHub settings or Hermes supervisors as part of monitoring.

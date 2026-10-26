#!/bin/bash
set -euo pipefail
task_dir=/Users/caiyijun/project/gcake-dev/output/discovery/hermes-archive-20261026
timestamp_dir=/Users/caiyijun/project/gcake-dev/output/discovery/original-site-times-20261026
bash /private/tmp/gcake-retired-archive-20261026/owner_archive.sh archive | tee "$task_dir/archive-result.json"
/usr/bin/python3 -I -B -S -c 'import json,sys; v=json.load(open(sys.argv[1])); assert v["status"]=="archived" and v["restore_controls_preserved"] and v["capacity"]["ready"]' "$task_dir/archive-result.json"
bash /private/tmp/gcake-original-site-times-20261026/owner_adopt.sh | tee "$timestamp_dir/owner-adoption-after-archive.json"
/usr/bin/python3 -I -B -S -c 'import json,sys; v=json.load(open(sys.argv[1])); assert v["status"]=="active-live" and v["notification_history_unchanged"] and v["job_unchanged"]' "$timestamp_dir/owner-adoption-after-archive.json"
/usr/local/share/gcake-hermes-runtime/releases/fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54/runtime/bin/python3.11 -I -B -S "$timestamp_dir/read-installed.py" | tee "$timestamp_dir/installed-readback.json"

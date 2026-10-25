#!/usr/bin/env bash
# Work item migrate-gcake-dev-ci-to-mint. No provider writes or runner sudo.
set -euo pipefail
mode=${1:-prepare}
[[ $mode == prepare || $mode == browser || $mode == fixtures ]] || { echo CI_PREPARE_MODE >&2; exit 64; }
case ${RUNNER_ENVIRONMENT:-} in
  self-hosted)
    [[ $(id -un) == ci-runner ]] || { echo MINT_CI_ACCOUNT >&2; exit 1; }
    uid=$(id -u)
    [[ ${DOCKER_HOST:-} == "unix:///run/user/$uid/docker.sock" ]] || { echo MINT_CI_DOCKER_SOCKET >&2; exit 1; }
    [[ ${GITHUB_REPOSITORY:-} == gcake119/gcake-dev && ${RUNNER_NAME:-} == mint-gcake-dev ]] || { echo MINT_CI_IDENTITY >&2; exit 1; }
    [[ -S /run/user/$uid/docker.sock ]] || { echo MINT_CI_DOCKER_UNAVAILABLE >&2; exit 1; }
    docker info --format '{{range .SecurityOptions}}{{println .}}{{end}}' | grep -Fx name=rootless >/dev/null || { echo MINT_CI_ROOTLESS >&2; exit 1; }
    cache=/var/lib/github-runner/toolcache
    [[ -f $cache/node/24.22.1/x64.complete && -x /opt/google/chrome/chrome ]] || { echo MINT_CI_TOOLS >&2; exit 1; }
    [[ $(findmnt -nr -o TARGET --target /private) == /private && $(findmnt -nr -o FSTYPE --target /private) == tmpfs ]] || { echo MINT_CI_PRIVATE_MOUNT >&2; exit 1; }
    python3 -c "import shutil; raise SystemExit(0 if shutil.disk_usage('/private').free>4*1024**3 else 1)" || { echo MINT_CI_FIXTURE_SPACE >&2; exit 1; }
    ;;
  github-hosted) ;;
  *) echo CI_RUNNER_ENVIRONMENT >&2; exit 1;;
esac
case $mode in
  prepare)
    [[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ && ${GITHUB_JOB:-} =~ ^[A-Za-z0-9_-]+$ && -d ${RUNNER_TEMP:-} ]] || { echo CI_JOB_IDENTITY >&2; exit 1; }
    if [[ $RUNNER_ENVIRONMENT == self-hosted ]]; then
      job_tmp="$RUNNER_TEMP/gcake-tmp-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-${GITHUB_JOB}"
      mkdir -m 0700 "$job_tmp"
      [[ $(stat -c '%d' "$job_tmp") == $(stat -c '%d' "${GITHUB_WORKSPACE:?}") ]] || { echo MINT_CI_TMP_DEVICE >&2; exit 1; }
    fi
    {
      if [[ $RUNNER_ENVIRONMENT == self-hosted ]]; then
        echo "TMPDIR=$job_tmp"
        echo "RUNNER_TOOL_CACHE=$cache"
        echo "AGENT_TOOLSDIRECTORY=$cache"
      fi
      echo "npm_config_store_dir=$RUNNER_TEMP/gcake-store-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-${GITHUB_JOB}"
    } >> "${GITHUB_ENV:?}"
    ;;
  browser)
    if [[ $RUNNER_ENVIRONMENT == self-hosted ]]; then /opt/google/chrome/chrome --version
    else pnpm exec playwright install --with-deps chrome; fi
    ;;
  fixtures)
    if [[ $RUNNER_ENVIRONMENT == self-hosted ]]; then
      [[ ! -L /private/tmp ]] || { echo MINT_CI_FIXTURE_SYMLINK >&2; exit 1; }
      if [[ ! -e /private/tmp ]]; then mkdir -m 0700 /private/tmp; fi
      [[ -d /private/tmp && $(stat -c '%u:%a' /private/tmp) == "$uid:700" ]] || { echo MINT_CI_FIXTURE_PERMISSIONS >&2; exit 1; }
    else sudo install -d -m 1777 /private/tmp; fi
    ;;
esac

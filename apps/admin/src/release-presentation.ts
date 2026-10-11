const labels: Record<string, string> = {
  'waiting-eligibility': '待排程',
  queued: '已排程',
  'committed-slot': '時段已鎖定',
  publishing: '發布中',
  'awaiting-verification': '待公開確認',
  'verified-public': '已公開驗證',
  failed: '發布失敗',
  'verification-unknown': '驗證異常',
  paused: '已暫停',
};
export const releaseLabel = (state: string) => labels[state] ?? state;
export function releaseEstimate(at?: string, locked = false) {
  if (!at) return '尚無預計時段';
  return (
    (locked ? '鎖定 ' : '預計 ') +
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(at)) +
    ' 起'
  );
}
export function seriesProgress(manifest: { sections: readonly { posts: readonly { status: string }[] }[] }) {
  const posts = manifest.sections.flatMap((s) => s.posts);
  return {
    ready: posts.filter((p) => ['ready', 'published'].includes(p.status)).length,
    published: posts.filter((p) => p.status === 'published').length,
    total: posts.length,
  };
}
export const eligibilityReason = (code?: string) =>
  ({
    PAUSED: '已暫停',
    SERIES_PREDECESSOR_HELD: '前一篇尚未恢復候選資格，後續篇目暫緩。',
    INCOMPLETE_SERIES: '系列尚未完整定稿，或檔案與狀態不一致。',
    LEGACY_SCHEDULE_REQUIRES_ADOPTION: '保留舊日期；請明確選擇自動排程後才納入候選。',
    MISSED_FIXED_SLOT: '固定時段已錯過，請取消固定並重新預覽。',
  })[code ?? ''] ??
  code ??
  '符合候選資格';

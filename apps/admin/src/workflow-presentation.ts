/** Presentation only: repository and provider values remain unchanged. */
export function contentStatusLabel(status?: string): string {
  return ({draft:'草稿',ready:'已定稿',published:'文章已標記公開'} as Record<string,string>)[status ?? ''] ?? '狀態待確認';
}
export function publicationStatusLabel(status?: string): string {
  return ({not_configured:'尚未設定',manual_required:'需人工處理',queued:'等待處理',running:'處理中',pending:'等待處理',
    deployed:'網站已更新，公開仍待確認',building:'正在準備網站',published:'待確認公開結果',verified:'已確認公開', 'verified-public':'已確認公開',failed:'處理未完成',unknown:'狀態待確認',
    'verification-unknown':'公開結果待確認', 'awaiting-verification':'待確認公開結果', cancelled:'已取消'} as Record<string,string>)[status ?? ''] ?? '狀態待確認';
}
export function previewStatusLabel(status?: string): string {
  return ({queued:'等待準備',running:'正在準備',ready:'可以查看',failed:'準備失敗，請重試',expired:'預覽已到期，請重新建立'} as Record<string,string>)[status ?? ''] ?? '狀態待確認';
}
export function safeMessage(value: unknown, fallback = '操作未完成，請稍後再試。'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (/ARTICLE_CONFLICT|SERIES_CONFLICT|GIT_CONFLICT|版本衝突|內容已更新|偵測到.*衝突/.test(value)) return '內容已有更新，尚未覆蓋任何版本。請保留目前修改，再比較較新的內容。';
  if (/MISSED_FIXED_SLOT/.test(value)) return '原定時間已過，請重新選擇發布時間。';
  if (/INCOMPLETE_SERIES/.test(value)) return '系列尚未全部定稿，請先完成待處理的文章。';
  if (/ELIGIBILITY_CHANGED/.test(value)) return '排程條件已有變動，請重新查看文章狀態。';
  if (/SQL|(?:SHA|revision|commit|blob|manifest|TypeError|fetch|HTTP|[A-Z]+_[A-Z_]+)/.test(value)) return fallback;
  return value.replaceAll('儲存至 Git','儲存文章').replaceAll('儲存 Git','儲存文章').replaceAll('GitHub 版本','較新版本')
    .replaceAll('系列 YAML','系列設定').replaceAll('Markdown','原文').replaceAll('slug','網址代稱').replaceAll('GitHub 內容','文章內容')
    .replaceAll('R2 媒體','圖片檔案').replaceAll('正式 Astro 預覽','網站預覽').replaceAll('候選資格','排程條件');
}

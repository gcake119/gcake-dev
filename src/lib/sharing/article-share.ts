/** Invoke sharing directly from activation so the browser retains user intent. */
export function initArticleShare(root: HTMLElement, browser: Pick<Navigator, 'share'> = navigator): void {
  const share = root.querySelector<HTMLButtonElement>('[data-share]')!;
  const status = root.querySelector<HTMLElement>('[data-share-status]')!;
  const recovery = root.querySelector<HTMLElement>('[data-share-recovery]')!;
  const url = root.dataset.url!;
  const title = root.dataset.title!;
  let pending = false;
  const supported = typeof browser.share === 'function';
  root.querySelector<HTMLElement>('[data-share-actions]')!.hidden = !supported;
  share.hidden = !supported;
  if (!supported) {
    recovery.hidden = false;
    status.textContent = '此瀏覽器不支援分享，請手動複製下方連結';
  }
  share.addEventListener('click', async () => {
    if (pending || !supported) return;
    pending = true;
    status.textContent = '';
    recovery.hidden = true;
    share.disabled = true;
    try {
      await browser.share({ title, url });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')) {
        status.textContent = '無法開啟分享，請手動複製下方連結';
        recovery.hidden = false;
      }
    } finally {
      pending = false;
      share.disabled = false;
    }
  });
}

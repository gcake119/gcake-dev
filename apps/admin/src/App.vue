<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type {
  ApiErrorResponse,
  DeploymentObservation,
  PostSource,
  PostSummary,
  SeriesSource,
  SessionResponse,
  MediaRecord,
  PreviewJob,
  PublicationOperation,
  PublicationTarget,
  PublicationTargetState,
} from '@gcake/admin-contract';
import { deploymentPresentation } from './deployment';
import { renderImmediatePreview, type EditorView } from './editor-state';
import { applyTaipeiSchedule, readScheduleFields, schedulePresentation } from './scheduling';
import {
  moveSeriesPost,
  parseSeriesManifest,
  serializeSeriesManifest,
  type AdminSeriesManifest,
} from './series-editor';

type ViewState = 'loading' | 'signed-out' | 'ready' | 'error';
type WorkspaceMode = 'overview' | 'post' | 'series';

const state = ref<ViewState>('loading');
const session = ref<SessionResponse>({ authenticated: false });
const posts = ref<readonly PostSummary[]>([]);
const series = ref<readonly SeriesSource[]>([]);
const deployment = ref<DeploymentObservation>();
const message = ref('');
const dark = ref(false);
const workspaceMode = ref<WorkspaceMode>('overview');
const selectedPost = ref<PostSource>();
const selectedSeries = ref<SeriesSource>();
const seriesManifest = ref<AdminSeriesManifest>();
const seriesDirty = ref(false);
const seriesMessage = ref('');
const draggedSeriesPost = ref<{ sectionId: string; index: number }>();
const editorSource = ref('');
const scheduleDate = ref('');
const scheduleTime = ref('09:00');
const editorView = ref<EditorView>('markdown');
const splitRatio = ref(50);
const syncScroll = ref(true);
const editorMessage = ref('');
const formalPreview = ref<PreviewJob>();
const formalPreviewMessage = ref('');
const publicationStates = ref<readonly PublicationTargetState[]>([]);
const publicationMessage = ref('');
const recoveryConflict = ref<{ draft: string; repository: string; detail?: string }>();
const sourceElement = ref<HTMLTextAreaElement>();
const previewElement = ref<HTMLElement>();
const mediaOpen = ref(false);
const media = ref<readonly MediaRecord[]>([]);
const mediaSearch = ref('');
const mediaMessage = ref('');
const selectedMedia = ref<MediaRecord>();
const pickerElement = ref<HTMLInputElement>();
const replaceElement = ref<HTMLInputElement>();
let synchronizingScroll = false;

const deploymentStatus = computed(() => deployment.value
  ? deploymentPresentation(deployment.value.state)
  : undefined);
const preview = computed(() => renderImmediatePreview(editorSource.value));
const activeSchedule = computed(() => {
  const fields = readScheduleFields(editorSource.value);
  if (!fields) return undefined;
  try {
    return schedulePresentation(`${fields.date}T${fields.time}:00+08:00`, deployment.value);
  } catch {
    return undefined;
  }
});
const nextViewLabel = computed(() => editorView.value === 'markdown'
  ? '切換至預覽'
  : editorView.value === 'rendered' ? '切換至分割' : '切換至 Markdown');

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' });
  const value = await response.json() as T | ApiErrorResponse;
  if (!response.ok) {
    const error = value as ApiErrorResponse;
    throw new Error(error.error?.message ?? '目前無法載入資料。');
  }
  return value as T;
}

async function loadAdmin(): Promise<void> {
  state.value = 'loading';
  message.value = '';
  try {
    session.value = await readJson<SessionResponse>('/api/v1/auth/session');
    if (!session.value.authenticated) {
      state.value = 'signed-out';
      return;
    }
    const [postResult, seriesResult, deploymentResult] = await Promise.all([
      readJson<{ posts: readonly PostSummary[] }>('/api/v1/posts'),
      readJson<{ series: readonly SeriesSource[] }>('/api/v1/series'),
      readJson<{ deployment?: DeploymentObservation }>('/api/v1/github/deployments/latest'),
    ]);
    posts.value = postResult.posts;
    series.value = seriesResult.series;
    deployment.value = deploymentResult.deployment;
    state.value = 'ready';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '目前無法載入資料。';
    state.value = 'error';
  }
}

async function loadMedia(): Promise<void> {
  try {
    const result = await readJson<{ media: readonly MediaRecord[] }>(`/api/v1/media?q=${encodeURIComponent(mediaSearch.value)}`);
    media.value = result.media;
  } catch (error) {
    mediaMessage.value = error instanceof Error ? error.message : '無法載入媒體。';
  }
}

async function openMediaLibrary(): Promise<void> {
  mediaOpen.value = true;
  await loadMedia();
}

async function imageDimensions(file: File): Promise<{ file: File; width: number; height: number }> {
  if (file.type === 'image/svg+xml') {
    const source = await file.text();
    const documentValue = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    const viewBox = documentValue.getAttribute('viewBox')?.split(/\s+/).map(Number);
    const width = Number(documentValue.getAttribute('width')) || viewBox?.[2] || 1;
    const height = Number(documentValue.getAttribute('height')) || viewBox?.[3] || 1;
    return { file, width, height };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return { file, width: bitmap.width, height: bitmap.height };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('圖片轉換失敗。')),
    'image/webp',
    0.86,
  ));
  return { file: new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }), width: canvas.width, height: canvas.height };
}

async function uploadSelectedFile(file: File, replaceId?: string): Promise<MediaRecord | undefined> {
  if (!selectedPost.value || !session.value.authenticated) {
    mediaMessage.value = '請先開啟要插入媒體的文章。';
    return undefined;
  }
  try {
    const processed = await imageDimensions(file);
    const form = new FormData();
    form.set('slug', selectedPost.value.slug);
    form.set('width', String(processed.width));
    form.set('height', String(processed.height));
    form.set('file', processed.file);
    const path = replaceId ? `/api/v1/media/${replaceId}/replace` : '/api/v1/media';
    const response = await fetch(path, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'x-csrf-token': session.value.csrfToken }, body: form,
    });
    const result = await response.json() as MediaRecord | ApiErrorResponse;
    if (!response.ok) throw new Error((result as ApiErrorResponse).error.message);
    const uploaded = result as MediaRecord;
    selectedMedia.value = uploaded;
    mediaMessage.value = replaceId ? '替代圖片已建立新網址；舊網址仍保留。' : '媒體已上傳，可以插入 Markdown。';
    await loadMedia();
    return uploaded;
  } catch (error) {
    mediaMessage.value = error instanceof Error ? error.message : '媒體上傳失敗。';
    return undefined;
  }
}

async function onFileChange(event: Event, replaceId?: string): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await uploadSelectedFile(file, replaceId);
  input.value = '';
}

async function onEditorPaste(event: ClipboardEvent): Promise<void> {
  const file = [...(event.clipboardData?.files ?? [])].find((candidate) => candidate.type.startsWith('image/'));
  if (!file) return;
  event.preventDefault();
  const uploaded = await uploadSelectedFile(file);
  if (uploaded) insertMedia(uploaded);
}

async function onEditorDrop(event: DragEvent): Promise<void> {
  const file = [...(event.dataTransfer?.files ?? [])].find((candidate) => candidate.type.startsWith('image/'));
  if (file) {
    const uploaded = await uploadSelectedFile(file);
    if (uploaded) insertMedia(uploaded);
  }
}

function insertMedia(record: MediaRecord): void {
  const alt = record.key.split('/').pop()?.replace(/^[^-]+-|\.[^.]+$/g, '') ?? '圖片';
  const markdown = `![${alt}](${record.url})`;
  editorSource.value = `${editorSource.value}${editorSource.value.endsWith('\n') ? '' : '\n\n'}${markdown}\n`;
  mediaMessage.value = '已插入 Markdown；文章 alt 文字仍以 Markdown 為準。';
  mediaOpen.value = false;
}

async function copyMediaUrl(record: MediaRecord): Promise<void> {
  await navigator.clipboard.writeText(record.url);
  mediaMessage.value = '媒體網址已複製。';
}

async function inspectUsage(record: MediaRecord): Promise<void> {
  const result = await readJson<{ usages: readonly string[] }>(`/api/v1/media/${record.id}/usage`);
  mediaMessage.value = result.usages.length ? `使用位置：${result.usages.join('、')}` : '目前未在文章中找到使用位置。';
}

async function deleteSelectedMedia(record: MediaRecord): Promise<void> {
  if (!session.value.authenticated || !window.confirm(`確定刪除 ${record.key}？`)) return;
  const response = await fetch(`/api/v1/media/${record.id}`, {
    method: 'DELETE', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({ confirmed: true }),
  });
  const result = await response.json() as { error?: { message?: string; details?: { usages?: string[] } } };
  mediaMessage.value = response.ok
    ? '未使用媒體已刪除。'
    : `${result.error?.message ?? '無法刪除媒體。'}${result.error?.details?.usages?.length ? ` 使用位置：${result.error.details.usages.join('、')}` : ''}`;
  await loadMedia();
}

function toggleTheme(): void {
  dark.value = !dark.value;
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light';
  localStorage.setItem('gcake-theme', dark.value ? 'dark' : 'light');
}

function initializeTheme(): void {
  const stored = localStorage.getItem('gcake-theme');
  dark.value = stored === 'dark'
    || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light';
}

function cycleEditorView(): void {
  editorView.value = editorView.value === 'markdown'
    ? 'rendered'
    : editorView.value === 'rendered' ? 'split' : 'markdown';
}

async function openPost(slug: string): Promise<void> {
  try {
    const post = await readJson<PostSource>(`/api/v1/posts/${slug}`);
    selectedPost.value = post;
    const key = `gcake:draft:gcake119/gcake-dev:${slug}:${post.baseBlobSha}`;
    const draft = localStorage.getItem(key);
    const prefix = `gcake:draft:gcake119/gcake-dev:${slug}:`;
    const staleKey = Object.keys(localStorage).find((candidate) => candidate.startsWith(prefix) && candidate !== key);
    const staleDraft = staleKey ? localStorage.getItem(staleKey) : null;
    recoveryConflict.value = staleDraft
      ? { draft: staleDraft, repository: post.source, detail: '瀏覽器草稿來自較舊的 Git 修訂版。' }
      : undefined;
    editorSource.value = draft ?? post.source;
    const schedule = readScheduleFields(editorSource.value);
    scheduleDate.value = schedule?.date ?? '';
    scheduleTime.value = schedule?.time ?? '09:00';
    splitRatio.value = Number(localStorage.getItem('gcake:editor:split-ratio') ?? 50);
    syncScroll.value = localStorage.getItem('gcake:editor:sync-scroll') !== 'false';
    editorMessage.value = staleDraft
      ? 'GitHub 內容已有更新；未自動套用舊草稿。請選擇復原方式。'
      : draft ? '已復原這個修訂版的瀏覽器草稿；尚未儲存至 Git。' : '';
    await loadPublicationStates(post);
    workspaceMode.value = 'post';
  } catch (error) {
    editorMessage.value = error instanceof Error ? error.message : '無法開啟文章。';
  }
}

async function loadPublicationStates(post = selectedPost.value): Promise<void> {
  if (!post) return;
  try {
    const result = await readJson<{ states: readonly PublicationTargetState[] }>(`/api/v1/publications/${post.slug}?sourceRevision=${encodeURIComponent(post.baseCommitSha)}`);
    publicationStates.value = result.states;
  } catch (error) {
    publicationMessage.value = error instanceof Error ? error.message : '無法載入發佈狀態。';
  }
}

function targetState(target: PublicationTarget): PublicationTargetState | undefined {
  return publicationStates.value.find((stateValue) => stateValue.target === target);
}

async function publicationOperation(target: PublicationTarget, operation: PublicationOperation): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  const response = await fetch(`/api/v1/publications/${selectedPost.value.slug}/operations`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({ sourceRevision: selectedPost.value.baseCommitSha, target, operation }),
  });
  const result = await response.json() as PublicationTargetState | ApiErrorResponse;
  if (!response.ok) {
    publicationMessage.value = (result as ApiErrorResponse).error.message;
    return;
  }
  const next = result as PublicationTargetState;
  publicationStates.value = [...publicationStates.value.filter((stateValue) => stateValue.target !== target), next];
  publicationMessage.value = target === 'paragraph' && operation === 'prepare'
    ? 'Paragraph 準備資料已產生；沒有呼叫外部寫入。'
    : target === 'substack' ? 'Substack 尚未設定穩定寫入，請使用人工流程。' : '操作狀態已更新。';
}

async function openSeries(slug: string): Promise<void> {
  try {
    const source = await readJson<SeriesSource>(`/api/v1/series/${slug}`);
    selectedSeries.value = source;
    seriesManifest.value = parseSeriesManifest(source.source);
    seriesDirty.value = false;
    seriesMessage.value = '排序只存在目前畫面；按下儲存後才會寫入 Git 的系列 YAML。';
    workspaceMode.value = 'series';
  } catch (error) {
    seriesMessage.value = error instanceof Error ? error.message : '無法開啟系列。';
  }
}

function closeWorkspace(): void {
  workspaceMode.value = 'overview';
}

function movePost(sectionId: string, index: number, delta: -1 | 1): void {
  if (!seriesManifest.value) return;
  seriesManifest.value = moveSeriesPost(seriesManifest.value, sectionId, index, delta);
  seriesDirty.value = true;
  seriesMessage.value = '排序尚未儲存，只是這個畫面的暫存狀態。';
}

function dropPost(sectionId: string, targetIndex: number): void {
  const dragged = draggedSeriesPost.value;
  draggedSeriesPost.value = undefined;
  if (!dragged || dragged.sectionId !== sectionId || dragged.index === targetIndex || !seriesManifest.value) return;
  const section = seriesManifest.value.sections.find((item) => item.id === sectionId);
  if (!section) return;
  const posts = section.posts.map((post) => ({ ...post }));
  const [post] = posts.splice(dragged.index, 1);
  if (!post) return;
  posts.splice(targetIndex, 0, post);
  seriesManifest.value = {
    ...seriesManifest.value,
    sections: seriesManifest.value.sections.map((item) => item.id === sectionId ? { ...item, posts } : item),
  };
  seriesDirty.value = true;
  seriesMessage.value = '拖曳排序尚未儲存，只是這個畫面的暫存狀態。';
}

function applySchedule(): void {
  try {
    editorSource.value = applyTaipeiSchedule(editorSource.value, scheduleDate.value, scheduleTime.value);
    editorMessage.value = `已把排程寫入編輯內容：${scheduleDate.value} ${scheduleTime.value}（Asia／Taipei）。尚未儲存至 Git。`;
  } catch {
    editorMessage.value = '排程日期或時間無效，請重新確認。';
  }
}

async function requestFormalPreview(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  formalPreviewMessage.value = '正在以指定 Git 修訂版建立隔離的 Astro 預覽……';
  try {
    const response = await fetch('/api/v1/previews', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
      body: JSON.stringify({
        repository: 'gcake119/gcake-dev', slug: selectedPost.value.slug,
        baseRevision: selectedPost.value.baseCommitSha, draft: editorSource.value,
      }),
    });
    const result = await response.json() as PreviewJob | ApiErrorResponse;
    if (!response.ok) throw new Error((result as ApiErrorResponse).error.message);
    formalPreview.value = result as PreviewJob;
    formalPreviewMessage.value = formalPreview.value.status === 'ready'
      ? `正式預覽已完成，將於 ${new Date(formalPreview.value.expiresAt).toLocaleString('zh-TW')} 到期。`
      : `正式預覽狀態：${formalPreview.value.status}`;
  } catch (error) {
    formalPreviewMessage.value = `${error instanceof Error ? error.message : '正式預覽失敗。'} 請確認基礎修訂版仍可重建，再重試。`;
  }
}

async function saveSeries(): Promise<void> {
  if (!selectedSeries.value || !seriesManifest.value || !session.value.authenticated) return;
  const response = await fetch(`/api/v1/series/${selectedSeries.value.slug}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({
      expectedBlobSha: selectedSeries.value.baseBlobSha,
      expectedBaseCommitSha: selectedSeries.value.baseCommitSha,
      manifest: seriesManifest.value,
    }),
  });
  const result = await response.json() as { commitSha?: string; error?: { message?: string; details?: { issues?: string[] } } };
  if (!response.ok) {
    seriesMessage.value = `${result.error?.message ?? '無法儲存系列。'}${result.error?.details?.issues?.length ? ` ${result.error.details.issues.join('；')}` : ''}`;
    return;
  }
  seriesDirty.value = false;
  seriesMessage.value = `系列 YAML 已儲存至 Git（${result.commitSha ?? '新修訂版'}）；尚未代表公開部署完成。`;
}

function useRepositoryVersion(): void {
  if (!recoveryConflict.value) return;
  editorSource.value = recoveryConflict.value.repository;
  recoveryConflict.value = undefined;
  editorMessage.value = '已保留 GitHub 的較新版本。';
}

function startManualMerge(): void {
  if (!recoveryConflict.value) return;
  editorSource.value = `${recoveryConflict.value.repository}\n\n<!-- 舊草稿，請手動合併 -->\n${recoveryConflict.value.draft}`;
  recoveryConflict.value = undefined;
  editorMessage.value = '已建立手動合併內容；尚未儲存至 Git。';
}

async function copyOldDraft(): Promise<void> {
  if (!recoveryConflict.value) return;
  await navigator.clipboard.writeText(recoveryConflict.value.draft);
  editorMessage.value = '舊草稿已複製到剪貼簿。';
}

async function saveToGit(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  try {
    const response = await fetch(`/api/v1/posts/${selectedPost.value.slug}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
      body: JSON.stringify({
        expectedBaseCommitSha: selectedPost.value.baseCommitSha,
        message: `Update ${selectedPost.value.slug}`,
        files: [
          { path: selectedPost.value.path, expectedBlobSha: selectedPost.value.baseBlobSha, source: editorSource.value },
          ...(seriesDirty.value && selectedSeries.value && seriesManifest.value
            ? [{
                path: selectedSeries.value.path,
                expectedBlobSha: selectedSeries.value.baseBlobSha,
                source: serializeSeriesManifest(seriesManifest.value),
              }]
            : []),
        ],
      }),
    });
    const result = await response.json() as { commitSha?: string; error?: { message?: string; details?: unknown } };
    if (response.status === 409) {
      recoveryConflict.value = {
        draft: editorSource.value,
        repository: selectedPost.value.source,
        detail: result.error?.message ?? 'GitHub 內容已更新。',
      };
      editorMessage.value = '偵測到 Git 衝突，沒有覆蓋較新的版本。';
      return;
    }
    if (!response.ok) throw new Error(result.error?.message ?? '無法儲存至 Git。');
    seriesDirty.value = false;
    editorMessage.value = `已儲存至 Git（${result.commitSha ?? '新修訂版'}）；公開部署仍需另外確認。`;
  } catch (error) {
    editorMessage.value = error instanceof Error ? error.message : '無法儲存至 Git。';
  }
}

async function requestDelete(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  if (!window.confirm(`確定要刪除 ${selectedPost.value.slug}？這不會刪除 R2 媒體。`)) return;
  const response = await fetch(`/api/v1/posts/${selectedPost.value.slug}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({
      expectedBlobSha: selectedPost.value.baseBlobSha,
      expectedBaseCommitSha: selectedPost.value.baseCommitSha,
      confirmed: true,
    }),
  });
  const result = await response.json() as { error?: { message?: string; details?: { seriesReferences?: string[] } } };
  editorMessage.value = response.ok
    ? '文章已從 Git 刪除；R2 媒體未被刪除。'
    : `${result.error?.message ?? '無法刪除文章。'}${result.error?.details?.seriesReferences?.length ? ` 引用系列：${result.error.details.seriesReferences.join('、')}` : ''}`;
}

function autosaveDraft(): void {
  if (!selectedPost.value) return;
  const key = `gcake:draft:gcake119/gcake-dev:${selectedPost.value.slug}:${selectedPost.value.baseBlobSha}`;
  localStorage.setItem(key, editorSource.value);
  editorMessage.value = '草稿只儲存在這個瀏覽器，尚未儲存至 Git。';
}

function resizeSplit(delta: number): void {
  splitRatio.value = Math.min(80, Math.max(20, splitRatio.value + delta));
  localStorage.setItem('gcake:editor:split-ratio', String(splitRatio.value));
}

function persistSync(): void {
  localStorage.setItem('gcake:editor:sync-scroll', String(syncScroll.value));
}

function synchronizeScroll(from: HTMLElement, to: HTMLElement): void {
  if (!syncScroll.value || synchronizingScroll) return;
  synchronizingScroll = true;
  const availableFrom = Math.max(1, from.scrollHeight - from.clientHeight);
  const availableTo = Math.max(0, to.scrollHeight - to.clientHeight);
  to.scrollTop = (from.scrollTop / availableFrom) * availableTo;
  requestAnimationFrame(() => { synchronizingScroll = false; });
}

function onSourceScroll(): void {
  if (sourceElement.value && previewElement.value) synchronizeScroll(sourceElement.value, previewElement.value);
}

function onPreviewScroll(): void {
  if (sourceElement.value && previewElement.value) synchronizeScroll(previewElement.value, sourceElement.value);
}

function startDividerDrag(event: PointerEvent): void {
  const divider = event.currentTarget as HTMLElement;
  const workspace = divider.parentElement;
  if (!workspace) return;
  const startX = event.clientX;
  const startRatio = splitRatio.value;
  const width = workspace.getBoundingClientRect().width;
  const move = (moveEvent: PointerEvent) => {
    splitRatio.value = Math.min(80, Math.max(20, startRatio + ((moveEvent.clientX - startX) / width) * 100));
  };
  const up = () => {
    localStorage.setItem('gcake:editor:split-ratio', String(splitRatio.value));
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

onMounted(() => {
  initializeTheme();
  void loadAdmin();
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Publishing Admin 首頁">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect class="brand-mark__tile" x="2" y="2" width="28" height="28" rx="7" />
          <g class="brand-mark__glyph">
            <path fill-rule="evenodd" d="M14 6.4a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Zm0 3.65a3.05 3.05 0 1 0 0 6.1 3.05 3.05 0 0 0 0-6.1Z" />
            <rect x="18.2" y="7.45" width="4.7" height="3.35" rx="1.675" />
          </g>
          <path class="brand-mark__tail" d="M8.5 20.7c1.45 2.55 3.75 3.9 6.65 3.9 3.05 0 5.35-1.45 6.35-4.1" />
          <circle class="brand-mark__dot" cx="23.4" cy="7.05" r="2.35" />
        </svg>
        <span><strong>雞蛋糕的開發筆記</strong><small>Publishing Admin</small></span>
      </a>
      <button class="theme-button" type="button" :aria-label="dark ? '切換至明亮主題' : '切換至暗色主題'" @click="toggleTheme">
        <svg v-if="dark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z" /></svg>
      </button>
    </header>

    <main class="main-content">
      <section v-if="state === 'loading'" class="center-card" aria-live="polite">
        <p class="eyebrow">正在確認權限</p>
        <h1>載入管理介面</h1>
        <p class="muted">只會向伺服器確認登入狀態，不會在瀏覽器保存 GitHub 權杖。</p>
      </section>

      <section v-else-if="state === 'signed-out'" class="center-card">
        <p class="eyebrow">僅限網站擁有者</p>
        <h1>先以 GitHub 登入</h1>
        <p class="lead">登入後才能讀取文章、系列與部署狀態。未授權帳號無法看到儲存庫內容。</p>
        <a class="primary-action" href="/api/v1/auth/login">使用 GitHub 登入</a>
      </section>

      <section v-else-if="state === 'error'" class="center-card" role="alert">
        <p class="eyebrow error-text">載入失敗</p>
        <h1>目前無法開啟管理介面</h1>
        <p class="lead">{{ message }}</p>
        <button class="primary-action" type="button" @click="loadAdmin">重新載入</button>
      </section>

      <template v-else>
        <section v-if="workspaceMode === 'overview'" class="content-overview">
          <div class="hero">
            <div>
              <p class="eyebrow">內容工作台</p>
              <h1>嗨，{{ session.authenticated ? session.user.login : '' }}</h1>
              <p class="lead">選擇一篇文章或一個系列開始工作。</p>
            </div>
            <div v-if="deploymentStatus" class="status-card" :data-state="deployment?.state">
              <span class="status-dot" aria-hidden="true"></span>
              <div>
                <strong>{{ deploymentStatus.git }}</strong>
                <span>{{ deploymentStatus.deployment }}</span>
              </div>
            </div>
          </div>

          <div class="content-grid">
            <article class="panel posts-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">文章</p>
                <h2>內容清單</h2>
              </div>
              <span class="count">{{ posts.length }} 篇</span>
            </div>
            <ul v-if="posts.length" class="item-list">
              <li v-for="post in posts" :key="post.slug">
                <button class="post-button" type="button" @click="openPost(post.slug)">
                  <span>
                    <strong>{{ post.title }}</strong>
                    <small>{{ post.path }}</small>
                  </span>
                  <span class="badge">{{ post.status }}</span>
                </button>
              </li>
            </ul>
            <p v-else class="empty">目前沒有文章。</p>
            </article>

            <aside class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">系列</p>
                <h2>內容系列</h2>
              </div>
              <span class="count">{{ series.length }} 組</span>
            </div>
            <ul v-if="series.length" class="series-list">
              <li v-for="item in series" :key="item.slug">
                <button class="post-button" type="button" @click="openSeries(item.slug)">
                  <strong>{{ item.slug }}</strong>
                  <small>{{ item.path }}</small>
                </button>
              </li>
            </ul>
            <p v-else class="empty">目前沒有系列。</p>
            </aside>
          </div>
        </section>

        <section v-if="workspaceMode === 'series' && selectedSeries && seriesManifest" class="editor-panel workspace-panel series-editor" aria-labelledby="series-editor-title">
          <div class="workspace-navigation">
            <button type="button" class="back-action" @click="closeWorkspace">返回內容清單</button>
            <span>系列編輯</span>
          </div>
          <div class="editor-toolbar">
            <div>
              <p class="eyebrow">系列編輯器</p>
              <h2 id="series-editor-title">{{ seriesManifest.title }}</h2>
            </div>
            <button type="button" class="primary-action compact" :disabled="!seriesDirty" @click="saveSeries">
              儲存系列 YAML
            </button>
          </div>
          <p class="editor-message" aria-live="polite">{{ seriesMessage }}</p>
          <p class="series-order-hint">拖曳左側把手調整文章順序；也可以使用右側上下按鈕。</p>
          <section v-for="section in seriesManifest.sections" :key="section.id" class="series-section">
            <div class="series-section-heading">
              <strong>{{ section.title }}</strong><span class="badge">{{ section.status }}</span>
            </div>
            <ol class="series-order">
              <li
                v-for="(post, index) in section.posts"
                :key="post.slug"
                :class="{ 'is-dragging': draggedSeriesPost?.sectionId === section.id && draggedSeriesPost?.index === index }"
                draggable="true"
                title="拖曳調整順序"
                @dragstart="draggedSeriesPost = { sectionId: section.id, index }"
                @dragend="draggedSeriesPost = undefined"
                @dragover.prevent
                @drop.prevent="dropPost(section.id, index)"
              >
                <span class="drag-handle" aria-hidden="true">⠿</span>
                <span class="series-post-copy"><strong>{{ post.workingTitle || post.slug }}</strong><small>{{ post.slug }} · {{ post.status }}</small></span>
                <span class="order-actions">
                  <button type="button" :aria-label="`將 ${post.slug} 往上移`" :disabled="index === 0" @click="movePost(section.id, index, -1)">↑</button>
                  <button type="button" :aria-label="`將 ${post.slug} 往下移`" :disabled="index === section.posts.length - 1" @click="movePost(section.id, index, 1)">↓</button>
                </span>
              </li>
            </ol>
          </section>
        </section>

        <section v-if="workspaceMode === 'post' && selectedPost" class="editor-panel workspace-panel" aria-labelledby="editor-title">
          <div class="workspace-navigation">
            <button type="button" class="back-action" @click="closeWorkspace">返回內容清單</button>
            <span>{{ selectedPost.status }}</span>
          </div>
          <div class="editor-toolbar">
            <div>
              <p class="eyebrow">文章編輯器</p>
              <h1 id="editor-title">{{ selectedPost.title }}</h1>
              <p class="workspace-path">{{ selectedPost.path }}</p>
            </div>
            <div class="editor-actions">
              <label class="sync-control">
                <input v-model="syncScroll" type="checkbox" @change="persistSync">
                同步捲動
              </label>
              <button type="button" class="secondary-action" @click="autosaveDraft">暫存到瀏覽器</button>
              <button type="button" class="secondary-action" @click="openMediaLibrary">媒體庫</button>
              <button type="button" class="secondary-action danger-action" @click="requestDelete">刪除文章</button>
              <button type="button" class="secondary-action" @click="saveToGit">儲存至 Git</button>
              <button type="button" class="primary-action compact" @click="cycleEditorView">{{ nextViewLabel }}</button>
            </div>
          </div>
          <p v-if="editorMessage" class="editor-message" aria-live="polite">{{ editorMessage }}</p>
          <section class="schedule-panel" aria-labelledby="schedule-title">
            <div>
              <p class="eyebrow">Asia／Taipei 排程</p>
              <h3 id="schedule-title">公開時間</h3>
            </div>
            <label>日期<input v-model="scheduleDate" type="date"></label>
            <label>時間<input v-model="scheduleTime" type="time"></label>
            <button type="button" class="secondary-action" @click="applySchedule">套用到文章</button>
            <div v-if="activeSchedule" class="schedule-state" :data-state="activeSchedule.state">
              <strong>{{ activeSchedule.label }}</strong><span>{{ activeSchedule.detail }}</span>
            </div>
            <p v-else class="muted">公開文章需先到達排程時間，且之後有一次成功的靜態部署；Git 儲存本身不等於公開。</p>
          </section>
          <div v-if="recoveryConflict" class="conflict-panel" role="alert">
            <div>
              <strong>需要處理內容衝突</strong>
              <p>{{ recoveryConflict.detail }} 系統沒有自動覆蓋 GitHub 的較新內容。</p>
            </div>
            <div class="conflict-actions">
              <button type="button" class="secondary-action" @click="copyOldDraft">複製舊草稿</button>
              <button type="button" class="secondary-action" @click="useRepositoryVersion">載入 GitHub 版本</button>
              <button type="button" class="primary-action compact" @click="startManualMerge">手動合併</button>
            </div>
          </div>
          <div v-if="preview.limitations.length" class="limitation" role="alert">
            {{ preview.limitations[0]?.message }}
            <button type="button" class="secondary-action" @click="requestFormalPreview">建立正式 Astro 預覽</button>
          </div>
          <div class="formal-preview-panel" aria-live="polite">
            <span>{{ formalPreviewMessage || '正式預覽會使用目前未儲存內容、指定基礎修訂版與真實 Astro 設定；不會提交到 main。' }}</span>
            <a v-if="formalPreview?.status === 'ready' && formalPreview.url" class="primary-action compact" :href="formalPreview.url" target="_blank" rel="noreferrer">開啟正式預覽</a>
            <button v-else type="button" class="secondary-action" @click="requestFormalPreview">建立正式預覽</button>
          </div>
          <div
            class="editor-workspace"
            :data-view="editorView"
            :style="{ '--split-ratio': `${splitRatio}%` }"
            @paste="onEditorPaste"
            @dragover.prevent
            @drop.prevent="onEditorDrop"
          >
            <textarea
              ref="sourceElement"
              v-show="editorView !== 'rendered'"
              v-model="editorSource"
              class="source-editor"
              aria-label="Markdown 原始碼"
              spellcheck="false"
              @scroll="onSourceScroll"
            ></textarea>
            <div
              v-if="editorView === 'split'"
              class="split-divider"
              role="separator"
              aria-label="調整編輯器與預覽寬度"
              aria-orientation="vertical"
              :aria-valuenow="splitRatio"
              tabindex="0"
              @pointerdown="startDividerDrag"
              @keydown.left.prevent="resizeSplit(-5)"
              @keydown.right.prevent="resizeSplit(5)"
            ></div>
            <article
              ref="previewElement"
              v-show="editorView !== 'markdown'"
              class="content-preview public-content"
              aria-label="即時預覽"
              v-html="preview.html"
              @scroll="onPreviewScroll"
            ></article>
          </div>
          <section class="publishing-center" aria-labelledby="publishing-title">
            <div class="publishing-heading">
              <div><p class="eyebrow">完稿後設定</p><h3 id="publishing-title">發佈中心</h3></div>
              <p>儲存 Git 不會自動觸發外部平台。</p>
            </div>
            <div class="target-grid">
              <article>
                <strong>GitHub Pages</strong><span class="badge">{{ targetState('github_pages')?.status || 'not_configured' }}</span>
                <small>僅觀察部署與公開驗證。</small>
              </article>
              <article>
                <strong>Paragraph</strong><span class="badge">{{ targetState('paragraph')?.status || 'not_configured' }}</span>
                <small>Phase 7 受控 cohort 已完成建立、更新、公開與 canonical 驗證；其他文章仍預設只允許準備。電子報未獲核准。</small>
                <button type="button" class="secondary-action" @click="publicationOperation('paragraph', 'prepare')">準備 Paragraph 資料</button>
                <a class="secondary-action" href="https://paragraph.com/@gcake/gcake-cms-production-gate-20260928" target="_blank" rel="noreferrer">查看受控驗證文章</a>
              </article>
              <article>
                <strong>Substack</strong><span class="badge">{{ targetState('substack')?.status || 'manual_required' }}</span>
                <small>未設定穩定寫入介面，維持人工處理。</small>
                <button type="button" class="secondary-action" @click="publicationOperation('substack', 'publish')">查看人工處理狀態</button>
              </article>
            </div>
            <p v-if="publicationMessage" class="editor-message" aria-live="polite">{{ publicationMessage }}</p>
          </section>
        </section>

        <div v-if="mediaOpen" class="dialog-backdrop" @click.self="mediaOpen = false">
          <section class="media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-title">
            <header class="media-header">
              <div>
                <p class="eyebrow">R2 媒體</p>
                <h2 id="media-title">媒體庫</h2>
              </div>
              <button type="button" class="secondary-action" aria-label="關閉媒體庫" @click="mediaOpen = false">關閉</button>
            </header>
            <div class="media-tools">
              <label>
                <span>搜尋媒體</span>
                <input v-model="mediaSearch" type="search" @input="loadMedia">
              </label>
              <button type="button" class="primary-action compact" @click="pickerElement?.click()">選擇圖片上傳</button>
              <input ref="pickerElement" class="visually-hidden" type="file" accept="image/webp,image/png,image/svg+xml" @change="onFileChange">
            </div>
            <p v-if="mediaMessage" class="editor-message" aria-live="polite">{{ mediaMessage }}</p>
            <ul class="media-grid">
              <li v-for="item in media" :key="item.id" class="media-card">
                <img :src="item.url" :alt="`媒體預覽 ${item.key}`">
                <strong>{{ item.key.split('/').pop() }}</strong>
                <small>{{ item.width }}×{{ item.height }} · {{ Math.ceil(item.size / 1024) }} KB</small>
                <div class="media-card-actions">
                  <button type="button" @click="insertMedia(item)">插入</button>
                  <button type="button" @click="copyMediaUrl(item)">複製網址</button>
                  <button type="button" @click="inspectUsage(item)">查看使用</button>
                  <button type="button" @click="selectedMedia = item; replaceElement?.click()">替換</button>
                  <button type="button" class="danger-action" @click="deleteSelectedMedia(item)">刪除</button>
                </div>
              </li>
            </ul>
            <p v-if="!media.length" class="empty">沒有符合條件的媒體。</p>
            <input ref="replaceElement" class="visually-hidden" type="file" accept="image/webp,image/png,image/svg+xml" @change="onFileChange($event, selectedMedia?.id)">
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

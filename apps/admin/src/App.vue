<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
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
  PagesPublicationStatus,
} from '@gcake/admin-contract';
import { contentStatusLabel, pagesPresentation, publicationStatusLabel, previewStatusLabel, safeMessage } from './workflow-presentation';
import { deploymentPresentation } from './deployment';
import { renderImmediatePreview, nextEditorView, editorViewLabel, type EditorView } from './editor-state';
import { removedImageUrls, removedMediaRecords } from './media-cleanup';
import { applyTaipeiSchedule, readScheduleFields, schedulePresentation } from './scheduling';
import {
  addSeriesSection,
  addSeriesPost,
  createSeriesManifest,
  moveSeriesPost,
  moveSeriesSection,
  parseSeriesManifest,
  removeEmptySeriesSection,
  serializeSeriesManifest,
  seriesDeleteConfirmation,
  type AdminSeriesManifest,
  type AdminSeriesSection,
  updateSeriesMetadata,
  updateSeriesSection,
} from './series-editor';
import { createStandaloneSource, filterPostsBySeries, standalonePosts, updatePostTitle } from './post-series';
import { requestSlugSuggestion } from './slug-suggestion';

import ReleaseQueuePanel from './ReleaseQueuePanel.vue';
import SubstackStatusPanel from './SubstackStatusPanel.vue';
import { iconPaths } from '../../../src/components/icon-paths';
import { reviewManualPublication } from './manual-release';
import type { QueueView } from '@gcake/admin-contract';
import { releaseEstimate, eligibilityReason, seriesProgress } from './release-presentation';

type ViewState = 'loading' | 'signed-out' | 'ready' | 'error';
type WorkspaceMode = 'overview' | 'post' | 'series';

const releaseQueue = ref<QueueView>();
const selectedCandidate = computed(() => releaseQueue.value?.items.find((i) => i.slug === selectedPost.value?.slug));
const selectedSeriesProgress = computed(() => (seriesManifest.value ? seriesProgress(seriesManifest.value) : undefined));
const selectedSeriesNext = computed(() => releaseQueue.value?.plan.find(p => releaseQueue.value?.items.find(i => i.slug === p.slug)?.seriesSlug === selectedSeries.value?.slug));
const selectedSeriesStarted = computed(() => seriesManifest.value?.sections.some(s => s.posts.some(p => p.status === 'published')) || releaseQueue.value?.releases.some(r => r.seriesSlug === selectedSeries.value?.slug));

const state = ref<ViewState>('loading');
const session = ref<SessionResponse>({ authenticated: false });
const posts = ref<readonly PostSummary[]>([]);
const series = ref<readonly SeriesSource[]>([]);
const deployment = ref<DeploymentObservation>();
const message = ref('');
const dark = ref(false);
const workspaceMode = ref<WorkspaceMode>('overview');
const overviewSection = ref<'articles' | 'series' | 'publishing'>('articles');
const createPostOpen = ref(false);
const createSeriesOpen = ref(false);
const saving = ref(false);
const savedAt = ref('');
const pendingOverview = ref<'articles' | 'series' | 'publishing'>();
const overviewScroll = ref(0);
const recoveryAction = ref('copy');
const mediaActions = ref<Record<string, string>>({});
const articleDirty = computed(() => Boolean(selectedPost.value && (
  !selectedPost.value.baseBlobSha || editorSource.value !== selectedPost.value.source ||
  editorTitle.value !== selectedPost.value.title || editorSlug.value !== selectedPost.value.slug
)));
async function finishOverview(section: 'articles' | 'series' | 'publishing'): Promise<void> {
  seriesDirty.value = false;
  selectedSeries.value = undefined;
  seriesManifest.value = undefined;
  pendingOverview.value = undefined;
  workspaceMode.value = 'overview';
  overviewSection.value = section;
  await nextTick();
  window.scrollTo({ top: overviewScroll.value });
}
async function selectOverview(section: 'articles' | 'series' | 'publishing'): Promise<void> {
  const dirty = workspaceMode.value === 'post' ? articleDirty.value : workspaceMode.value === 'series' && seriesDirty.value;
  if (dirty) { pendingOverview.value = section; return; }
  await finishOverview(section);
}
async function runMediaAction(record: MediaRecord): Promise<void> {
  const action = mediaActions.value[record.id];
  if (action === 'copy') await copyMediaUrl(record);
  else if (action === 'usage') await inspectUsage(record);
  else if (action === 'replace') { selectedMedia.value = record; replaceElement.value?.click(); }
  else if (action === 'delete') await deleteSelectedMedia(record);
}
function resolveRecovery(): void {
  if (recoveryAction.value === 'repository') useRepositoryVersion();
  else if (recoveryAction.value === 'merge') startManualMerge();
  else void copyOldDraft();
}
const selectedPost = ref<PostSource>();
const selectedSeries = ref<SeriesSource>();
const seriesManifest = ref<AdminSeriesManifest>();
const seriesDirty = ref(false);
const seriesMessage = ref('');
const seriesFilter = ref('all');
const newSeriesTitle = ref('');
const newSeriesSlug = ref('');
const newPostTitle = ref('');
const newPostSlug = ref('');
const slugSuggestionMessage = ref('');
const slugSuggestionLoading = ref(false);
const editorTitle = ref('');
const editorSlug = ref('');
const editorSlugSuggestionMessage = ref('');
const editorSlugSuggestionLoading = ref(false);
const draggedSeriesPost = ref<{ sectionId: string; index: number }>();
const editorSource = ref('');
const scheduleDate = ref('');
const scheduleTime = ref('09:00');
const editorView = ref<EditorView>('markdown');
const splitRatio = ref(50);
const syncScroll = ref(true);
const editorMessage = ref('');
const manualPublishing=ref(false);
const formalPreview = ref<PreviewJob>();
const formalPreviewMessage = ref('');
const publicationStates = ref<readonly PublicationTargetState[]>([]);
const publicationMessage = ref('');
const pagesStatus = ref<PagesPublicationStatus>();
const pagesSummary = computed(() => pagesStatus.value ? pagesPresentation(pagesStatus.value) : undefined);
const recoveryPost = ref<PostSource>();
const recoveryConflict = ref<{ draft: string; repository: string; detail?: string }>();
const sourceElement = ref<HTMLTextAreaElement>();
const previewElement = ref<HTMLElement>();
const mediaOpen = ref(false);
const mediaDialogElement = ref<HTMLElement>();
const mediaButtonElement = ref<HTMLButtonElement>();
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
const filteredPosts = computed(() => filterPostsBySeries(posts.value, seriesFilter.value));
const availableStandalonePosts = computed(() => {
  const candidates = standalonePosts(posts.value, series.value);
  const pending = new Set(seriesManifest.value?.sections.flatMap((section) => section.posts.map((post) => post.slug)) ?? []);
  return candidates.filter((post) => !pending.has(post.slug));
});
const repositoryRevision = computed(() => series.value[0]?.baseCommitSha ?? posts.value[0]?.commitSha);

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
  mediaMessage.value = '';
  mediaOpen.value = true;
  await nextTick();
  mediaDialogElement.value?.focus();
  await loadMedia();
}

function closeMediaLibrary(): void {
  if (!mediaOpen.value) return;
  mediaOpen.value = false;
  mediaButtonElement.value?.focus();
}

function onMediaKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMediaLibrary();
  } else if (event.key === 'Tab') {
    const controls = [...(mediaDialogElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([type="file"]), select, a[href], summary') ?? [])];
    const visibleControls = controls.filter(control => control.getClientRects().length > 0);
    const first = visibleControls[0];
    const last = visibleControls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === mediaDialogElement.value)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }
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
    mediaMessage.value = replaceId ? '替代圖片已建立新網址；舊網址仍保留。' : '圖片已上傳，可以插入文章。';
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
  mediaMessage.value = '圖片已插入文章，可在原文修改圖片說明。';
  closeMediaLibrary();
}

async function copyMediaUrl(record: MediaRecord): Promise<void> {
  await navigator.clipboard.writeText(record.url);
  mediaMessage.value = '媒體網址已複製。';
}

async function inspectUsage(record: MediaRecord): Promise<void> {
  const result = await readJson<{ usages: readonly string[] }>(`/api/v1/media/${record.id}/usage`);
  mediaMessage.value = result.usages.length ? `使用位置：${result.usages.join('、')}` : '目前未在文章中找到使用位置。';
}

async function requestMediaDeletion(record: MediaRecord): Promise<{ deleted: boolean; usages: readonly string[]; message?: string }> {
  if (!session.value.authenticated) return { deleted: false, usages: [], message: '請先登入。' };
  try {
    const response = await fetch(`/api/v1/media/${record.id}`, {
      method: 'DELETE', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
      body: JSON.stringify({ confirmed: true }),
    });
    const result = await response.json() as { error?: { message?: string; details?: { usages?: string[] } } };
    return {
      deleted: response.ok,
      usages: result.error?.details?.usages ?? [],
      message: result.error?.message,
    };
  } catch (error) {
    return { deleted: false, usages: [], message: error instanceof Error ? error.message : '媒體清理失敗。' };
  }
}

async function deleteSelectedMedia(record: MediaRecord): Promise<void> {
  if (!session.value.authenticated || !window.confirm(`確定刪除「${record.key.split('/').pop()}」？`)) return;
  const result = await requestMediaDeletion(record);
  mediaMessage.value = result.deleted
    ? '未使用媒體已刪除。'
    : `${result.message ?? '無法刪除媒體。'}${result.usages.length ? ` 使用位置：${result.usages.join('、')}` : ''}`;
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

let sourcePosition = { start: 0, end: 0, scroll: 0 };
let previewScroll = 0;
async function setEditorView(view: EditorView): Promise<void> {
  if (sourceElement.value && editorView.value !== 'rendered') sourcePosition = {
    start: sourceElement.value.selectionStart, end: sourceElement.value.selectionEnd, scroll: sourceElement.value.scrollTop,
  };
  if (previewElement.value && editorView.value !== 'markdown') previewScroll = previewElement.value.scrollTop;
  editorView.value = view;
  await nextTick();
  if (sourceElement.value && view !== 'rendered') {
    sourceElement.value.setSelectionRange(sourcePosition.start, sourcePosition.end);
    sourceElement.value.scrollTop = sourcePosition.scroll;
  }
  if (previewElement.value && view !== 'markdown') previewElement.value.scrollTop = previewScroll;
}

async function openPost(slug: string): Promise<void> {
  if (workspaceMode.value === 'overview') overviewScroll.value = window.scrollY;
  try {
    const post = await readJson<PostSource>(`/api/v1/posts/${slug}`);
    selectedPost.value = post;
    savedAt.value = '';
    editorTitle.value = post.title;
    editorSlug.value = post.slug;
    sourcePosition = { start: 0, end: 0, scroll: 0 };
    previewScroll = 0;
    editorSlugSuggestionMessage.value = '';
    const key = `gcake:draft:gcake119/gcake-dev:${slug}:${post.baseBlobSha}`;
    const draft = localStorage.getItem(key);
    const prefix = `gcake:draft:gcake119/gcake-dev:${slug}:`;
    const staleKey = Object.keys(localStorage).find((candidate) => candidate.startsWith(prefix) && candidate !== key);
    const staleDraft = staleKey ? localStorage.getItem(staleKey) : null;
    recoveryPost.value = staleDraft ? post : undefined;
    recoveryAction.value = 'copy';
    recoveryConflict.value = staleDraft
      ? { draft: staleDraft, repository: post.source, detail: '這份暫存來自較舊的文章版本。' }
      : undefined;
    editorSource.value = draft ?? post.source;
    const schedule = readScheduleFields(editorSource.value);
    scheduleDate.value = schedule?.date ?? '';
    scheduleTime.value = schedule?.time ?? '09:00';
    splitRatio.value = Number(localStorage.getItem('gcake:editor:split-ratio') ?? 50);
    syncScroll.value = localStorage.getItem('gcake:editor:sync-scroll') !== 'false';
    editorMessage.value = staleDraft
      ? '文章內容已有更新；尚未套用舊暫存。請選擇復原方式。'
      : draft ? '已復原這份暫存；尚未儲存文章。' : '';
    await loadPublicationStates(post);
    workspaceMode.value = 'post';
    createPostOpen.value = false;
    await nextTick();
    window.scrollTo({ top: 0 });
  } catch (error) {
    editorMessage.value = error instanceof Error ? error.message : '無法開啟文章。';
  }
}

function createPost(): void {
  const slug = newPostSlug.value.trim();
  const title = newPostTitle.value.trim();
  const baseCommitSha = posts.value[0]?.commitSha ?? series.value[0]?.baseCommitSha;
  if (!title || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    message.value = '請輸入標題，網址代稱只使用小寫英文、數字與連字號。';
    return;
  }
  if (posts.value.some((post) => post.slug === slug)) {
    message.value = '這個網址代稱已經存在，請換一個。';
    return;
  }
  if (!baseCommitSha) {
    message.value = '目前無法確認文章版本，請重新載入。';
    return;
  }
  recoveryPost.value = undefined;
  recoveryConflict.value = undefined;
  recoveryAction.value = 'copy';
  const source = createStandaloneSource(title);
  selectedPost.value = {
    slug,
    path: `src/content/posts/${slug}.md`,
    title,
    status: 'draft',
    source,
    frontmatter: { title, status: 'draft', topics: [], distribution: { mode: 'full' } },
    body: '',
    series: [],
    baseCommitSha,
  };
  editorTitle.value = title;
  editorSlug.value = slug;
  editorSlugSuggestionMessage.value = '';
  editorSource.value = source;
  editorMessage.value = '已建立無系列文章草稿；按下「儲存文章」才會保存。';
  scheduleDate.value = '';
  scheduleTime.value = '09:00';
  resetPublicationEvidence();
  workspaceMode.value = 'post';
}

async function generateNewPostSlug(): Promise<void> {
  const currentSlug = newPostSlug.value;
  slugSuggestionLoading.value = true;
  slugSuggestionMessage.value = '';
  const result = await requestSlugSuggestion(
    newPostTitle.value,
    import.meta.env.VITE_SLUG_GENERATOR_URL ?? '',
  );
  slugSuggestionLoading.value = false;
  if (result.kind === 'empty-title') {
    slugSuggestionMessage.value = '請先輸入文章標題。';
  } else if (result.kind === 'suggested') {
    newPostSlug.value = result.slug;
    slugSuggestionMessage.value = '已填入建議的網址代稱；可以自行修改，尚未儲存。';
  } else {
    newPostSlug.value = currentSlug;
    slugSuggestionMessage.value = '目前無法提供網址代稱建議，可以自行輸入。';
  }
}

async function generateEditorSlug(): Promise<void> {
  const currentSlug = editorSlug.value;
  editorSlugSuggestionLoading.value = true;
  editorSlugSuggestionMessage.value = '';
  const result = await requestSlugSuggestion(
    editorTitle.value,
    import.meta.env.VITE_SLUG_GENERATOR_URL ?? '',
  );
  editorSlugSuggestionLoading.value = false;
  if (result.kind === 'empty-title') {
    editorSlugSuggestionMessage.value = '請先輸入文章標題。';
  } else if (result.kind === 'suggested') {
    editorSlug.value = result.slug;
    editorSlugSuggestionMessage.value = '已填入建議的網址代稱；可以自行修改，尚未儲存。';
  } else {
    editorSlug.value = currentSlug;
    editorSlugSuggestionMessage.value = '目前無法提供網址代稱建議，可以自行輸入。';
  }
}

let publicationReadGeneration = 0;
function resetPublicationEvidence(): number {
  publicationMessage.value = '';
  publicationStates.value = [];
  pagesStatus.value = undefined;
  return ++publicationReadGeneration;
}
async function loadPublicationStates(post = selectedPost.value): Promise<void> {
  const generation = resetPublicationEvidence();
  if (!post) return;
  try {
    const result = await readJson<{ states: readonly PublicationTargetState[]; pages?:PagesPublicationStatus }>(`/api/v1/publications/${post.slug}?sourceRevision=${encodeURIComponent(post.baseCommitSha)}`);
    if (generation !== publicationReadGeneration) return;
    publicationStates.value = result.states;
    pagesStatus.value = result.pages;
  } catch (error) {
    if (generation !== publicationReadGeneration) return;
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
  publicationMessage.value = target === 'substack' ? 'Substack 尚未設定穩定寫入，請使用人工流程。' : '操作狀態已更新。';
}

async function openSeries(slug: string): Promise<void> {
  if (workspaceMode.value === 'overview') overviewScroll.value = window.scrollY;
  try {
    const source = await readJson<SeriesSource>(`/api/v1/series/${slug}`);
    selectedSeries.value = source;
    seriesManifest.value = parseSeriesManifest(source.source);
    seriesDirty.value = false;
    seriesMessage.value = '';
    workspaceMode.value = 'series';
    createSeriesOpen.value = false;
    await nextTick();
    window.scrollTo({ top: 0 });
  } catch (error) {
    seriesMessage.value = error instanceof Error ? error.message : '無法開啟系列。';
  }
}

async function createSeries(): Promise<void> {
  if (!session.value.authenticated || !repositoryRevision.value) {
    message.value = '目前無法確認內容版本，請重新整理後再試。';
    return;
  }
  const manifest = createSeriesManifest(newSeriesTitle.value, newSeriesSlug.value);
  const response = await fetch('/api/v1/series', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({
      title: manifest.title, slug: manifest.slug, expectedBaseCommitSha: repositoryRevision.value,
    }),
  });
  const result = await response.json() as { commitSha?: string; error?: { message?: string } };
  if (!response.ok) {
    message.value = result.error?.message ?? '無法新增系列。';
    return;
  }
  const slug = manifest.slug;
  newSeriesTitle.value = '';
  newSeriesSlug.value = '';
  await loadAdmin();
  await openSeries(slug);
  seriesMessage.value = '空系列已建立，可以繼續新增章節或文章。';
}

function editSeriesMetadata(patch: Partial<Pick<AdminSeriesManifest, 'title' | 'slug'>>): void {
  if (!seriesManifest.value) return;
  seriesManifest.value = updateSeriesMetadata(seriesManifest.value, patch);
  seriesDirty.value = true;
  seriesMessage.value = '系列設定尚未儲存；修改網址代稱會一併更新系列網址。';
}

function closeWorkspace(): void {
  void selectOverview(overviewSection.value);
}

function movePost(sectionId: string, index: number, delta: -1 | 1): void {
  if (!seriesManifest.value || selectedSeriesStarted.value) return;
  seriesManifest.value = moveSeriesPost(seriesManifest.value, sectionId, index, delta);
  seriesDirty.value = true;
  seriesMessage.value = '排序尚未儲存，只是這個畫面的暫存狀態。';
}

function addPost(sectionId: string, slug: string): void {
  if (!seriesManifest.value || !slug) return;
  const post = posts.value.find((item) => item.slug === slug);
  if (!post) return;
  seriesManifest.value = addSeriesPost(seriesManifest.value, sectionId, { slug, status: post.status });
  seriesDirty.value = true;
  seriesMessage.value = `已將「${post.title}」加入系列；儲存時只更新系列設定。`;
}

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function addSection(): void {
  if (!seriesManifest.value || selectedSeriesStarted.value || saving.value) return;
  seriesManifest.value = addSeriesSection(seriesManifest.value);
  seriesDirty.value = true;
  seriesMessage.value = '已新增空白章節；請確認章節代稱、標題與狀態後儲存。';
}

function editSection(sectionId: string, patch: Partial<Pick<AdminSeriesSection, 'id' | 'title' | 'status'>>): void {
  if (!seriesManifest.value) return;
  seriesManifest.value = updateSeriesSection(seriesManifest.value, sectionId, patch);
  seriesDirty.value = true;
  seriesMessage.value = '章節設定尚未儲存，只是這個畫面的暫存狀態。';
}

function moveSection(index: number, delta: -1 | 1): void {
  if (!seriesManifest.value || selectedSeriesStarted.value) return;
  seriesManifest.value = moveSeriesSection(seriesManifest.value, index, delta);
  seriesDirty.value = true;
  seriesMessage.value = '章節順序尚未儲存，只是這個畫面的暫存狀態。';
}

function removeSection(sectionId: string): void {
  if (!seriesManifest.value) return;
  const next = removeEmptySeriesSection(seriesManifest.value, sectionId);
  if (next === seriesManifest.value) {
    seriesMessage.value = '章節仍有文章，請先移出文章後再刪除章節。';
    return;
  }
  seriesManifest.value = next;
  seriesDirty.value = true;
  seriesMessage.value = '空白章節已移除；變更尚未儲存。';
}

function dropPost(sectionId: string, targetIndex: number): void {
  const dragged = draggedSeriesPost.value;
  draggedSeriesPost.value = undefined;
  if (selectedSeriesStarted.value || !dragged || dragged.sectionId !== sectionId || dragged.index === targetIndex || !seriesManifest.value) return;
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
    editorMessage.value = `已把排程寫入編輯內容：${scheduleDate.value} ${scheduleTime.value}（台北時間）。尚未儲存文章。`;
  } catch {
    editorMessage.value = '排程日期或時間無效，請重新確認。';
  }
}

async function requestFormalPreview(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  formalPreviewMessage.value = '正在準備目前內容的網站預覽…';
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
      ? `網站預覽已完成，將於 ${new Date(formalPreview.value.expiresAt).toLocaleString('zh-TW')} 到期。`
      : `網站預覽：${previewStatusLabel(formalPreview.value.status)}`;
  } catch (error) {
    formalPreviewMessage.value = `${error instanceof Error ? error.message : '正式預覽失敗。'} 請重新載入文章後再試。`;
  }
}

async function publishNow():Promise<void> {
  if(!selectedPost.value || !session.value.authenticated || manualPublishing.value)return;
  manualPublishing.value=true;
  try {
    const post=selectedPost.value;
    const result=await reviewManualPublication({slug:post.slug,status:post.status,saved:!!post.baseBlobSha,revision:post.baseCommitSha,
      dirty:articleDirty.value},async(path,body)=>{
      if(!session.value.authenticated)throw new Error('請先登入。');
      const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':session.value.csrfToken},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message??'發布結果尚未確認，請核對原紀錄。');return data;
    },async(message)=>window.confirm(message));
    if(result){await openPost(post.slug);editorMessage.value=`${result.state==='awaiting-verification'?'已提交目前內容，等待網站更新與公開確認。':result.state==='verified-public'?'原發布已確認公開。':'原發布結果仍需核對，請不要重新發布。'}`;}
  } catch(error){editorMessage.value=error instanceof Error?error.message:'發布結果尚未確認，請核對原紀錄。';}
  finally {manualPublishing.value=false;}
}

async function finalizePost(): Promise<void> {
  if (!session.value.authenticated || !selectedPost.value?.baseBlobSha || saving.value) return;
  saving.value = true;
  try {
    const response = await fetch('/api/v1/releases/finalize', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': session.value.csrfToken,
      },
      body: JSON.stringify({
        slug: selectedPost.value.slug,
        revision: selectedPost.value.baseCommitSha,
        blobSha: selectedPost.value.baseBlobSha,
        source: updatePostTitle(editorSource.value, editorTitle.value),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? '定稿未完成。');
    await openPost(selectedPost.value.slug);
    const queue = await readJson<QueueView>('/api/v1/releases');
    releaseQueue.value = queue;
    editorMessage.value = '文章已儲存並定稿；公開結果仍需另外確認。';
  } catch (e) {
    editorMessage.value = e instanceof Error ? e.message : '定稿未完成。';
  } finally { saving.value = false; }
}

async function saveSeries(): Promise<void> {
  if (!selectedSeries.value || !seriesManifest.value || !session.value.authenticated || saving.value) return;
  saving.value = true;
  try {
  const response = await fetch(`/api/v1/series/${selectedSeries.value.slug}`, {
    method: 'PUT', credentials: 'same-origin',
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
  const savedSlug = seriesManifest.value.slug;
  seriesDirty.value = false;
  await loadAdmin();
  await openSeries(savedSlug);
  seriesMessage.value = '系列已儲存；網站更新與公開結果仍需另外確認。';
  } catch { seriesMessage.value = '系列尚未儲存，修改仍保留在這裡。請稍後再試。'; }
  finally { saving.value = false; }
}

async function deleteSeries(): Promise<void> {
  if (!selectedSeries.value || !seriesManifest.value || !session.value.authenticated) return;
  const postCount = seriesManifest.value.sections.reduce((count, section) => count + section.posts.length, 0);
  if (!window.confirm(seriesDeleteConfirmation(seriesManifest.value.title, postCount))) return;
  const response = await fetch(`/api/v1/series/${selectedSeries.value.slug}`, {
    method: 'DELETE', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
    body: JSON.stringify({
      expectedBlobSha: selectedSeries.value.baseBlobSha,
      expectedBaseCommitSha: selectedSeries.value.baseCommitSha,
      confirmed: true,
    }),
  });
  const result = await response.json() as { commitSha?: string; error?: { message?: string } };
  if (!response.ok) {
    seriesMessage.value = result.error?.message ?? '無法刪除系列。';
    return;
  }
  selectedSeries.value = undefined;
  seriesManifest.value = undefined;
  workspaceMode.value = 'overview';
  await loadAdmin();
  message.value = '系列已刪除；文章均保留，現在會顯示為無系列文章。';
}

async function useRepositoryVersion(): Promise<void> {
  if (!recoveryConflict.value || !selectedPost.value) return;
  await openPost(selectedPost.value.slug);
  if (recoveryPost.value) {
    selectedPost.value = recoveryPost.value;
    editorSource.value = recoveryPost.value.source;
    editorTitle.value = recoveryPost.value.title;
    editorSlug.value = recoveryPost.value.slug;
  }
  recoveryConflict.value = undefined;
  editorMessage.value = '已載入較新的內容。';
}

function startManualMerge(): void {
  if (!recoveryConflict.value) return;
  if (!recoveryPost.value) { editorMessage.value = '較新的內容尚未載入，請先複製目前暫存，再重新開啟文章。'; return; }
  selectedPost.value = recoveryPost.value;
  editorSource.value = `${recoveryConflict.value.repository}\n\n<!-- 舊草稿，請手動合併 -->\n${recoveryConflict.value.draft}`;
  recoveryConflict.value = undefined;
  editorMessage.value = '已將兩份內容放入編輯區，請整理後儲存文章。';
}

async function copyOldDraft(): Promise<void> {
  if (!recoveryConflict.value) return;
  await navigator.clipboard.writeText(recoveryConflict.value.draft);
  editorMessage.value = '舊草稿已複製到剪貼簿。';
}

async function saveToGit(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated || saving.value) return;
  saving.value = true;
  try {
    const wasNew = !selectedPost.value.baseBlobSha;
    const savedSlug = editorSlug.value.trim();
    const savedTitle = editorTitle.value.trim();
    if (!savedTitle || !/^[a-z0-9][a-z0-9-]*$/.test(savedSlug)) {
      editorMessage.value = '請輸入標題，網址代稱只使用小寫英文、數字與連字號。';
      return;
    }
    if (savedSlug !== selectedPost.value.slug && posts.value.some((post) => post.slug === savedSlug)) {
      editorMessage.value = '這個網址代稱已經存在，請換一個。';
      return;
    }
    const savedSource = updatePostTitle(editorSource.value, savedTitle);
    editorSource.value = savedSource;
    const removedUrls = removedImageUrls(selectedPost.value.source, editorSource.value);
    let cleanupCandidates: readonly MediaRecord[] = [];
    if (removedUrls.length) {
      const mediaResult = await readJson<{ media: readonly MediaRecord[] }>('/api/v1/media');
      cleanupCandidates = removedMediaRecords(selectedPost.value.source, editorSource.value, mediaResult.media);
      if (cleanupCandidates.length) {
        const names = cleanupCandidates.map((record) => record.key.split('/').pop() ?? record.key).join('、');
        if (!window.confirm(`這次移除了 ${cleanupCandidates.length} 張圖片：${names}。儲存文章後，系統會刪除未被其他內容引用的媒體檔案；仍有引用的檔案會保留。是否繼續？`)) {
          editorMessage.value = '已取消儲存，文章與媒體庫都沒有變更。';
          return;
        }
      }
    }
    const renaming = Boolean(selectedPost.value.baseBlobSha && savedSlug !== selectedPost.value.slug);
    const response = await fetch(`/api/v1/posts/${selectedPost.value.slug}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken },
      body: JSON.stringify(renaming ? {
        expectedBaseCommitSha: selectedPost.value.baseCommitSha,
        expectedBlobSha: selectedPost.value.baseBlobSha,
        newSlug: savedSlug,
        source: savedSource,
      } : {
        expectedBaseCommitSha: selectedPost.value.baseCommitSha,
        message: `${selectedPost.value.baseBlobSha ? 'Update' : 'Create'} ${savedSlug}`,
        files: [
          { path: `src/content/posts/${savedSlug}.md`, ...(selectedPost.value.baseBlobSha ? { expectedBlobSha: selectedPost.value.baseBlobSha } : {}), source: savedSource },
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
      try { recoveryPost.value = await readJson<PostSource>(`/api/v1/posts/${selectedPost.value.slug}`); } catch { recoveryPost.value = undefined; }
      recoveryConflict.value = {
        draft: editorSource.value,
        repository: recoveryPost.value?.source ?? selectedPost.value.source,
        detail: result.error?.message ?? 'GitHub 內容已更新。',
      };
      editorMessage.value = '文章已有較新的內容，尚未覆蓋。請選擇保留或整理內容。';
      return;
    }
    if (!response.ok) throw new Error(result.error?.message ?? '無法儲存至 Git。');
    const savedDraftKey = `gcake:draft:gcake119/gcake-dev:${selectedPost.value.slug}:${selectedPost.value.baseBlobSha}`;
    localStorage.removeItem(savedDraftKey);
    seriesDirty.value = false;
    const cleanupResults = await Promise.all(cleanupCandidates.map(async (record) => ({
      record,
      result: await requestMediaDeletion(record),
    })));
    const deleted = cleanupResults.filter((item) => item.result.deleted);
    const retained = cleanupResults.filter((item) => !item.result.deleted && item.result.usages.length);
    const failed = cleanupResults.filter((item) => !item.result.deleted && !item.result.usages.length);
    const cleanupMessage = cleanupCandidates.length
      ? ` 已刪除 ${deleted.length} 個未使用媒體；${retained.length ? `${retained.length} 個仍被其他內容引用而保留；` : ''}${failed.length ? `${failed.length} 個清理失敗，請到媒體庫重試；` : ''}`
      : '';
    if (wasNew || renaming) {
      newPostTitle.value = '';
      newPostSlug.value = '';
      await loadAdmin();
      await openPost(savedSlug);
    }
    if (!wasNew && !renaming) await openPost(savedSlug);
    savedAt.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    editorMessage.value = `文章已儲存。${cleanupMessage}公開結果仍需另外確認。`;
    if (mediaOpen.value) await loadMedia();
  } catch (error) {
    editorMessage.value = error instanceof Error ? error.message : '無法儲存文章。';
  } finally { saving.value = false; }
}

async function requestDelete(): Promise<void> {
  if (!selectedPost.value || !session.value.authenticated) return;
  if (!window.confirm(`確定要刪除「${selectedPost.value.title}」？已上傳的圖片會保留。`)) return;
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
    ? '文章已刪除；已上傳的圖片仍保留。'
    : `${result.error?.message ?? '無法刪除文章。'}${result.error?.details?.seriesReferences?.length ? ` 引用系列：${result.error.details.seriesReferences.join('、')}` : ''}`;
}

function autosaveDraft(): void {
  if (!selectedPost.value) return;
  const key = `gcake:draft:gcake119/gcake-dev:${selectedPost.value.slug}:${selectedPost.value.baseBlobSha}`;
  localStorage.setItem(key, editorSource.value);
  editorMessage.value = '已暫存到這台裝置的目前瀏覽器；尚未儲存文章。';
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
      <a class="brand" href="#articles" aria-label="Publishing Admin 首頁" @click.prevent="selectOverview('articles')">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect class="brand-mark__tile" x="2" y="2" width="28" height="28" rx="7" />
          <g class="brand-mark__glyph">
            <path fill-rule="evenodd" d="M14 6.4a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Zm0 3.65a3.05 3.05 0 1 0 0 6.1 3.05 3.05 0 0 0 0-6.1Z" />
            <rect x="18.2" y="7.45" width="4.7" height="3.35" rx="1.675" />
          </g>
          <path class="brand-mark__tail" d="M8.5 20.7c1.45 2.55 3.75 3.9 6.65 3.9 3.05 0 5.35-1.45 6.35-4.1" />
          <circle class="brand-mark__dot" cx="23.4" cy="7.05" r="2.35" />
        </svg>
        <span>
          <strong>雞蛋糕的開發筆記</strong>
          <small>內容管理</small>
        </span>
      </a>
      <nav v-if="state === 'ready'" aria-label="工作區" class="workspace-tabs">
        <a href="#articles" :aria-current="overviewSection === 'articles' ? 'page' : undefined" @click.prevent="selectOverview('articles')">文章</a>
        <a href="#series" :aria-current="overviewSection === 'series' ? 'page' : undefined" @click.prevent="selectOverview('series')">系列</a>
        <a href="#publishing" :aria-current="overviewSection === 'publishing' ? 'page' : undefined" @click.prevent="selectOverview('publishing')">發布管理</a>
      </nav>
      <button class="theme-button" type="button" :aria-label="dark ? '切換至明亮主題' : '切換至暗色主題'" @click="toggleTheme">
        <svg v-if="dark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/>
          <path :d="iconPaths.sun"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path :d="iconPaths.moon"/>
        </svg>
      </button>
    </header>
    <main class="main-content">
      <section v-if="state === 'loading'" class="center-card" aria-live="polite">
        <h1>正在開啟內容工作台</h1>
        <p>請稍候，正在載入文章與系列。</p>
      </section>
      <section v-else-if="state === 'signed-out'" class="center-card">
        <h1>登入內容工作台</h1>
        <p>登入後即可管理文章、系列與發布進度。</p>
        <a class="primary-action" href="/api/v1/auth/login">使用 GitHub 登入</a>
      </section>
      <section v-else-if="state === 'error'" class="center-card" role="alert">
        <h1>目前無法開啟工作台</h1>
        <p>{{ safeMessage(message, '載入未完成，請重新整理後再試。') }}</p>
        <button type="button" class="primary-action" @click="loadAdmin">重新載入</button>
      </section>
      <template v-else>
        <section v-if="pendingOverview" class="leave-confirmation" role="alert" aria-labelledby="leave-title">
          <h2 id="leave-title">目前修改尚未儲存</h2>
          <p>留在這裡可以繼續編輯；捨棄修改後才會離開。</p>
          <div role="group" aria-label="離開編輯確認" class="context-actions">
            <button type="button" class="secondary-action" @click="pendingOverview = undefined">繼續編輯</button>
            <button type="button" class="secondary-action danger-action" @click="finishOverview(pendingOverview)">捨棄修改並離開</button>
          </div>
        </section>
        <ReleaseQueuePanel v-if="session.authenticated" v-show="workspaceMode === 'overview' && overviewSection !== 'series'"
          :csrf-token="session.csrfToken" :compact="overviewSection !== 'publishing'" :series-titles="Object.fromEntries(series.map(item => [item.slug, item.title]))"
          @loaded="releaseQueue = $event" @view-publishing="selectOverview('publishing')" />
        <section v-if="workspaceMode === 'overview'" class="content-overview">
          <article v-if="overviewSection === 'articles'" class="panel posts-panel">
            <header class="panel-heading">
              <div>
                <p class="eyebrow">內容工作台</p>
                <h1>文章</h1>
                <p class="muted">{{ filteredPosts.length }} 篇文章</p>
              </div>
              <div v-if="!createPostOpen" role="group" aria-label="文章清單操作">
                <button type="button" class="primary-action" @click="createPostOpen = true">新增文章</button>
              </div>
            </header>
            <form v-if="createPostOpen" class="creation-form new-post-form" @submit.prevent="createPost">
              <label>
                <span>文章標題</span>
                <input v-model="newPostTitle" type="text" required>
              </label>
              <label>
                <span>網址代稱</span>
                <input v-model="newPostSlug" type="text" pattern="[a-z0-9][a-z0-9-]*" required>
                <small>文章網址最後一段，使用小寫英文、數字與連字號。</small>
              </label>
              <details>
                <summary>需要網址建議？</summary>
                <button type="button" class="secondary-action" :disabled="slugSuggestionLoading" @click="generateNewPostSlug">建議網址代稱</button>
                <p v-if="slugSuggestionMessage" role="status">{{ safeMessage(slugSuggestionMessage) }}</p>
              </details>
              <div role="group" aria-label="新增文章操作" class="context-actions">
                <button class="primary-action" type="submit">建立無系列草稿</button>
                <button class="secondary-action" type="button" @click="createPostOpen = false">取消</button>
              </div>
            </form>
            <label class="series-filter">
              <span>依系列篩選</span>
              <select v-model="seriesFilter">
                <option value="all">全部文章</option>
                <option value="standalone">無系列</option>
                <option v-for="item in series" :key="item.slug" :value="item.slug">{{ item.title }}</option>
              </select>
            </label>
            <p v-if="message" class="editor-message" aria-live="polite">{{ safeMessage(message) }}</p>
            <ul v-if="filteredPosts.length" class="item-list">
              <li v-for="post in filteredPosts" :key="post.slug">
                <button class="post-button" type="button" @click="openPost(post.slug)">
                  <span>
                    <strong>{{ post.title }}</strong>
                    <small>{{ post.series.length ? post.series.map(item => item.title).join('、') : '無系列' }}</small>
                  </span>
                  <span class="badge">{{ contentStatusLabel(post.status) }}</span>
                </button>
              </li>
            </ul>
            <p v-else class="empty">這個篩選條件目前沒有文章。可以改選其他系列，或新增文章。</p>
          </article>
          <article v-if="overviewSection === 'series'" class="panel">
            <header class="panel-heading">
              <div>
                <p class="eyebrow">整理寫作脈絡</p>
                <h1>系列</h1>
                <p class="muted">{{ series.length }} 組系列</p>
              </div>
              <div v-if="!createSeriesOpen" role="group" aria-label="系列清單操作">
                <button type="button" class="primary-action" @click="createSeriesOpen = true">新增系列</button>
              </div>
            </header>
            <form v-if="createSeriesOpen" class="creation-form new-series-form" @submit.prevent="createSeries">
              <label>
                <span>系列名稱</span>
                <input v-model="newSeriesTitle" type="text" required>
              </label>
              <label>
                <span>網址代稱</span>
                <input v-model="newSeriesSlug" type="text" pattern="[a-z0-9][a-z0-9-]*" required>
                <small>系列網址最後一段，使用小寫英文、數字與連字號。</small>
              </label>
              <div role="group" aria-label="新增系列操作" class="context-actions">
                <button class="primary-action" type="submit">建立系列</button>
                <button class="secondary-action" type="button" @click="createSeriesOpen = false">取消</button>
              </div>
            </form>
            <p v-if="message" class="editor-message" role="status">{{ safeMessage(message) }}</p>
            <ul v-if="series.length" class="series-list">
              <li v-for="item in series" :key="item.slug">
                <button type="button" class="post-button" @click="openSeries(item.slug)">
                  <span>
                    <strong>{{ item.title }}</strong>
                  </span>
                  <span class="badge">{{ item.postCount }} 篇</span>
                </button>
              </li>
            </ul>
            <p v-else class="empty">目前沒有系列。新增系列後即可加入文章。</p>
          </article>
          <SubstackStatusPanel v-if="overviewSection === 'publishing'" :titles="Object.fromEntries(posts.map(post => [post.slug, post.title]))" @select="openPost" />
          <details v-if="deploymentStatus && overviewSection === 'publishing'" class="workspace-settings">
            <summary>網站更新狀態</summary>
            <p>這是整個網站最近一次更新的狀態，不代表每篇文章都已公開。</p>
            <p>{{ deploymentStatus.deployment }}</p>
          </details>
        </section>
        <section v-if="workspaceMode === 'series' && selectedSeries && seriesManifest" class="editor-panel workspace-panel series-editor" aria-labelledby="series-editor-title">
          <div class="workspace-navigation">
            <a href="#series" @click.prevent="closeWorkspace">返回系列清單</a>
            <span>{{ seriesDirty ? '有未儲存的修改' : '沒有未儲存的修改' }}</span>
          </div>
          <div class="editor-toolbar">
            <div>
              <p class="eyebrow">系列編輯</p>
              <h1 id="series-editor-title">{{ seriesManifest.title }}</h1>
            </div>
            <div class="editor-actions" role="group" aria-label="系列主要操作">
              <button type="button" class="secondary-action" :disabled="selectedSeriesStarted || saving" @click="addSection">新增章節</button>
              <button type="button" class="primary-action compact" :disabled="!seriesDirty || saving" @click="saveSeries">儲存系列</button>
            </div>
          </div>
          <p v-if="selectedSeriesProgress" class="muted">已定稿 {{ selectedSeriesProgress.ready }}／{{ selectedSeriesProgress.total }} 篇；已標記公開 {{ selectedSeriesProgress.published }}／{{ selectedSeriesProgress.total }} 篇。</p>
          <p v-if="selectedSeriesStarted" class="lock-note">篇序已鎖定，因為這個系列已開始連載。仍可修改內容，儲存後會重新檢查。</p>
          <p v-else class="muted">拖曳把手或使用上下按鈕調整篇序，儲存系列後才會生效。</p>
          <p v-if="seriesMessage" class="editor-message" aria-live="polite">{{ safeMessage(seriesMessage) }}</p>
          <details class="workspace-settings">
            <summary>系列設定</summary>
            <div class="series-metadata-fields">
              <label>
                <span>系列名稱</span>
                <input :value="seriesManifest.title" :disabled="saving" type="text" required @input="editSeriesMetadata({ title: eventValue($event) })">
              </label>
              <label>
                <span>網址代稱</span>
                <input :value="seriesManifest.slug" :disabled="selectedSeriesStarted || saving" type="text" pattern="[a-z0-9][a-z0-9-]*" @input="editSeriesMetadata({ slug: eventValue($event) })">
              </label>
            </div>
            <p class="muted">修改網址代稱會更新系列網址；已開始連載的系列不能修改。</p>
            <details class="danger-settings">
              <summary>刪除系列</summary>
              <p>刪除系列會保留所有文章，文章將改為無系列。</p>
              <div role="group" aria-label="刪除系列操作">
                <button type="button" class="secondary-action danger-action" :disabled="selectedSeriesStarted" @click="deleteSeries">刪除系列</button>
              </div>
              <p v-if="selectedSeriesStarted" class="muted">已開始連載，無法刪除這個系列。</p>
            </details>
          </details>
          <section v-for="(section, sectionIndex) in seriesManifest.sections" :key="section.id" class="series-section">
            <header class="series-section-heading">
              <h2>{{ section.title }}</h2>
              <details>
                <summary>章節設定</summary>
                <div class="series-section-fields">
                  <label>
                    <span>章節代稱</span>
                    <input :value="section.id" type="text" :disabled="selectedSeriesStarted" @input="editSection(section.id, { id: eventValue($event) })">
                  </label>
                  <label>
                    <span>章節標題</span>
                    <input :value="section.title" :disabled="saving" type="text" @input="editSection(section.id, { title: eventValue($event) })">
                  </label>
                  <label>
                    <span>章節進度</span>
                    <select :value="section.status" :disabled="saving" @change="editSection(section.id, { status: eventValue($event) })">
                      <option value="planned">規劃中</option>
                      <option value="active">進行中</option>
                      <option value="completed">已完成</option>
                    </select>
                  </label>
                </div>
                <div v-if="!selectedSeriesStarted" role="group" aria-label="章節排序操作" class="section-actions">
                  <button type="button" :aria-label="`將 ${section.title} 往上移`" :disabled="sectionIndex === 0" @click="moveSection(sectionIndex, -1)">往上移</button>
                  <button type="button" :aria-label="`將 ${section.title} 往下移`" :disabled="sectionIndex === seriesManifest.sections.length - 1" @click="moveSection(sectionIndex, 1)">往下移</button>
                </div>
                <details v-if="!selectedSeriesStarted">
                  <summary>移除空白章節</summary>
                  <p v-if="section.posts.length">請先移出章節內的文章。</p>
                  <div role="group" aria-label="移除章節操作">
                    <button type="button" class="danger-action secondary-action" :disabled="section.posts.length > 0" @click="removeSection(section.id)">刪除空白章節</button>
                  </div>
                </details>
              </details>
            </header>
            <ol class="series-order">
              <li v-for="(post, index) in section.posts" :key="post.slug" :class="{ 'is-dragging': draggedSeriesPost?.sectionId === section.id && draggedSeriesPost?.index === index, 'is-locked': selectedSeriesStarted }" :draggable="!selectedSeriesStarted" @dragstart="draggedSeriesPost = { sectionId: section.id, index }" @dragend="draggedSeriesPost = undefined" @dragover.prevent @drop.prevent="dropPost(section.id, index)">
                <span v-if="!selectedSeriesStarted" class="drag-handle" aria-hidden="true">⠿</span>
                <span v-else class="post-ordinal">{{ index + 1 }}</span>
                <span class="series-post-copy">
                  <strong>{{ post.workingTitle || posts.find(item => item.slug === post.slug)?.title || '未命名文章' }}</strong>
                  <small>{{ contentStatusLabel(post.status) }}</small>
                </span>
                <span v-if="!selectedSeriesStarted" class="order-actions" role="group" :aria-label="`調整第 ${index + 1} 篇順序`">
                  <button type="button" aria-label="往上移" :disabled="index === 0" @click="movePost(section.id, index, -1)">↑</button>
                  <button type="button" aria-label="往下移" :disabled="index === section.posts.length - 1" @click="movePost(section.id, index, 1)">↓</button>
                </span>
              </li>
            </ol>
            <label v-if="availableStandalonePosts.length && !selectedSeriesStarted" class="add-series-post">
              <span>加入無系列文章</span>
              <select value="" @change="addPost(section.id, eventValue($event))">
                <option value="" disabled>選擇文章</option>
                <option v-for="post in availableStandalonePosts" :key="post.slug" :value="post.slug">{{ post.title }}</option>
              </select>
            </label>
          </section>
        </section>
        <section v-if="workspaceMode === 'post' && selectedPost" class="editor-panel workspace-panel" aria-labelledby="editor-title">
          <div class="workspace-navigation">
            <a href="#articles" @click.prevent="closeWorkspace">返回文章清單</a>
            <span class="badge">{{ contentStatusLabel(selectedPost.status) }}</span>
          </div>
          <div class="editor-toolbar">
            <div>
              <p class="eyebrow">文章編輯</p>
              <h1 id="editor-title">{{ editorTitle }}</h1>
              <p class="save-state" aria-live="polite">
                {{ saving ? '正在儲存…' : articleDirty ? '有未儲存的修改' : '文章已儲存' }}
                <span v-if="savedAt && !articleDirty"> · {{ savedAt }}</span>
              </p>
            </div>
            <div class="editor-actions" role="group" aria-label="文章主要操作">
              <button type="button" class="primary-action" :disabled="saving || manualPublishing" @click="saveToGit">{{ saving ? '儲存中…' : '儲存文章' }}</button>
            </div>
          </div>
          <p v-if="editorMessage" class="editor-message" aria-live="polite">{{ safeMessage(editorMessage) }}</p>
          <div v-if="recoveryConflict" class="conflict-panel" role="alert">
            <div>
              <h2>文章有較新的版本</h2>
              <p>目前修改仍在這裡。先複製備份，或選擇要使用的內容。</p>
            </div>
            <div class="recovery-choice">
              <label>
                處理方式
                <select v-model="recoveryAction">
                  <option value="copy">複製目前暫存</option>
                  <option value="repository">載入較新的內容</option>
                  <option value="merge">合併兩份內容再編輯</option>
                </select>
              </label>
              <div role="group" aria-label="版本衝突處理">
                <button type="button" class="secondary-action" @click="resolveRecovery">執行選擇</button>
              </div>
            </div>
          </div>
          <div class="editor-view-tools">
            <div class="editor-icon-tools" role="group" aria-label="文章編輯工具">
              <button type="button" class="icon-action" :aria-label="`目前是${editorViewLabel(editorView)}，切換至${editorViewLabel(nextEditorView(editorView))}`" :title="`目前是${editorViewLabel(editorView)}，切換至${editorViewLabel(nextEditorView(editorView))}`" @click="setEditorView(nextEditorView(editorView))">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path :d="iconPaths[editorView === 'markdown' ? 'eye' : editorView === 'rendered' ? 'split' : 'code']" />
                </svg>
              </button>
              <button ref="mediaButtonElement" type="button" class="icon-action" aria-label="插入圖片" title="插入圖片" @click="openMediaLibrary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path :d="iconPaths.image" />
                </svg>
              </button>
            </div>
            <span class="current-view" aria-live="polite">{{ editorViewLabel(editorView) }}</span>
            <label v-if="editorView === 'split'" class="sync-control">
              <input v-model="syncScroll" type="checkbox" @change="persistSync">
              左右同步捲動
            </label>
          </div>
          <div v-if="preview.limitations.length" class="limitation" role="alert">
            {{ preview.limitations[0]?.message }}
            <a href="#website-preview">前往網站預覽</a>
          </div>
          <div class="editor-workspace" :data-view="editorView" :style="{ '--split-ratio': `${splitRatio}%` }" @paste="onEditorPaste" @dragover.prevent @drop.prevent="onEditorDrop">
            <textarea ref="sourceElement" v-show="editorView !== 'rendered'" v-model="editorSource" class="source-editor" :disabled="saving" aria-label="文章原文" spellcheck="false" @scroll="onSourceScroll"></textarea>
            <div v-if="editorView === 'split'" class="split-divider" role="separator" aria-label="調整編輯器與預覽寬度" aria-orientation="vertical" :aria-valuenow="splitRatio" tabindex="0" @pointerdown="startDividerDrag" @keydown.left.prevent="resizeSplit(-5)" @keydown.right.prevent="resizeSplit(5)"></div>
            <article ref="previewElement" v-show="editorView !== 'markdown'" class="content-preview public-content" aria-label="即時預覽" v-html="preview.html" @scroll="onPreviewScroll"></article>
          </div>
          <details class="workspace-settings article-settings" aria-labelledby="article-settings-title">
            <summary id="article-settings-title">文章設定</summary>
            <section class="settings-section" aria-labelledby="basic-settings-title">
              <div class="settings-section-heading">
                <h3 id="basic-settings-title">基本資料</h3>
                <p>標題與所屬系列，會顯示在文章清單。</p>
              </div>
              <div class="settings-fields">
                <label>
                  <span>文章標題</span>
                  <input v-model="editorTitle" type="text" :disabled="saving" required>
                </label>
                <div class="readonly-field">
                  <span>所屬系列</span>
                  <p>{{ selectedPost.series.length ? selectedPost.series.map(item => item.title).join('、') : '無系列' }}</p>
                  <small>文章歸屬請到系列頁調整。</small>
                </div>
              </div>
            </section>
            <section class="settings-section" aria-labelledby="url-settings-title">
              <div class="settings-section-heading">
                <h3 id="url-settings-title">文章網址</h3>
                <p>已公開的文章，請謹慎修改網址。</p>
              </div>
              <div class="settings-fields">
                <label>
                  <span>網址代稱</span>
                  <input v-model="editorSlug" type="text" :disabled="saving" inputmode="url" pattern="[a-z0-9][a-z0-9-]*" required aria-describedby="article-url-help">
                </label>
                <p id="article-url-help" class="field-help">這是文章網址的最後一段；修改後，文章網址也會改變。</p>
                <div role="group" aria-label="文章網址建議">
                  <button type="button" class="secondary-action" :disabled="saving || editorSlugSuggestionLoading || !editorTitle.trim()" @click="generateEditorSlug">建議網址代稱</button>
                </div>
                <p v-if="editorSlugSuggestionMessage" role="status">{{ safeMessage(editorSlugSuggestionMessage) }}</p>
              </div>
            </section>
            <p class="settings-save-hint">修改完成後，請按上方「儲存文章」。</p>
          </details>
          <details class="workspace-settings article-management" aria-labelledby="article-management-title">
            <summary id="article-management-title">其他管理</summary>
            <section class="management-row">
              <div>
                <h3>裝置備份</h3>
                <p>只保存在目前瀏覽器，不會儲存到網站或發布。</p>
              </div>
              <div role="group" aria-label="暫存操作">
                <button type="button" class="secondary-action" @click="autosaveDraft">暫存到這台裝置</button>
              </div>
            </section>
            <section class="management-row danger-settings">
              <div>
                <h3>刪除文章</h3>
                <p>已上傳的圖片會保留，刪除前還需要確認。</p>
              </div>
              <div role="group" aria-label="刪除文章操作">
                <button type="button" class="secondary-action danger-action" :disabled="!selectedPost.baseBlobSha || saving" @click="requestDelete">刪除文章</button>
              </div>
            </section>
          </details>
          <details class="workspace-settings" id="website-preview">
            <summary>檢查網站實際版面</summary>
            <p>網站預覽會使用目前內容，不會直接公開，也不會先儲存文章。</p>
            <p v-if="formalPreviewMessage" aria-live="polite">{{ safeMessage(formalPreviewMessage) }}</p>
            <div class="context-actions" role="group" aria-label="網站預覽操作">
              <a v-if="formalPreview?.status === 'ready' && formalPreview.url" class="primary-action" :href="formalPreview.url" target="_blank" rel="noreferrer">開啟網站預覽</a>
              <button type="button" class="secondary-action" @click="requestFormalPreview">建立網站預覽</button>
            </div>
          </details>
          <section class="publishing-center" aria-labelledby="publishing-title">
            <details class="workspace-settings">
              <summary id="publishing-title">發布設定與結果</summary>
              <p>儲存文章不會直接發布。定稿後，符合條件便會加入排程。</p>
              <p>{{ contentStatusLabel(selectedPost.status) }} · {{ releaseEstimate(selectedCandidate?.estimatedAt) }}</p>
              <p>{{ selectedPost.status === 'draft' ? '完成文章後，請確認定稿。' : selectedPost.status === 'published' ? '文章已標記公開，實際結果仍以公開確認紀錄為準。' : eligibilityReason(selectedCandidate?.reason) }}</p>
              <div v-if="selectedPost.status === 'draft'" role="group" aria-label="定稿操作">
                <button type="button" class="secondary-action" :disabled="saving || !selectedPost.baseBlobSha" @click="finalizePost">確認定稿</button>
                <p class="muted">定稿時會一併儲存；新文章請先儲存一次。</p>
              </div>
              <details v-if="selectedPost.status === 'ready'">
                <summary>立即發布這篇文章</summary>
                <p>這是人工例外操作。使用目前已儲存的內容；公開仍需網站更新與查證，不代表其他平台已同步或寄送通知。</p>
                <div role="group" aria-label="人工發布操作">
                  <button type="button" class="secondary-action" :disabled="manualPublishing || saving || articleDirty || !selectedPost.baseBlobSha" @click="publishNow">{{ manualPublishing ? '正在處理…' : '立即發布' }}</button>
                </div>
                <p v-if="articleDirty" class="muted">請先儲存目前修改，再進行發布。</p>
              </details>
              <details>
                <summary>舊文章的公開日期</summary>
                <p>這是舊文章保留的日期設定；一般排程請到發布管理調整。</p>
                <section class="schedule-panel">
                  <label>
                    日期
                    <input v-model="scheduleDate" type="date">
                  </label>
                  <label>
                    時間
                    <input v-model="scheduleTime" type="time">
                  </label>
                  <div role="group" aria-label="文章日期操作">
                    <button type="button" class="secondary-action" @click="applySchedule">套用到文章</button>
                  </div>
                  <p v-if="activeSchedule" class="schedule-state">{{ safeMessage(activeSchedule.label) }} · {{ safeMessage(activeSchedule.detail) }}</p>
                </section>
              </details>
              <div class="target-grid">
                <article>
                  <strong>GitHub Pages</strong>
                  <span class="badge">{{ pagesSummary?.label ?? (targetState('github_pages') ? publicationStatusLabel(targetState('github_pages')!.status) : '尚無發布紀錄') }}</span>
                  <template v-if="pagesSummary">
                    <small>部署：{{ pagesSummary.deployment }}</small>
                    <small>公開驗證：{{ pagesSummary.verification }}</small>
                    <small v-if="pagesSummary.verifiedAt">驗證時間：{{ pagesSummary.verifiedAt }}</small>
                    <a v-if="pagesSummary.url" :href="pagesSummary.url" target="_blank" rel="noopener noreferrer">查看已驗證文章</a>
                    <small>依已保存的發布與查核紀錄；讀取不會重新驗證，也不代表目前內容再次驗證。</small>
                  </template>
                  <small v-else>網站更新與公開確認分開記錄。</small>
                </article>

              </div>
              <SubstackStatusPanel v-if="selectedPost.baseBlobSha" :slug="selectedPost.slug" />
              <p v-else class="muted">尚未儲存的文章沒有可查核的平台狀態。</p>
              <p v-if="publicationMessage" class="editor-message" aria-live="polite">{{ safeMessage(publicationMessage) }}</p>
            </details>
          </section>
        </section>
        <div v-if="mediaOpen" class="dialog-backdrop" @click.self="closeMediaLibrary" @keydown="onMediaKeydown">
          <section ref="mediaDialogElement" class="media-dialog" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="media-title" aria-describedby="media-drop-help" @paste="onEditorPaste" @dragover.prevent @drop.prevent="onEditorDrop">
            <header class="media-header">
              <div>
                <p class="eyebrow">文章圖片</p>
                <h2 id="media-title">媒體庫</h2>
              </div>
              <div role="group" aria-label="媒體庫主要操作" class="context-actions">
                <button type="button" class="primary-action" @click="pickerElement?.click()">上傳圖片</button>
                <button type="button" class="secondary-action" @click="closeMediaLibrary">關閉</button>
              </div>
            </header>
            <p id="media-drop-help" class="media-drop-help">可以直接貼上圖片，或將圖片拖入這裡。貼上或拖入後，圖片會插入目前文章。</p>
            <div class="media-tools">
              <label>
                <span>搜尋媒體</span>
                <input v-model="mediaSearch" type="search" @input="loadMedia">
              </label>
              <input ref="pickerElement" class="visually-hidden" type="file" accept="image/webp,image/png,image/svg+xml" @change="onFileChange">
            </div>
            <p v-if="mediaMessage" class="editor-message" aria-live="polite">{{ safeMessage(mediaMessage) }}</p>
            <ul class="media-grid">
              <li v-for="item in media" :key="item.id" class="media-card">
                <img :src="item.url" :alt="`圖片預覽 ${item.key.split('/').pop()}`">
                <strong>{{ item.key.split('/').pop() }}</strong>
                <small>{{ item.width }}×{{ item.height }} · {{ Math.ceil(item.size / 1024) }} KB</small>
                <div class="media-card-actions" role="group" :aria-label="`圖片操作 ${item.key.split('/').pop()}`">
                  <button type="button" @click="insertMedia(item)">插入文章</button>
                </div>
                <details>
                  <summary>圖片管理</summary>
                  <label>
                    處理方式
                    <select v-model="mediaActions[item.id]">
                      <option value="" disabled>請選擇</option>
                      <option value="copy">複製圖片網址</option>
                      <option value="usage">查看使用位置</option>
                      <option value="replace">替換圖片</option>
                      <option value="delete">刪除圖片</option>
                    </select>
                  </label>
                  <div role="group" :aria-label="`管理圖片 ${item.key.split('/').pop()}`">
                    <button type="button" class="secondary-action" :disabled="!mediaActions[item.id]" @click="runMediaAction(item)">執行選擇</button>
                  </div>
                </details>
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

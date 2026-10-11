<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import type { QueueView, QueueControl, ReleaseRecord, OverridePreview } from '@gcake/admin-contract';
import { createPreviewRequests } from './release-preview';
import { releaseLabel, releaseEstimate, eligibilityReason } from './release-presentation';
const props = defineProps<{ csrfToken: string }>();
const emit = defineEmits<{ loaded: [QueueView] }>();
const queue = ref<QueueView>();
const message = ref('');
const busy = ref(false);
const tab = ref('預計發布');
const detail = ref<ReleaseRecord>();
const preview = ref<OverridePreview>();
const overrideSlug = ref('');
const overrideDate = ref('');
const overrideInput = ref<HTMLInputElement>();
const previewRequests = createPreviewRequests();
function clearPreview() {
  previewRequests.invalidate();
  preview.value = undefined;
}
async function openOverride(slug: string, estimatedAt?: string) {
  overrideSlug.value = slug;
  overrideDate.value = estimatedAt
    ? new Date(Date.parse(estimatedAt) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : '';
  clearPreview();
  await nextTick();
  overrideInput.value?.scrollIntoView({ block: 'center' });
  overrideInput.value?.focus({ preventScroll: true });
}
const plannedItems = computed(() =>
  [...(queue.value?.items.filter((i) => i.contentStatus === 'ready') ?? [])].sort(
    (a, b) => (a.estimatedAt ?? 'z').localeCompare(b.estimatedAt ?? 'z') || (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug),
  ),
);
const needsAttention = computed(
  () => queue.value?.items.filter((i) => i.reason || ['failed', 'verification-unknown'].includes(i.state)) ?? [],
);
async function request(path: string, body?: unknown) {
  const response = await fetch('/api/v1/releases' + path, {
    credentials: 'same-origin',
    ...(body
      ? {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': props.csrfToken,
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error?.message ?? '發布佇列無法載入。');
  return value;
}
async function load() {
  clearPreview();
  busy.value = true;
  try {
    queue.value = await request('');
    emit('loaded', queue.value!);
    message.value = '';
  } catch (e) {
    message.value = e instanceof Error ? e.message : '載入失敗。';
  } finally {
    busy.value = false;
  }
}
async function control(input: QueueControl) {
  clearPreview();
  busy.value = true;
  try {
    queue.value = await request('/action', input);
    emit('loaded', queue.value!);
    clearPreview();
    message.value = '操作已保存；預計時段不代表已公開。';
  } catch (e) {
    message.value = e instanceof Error ? e.message : '操作失敗。';
  } finally {
    busy.value = false;
  }
}
async function operation(path: string, id: string) {
  busy.value = true;
  try {
    detail.value = await request('/' + path, { id });
    await load();
    message.value = path === 'reverify' ? '已檢查公開頁與 RSS；請查看個別證據。' : '已提出安全重試。';
  } catch (e) {
    message.value = e instanceof Error ? e.message : '操作失敗。';
  } finally {
    busy.value = false;
  }
}
async function showDetail(id: string) {
  try {
    detail.value = await request('/' + id);
  } catch (e) {
    message.value = e instanceof Error ? e.message : '無法載入紀錄。';
  }
}
async function previewSlot() {
  try {
    const result = await previewRequests.run<OverridePreview>(() => request('/preview', {
      slug: overrideSlug.value,
      releaseAt: overrideDate.value + 'T07:00:00+08:00',
    }));
    if (result) {
      preview.value = result;
      message.value = '';
    }
  } catch (e) {
    message.value = e instanceof Error ? e.message : '預覽失敗。';
  }
}
function unlock(slug: string) {
  if (window.confirm('僅能解除確認未寫入 Git 的衝突承諾。確認重新計算此文章的預計時段？'))
    void control({ action: 'unlock', slug, confirmed: true });
}
onMounted(load);
defineExpose({ load });
</script>
<template>
  <section class="panel release-queue" aria-labelledby="release-queue-title">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Publishing Center</p>
        <h2 id="release-queue-title">長期發布排程</h2>
      </div>
      <button class="secondary-action" type="button" :disabled="busy" @click="load">重新整理排程</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="!queue && !message">正在載入排程……</p>
    <template v-if="queue">
      <div class="release-overview">
        <div class="release-policy">
          <strong>{{ queue.enabled ? '正式發布已啟用' : '正式發布尚未啟用' }}</strong>
          <span>每週一、四 07:00 起 · Asia／Taipei</span>
          <small>預計時段仍需等待部署及公開驗證。</small>
        </div>
        <dl class="release-summary">
          <div><dt>下一篇</dt><dd>{{ queue.plan[0] ? queue.items.find((i) => i.slug === queue!.plan[0].slug)?.title : '尚無候選文章' }}</dd></div>
          <div><dt>預計時段</dt><dd>{{ releaseEstimate(queue.plan[0]?.releaseAt) }}</dd></div>
          <div><dt>需處理</dt><dd>{{ needsAttention.length }} 篇</dd></div>
        </dl>
      </div>
      <nav aria-label="發布視圖" class="release-tabs">
        <button
          class="secondary-action"
          v-for="name in ['預計發布', '執行紀錄', '需處理']"
          :key="name"
          type="button"
          :aria-pressed="tab === name"
          @click="tab = name"
        >
          {{ name }}
        </button>
      </nav>
      <ul v-if="tab === '預計發布' || tab === '需處理'" class="release-list">
        <li v-for="item in tab === '需處理' ? needsAttention : plannedItems" :key="item.slug">
          <div>
            <strong class="release-title">{{ item.title }}</strong
            ><span class="release-context">{{ item.seriesSlug ? '系列：' + item.seriesSlug + '／第 ' + ((item.order ?? 0) + 1) + ' 篇' : '獨立文章' }}</span
            ><span class="release-time">{{
              releaseEstimate(
                item.estimatedAt,
                ['committed-slot', 'publishing', 'awaiting-verification', 'verified-public', 'failed', 'verification-unknown'].includes(
                  item.state,
                ),
              )
            }}</span
            ><span class="release-state">{{ releaseLabel(item.state) }} · {{ eligibilityReason(item.reason) }}</span>
          </div>
          <div class="release-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy"
              @click="
                control({
                  action: item.postPaused ? 'resume' : 'pause',
                  slug: item.slug,
                })
              "
            >
              {{ item.postPaused ? '恢復' : '暫停' }}</button
            ><button
              class="secondary-action"
              v-if="item.seriesSlug"
              type="button"
              :disabled="busy"
              @click="
                control({
                  action: item.seriesPaused ? 'resume' : 'pause',
                  scope: 'series',
                  slug: item.seriesSlug,
                })
              "
            >
              {{ item.seriesPaused ? '恢復系列' : '暫停系列' }}</button
            ><button
              class="secondary-action"
              v-if="item.reason === 'LEGACY_SCHEDULE_REQUIRES_ADOPTION'"
              type="button"
              @click="control({ action: 'adopt-auto', slug: item.slug })"
            >
              採用自動排程</button
            ><button
              class="secondary-action"
              type="button"
              @click="openOverride(item.slug, item.estimatedAt)"
            >
              指定時段</button
            ><button class="secondary-action" type="button" @click="control({ action: 'cancel-override', slug: item.slug })">
              取消固定
            </button>
          </div>
        </li>
      </ul>
      <ul v-else class="release-list">
        <li v-for="r in queue.releases" :key="r.id">
          <div>
            <strong>{{ queue.items.find((i) => i.slug === r.slug)?.title ?? r.slug }}</strong
            ><span>{{ r.unlockedAt ? '已解除承諾，保留紀錄' : releaseLabel(r.state) }} · {{ releaseEstimate(r.slot, true) }}</span
            ><span
              >頁面：{{ r.pageVerifiedAt ? '已驗證' : '未確認' }}／RSS：{{
                r.rssGuid ? '已出現' : '未確認'
              }}／Telegram：外部監控／未回報</span
            >
          </div>
          <div class="release-actions">
            <button class="secondary-action" type="button" @click="showDetail(r.id)">查看時間線</button
            ><button class="secondary-action" type="button" :disabled="busy" @click="operation('reverify', r.id)">檢查公開狀態</button
            ><button class="secondary-action" type="button" :disabled="busy || !queue.enabled" @click="operation('retry', r.id)">
              安全重試</button
            ><button
              class="secondary-action"
              v-if="
                r.state === 'failed' && ['GIT_CONFLICT', 'ELIGIBILITY_CHANGED'].includes(r.error ?? '') && !r.unlockedAt && !r.commitSha
              "
              type="button"
              @click="unlock(r.slug)"
            >
              解除衝突鎖定
            </button>
          </div>
        </li>
      </ul>
      <p v-if="tab === '執行紀錄' && !queue.releases.length">尚無發布執行紀錄。</p>
      <p class="release-note">Telegram 通知由外部監控處理，目前未回報。</p>
      <details class="release-blocked" v-for="blocked in queue.blockedSeries" :key="blocked.seriesSlug">
        <summary>{{ blocked.seriesSlug }}：系列待完成</summary>
        <ul>
          <li v-for="reason in blocked.reasons" :key="reason">{{ reason }}</li>
        </ul>
      </details>
      <form v-if="overrideSlug" class="release-override" @submit.prevent="previewSlot">
        <p class="eyebrow">時段調整</p>
        <h3>{{ queue.items.find((i) => i.slug === overrideSlug)?.title ?? overrideSlug }}</h3>
        <label>預計發布日期<input ref="overrideInput" v-model="overrideDate" type="date" required @input="clearPreview" /></label>
        <p>週一或週四 07:00 起；先預覽衝突與後續日期。</p>
        <button class="secondary-action" type="submit">預覽變動</button>
        <div v-if="preview" class="release-preview">
          <p v-if="preview.conflicts.length" role="alert">無法確認：{{ preview.conflicts.join('、') }}</p>
          <h4>預覽結果 · 影響 {{ preview.affected.length }} 篇</h4>
          <p class="release-note">以下變動尚未保存。確認後才固定時段；取消固定會重新依自動排程估算。</p>
          <ul class="release-changes">
            <li v-for="change in preview.affected" :key="change.slug">
              <strong>{{ queue.items.find((i) => i.slug === change.slug)?.title ?? change.slug }}</strong>
              <dl><div><dt>原時段</dt><dd>{{ releaseEstimate(change.before) }}</dd></div>
              <div><dt>調整後</dt><dd>{{ releaseEstimate(change.after) }}</dd></div></dl>
            </li>
          </ul>
          <button
            class="primary-action"
            type="button"
            :disabled="busy || preview.conflicts.length > 0"
            @click="
              control({
                action: 'override',
                slug: overrideSlug,
                releaseAt: preview.releaseAt,
                version: preview.version,
                revision: preview.revision,
              })
            "
          >
            確認固定時段
          </button>
        </div>
      </form>
      <section v-if="detail" aria-label="發布事件時間線">
        <h3>發布時間線</h3>
        <p>release id：{{ detail.id }}</p>
        <p>
          Git：{{ detail.commitSha ?? detail.sourceRevision }}／部署：{{ detail.deployment?.state ?? '未觀察' }}／最後驗證：{{
            detail.verifiedAt ?? detail.pageVerifiedAt ?? '未確認'
          }}
        </p>
        <p>
          RSS GUID：{{ detail.rssGuid ?? '尚未出現' }}／下次檢查：{{ detail.nextRetryAt ?? '未安排' }}／錯誤：{{ detail.error ?? '無' }}
        </p>
        <ol>
          <li v-for="(e, i) in detail.events" :key="i">{{ e.at }}　{{ e.type }}　{{ e.detail }}</li>
        </ol>
      </section>
    </template>
  </section>
</template>
<style scoped>
.release-queue {
  margin-block: 1.5rem;
  padding: 1.25rem;
  min-width: 0;
}
.release-tabs,
.release-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.release-tabs {
  margin-block: 1rem;
}
.release-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.release-list > li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--rule);
  align-items: flex-start;
  padding-block: 1rem;
}
.release-list span,
.release-list small {
  display: block;
  margin-top: 0.35rem;
}
.release-list > li > div:first-child {
  min-width: 0;
}
.release-queue p,
.release-queue li {
  overflow-wrap: anywhere;
}
.release-queue button {
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}
.release-queue button:focus-visible,
.release-queue input:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
.release-tabs button[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.release-override {
  margin-block: 1rem;
}
.release-override input {
  display: block;
  margin-top: 0.5rem;
}
.release-overview { border-bottom: 1px solid var(--rule); padding-block: 1rem 1.5rem; }
.release-policy { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem 1rem; }
.release-policy strong { font-size: .95rem; }
.release-policy span, .release-policy small, .release-note, .release-context, .release-state { color: var(--muted); font-size: .82rem; }
.release-policy small { flex-basis: 100%; }
.release-summary { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) auto; gap: 1.25rem; margin: 1.5rem 0 0; }
.release-summary dt, .release-changes dt { color: var(--muted); font-size: .75rem; margin-bottom: .4rem; }
.release-summary dd, .release-changes dd { margin: 0; }
.release-summary dd { font-weight: 650; line-height: 1.6; }
.release-list > li { gap: 2rem; padding-block: 1.5rem; }
.release-title { display: block; font-size: 1.05rem; line-height: 1.6; }
.release-list .release-time { color: var(--accent); font-size: .95rem; font-weight: 650; margin-block: .75rem .25rem; }
.release-actions { max-width: 21rem; justify-content: flex-end; }
.release-queue button { min-height: 44px; font-size: .82rem; }
.release-blocked { padding-block: .6rem; color: var(--muted); font-size: .85rem; }
.release-override { border: 1px solid var(--rule); background: var(--paper-deep); padding: 1.5rem; margin-block: 2rem; }
.release-override h3 { font-size: 1.15rem; line-height: 1.6; margin: 0 0 1.25rem; }
.release-override label { display: block; font-size: .82rem; color: var(--muted); }
.release-override input { min-height: 44px; padding: .5rem .75rem; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); border-radius: 5px; font: inherit; }
.release-override > p:not(.eyebrow) { color: var(--muted); font-size: .82rem; }
.release-preview { margin-top: 1.5rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
.release-preview h4 { font-size: 1rem; margin: 0; }
.release-changes { padding: 0; list-style: none; margin: 1rem 0; }
.release-changes > li { border-bottom: 1px solid var(--rule); padding-block: 1rem; }
.release-changes strong { font-size: .9rem; line-height: 1.6; }
.release-changes dl { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-block: .75rem 0; }
.release-changes dd { font-size: .85rem; line-height: 1.6; }
.release-changes dl > div:last-child dd { color: var(--accent); font-weight: 650; }
@media (max-width: 640px) {
  .release-list > li {
    flex-direction: column;
  }
  .release-summary, .release-changes dl { grid-template-columns: 1fr; }
  .release-actions { width: 100%; }
  .release-actions button { flex: 1 1 auto; }
  .panel-heading {
    flex-wrap: wrap;
  }
  .release-queue {
    padding: 1rem;
  }
}
</style>

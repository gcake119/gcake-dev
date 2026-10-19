<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import type { QueueView, QueueControl, ReleaseRecord, OverridePreview } from '@gcake/admin-contract';
import { publicationStatusLabel, safeMessage } from './workflow-presentation';
import { createPreviewRequests } from './release-preview';
import { releaseLabel, releaseEstimate, eligibilityReason } from './release-presentation';
const props = defineProps<{ csrfToken: string; compact?: boolean; seriesTitles?: Record<string, string> }>();
const emit = defineEmits<{ loaded: [QueueView]; 'view-publishing': [] }>();
const queue = ref<QueueView>();
const message = ref('');
const busy = ref(false);
const queueActions = ref<Record<string, string>>({});
const recordActions = ref<Record<string, string>>({});
const knownFixed = ref<Record<string, string>>({});
const seriesGroups = computed(() => [...new Set(queue.value?.items.map(i => i.seriesSlug).filter((v): v is string => Boolean(v)))].map(slug => ({slug, title: props.seriesTitles?.[slug] ?? '所屬系列', paused: queue.value?.items.some(i => i.seriesSlug === slug && i.seriesPaused) ?? false})));
function isFixed(slug: string): boolean { return Boolean(knownFixed.value[slug]) && Date.parse(knownFixed.value[slug]) > Date.now(); }
function cancelOverride() { clearPreview(); overrideSlug.value = ''; }
async function applyQueueAction(slug: string) {
  const action = queueActions.value[slug];
  const item = queue.value?.items.find(i => i.slug === slug);
  if (!item) return;
  if (action === 'time') await openOverride(slug, item.estimatedAt);
  else if (action === 'pause') await control({action: item.postPaused ? 'resume' : 'pause', slug});
  else if (action === 'auto') await control({action:'adopt-auto',slug});
  else if (action === 'cancel' && isFixed(slug)) await control({action:'cancel-override',slug});
}
async function applyRecordAction(record: ReleaseRecord) {
  const action = recordActions.value[record.id];
  if (action === 'check') await operation('reverify', record.id);
  else if (action === 'retry') await operation('retry', record.id);
  else if (action === 'unlock') unlock(record.slug);
}

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
  knownFixed.value = {};
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
  if (busy.value) return;
  clearPreview();
  busy.value = true;
  try {
    queue.value = await request('/action', input);
    knownFixed.value = input.action === 'override' && input.releaseAt ? { [input.slug]: input.releaseAt } : {};
    if (input.action === 'override') overrideSlug.value = '';
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
  if (busy.value) return;
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
  if (busy.value) return;
  busy.value = true;
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
  } finally { busy.value = false; }
}
function unlock(slug: string) {
  if (window.confirm('確認重新計算這篇文章的發布時間？只有確定尚未儲存發布內容的衝突才能解除。'))
    void control({ action: 'unlock', slug, confirmed: true });
}
onMounted(load);
defineExpose({ load });
</script>
<template>
  <section class="panel release-queue" :class="{ 'release-compact': props.compact }" aria-labelledby="release-queue-title">
    <header class="panel-heading">
      <div>
        <p class="eyebrow">{{ props.compact ? '發布摘要' : '發布管理' }}</p>
        <h2 id="release-queue-title">{{ props.compact ? '接下來的發布安排' : '發布進度與安排' }}</h2>
      </div>
      <a v-if="props.compact" href="#publishing" @click.prevent="emit('view-publishing')">前往發布管理</a>
      <div v-else role="group" aria-label="排程查詢操作">
        <button class="secondary-action" type="button" :disabled="busy" @click="load">重新整理</button>
      </div>
    </header>
    <p v-if="message" role="status">{{ safeMessage(message, '目前無法完成排程操作，請重新查看狀態後再試。') }}</p>
    <p v-if="!queue && !message" role="status">正在載入發布安排…</p>
    <template v-if="queue">
      <dl class="release-summary">
        <div>
          <dt>下一篇</dt>
          <dd>{{ queue.plan[0] ? queue.items.find(i => i.slug === queue!.plan[0].slug)?.title : '尚無待發布文章' }}</dd>
        </div>
        <div>
          <dt>預計發布時間</dt>
          <dd>{{ releaseEstimate(queue.plan[0]?.releaseAt) }}</dd>
        </div>
        <div>
          <dt>需處理</dt>
          <dd>
            <a v-if="props.compact" href="#publishing" @click.prevent="tab = '需處理'; emit('view-publishing')">{{ needsAttention.length }} 篇</a>
            <span v-else>{{ needsAttention.length }} 篇</span>
          </dd>
        </div>
      </dl>
      <p v-if="props.compact" class="release-note">預計時間不代表已公開；有待處理項目時，請到發布管理查看。</p>
      <template v-else>
        <div class="release-policy">
          <strong>{{ queue.enabled ? '自動發布已啟用' : '自動發布尚未啟用' }}</strong>
          <span>每週一、四，台北時間 07:00 起</span>
          <p>預計時間仍需等待網站更新與公開確認。</p>
        </div>
        <label class="release-view">
          查看內容
          <select v-model="tab" aria-label="發布視圖">
            <option>預計發布</option>
            <option>執行紀錄</option>
            <option>需處理</option>
          </select>
        </label>
        <ul v-if="tab !== '執行紀錄'" class="release-list">
          <li v-for="item in tab === '需處理' ? needsAttention : plannedItems" :key="item.slug">
            <div class="release-item-copy">
              <strong class="release-title">{{ item.title }}</strong>
              <span class="release-context">{{ item.seriesSlug ? (props.seriesTitles?.[item.seriesSlug] ?? '系列文章') + '／第 ' + ((item.order ?? 0) + 1) + ' 篇' : '獨立文章' }}</span>
              <span class="release-time">{{ releaseEstimate(item.estimatedAt, ['committed-slot', 'publishing', 'awaiting-verification', 'verified-public', 'failed', 'verification-unknown'].includes(item.state)) }}</span>
              <span class="release-state">{{ releaseLabel(item.state) }} · {{ eligibilityReason(item.reason) }}</span>
            </div>
            <div class="release-actions" role="group" :aria-label="`發布文章操作 ${item.title}`">
              <details class="queue-more">
                <summary>查看與調整</summary>
                <p>{{ releaseLabel(item.state) }} · {{ eligibilityReason(item.reason) }}</p>
                <p v-if="isFixed(item.slug)">已固定時間：{{ releaseEstimate(knownFixed[item.slug]) }}</p>
                <p v-else class="release-note">尚無固定時間的確認結果，因此不提供取消固定的操作。</p>
                <label>
                  處理方式
                  <select v-model="queueActions[item.slug]">
                    <option value="" disabled>請選擇</option>
                    <option value="time">調整發布時間</option>
                    <option value="pause">{{ item.postPaused ? '恢復這篇的排程' : '暫停這篇的排程' }}</option>
                    <option v-if="item.reason === 'LEGACY_SCHEDULE_REQUIRES_ADOPTION'" value="auto">採用自動安排</option>
                    <option v-if="isFixed(item.slug)" value="cancel">恢復自動安排</option>
                  </select>
                </label>
                <button class="secondary-action" type="button" :disabled="busy || !queueActions[item.slug]" @click="applyQueueAction(item.slug)">執行選擇</button>
              </details>
            </div>
          </li>
        </ul>
        <p v-if="tab === '需處理' && !needsAttention.length" class="empty">目前沒有需要處理的文章。</p>
        <p v-if="tab === '預計發布' && !plannedItems.length" class="empty">目前沒有待發布文章，請先完成文章並確認定稿。</p>
        <ul v-if="tab === '執行紀錄'" class="release-list">
          <li v-for="r in queue.releases" :key="r.id">
            <div>
              <strong>{{ queue.items.find(i => i.slug === r.slug)?.title ?? '文章發布紀錄' }}</strong>
              <span>{{ r.unlockedAt ? '已解除原安排，保留紀錄' : releaseLabel(r.state) }} · {{ releaseEstimate(r.slot, true) }}</span>
              <span>公開頁面：{{ r.pageVerifiedAt ? '已確認' : '待確認' }}／訂閱更新：{{ r.rssGuid ? '已出現' : '待確認' }}／Telegram：尚未回報</span>
            </div>
            <div class="release-actions" role="group" aria-label="發布紀錄操作">
              <button type="button" class="secondary-action" @click="showDetail(r.id)">查看時間線</button>
              <details>
                <summary>檢查與恢復</summary>
                <label>
                  處理方式
                  <select v-model="recordActions[r.id]">
                    <option value="" disabled>請選擇</option>
                    <option value="check">檢查公開結果</option>
                    <option v-if="queue.enabled && r.state === 'failed'" value="retry">重試失敗的發布</option>
                    <option v-if="r.state === 'failed' && ['GIT_CONFLICT', 'ELIGIBILITY_CHANGED'].includes(r.error ?? '') && !r.unlockedAt && !r.commitSha" value="unlock">重新安排衝突文章</option>
                  </select>
                </label>
                <p class="release-note">結果未知時先檢查公開頁面，不直接重複發布。</p>
                <button type="button" class="secondary-action" :disabled="busy || !recordActions[r.id]" @click="applyRecordAction(r)">執行選擇</button>
              </details>
            </div>
          </li>
        </ul>
        <p v-if="tab === '執行紀錄' && !queue.releases.length" class="empty">尚無發布紀錄。</p>
        <details v-if="seriesGroups.length" class="series-release-settings">
          <summary>整個系列的安排</summary>
          <p class="release-note">這裡的暫停只影響本站安排，不代表 Substack 已解除排程。</p>
          <div v-for="group in seriesGroups" :key="group.slug" class="series-release-row">
            <strong>{{ group.title }}</strong>
            <div role="group" :aria-label="`系列排程操作 ${group.title}`">
              <button type="button" class="secondary-action" :disabled="busy" @click="control({action: group.paused ? 'resume' : 'pause',scope:'series',slug:group.slug})">{{ group.paused ? '恢復整個系列' : '暫停整個系列' }}</button>
            </div>
          </div>
        </details>
        <p class="release-note">Telegram 通知由外部監控處理，目前未回報。</p>
        <details v-for="blocked in queue.blockedSeries" :key="blocked.seriesSlug" class="release-blocked">
          <summary>{{ props.seriesTitles?.[blocked.seriesSlug] ?? '系列' }}：仍有待完成內容</summary>
          <ul>
            <li v-for="reason in blocked.reasons" :key="reason">{{ safeMessage(reason, '請查看系列內尚未定稿、缺少內容或狀態不一致的文章。') }}</li>
          </ul>
        </details>
        <form v-if="overrideSlug" class="release-override" @submit.prevent="previewSlot">
          <p class="eyebrow">調整發布時間</p>
          <h3>{{ queue.items.find(i => i.slug === overrideSlug)?.title ?? '選定文章' }}</h3>
          <template v-if="!preview">
            <label>
              預計發布日期
              <input ref="overrideInput" v-model="overrideDate" type="date" required @input="clearPreview">
            </label>
            <p>週一或週四，台北時間 07:00 起。先查看與其他文章的安排是否衝突。</p>
            <div role="group" aria-label="時間調整預覽操作" class="context-actions">
              <button class="primary-action" type="submit" :disabled="busy">查看影響</button>
              <button class="secondary-action" type="button" @click="cancelOverride">取消</button>
            </div>
          </template>
          <div v-else class="release-preview">
            <p v-if="preview.conflicts.length" role="alert">目前無法調整：{{ preview.conflicts.map(reason => safeMessage(reason, '這個時間已有安排或不符合發布條件，請返回修改。')).join('、') }}</p>
            <h4>影響 {{ preview.affected.length }} 篇文章</h4>
            <p class="release-note">尚未儲存。確認後才會固定時間。</p>
            <ul class="release-changes">
              <li v-for="change in preview.affected" :key="change.slug">
                <strong>{{ queue.items.find(i => i.slug === change.slug)?.title ?? '受影響文章' }}</strong>
                <dl>
                  <div>
                    <dt>原時間</dt>
                    <dd>{{ releaseEstimate(change.before) }}</dd>
                  </div>
                  <div>
                    <dt>調整後</dt>
                    <dd>{{ releaseEstimate(change.after) }}</dd>
                  </div>
                </dl>
              </li>
            </ul>
            <div role="group" aria-label="確認時間調整操作" class="context-actions">
              <button type="button" class="primary-action" :disabled="busy || preview.conflicts.length > 0" @click="control({action:'override',slug:overrideSlug,releaseAt:preview.releaseAt,version:preview.version,revision:preview.revision})">確認調整</button>
              <button type="button" class="secondary-action" @click="clearPreview">返回修改</button>
            </div>
          </div>
        </form>
        <section v-if="detail" class="release-timeline" aria-label="發布事件時間線">
          <h3>發布時間線</h3>
          <p>公開結果：{{ releaseLabel(detail.state) }}。網站更新：{{ publicationStatusLabel(detail.deployment?.state) }}。</p>
          <p>最後確認：{{ detail.verifiedAt ?? detail.pageVerifiedAt ?? '尚未確認' }}／下次檢查：{{ detail.nextRetryAt ?? '未安排' }}</p>
          <p v-if="detail.error">{{ safeMessage(detail.error, '處理遇到問題，請先檢查公開結果，再依目前狀態處理。') }}</p>
          <ol>
            <li v-for="(event, i) in detail.events" :key="i">
              {{ new Date(event.at).toLocaleString('zh-TW', {timeZone:'Asia/Taipei'}) }}
              {{ releaseLabel(event.type) }}
              <span v-if="event.detail">　{{ safeMessage(event.detail, '處理紀錄已保留，請以目前公開狀態為準。') }}</span>
            </li>
          </ol>
        </section>
      </template>
    </template>
  </section>
</template>
<style scoped>
.release-queue{padding:var(--space-20) 0;min-width:0}.release-compact{border-bottom:1px solid var(--rule);margin-bottom:var(--space-32)}.release-compact h2{font-size:var(--text-heading)}.release-summary{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.3fr) auto;gap:var(--space-20);margin:var(--space-16) 0}.release-summary dt{font-size:var(--text-small);line-height:1.7;color:var(--muted)}.release-summary dd{margin:0;font-weight:650;line-height:1.6}.release-policy{margin-block:var(--space-24);color:var(--ink-soft)}.release-policy span{margin-left:var(--space-16)}.release-policy p,.release-note,.release-context,.release-state{font-size:var(--text-small);line-height:1.7;color:var(--muted)}.release-view{display:grid;gap:var(--space-8);max-width:15rem}.release-list{list-style:none;padding:0;margin:var(--space-16) 0}.release-list>li{display:flex;justify-content:space-between;gap:var(--space-32);padding:var(--space-24) 0;border-bottom:1px solid var(--rule)}.release-list span{display:block;margin-top:var(--space-4)}.release-item-copy{min-width:0;flex:1}.release-title{font-size:var(--text-body)}.release-time{color:var(--accent);font-weight:650}.release-actions{display:flex;align-items:start;gap:var(--space-8);max-width:22rem}.queue-more{min-width:7rem}.release-actions details{max-width:16rem}.release-actions select{width:100%}.release-queue select,.release-queue input{min-height:var(--control-size);border:1px solid var(--rule);border-radius:var(--radius-control);background:var(--paper);color:var(--ink);font:inherit;font-size:var(--text-body);padding:var(--space-8) var(--space-8);max-width:100%}.release-queue label{display:grid;gap:var(--space-8);font-size:var(--text-small);line-height:1.7;color:var(--muted)}.release-queue summary{min-height:var(--control-size);cursor:pointer;color:var(--accent);padding:var(--space-8) 0}.release-queue button{min-height:var(--control-size);font-size:var(--text-body)}.series-release-settings,.release-blocked{border-top:1px solid var(--rule);margin-top:var(--space-16);padding-top:var(--space-8)}.series-release-row{display:flex;align-items:center;justify-content:space-between;gap:var(--space-16);padding:var(--space-16) 0}.release-override,.release-timeline{padding:var(--space-24);margin-top:var(--space-24);background:var(--paper-deep);border:1px solid var(--rule)}.release-override h3{font-size:var(--text-heading)}.release-preview{margin-top:var(--space-16)}.release-changes{list-style:none;padding:0}.release-changes>li{padding:var(--space-16) 0;border-bottom:1px solid var(--rule)}.release-changes dl{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-16)}.release-changes dd{margin:0}.release-changes dt{font-size:var(--text-small);line-height:1.7;color:var(--muted)}.queue-item-detail{margin-top:var(--space-16);font-size:var(--text-small);line-height:1.7}.release-timeline{overflow-wrap:anywhere}@media(max-width:760px){.release-summary{grid-template-columns:1fr}.release-list>li{flex-direction:column;gap:var(--space-16)}.release-actions{max-width:100%;flex-wrap:wrap}.release-policy span{display:block;margin-left:0}.series-release-row{align-items:start;flex-direction:column}.release-changes dl{grid-template-columns:1fr}.release-override{padding:var(--space-16)}}
/* Shared disclosure and field/action rhythm; actual distances are browser-verified. */
.release-actions details > button { margin-top:var(--space-16); }
.release-actions details > p { margin-bottom:var(--space-12); }
.release-actions details > label + p { margin-top:var(--space-8); margin-bottom:0; }
.release-override { display:grid; gap:var(--space-12); }
.release-override > p, .release-override > h3 { margin:0; }
.release-override > .context-actions { margin-top:var(--space-4); }
.release-preview { display:grid; gap:var(--space-12); margin-top:0; }
.release-preview > p, .release-preview > h4, .release-preview > ul { margin:0; }
.release-preview > ul:empty { display:none; }
.release-preview > .context-actions { margin-top:var(--space-4); }
.release-blocked > ul { margin:0; padding-left:var(--space-24); }
</style>

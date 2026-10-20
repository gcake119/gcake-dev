<script setup lang="ts">
import {computed,onUnmounted,ref,watch} from 'vue';
import {createStatusReader,emptyStatusState,statusPresentation} from './substack-status';
const props=defineProps<{slug?:string;titles?:Record<string,string>}>();
const emit=defineEmits<{select:[slug:string]}>();
const snapshot=ref(emptyStatusState());
const reader=createStatusReader(value=>{snapshot.value=value;});
const rows=computed(()=>snapshot.value.rows.map(row=>({row,view:statusPresentation(row),title:props.titles?.[row.slug]??row.slug})));
const headingId=computed(()=>props.slug?'substack-article-status-title':'substack-status-title');
function refresh(){void reader.load(props.slug,snapshot.value.page?.offset??0);}
function page(offset:number){void reader.load(undefined,offset);}
watch(()=>props.slug,()=>{void reader.load(props.slug);},{immediate:true});
onUnmounted(()=>reader.dispose());
</script>
<template>
  <section class="substack-status" :aria-labelledby="headingId" :aria-busy="snapshot.loading">
    <header class="panel-heading">
      <div>
        <h2 :id="headingId">Substack 狀態</h2>
        <p class="muted">最後查核結果。讀取不會啟動同步、發布或寄送。</p>
      </div>
      <button class="secondary-action" type="button" :disabled="snapshot.loading" @click="refresh">重新讀取狀態</button>
    </header>
    <p v-if="snapshot.loading" role="status" class="muted">正在讀取狀態…</p>
    <p v-if="snapshot.error" role="alert" class="substack-read-error">{{ snapshot.error }} <a v-if="snapshot.loginRequired" href="/api/v1/auth/login">使用 GitHub 重新登入</a></p>
    <p v-if="snapshot.untracked" class="empty">尚未追蹤這篇文章的 Substack 狀態，無法據此判斷平台是否已有草稿。</p>
    <p v-else-if="snapshot.loaded && !snapshot.loading && !snapshot.error && !rows.length" class="empty">目前沒有已追蹤的 Substack 文章。</p>
    <article v-for="item in rows" :key="item.row.slug" class="substack-status-row" :aria-label="item.title">
      <header v-if="!props.slug" class="substack-row-heading">
        <h3><button v-if="props.titles?.[item.row.slug]" type="button" class="substack-open" @click="emit('select',item.row.slug)">{{ item.title }}</button><template v-else>{{ item.title }}</template></h3>
      </header>
      <dl class="substack-evidence">
        <div><dt>草稿同步</dt><dd><strong :data-tone="item.view.sync.tone">{{ item.view.sync.label }}</strong><span v-if="item.view.sync.detail">{{ item.view.sync.detail }}</span></dd></div>
        <div><dt>發布</dt><dd><strong :data-tone="item.view.publication.tone">{{ item.view.publication.label }}</strong><span v-if="item.view.publication.detail">{{ item.view.publication.detail }}</span></dd></div>
        <div><dt>寄送</dt><dd><strong :data-tone="item.view.delivery.tone">{{ item.view.delivery.label }}</strong><span>{{ item.view.receipt }}</span><span v-if="item.view.delivery.detail">{{ item.view.delivery.detail }}</span></dd></div>
      </dl>
      <p v-if="item.view.attention" class="substack-attention" role="status">{{ item.view.attention }}</p>
      <p class="substack-check">最近查核：{{ item.view.checkedAt }}<span>Substack 編號：{{ item.row.providerId ?? '尚未確認' }}</span></p>
    </article>
    <nav v-if="!props.slug && snapshot.page && (snapshot.page.offset > 0 || snapshot.page.hasMore)" class="substack-pagination" aria-label="Substack 狀態分頁">
      <span>第 {{ snapshot.page.offset + 1 }}～{{ snapshot.page.offset + rows.length }} 筆</span>
      <div role="group" aria-label="狀態分頁操作" class="context-actions">
        <button type="button" class="secondary-action" :disabled="snapshot.loading || snapshot.page.offset === 0" @click="page(Math.max(0,snapshot.page.offset-snapshot.page.limit))">上一頁</button>
        <button type="button" class="secondary-action" :disabled="snapshot.loading || !snapshot.page.hasMore" @click="page(snapshot.page.offset+snapshot.page.limit)">下一頁</button>
      </div>
    </nav>
  </section>
</template>

<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref} from 'vue';
import {createIndexStatusReader,progressPresentation,assessmentLabels,type IndexReadState} from './index-status';
import {taipeiTime} from './substack-status';
const snapshot=ref<IndexReadState>({data:null,loading:false,error:null,loginRequired:false,lastReadAt:null,refreshAvailableAt:0});
const reader=createIndexStatusReader(value=>{snapshot.value=value;});
const data=computed(()=>snapshot.value.data);
const progress=computed(()=>progressPresentation(data.value?.snapshot.reportedCompleted,data.value?.source?.total,!!data.value?.source&&data.value.source.corpusId===data.value.snapshot.targetCorpusId));
const status=computed(()=>{if(!data.value)return '';if(progress.value.kind==='known'&&progress.value.percent===100&&data.value.assessment==='in_progress')return '段落已處理，等待完整確認';return assessmentLabels[data.value.assessment]??'目前狀態待確認';});
const label=computed(()=>snapshot.value.error?'上次記錄進度':'已記錄驗證進度');
const time=(value:number|string|null|undefined)=>value?taipeiTime(typeof value==='number'?new Date(value).toISOString():value):'尚無確認時間';
const visibility=()=>reader.activate(document.visibilityState==='visible');
onMounted(()=>{document.addEventListener('visibilitychange',visibility);visibility();});
onUnmounted(()=>{document.removeEventListener('visibilitychange',visibility);reader.dispose();});
</script>
<template>
 <section class="index-status" aria-labelledby="index-status-title" :aria-busy="snapshot.loading">
  <header class="panel-heading"><h2 id="index-status-title">搜尋索引</h2><button type="button" class="secondary-action" :disabled="snapshot.loading" @click="reader.load()">{{ snapshot.loading ? '正在讀取…' : '重新讀取' }}</button></header>
  <p v-if="snapshot.error" class="index-status-error" role="alert">{{ snapshot.error }} <a v-if="snapshot.loginRequired" href="/api/v1/auth/login">重新登入</a></p>
  <p v-if="!data && snapshot.loading" role="status" class="muted">正在讀取搜尋索引…</p>
  <template v-if="data">
   <div class="index-progress-caption"><span id="index-progress-label">{{ label }}</span><span v-if="progress.kind === 'known'" class="index-progress-number">{{ progress.completed.toLocaleString() }}／{{ progress.total.toLocaleString() }} 段<span>{{ progress.percent }}％</span></span><span v-else>{{ progress.kind === 'empty' ? '目前沒有可建立索引的公開段落' : data.assessment === 'source_changed' ? '公開版本已變，等待對齊' : '總數待核對' }}</span></div>
   <progress v-if="progress.kind === 'known'" class="index-progress" :class="{'index-progress-stale': snapshot.error}" :value="progress.completed" :max="progress.total" aria-labelledby="index-progress-label" aria-describedby="index-progress-state index-last-observed">{{ progress.percent }}％</progress>
   <div v-else-if="progress.kind !== 'empty'" class="index-progress index-progress-unknown" role="progressbar" aria-labelledby="index-progress-label" aria-valuetext="總數待核對，無法顯示完成比例" aria-describedby="index-progress-state" />
   <p id="index-progress-state" class="index-process-state" role="status" aria-live="polite">{{ status }}</p>
   <dl class="index-status-details"><div><dt>待確認段數</dt><dd>{{ data.snapshot.pendingCount.toLocaleString() }} 段</dd></div><div v-if="data.snapshot.nextAttemptAt"><dt>下一次可續作</dt><dd>{{ time(data.snapshot.nextAttemptAt) }}</dd></div><div><dt>最後讀取</dt><dd id="index-last-observed">{{ time(data.snapshot.observedAt) }}{{ snapshot.error ? '（上次成功資料）' : '' }}</dd></div><div><dt>最後進度紀錄</dt><dd>{{ time(data.snapshot.lastProgressAt) }}</dd></div><div><dt>容量證據到期</dt><dd>{{ time(data.snapshot.capacityValidUntil) }}</dd></div><div><dt>使用資格到期</dt><dd>{{ time(data.snapshot.billingValidUntil) }}</dd></div></dl>
   <p class="index-acceptance">語意搜尋：尚無本輪驗收結果。索引進度不代表搜尋驗證通過。</p>
  </template>
 </section>
</template>

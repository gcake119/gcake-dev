<script setup lang="ts">
import {onMounted,onUnmounted,ref} from 'vue';
import {createAlertHistoryReader,alertDeliveryLabels,alertMonitorLabels,alertReasonLabels,type AlertReadState} from './index-alerts';
import {taipeiTime} from './substack-status';
const state=ref<AlertReadState>({data:null,loading:false,error:null,loginRequired:false,lastReadAt:null,refreshAvailableAt:0});
const reader=createAlertHistoryReader(value=>{state.value=value;});
const time=(value:number|string|null)=>value===null?'尚無紀錄':taipeiTime(typeof value==='number'?new Date(value).toISOString():value);
onMounted(()=>{void reader.load();});
onUnmounted(()=>reader.dispose());
</script>
<template>
 <section class="index-alert-history" aria-labelledby="index-alert-title" :aria-busy="state.loading">
  <header class="panel-heading"><h3 id="index-alert-title">索引通知紀錄</h3><button class="secondary-action" type="button" :disabled="state.loading" @click="reader.load()">{{ state.loading?'正在讀取…':'重新讀取通知' }}</button></header>
  <p v-if="state.error" role="alert">{{ state.error }} <a v-if="state.loginRequired" href="/api/v1/auth/login">重新登入</a></p>
  <p v-if="state.loading&&!state.data" role="status" class="muted">正在讀取通知紀錄…</p>
  <template v-if="state.data">
   <p class="alert-monitor-state">{{ alertMonitorLabels[state.data.monitor.status] }}</p>
   <p v-if="state.data.monitor.status==='paused'">{{ alertReasonLabels[state.data.monitor.reason]??'請人工核對監測狀態。' }}</p>
   <dl class="alert-times"><div><dt>背景最後檢查</dt><dd>{{ time(state.data.monitor.checkedAt) }}</dd></div><div><dt>監測期限</dt><dd>{{ time(state.data.monitor.validUntil) }}</dd></div><div><dt>{{ state.error?'上次讀取紀錄':'本頁最後讀取' }}</dt><dd>{{ time(state.lastReadAt) }}</dd></div></dl>
   <p v-if="!state.data.events.length" class="muted">尚無通知事件；一般進度不寄送通知。</p>
   <ol v-else class="alert-events">
    <li v-for="event in state.data.events" :key="event.id">
     <p class="alert-event-title">{{ alertReasonLabels[event.reason]??'索引狀態需要人工核對' }}</p>
     <p>{{ alertDeliveryLabels[event.delivery] }}</p>
     <p class="muted">事件時間：{{ time(event.createdAt) }}<template v-if="event.deliveredAt!==null">；確認接收：{{ time(event.deliveredAt) }}</template></p>
     <p class="muted">版本：{{ event.corpusId.slice(0,12) }}</p>
    </li>
   </ol>
   <p class="muted">Telegram 確認接收不代表已讀；同步完成候選不代表搜尋品質已通過。</p>
  </template>
 </section>
</template>
<style scoped>
.index-alert-history{margin-top:var(--space-24);padding-top:var(--space-24);border-top:1px solid var(--rule);}
.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-16);flex-wrap:wrap;}
h3{margin:0;font-size:var(--text-heading);line-height:1.45;font-weight:650;}
p{margin:var(--space-12) 0;font-size:var(--text-body);line-height:1.8;overflow-wrap:anywhere;}
.muted,.alert-times{font-size:var(--text-small);line-height:1.7;}
.muted,dt{color:var(--muted);}
.alert-times{display:flex;flex-wrap:wrap;gap:var(--space-16) var(--space-24);margin:var(--space-16) 0;}
dd{margin:var(--space-8) 0 0;font-variant-numeric:tabular-nums;}
.alert-events{list-style:none;margin:var(--space-24) 0;padding:0;}
.alert-events li{padding:var(--space-16) 0;border-top:1px solid var(--rule);}
.alert-event-title,.alert-monitor-state{font-weight:650;}
.secondary-action{min-height:44px;border:1px solid var(--accent);border-radius:var(--radius-control);padding:var(--space-8) var(--space-16);background:transparent;color:var(--accent);font:inherit;font-weight:650;cursor:pointer;}
.secondary-action:disabled{cursor:wait;opacity:.6;}
.secondary-action:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
</style>

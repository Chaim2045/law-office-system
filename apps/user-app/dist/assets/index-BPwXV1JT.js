(function() {
const e=document.createElement('link').relList;if (e&&e.supports&&e.supports('modulepreload')) {
return;
} for (const n of document.querySelectorAll('link[rel="modulepreload"]')) {
s(n);
} new MutationObserver(n => {
for (const o of n) {
if (o.type==='childList') {
for (const a of o.addedNodes) {
a.tagName==='LINK'&&a.rel==='modulepreload'&&s(a);
}
}
}
}).observe(document,{childList:!0,subtree:!0});function t(n) {
const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==='use-credentials'?o.credentials='include':n.crossOrigin==='anonymous'?o.credentials='omit':o.credentials='same-origin',o;
} function s(n) {
if (n.ep) {
return;
}n.ep=!0;const o=t(n);fetch(n.href,o);
}
})();const Tt=class {
constructor() {
this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0;
}setDebugMode(e) {
this.debugMode=e,e&&console.log('🔍 EventBus Debug Mode: ENABLED');
}emit(e,t) {
const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if (!n||n.size===0) {
this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return;
} const o=Array.from(n).sort((c,d) => d.priority-c.priority);let a=0,r=0;for (const c of o) {
try {
c.callback(t),a++,c.once&&n.delete(c);
} catch (d) {
r++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,d),this.emit('system:error',{error:d,context:`Event listener for ${String(e)}`,severity:'medium'});
}
} const l=performance.now()-s;this.updateStats(e,l,r),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:l,listenersNotified:a,errors:r}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${l.toFixed(2)}ms (${a} listeners)`);
}on(e,t,s={}) {
const {priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const a=this.listeners.get(e),r={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return a.add(r),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${r.id}, Priority: ${n})`),() => {
a.delete(r),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${r.id})`);
};
}once(e,t,s=0) {
return this.on(e,t,{priority:s,once:!0});
}off(e) {
const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`));
}clear() {
this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log('🗑️ [EventBus] Cleared all listeners');
}getHistory() {
return [...this.history];
}getLastEvents(e) {
return this.history.slice(-e);
}clearHistory() {
this.history=[],this.debugMode&&console.log('🗑️ [EventBus] History cleared');
}getStats() {
return {...this.stats};
}resetStats() {
this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log('🗑️ [EventBus] Statistics reset');
}getEventSummary() {
const e={};for (const [t,s] of this.listeners.entries()) {
e[String(t)]=s.size;
} return e;
}replay(e=0,t) {
const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for (const n of s) {
this.emit(n.event,n.data);
}
}addToHistory(e) {
this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift();
}updateStats(e,t,s) {
this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o;
}
};const St=new Tt;typeof window<'u'&&(window.EventBus=St);class Ct {
constructor() {
this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0;
}setDebugMode(e) {
this.debugMode=e,e&&console.log('🔍 EventBus Debug Mode: ENABLED');
}emit(e,t) {
const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if (!n||n.size===0) {
this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return;
} const o=Array.from(n).sort((c,d) => d.priority-c.priority);let a=0,r=0;for (const c of o) {
try {
c.callback(t),a++,c.once&&n.delete(c);
} catch (d) {
r++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,d),this.emit('system:error',{error:d,context:`Event listener for ${String(e)}`,severity:'medium'});
}
} const l=performance.now()-s;this.updateStats(e,l,r),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:l,listenersNotified:a,errors:r}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${l.toFixed(2)}ms (${a} listeners)`);
}on(e,t,s={}) {
const {priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const a=this.listeners.get(e),r={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return a.add(r),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${r.id}, Priority: ${n})`),() => {
a.delete(r),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${r.id})`);
};
}once(e,t,s=0) {
return this.on(e,t,{priority:s,once:!0});
}off(e) {
const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`));
}clear() {
this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log('🗑️ [EventBus] Cleared all listeners');
}getHistory() {
return [...this.history];
}getLastEvents(e) {
return this.history.slice(-e);
}clearHistory() {
this.history=[],this.debugMode&&console.log('🗑️ [EventBus] History cleared');
}getStats() {
return {...this.stats};
}resetStats() {
this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log('🗑️ [EventBus] Statistics reset');
}getEventSummary() {
const e={};for (const [t,s] of this.listeners.entries()) {
e[String(t)]=s.size;
} return e;
}replay(e=0,t) {
const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for (const n of s) {
this.emit(n.event,n.data);
}
}addToHistory(e) {
this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift();
}updateStats(e,t,s) {
this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o;
}
} const R=new Ct;typeof window<'u'&&(window.EventBus=R);class kt {
constructor() {
this.cache=new Map,this.queue=[],this.processingQueue=!1,this.rateLimitBucket={count:0,resetTime:Date.now()+1e3},this.maxRequestsPerSecond=10,this.inFlightRequests=new Map,this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:0},this.debugMode=!1;
}setDebugMode(e) {
this.debugMode=e,e&&console.log('🔍 FirebaseService Debug Mode: ENABLED');
} async call(e,t={},s={}) {
const n=performance.now(),{retries:o=3,cacheTTL:a=0,timeout:r=3e4,priority:l=0,skipRateLimit:c=!1,onError:d}=s;this.debugMode&&console.log(`📤 [Firebase] Calling: ${e}`,t),this.stats.totalCalls++;try {
if (a>0) {
const w=this.getFromCache(e,t);if (w) {
return this.debugMode&&console.log(`💾 [Firebase] Cache hit: ${e}`),this.stats.cachedCalls++,{success:!0,data:w,duration:performance.now()-n,cached:!0};
}
} const u=this.getRequestKey(e,t);if (this.inFlightRequests.has(u)) {
return this.debugMode&&console.log(`🔄 [Firebase] Deduplicating: ${e}`),this.inFlightRequests.get(u);
} if (!c&&!this.checkRateLimit()) {
return this.debugMode&&console.log(`⏳ [Firebase] Rate limited, queuing: ${e}`),this.stats.rateLimitHits++,this.stats.queuedRequests++,new Promise((w,h) => {
this.queue.push({functionName:e,data:t,options:s,resolve:w,reject:h,priority:l,timestamp:Date.now()}),this.processQueue();
});
} const g=this.executeCall(e,t,o,r,d);this.inFlightRequests.set(u,g);const p=await g;this.inFlightRequests.delete(u),p.success&&a>0&&this.addToCache(e,t,p.data,a),p.success?this.stats.successfulCalls++:this.stats.failedCalls++;const b=performance.now()-n;return this.updateAverageResponseTime(b),this.debugMode&&console.log(`✅ [Firebase] ${e} completed in ${b.toFixed(2)}ms`),R.emit('system:data-loaded',{dataType:e,recordCount:1,duration:b}),{...p,duration:b};
} catch (u) {
this.stats.failedCalls++;const g=u instanceof Error?u.message:'Unknown error';return this.debugMode&&console.error(`❌ [Firebase] Error in ${e}:`,u),R.emit('system:error',{error:u,context:`Firebase function: ${e}`,severity:'high'}),{success:!1,error:g,duration:performance.now()-n};
}
} async executeCall(e,t,s,n,o) {
let a=null,r=0;for (let d=0;d<=s;d++) {
try {
if (d>0) {
const g=Math.min(1e3*Math.pow(2,d-1),1e4);this.debugMode&&console.log(`⏳ [Firebase] Retry ${d}/${s} after ${g}ms for: ${e}`),await this.sleep(g),this.stats.retriedCalls++,r++;
} return {success:!0,data:await this.callWithTimeout(e,t,n),duration:0,retries:r};
} catch (u) {
if (a=u,!this.isRetryableError(u)) {
this.debugMode&&console.log(`🚫 [Firebase] Non-retryable error: ${e}`);break;
}o&&o(a);
}
} const l=(a==null?void 0:a.message)||'Unknown error',c=this.getErrorCode(a);return {success:!1,error:l,errorCode:c,duration:0,retries:r};
} async callWithTimeout(e,t,s) {
const n=new Promise((r,l) => {
setTimeout(() => {
l(new Error(`Request timeout after ${s}ms`));
},s);
}),o=firebase.functions().httpsCallable(e)(t);return (await Promise.race([o,n])).data;
}isRetryableError(e) {
let t;return e?!!(e.code==='unavailable'||e.code==='deadline-exceeded'||(t=e.message)!=null&&t.includes('timeout')||e.code==='internal'||e.code==='unknown'):!1;
}getErrorCode(e) {
let t,s;if (e!=null&&e.code) {
return e.code;
} if ((t=e==null?void 0:e.message)!=null&&t.includes('timeout')) {
return 'timeout';
} if ((s=e==null?void 0:e.message)!=null&&s.includes('network')) {
return 'network';
}
}checkRateLimit() {
const e=Date.now();return e>=this.rateLimitBucket.resetTime&&(this.rateLimitBucket={count:0,resetTime:e+1e3}),this.rateLimitBucket.count<this.maxRequestsPerSecond?(this.rateLimitBucket.count++,!0):!1;
} async processQueue() {
if (!(this.processingQueue||this.queue.length===0)) {
for (this.processingQueue=!0;this.queue.length>0;) {
if (!this.checkRateLimit()) {
await this.sleep(100);continue;
} this.queue.sort((t,s) => s.priority-t.priority);const e=this.queue.shift();if (!e) {
break;
} this.stats.queuedRequests--;try {
const t=await this.call(e.functionName,e.data,{...e.options,skipRateLimit:!0});e.resolve(t);
} catch (t) {
e.reject(t);
}
} this.processingQueue=!1;
}
}getCacheKey(e,t) {
return `${e}:${JSON.stringify(t)}`;
}getRequestKey(e,t) {
return this.getCacheKey(e,t);
}getFromCache(e,t) {
const s=this.getCacheKey(e,t),n=this.cache.get(s);return n?Date.now()-n.timestamp>n.ttl?(this.cache.delete(s),null):n.data:null;
}addToCache(e,t,s,n) {
const o=this.getCacheKey(e,t);this.cache.set(o,{data:s,timestamp:Date.now(),ttl:n}),R.emit('system:cache-updated',{cacheKey:o,action:'add'});
}clearCache() {
this.cache.clear(),R.emit('system:cache-updated',{cacheKey:'all',action:'clear'}),this.debugMode&&console.log('🗑️ [Firebase] Cache cleared');
}clearCacheEntry(e,t) {
const s=this.getCacheKey(e,t);this.cache.delete(s),R.emit('system:cache-updated',{cacheKey:s,action:'delete'});
}getStats() {
return {...this.stats};
}resetStats() {
this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:this.queue.length},this.debugMode&&console.log('🗑️ [Firebase] Statistics reset');
}updateAverageResponseTime(e) {
const t=this.stats.totalCalls;this.stats.averageResponseTime=(this.stats.averageResponseTime*(t-1)+e)/t;
}sleep(e) {
return new Promise(t => setTimeout(t,e));
}
} const It=new kt;typeof window<'u'&&(window.FirebaseService=It);function L(i) {
if (!i) {
return 0;
} if (i.type==='legal_procedure'&&i.stages&&Array.isArray(i.stages)) {
return i.stages.filter(e => e.status==='active'||e.status==='pending').reduce((e,t) => {
if (t.packages&&Array.isArray(t.packages)&&t.packages.length>0) {
const s=t.packages.filter(n => n.status==='active'||n.status==='pending'||!n.status).reduce((n,o) => n+(o.hoursRemaining||0),0);return e+s;
} return e+(t.hoursRemaining||0);
},0);
} if (i.packages&&Array.isArray(i.packages)&&i.packages.length>0) {
const e=i.packages.filter(t => t.status==='active'||!t.status);return e.length>0?e.reduce((t,s) => t+(s.hoursRemaining||0),0):i.hoursRemaining||0;
} return i.hoursRemaining||0;
} function M(i) {
return !i||!i.packages||i.packages.length===0?i.totalHours||0:i.packages.reduce((e,t) => e+(t.hours||0),0);
} function x(i) {
return !i||!i.packages||i.packages.length===0?i.hoursUsed||0:i.packages.reduce((e,t) => e+(t.hoursUsed||0),0);
} function oe(i) {
const e=M(i);if (e===0) {
return 0;
} const t=x(i);return Math.round(t/e*100*10)/10;
} function $e(i,e=2) {
return Math.round(i/60*Math.pow(10,e))/Math.pow(10,e);
} function _e(i) {
return Math.round(i*60);
} function Fe(i,e=!1) {
if (!i||i===0) {
return '0 שעות';
} if (e) {
const t=Math.floor(i),s=Math.round((i-t)*60);return s===0?`${t} שעות`:`${t}:${s.toString().padStart(2,'0')} שעות`;
} return `${i.toFixed(1)} שעות`;
} typeof module<'u'&&module.exports&&(module.exports={calculateRemainingHours:L,calculateTotalHours:M,calculateHoursUsed:x,calculateProgress:oe,minutesToHours:$e,hoursToMinutes:_e,formatHours:Fe});function Ne(i,e) {
return i?e?!i.serviceType||!i.parentServiceId?{valid:!1,error:'המשימה חסרה מידע על שירות'}:i.serviceType==='legal_procedure'&&!i.serviceId?{valid:!1,error:'המשימה חסרה מידע על שלב'}:!e.services||e.services.length===0?{valid:!1,error:'ללקוח אין שירותים פעילים'}:{valid:!0}:{valid:!1,error:'לקוח לא נמצא'}:{valid:!1,error:'משימה לא נמצאה'};
} function Re(i) {
const e=[];return (!i.hours||i.hours<=0)&&e.push('חובה להזין כמות שעות תקינה'),i.hours>500&&e.push('כמות שעות גבוהה מדי (מקסימום 500)'),(!i.type||!['initial','additional','renewal'].includes(i.type))&&e.push('סוג חבילה לא תקין'),{valid:e.length===0,errors:e};
} function Pe(i,e) {
const t=[];return (!i||i<=0)&&t.push('חובה להזין כמות שעות תקינה'),i>500&&t.push('כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)'),(!e||e.trim().length<3)&&t.push('חובה להזין סיבה/הערה (לפחות 3 תווים)'),{valid:t.length===0,errors:t};
} function qe(i,e='hourly') {
const t=[];return !Array.isArray(i)||i.length!==3?(t.push('חובה למלא בדיוק 3 שלבים'),{valid:!1,errors:t}):(i.forEach((s,n) => {
const o=n+1;(!s.description||!s.description.trim())&&t.push(`שלב ${o}: חובה למלא תיאור השלב`),e==='hourly'?((!s.hours||s.hours<=0)&&t.push(`שלב ${o}: חובה למלא תקרת שעות תקינה`),s.hours&&s.hours>1e3&&t.push(`שלב ${o}: תקרת שעות גבוהה מדי (מקסימום 1000)`)):((!s.fixedPrice||s.fixedPrice<=0)&&t.push(`שלב ${o}: חובה למלא מחיר פיקס תקין`),s.fixedPrice&&s.fixedPrice>1e6&&t.push(`שלב ${o}: מחיר גבוה מדי (מקסימום 1,000,000 ₪)`));
}),{valid:t.length===0,errors:t});
} function Ue(i,e) {
return !i||i<=0?{valid:!1,error:'כמות שעות לקיזוז חייבת להיות חיובית'}:i>24?{valid:!1,error:'לא ניתן לקזז יותר מ-24 שעות בפעולה אחת'}:e?{valid:!0}:{valid:!1,error:'לא נמצא שירות או שלב לקיזוז'};
} typeof module<'u'&&module.exports&&(module.exports={validateTimeEntry:Ne,validatePackage:Re,validateHoursPackage:Pe,validateStages:qe,validateDeduction:Ue});function He(i,e) {
return i&&(i.totalHours=M(i),i.hoursUsed=x(i),i.hoursRemaining=L(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e),i);
} function ae(i,e) {
return i&&(i.totalHours=M(i),i.hoursUsed=x(i),i.hoursRemaining=L(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i);
} function Oe(i,e) {
if (!i||!i.services||i.services.length===0) {
return {};
} const t=i.services.reduce((o,a) => o+(a.totalHours||0),0),s=i.services.reduce((o,a) => o+(a.hoursUsed||0),0),n=i.services.reduce((o,a) => o+L(a),0);return {totalHours:t,hoursUsed:s,hoursRemaining:n,minutesUsed:Math.round(s*60),minutesRemaining:Math.round(n*60),totalMinutes:Math.round(t*60),lastActivity:new Date().toISOString(),_lastModified:new Date().toISOString(),_modifiedBy:e||'system',_version:(i._version||0)+1};
} function Ve(i,e) {
return !i||!i.stages||(i.stages.forEach(t => {
ae(t);
}),i.totalHours=i.stages.reduce((t,s) => t+(s.totalHours||0),0),i.hoursUsed=i.stages.reduce((t,s) => t+(s.hoursUsed||0),0),i.hoursRemaining=i.stages.reduce((t,s) => t+L(s),0),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e)),i;
} function ze(i,e) {
const t=Math.round(i*60);return {hoursUsed:e.increment(i),hoursRemaining:e.increment(-i),minutesUsed:e.increment(t),minutesRemaining:e.increment(-t),lastActivity:e.serverTimestamp(),_lastModified:e.serverTimestamp()};
} typeof module<'u'&&module.exports&&(module.exports={updateServiceAggregates:He,updateStageAggregates:ae,updateClientAggregates:Oe,updateLegalProcedureAggregates:Ve,createIncrementUpdate:ze});function We(i) {
return !i||!i.packages||i.packages.length===0?null:i.packages.find(e => {
const t=!e.status||e.status==='active',s=(e.hoursRemaining||0)>0;return t&&s;
})||null;
} function Lt(i) {
return i?!i.packages||i.packages.length===0?i.hoursRemaining||0:i.packages.filter(e => e.status==='active'||!e.status).reduce((e,t) => e+(t.hoursRemaining||0),0):0;
} function Ge(i,e) {
return i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=(i.hoursRemaining||0)-e,i.status||(i.status='active'),i.hoursRemaining<=0&&(i.status='depleted',i.hoursRemaining=0,i.closedDate=new Date().toISOString()),i;
} function je(i,e) {
const t=We(i);return t?(Ge(t,e),i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=Lt(i),{success:!0,packageId:t.id,stageId:i.id}):{success:!1,error:'אין חבילה פעילה לניכוי שעות'};
} function Bt(i,e,t) {
const s=t/60,n={clientUpdate:null,error:null};if (e.serviceType==='legal_procedure'&&e.parentServiceId) {
const o=i.services||[],a=o.findIndex(g => g.id===e.parentServiceId);if (a===-1) {
return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;
} const r=o[a],l=r.stages||[],c=l.findIndex(g => g.id===e.serviceId);if (c===-1) {
return n.error=`שלב ${e.serviceId} לא נמצא בשירות`,n;
} const d=l[c],u=je(d,s);if (!u.success) {
return n.error=u.error,n;
}r.hoursUsed=(r.hoursUsed||0)+s,r.hoursRemaining=r.stages.reduce((g,p) => g+(p.hoursRemaining||0),0),n.clientUpdate={[`services.${a}`]:r,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1};
} else if (e.serviceType==='hours'&&e.parentServiceId) {
const o=i.services||[],a=o.findIndex(l => l.id===e.parentServiceId);if (a===-1) {
return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;
} const r=o[a];r.hoursUsed=(r.hoursUsed||0)+s,r.hoursRemaining=(r.hoursRemaining||0)-s,r.hoursRemaining<0&&(r.hoursRemaining=0),n.clientUpdate={[`services.${a}`]:r,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1};
} else {
n.error='סוג שירות לא נתמך או חסר מידע';
} return n;
} function re({stageId:i,type:e,hours:t,status:s,description:n}) {
return {id:`pkg_${e}_${i}_${Date.now()}`,type:e,hours:t,hoursUsed:0,hoursRemaining:t,status:s,description:n||(e==='initial'?'חבילה ראשונית':'חבילה נוספת'),createdAt:new Date().toISOString()};
} function Ke({id:i,name:e,description:t,order:s,status:n,hours:o}) {
const a=re({stageId:i,type:'initial',hours:o,status:n==='active'?'active':'pending'});return {id:i,name:e,description:t,order:s,status:n,totalHours:o,hoursUsed:0,hoursRemaining:o,packages:[a],createdAt:new Date().toISOString()};
} function Ye(i) {
if (!i||i.length!==3) {
throw new Error('Legal procedure requires exactly 3 stages');
} const e=['stage_a','stage_b','stage_c'],t=["שלב א'","שלב ב'","שלב ג'"];return i.map((s,n) => Ke({id:e[n],name:t[n],description:s.description||'',order:n+1,status:n===0?'active':'pending',hours:s.hours||0}));
} function Dt({id:i,name:e,stagesData:t,currentStage:s}) {
const n=Ye(t),o=n.reduce((a,r) => a+r.totalHours,0);return {id:i,type:'legal_procedure',name:e,currentStage:s||'stage_a',stages:n,totalHours:o,hoursUsed:0,hoursRemaining:o,createdAt:new Date().toISOString()};
} function Mt({id:i,name:e,hours:t}) {
return {id:i,type:'hours',name:e,totalHours:t,hoursUsed:0,hoursRemaining:t,createdAt:new Date().toISOString()};
} function xt(i,e,t) {
const s=re({stageId:i.id,type:'additional',hours:e,status:i.status==='active'?'active':'pending',description:t});return i.packages.push(s),i.totalHours+=e,i.hoursRemaining+=e,s;
} const Je={calculateRemainingHours:L,calculateTotalHours:M,calculateHoursUsed:x,calculateProgress:oe,minutesToHours:$e,hoursToMinutes:_e,formatHours:Fe,validateTimeEntry:Ne,validatePackage:Re,validateHoursPackage:Pe,validateStages:qe,validateDeduction:Ue,updateServiceAggregates:He,updateStageAggregates:ae,updateClientAggregates:Oe,updateLegalProcedureAggregates:Ve,createIncrementUpdate:ze,getActivePackage:We,deductHoursFromPackage:Ge,deductHoursFromStage:je,calculateClientUpdates:Bt,createPackage:re,createStage:Ke,createLegalProcedureStages:Ye,createLegalProcedureService:Dt,createHourlyService:Mt,addPackageToStage:xt};typeof window<'u'&&(window.DeductionSystem=Je,window.calculateRemainingHours=L,window.calculateHoursUsed=x,window.calculateTotalHours=M,window.calculateProgress=oe);typeof module<'u'&&module.exports&&(module.exports=Je);(function() {
const i={DEFAULT_PAGE_SIZE:20};class e {
constructor() {
this.lastDocs={clients:null,budget_tasks:null,timesheet_entries:null},this.cache={clients:[],budget_tasks:[],timesheet_entries:[]},this.hasMore={clients:!0,budget_tasks:!0,timesheet_entries:!0};
}_log(s,n=null) {}_convertTimestamps(s) {
const n={...s};return ['createdAt','updatedAt','completedAt','deadline','date'].forEach(a => {
let r;(r=n[a])!=null&&r.toDate&&typeof n[a].toDate==='function'&&(n[a]=n[a].toDate());
}),n;
}reset(s) {
this.lastDocs[s]!==void 0&&(this.lastDocs[s]=null,this.cache[s]=[],this.hasMore[s]=!0,this._log(`Reset pagination for ${s}`));
}resetAll() {
Object.keys(this.lastDocs).forEach(s => this.reset(s)),this._log('Reset all pagination');
} async loadClientsPaginated(s=i.DEFAULT_PAGE_SIZE,n=!1) {
try {
const o=window.firebaseDB;if (!o) {
throw new Error('Firebase לא מחובר');
} if (n||this.reset('clients'),!this.hasMore.clients&&n) {
return this._log('No more clients to load'),{items:[],hasMore:!1,total:this.cache.clients.length};
} let a=o.collection('clients').orderBy('createdAt','desc').limit(s);this.lastDocs.clients&&n&&(a=a.startAfter(this.lastDocs.clients)),this._log(`Loading clients (limit: ${s}, loadMore: ${n})`);const r=await a.get(),l=[];return r.forEach(c => {
const d=this._convertTimestamps(c.data());l.push({id:c.id,...d});
}),r.docs.length>0&&(this.lastDocs.clients=r.docs[r.docs.length-1]),this.hasMore.clients=r.docs.length===s,n?this.cache.clients=[...this.cache.clients,...l]:this.cache.clients=l,this._log(`Loaded ${l.length} clients (hasMore: ${this.hasMore.clients})`),{items:l,hasMore:this.hasMore.clients,total:this.cache.clients.length};
} catch (o) {
throw console.error('Firebase Pagination error (clients):',o),new Error('שגיאה בטעינת לקוחות: '+o.message);
}
} async loadBudgetTasksPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1,a='active') {
try {
const r=window.firebaseDB;if (!r) {
throw new Error('Firebase לא מחובר');
} const l=`budget_tasks_${a}`;if (o||this.reset(l),!this.hasMore[l]&&o) {
return this._log(`No more budget tasks to load (filter: ${a})`),{items:[],hasMore:!1,total:(this.cache[l]||[]).length};
} let c=r.collection('budget_tasks').where('employee','==',s).orderBy('createdAt','desc').limit(n);this.lastDocs[l]&&o&&(c=c.startAfter(this.lastDocs[l])),this._log(`Loading budget tasks for ${s} (limit: ${n}, loadMore: ${o}, filter: ${a})`);const d=await c.get(),u=[];d.forEach(p => {
const w={...this._convertTimestamps(p.data()),firebaseDocId:p.id};w.id||(w.id=p.id),u.push(w);
});let g=u;return a==='active'?g=u.filter(p => p.status==='פעיל'):a==='completed'&&(g=u.filter(p => p.status==='הושלם')),d.docs.length>0&&(this.lastDocs[l]=d.docs[d.docs.length-1]),this.hasMore[l]=d.docs.length===n,o?this.cache[l]=[...this.cache[l]||[],...g]:this.cache[l]=g,this._log(`Loaded ${g.length} budget tasks (hasMore: ${this.hasMore[l]}, filtered from ${u.length}, cacheKey: ${l})`),{items:g,hasMore:this.hasMore[l],total:(this.cache[l]||[]).length};
} catch (r) {
throw console.error('Firebase Pagination error (budget_tasks):',r),new Error('שגיאה בטעינת משימות: '+r.message);
}
} async loadTimesheetPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1) {
try {
const a=window.firebaseDB;if (!a) {
throw new Error('Firebase לא מחובר');
} if (o||this.reset('timesheet_entries'),!this.hasMore.timesheet_entries&&o) {
return this._log('No more timesheet entries to load'),{items:[],hasMore:!1,total:this.cache.timesheet_entries.length};
} let r=a.collection('timesheet_entries').where('employee','==',s).orderBy('createdAt','desc').limit(n);this.lastDocs.timesheet_entries&&o&&(r=r.startAfter(this.lastDocs.timesheet_entries)),this._log(`Loading timesheet for ${s} (limit: ${n}, loadMore: ${o})`);const l=await r.get(),c=[];return l.forEach(d => {
const u=this._convertTimestamps(d.data());c.push({id:d.id,...u});
}),l.docs.length>0&&(this.lastDocs.timesheet_entries=l.docs[l.docs.length-1]),this.hasMore.timesheet_entries=l.docs.length===n,o?this.cache.timesheet_entries=[...this.cache.timesheet_entries,...c]:this.cache.timesheet_entries=c,this._log(`Loaded ${c.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`),{items:c,hasMore:this.hasMore.timesheet_entries,total:this.cache.timesheet_entries.length};
} catch (a) {
throw console.error('Firebase Pagination error (timesheet):',a),new Error('שגיאה בטעינת שעתון: '+a.message);
}
}getCachedData(s) {
return this.cache[s]||[];
}getStatus(s) {
let n;return {collection:s,cachedItems:((n=this.cache[s])==null?void 0:n.length)||0,hasMore:this.hasMore[s],hasLastDoc:!!this.lastDocs[s]};
}
}window.FirebasePaginationModule={FirebasePaginationManager:e,create() {
return new e;
}};
})();(function() {
const i={CACHE_TTL:3e5,DEBUG:!1},e={log:(...h) => {
i.DEBUG&&console.log('[EmployeesManager]',...h);
},error:(...h) => {
console.error('[EmployeesManager ERROR]',...h);
}};let t=null,s=0;function n() {
return t&&Date.now()-s<i.CACHE_TTL;
} function o() {
t=null,s=0,e.log('🗑️ Cache cleared');
} async function a(h=!1) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} if (!h&&n()) {
return e.log('📦 Using cached employees'),t;
} try {
e.log('🔄 Loading employees from Firebase...');const m=await window.firebaseDB.collection('employees').get(),f={};return m.forEach(y => {
const v=y.data();f[y.id]={email:y.id,username:v.username,password:v.password,name:v.name||v.displayName,displayName:v.displayName||v.name,isActive:v.isActive!==!1,role:v.role||'employee',createdAt:v.createdAt,updatedAt:v.updatedAt,lastLogin:v.lastLogin,loginCount:v.loginCount||0};
}),t=f,s=Date.now(),e.log(`✅ Loaded ${Object.keys(f).length} employees`),f;
} catch (m) {
throw e.error('Failed to load employees:',m),m;
}
} async function r(h) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} try {
const m=await window.firebaseDB.collection('employees').doc(h).get();if (!m.exists) {
return null;
} const f=m.data();return {username:m.id,password:f.password,name:f.name||f.displayName,displayName:f.displayName||f.name,email:f.email,isActive:f.isActive!==!1,role:f.role||'employee',createdAt:f.createdAt,updatedAt:f.updatedAt,lastLogin:f.lastLogin,loginCount:f.loginCount||0};
} catch (m) {
throw e.error(`Failed to get employee ${h}:`,m),m;
}
} async function l(h) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} if (!h.email||!h.username||!h.password||!h.name) {
throw new Error('Missing required fields: email, username, password, name');
} if ((await window.firebaseDB.collection('employees').doc(h.email).get()).exists) {
throw new Error(`Employee with email ${h.email} already exists`);
} try {
const f={username:h.username,password:h.password,name:h.name,displayName:h.name,email:h.email,isActive:h.isActive!==!1,role:h.role||'employee',createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:h.createdBy||'admin',lastLogin:null,loginCount:0};return await window.firebaseDB.collection('employees').doc(h.email).set(f),o(),e.log(`✅ Employee ${h.username} (${h.email}) added successfully`),{success:!0,email:h.email,username:h.username};
} catch (f) {
throw e.error('Failed to add employee:',f),f;
}
} async function c(h,m) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} let f=window.firebaseDB.collection('employees').doc(h),y=await f.get();if (!y.exists) {
const E=await window.firebaseDB.collection('employees').where('username','==',h).limit(1).get();if (E.empty) {
throw new Error(`Employee ${h} not found`);
}f=E.docs[0].ref,y=E.docs[0];
} const v=y.data(),T=y.id;try {
const E={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};return m.password!==void 0&&(E.password=m.password),m.name!==void 0&&(E.name=m.name,E.displayName=m.name),m.email!==void 0&&(E.email=m.email),m.isActive!==void 0&&(E.isActive=m.isActive),m.role!==void 0&&(E.role=m.role),await f.update(E),o(),e.log(`✅ Employee ${T} updated successfully`),{success:!0,email:T,username:v.username};
} catch (E) {
throw e.error('Failed to update employee:',E),E;
}
} async function d(h,m=!1) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} let f=window.firebaseDB.collection('employees').doc(h),y=await f.get();if (!y.exists) {
const E=await window.firebaseDB.collection('employees').where('username','==',h).limit(1).get();if (E.empty) {
throw new Error(`Employee ${h} not found`);
}f=E.docs[0].ref,y=E.docs[0];
} const v=y.data(),T=y.id;try {
return m?(await f.delete(),e.log(`✅ Employee ${T} deleted permanently`)):(await f.update({isActive:!1,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.serverTimestamp()}),e.log(`✅ Employee ${T} deactivated`)),o(),{success:!0,email:T,username:v.username};
} catch (E) {
throw e.error('Failed to delete employee:',E),E;
}
} async function u(h) {
if (!window.firebaseDB) {
throw new Error('Firebase DB not available');
} let m=window.firebaseDB.collection('employees').doc(h),f=await m.get();if (!f.exists) {
const T=await window.firebaseDB.collection('employees').where('username','==',h).limit(1).get();if (T.empty) {
throw new Error(`Employee ${h} not found`);
}m=T.docs[0].ref,f=T.docs[0];
} const y=f.data(),v=f.id;try {
return await m.update({isActive:!0,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.delete()}),o(),e.log(`✅ Employee ${v} restored`),{success:!0,email:v,username:y.username};
} catch (T) {
throw e.error('Failed to restore employee:',T),T;
}
} async function g(h,m) {
try {
const f=await r(h);return f?f.isActive?f.password!==m?{success:!1,error:'סיסמה שגויה'}:(await window.firebaseDB.collection('employees').doc(h).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),e.log(`✅ User ${h} authenticated successfully`),{success:!0,employee:f}):{success:!1,error:'החשבון מושבת'}:{success:!1,error:'המשתמש לא קיים'};
} catch (f) {
return e.error('Authentication failed:',f),{success:!1,error:'שגיאה באימות'};
}
} async function p(h) {
const m=await a(),f=[],y=h.toLowerCase();return Object.values(m).forEach(v => {
(v.username.toLowerCase().includes(y)||v.name.toLowerCase().includes(y)||v.email.toLowerCase().includes(y))&&f.push(v);
}),f;
} async function b() {
const h=await a();return Object.values(h).filter(m => m.isActive);
} async function w() {
const h=await a(),m=Object.values(h);return {total:m.length,active:m.filter(f => f.isActive).length,inactive:m.filter(f => !f.isActive).length,admins:m.filter(f => f.role==='admin').length,employees:m.filter(f => f.role==='employee').length};
}window.EmployeesManager={async loadAll(h=!1) {
return await a(h);
},async get(h) {
return await r(h);
},async add(h) {
return await l(h);
},async update(h,m) {
return await c(h,m);
},async delete(h,m=!1) {
return await d(h,m);
},async restore(h) {
return await u(h);
},async authenticate(h,m) {
return await g(h,m);
},async search(h) {
return await p(h);
},async getActive() {
return await b();
},async getStats() {
return await w();
},clearCache() {
o();
},config:i},e.log('📦 Employees Manager module loaded');
})();function At(i) {
if (typeof i!=='string') {
return String(i||'');
} const e=document.createElement('div');return e.textContent=i,e.innerHTML;
}window.isInWelcomeScreen=!1;const Qe=document.createElement('style');Qe.textContent=`
  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;document.head.appendChild(Qe);typeof window<'u'&&(window.calculateRemainingHours=L,window.calculateTotalHours=M,window.calculateHoursUsed=x,window.safeText=At);const $t='modulepreload',_t=function(i) {
return '/'+i;
},Ce={},le=function(e,t,s) {
let n=Promise.resolve();if (t&&t.length>0) {
document.getElementsByTagName('link');const a=document.querySelector('meta[property=csp-nonce]'),r=(a==null?void 0:a.nonce)||(a==null?void 0:a.getAttribute('nonce'));n=Promise.allSettled(t.map(l => {
if (l=_t(l),l in Ce) {
return;
}Ce[l]=!0;const c=l.endsWith('.css'),d=c?'[rel="stylesheet"]':'';if (document.querySelector(`link[href="${l}"]${d}`)) {
return;
} const u=document.createElement('link');if (u.rel=c?'stylesheet':$t,c||(u.as='script'),u.crossOrigin='',u.href=l,r&&u.setAttribute('nonce',r),document.head.appendChild(u),c) {
return new Promise((g,p) => {
u.addEventListener('load',g),u.addEventListener('error',() => p(new Error(`Unable to preload CSS for ${l}`)));
});
}
}));
} function o(a) {
const r=new Event('vite:preloadError',{cancelable:!0});if (r.payload=a,window.dispatchEvent(r),!r.defaultPrevented) {
throw a;
}
} return n.then(a => {
for (const r of a||[]) {
r.status==='rejected'&&o(r.reason);
} return e().catch(o);
});
},Ft='budget',Nt=!1,Rt={documentClick:null,documentKeydown:null,windowResize:null,notificationClick:null};function S(i) {
if (typeof i!=='string') {
return String(i||'');
} const e=document.createElement('div');return e.textContent=i,e.innerHTML;
} function Pt(i) {
return new Promise(e => setTimeout(e,i));
} function Xe(i,e) {
let t;return function(...n) {
const o=() => {
clearTimeout(t),i(...n);
};clearTimeout(t),t=setTimeout(o,e);
};
}window.isInWelcomeScreen=!1;const Ze=document.createElement('style');Ze.textContent=`
  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;document.head.appendChild(Ze);const O=i => {
let e;return ((e=window.DatesModule)==null?void 0:e.formatDateTime(i))||'-';
},k=i => {
let e;return ((e=window.DatesModule)==null?void 0:e.formatDate(i))||'-';
},ce=i => {
let e;return ((e=window.DatesModule)==null?void 0:e.formatShort(i))||'-';
};typeof window<'u'&&(window.calculateRemainingHours=L,window.calculateTotalHours=M,window.calculateHoursUsed=x,window.safeText=S);const qt=Object.freeze(Object.defineProperty({__proto__:null,calculateHoursUsed:x,calculateRemainingHours:L,calculateTotalHours:M,currentActiveTab:Ft,debounce:Xe,delay:Pt,formatDate:k,formatDateTime:O,formatShort:ce,globalListeners:Rt,isScrolled:Nt,safeText:S},Symbol.toStringTag,{value:'Module'}));class Ut {
constructor() {
this.elements=new Map;
}getElementById(e) {
if (this.elements.has(e)) {
return this.elements.get(e);
} const t=document.getElementById(e);return t&&this.elements.set(e,t),t;
}querySelector(e) {
if (this.elements.has(e)) {
return this.elements.get(e);
} const t=document.querySelector(e);return t&&this.elements.set(e,t),t;
}clear() {
this.elements.clear();
}remove(e) {
this.elements.delete(e);
}
} class de {
constructor(e={}) {
this.maxAge=e.maxAge||5*60*1e3,this.staleWhileRevalidate=e.staleWhileRevalidate!==!1,this.staleAge=e.staleAge||10*60*1e3,this.storage=e.storage||'memory',this.onError=e.onError||(t => console.error('[DataCache]',t)),this.debug=e.debug||!1,this.namespace=e.namespace||'dataCache',this.cache=new Map,this.stats={hits:0,misses:0,revalidations:0,errors:0},this.pendingRevalidations=new Map,this.storage==='localStorage'&&!this._isLocalStorageAvailable()&&(this._log('warn','localStorage not available, falling back to memory'),this.storage='memory'),this._log('info','DataCache initialized',{maxAge:this.maxAge,staleAge:this.staleAge,storage:this.storage,staleWhileRevalidate:this.staleWhileRevalidate});
} async get(e,t,s={}) {
if (!e||typeof e!=='string') {
throw new Error('[DataCache] Key must be a non-empty string');
} if (typeof t!=='function') {
throw new Error('[DataCache] fetchFunction must be a function');
} if (s.force) {
return this._log('info',`Force fetch for key: ${e}`),await this._fetchAndCache(e,t);
} const n=Date.now(),o=this._getEntry(e);if (!o) {
return this.stats.misses++,this._log('info',`Cache MISS for key: ${e}`),await this._fetchAndCache(e,t);
} const a=s.maxAge||this.maxAge,r=n-o.timestamp,l=r<a,c=r>=a&&r<a+this.staleAge;if (r>=a+this.staleAge) {
return this.stats.misses++,this._log('info',`Cache EXPIRED for key: ${e} (age: ${r}ms)`),await this._fetchAndCache(e,t);
} if (l) {
return this.stats.hits++,this._log('info',`Cache HIT (fresh) for key: ${e} (age: ${r}ms)`),o.data;
} if (c&&this.staleWhileRevalidate) {
this.stats.hits++,this._log('info',`Cache HIT (stale) for key: ${e} (age: ${r}ms) - revalidating in background`);const u=o.data;return this._revalidateInBackground(e,t),u;
} return this.stats.misses++,await this._fetchAndCache(e,t);
} async _fetchAndCache(e,t) {
try {
const s=await t();return this._setEntry(e,s),s;
} catch (s) {
throw this.stats.errors++,this._log('error',`Error fetching data for key: ${e}`,s),this.onError(s),s;
}
}_revalidateInBackground(e,t) {
if (this.pendingRevalidations.has(e)) {
this._log('debug',`Revalidation already in progress for key: ${e}`);return;
} this.stats.revalidations++;const s=(async() => {
try {
this._log('debug',`Starting background revalidation for key: ${e}`);const n=await t();this._setEntry(e,n),this._log('debug',`Background revalidation complete for key: ${e}`);
} catch (n) {
this.stats.errors++,this._log('error',`Background revalidation failed for key: ${e}`,n),this.onError(n);
} finally {
this.pendingRevalidations.delete(e);
}
})();this.pendingRevalidations.set(e,s);
}_getEntry(e) {
if (this.storage==='memory') {
return this.cache.get(e)||null;
} if (this.storage==='localStorage') {
try {
const t=localStorage.getItem(this._getStorageKey(e));return t?JSON.parse(t):null;
} catch (t) {
return this._log('error','Error reading from localStorage',t),null;
}
} return null;
}_setEntry(e,t) {
const s=Date.now(),n={data:t,timestamp:s,expiresAt:s+this.maxAge};if (this.storage==='memory'&&this.cache.set(e,n),this.storage==='localStorage') {
try {
localStorage.setItem(this._getStorageKey(e),JSON.stringify(n));
} catch (o) {
this._log('error','Error writing to localStorage',o),this.stats.errors++,this.cache.set(e,n);
}
} this._log('debug',`Cached data for key: ${e}`);
}invalidate(e) {
this._log('info',`Invalidating cache for key: ${e}`);let t=!1;if (this.storage==='memory'&&(t=this.cache.delete(e)),this.storage==='localStorage') {
const s=this._getStorageKey(e);t=localStorage.getItem(s)!==null,localStorage.removeItem(s);
} return this.pendingRevalidations.has(e)&&this.pendingRevalidations.delete(e),t;
}clear() {
this._log('info','Clearing all cache entries');let e=0;if (this.storage==='memory'&&(e=this.cache.size,this.cache.clear()),this.storage==='localStorage') {
const t=Object.keys(localStorage),s=this._getStorageKey('');t.forEach(n => {
n.startsWith(s)&&(localStorage.removeItem(n),e++);
});
} return this.pendingRevalidations.clear(),e;
}getStats() {
const e=this.stats.hits+this.stats.misses,t=e>0?Math.round(this.stats.hits/e*100):0;return {...this.stats,size:this.storage==='memory'?this.cache.size:this._getLocalStorageSize(),hitRate:t};
}resetStats() {
this.stats={hits:0,misses:0,revalidations:0,errors:0},this._log('info','Statistics reset');
}_getStorageKey(e) {
return `${this.namespace}:${e}`;
}_getLocalStorageSize() {
const e=Object.keys(localStorage),t=this._getStorageKey('');return e.filter(s => s.startsWith(t)).length;
}_isLocalStorageAvailable() {
try {
const e='__localStorage_test__';return localStorage.setItem(e,e),localStorage.removeItem(e),!0;
} catch {
return !1;
}
}_log(e,t,s) {
if (!this.debug&&e==='debug') {
return;
} const n='[DataCache]',o=new Date().toISOString();s?console[e==='debug'?'log':e](`${n} ${o} ${t}`,s):console[e==='debug'?'log':e](`${n} ${o} ${t}`);
}
} typeof module<'u'&&module.exports&&(module.exports=de);typeof window<'u'&&(window.DataCache=de);const ue={TASK_FILTER:'active',TIMESHEET_FILTER:'month',BUDGET_VIEW:'cards',TIMESHEET_VIEW:'table',BUDGET_SORT:'recent',TIMESHEET_SORT:'recent'},he=['taskFilter','timesheetFilter','currentPage','searchQuery'],me=['budgetView','timesheetView','budgetSort','timesheetSort'];function fe(i) {
return he.includes(i);
} function ge(i) {
return me.includes(i);
} function Ht(i) {
return ue[i];
} function Ot(i) {
const e=i.replace(/([A-Z])/g,'_$1').toUpperCase(),t=ue[e];if (fe(i)) {
return t;
} if (ge(i)) {
const s=localStorage.getItem(i);return s!==null?s:t;
} return t;
} function Vt(i,e) {
return fe(i)?(console.debug(`⚠️ ${i} is session-only, not persisting to localStorage`),!1):ge(i)?(localStorage.setItem(i,e),console.debug(`✅ ${i} persisted to localStorage: ${e}`),!0):(console.warn(`⚠️ Unknown state key: ${i}`),!1);
} function zt(i=!1) {
me.forEach(e => {
localStorage.removeItem(e);
}),i&&he.forEach(e => {
localStorage.removeItem(e);
}),console.log('✅ State cleared');
} const B={DEFAULTS:ue,SESSION_ONLY_KEYS:he,PERSISTED_KEYS:me,isSessionOnly:fe,isPersisted:ge,getDefault:Ht,getStateValue:Ot,setStateValue:Vt,clearAllState:zt};class Wt {
constructor() {
this.errors=[];
}validateClientCase(e) {
return e?!e.clientId||!e.clientName?(this.errors.push('חובה לבחור לקוח'),!1):e.caseId?!0:(this.errors.push('חובה לבחור תיק'),!1):(this.errors.push('חובה לבחור לקוח ותיק'),!1);
}validateBranch(e) {
return !e||e.trim()===''?(this.errors.push('חובה לבחור סניף מטפל'),!1):['רחובות','תל אביב'].includes(e)?!0:(this.errors.push('סניף לא תקין. אנא בחר מהרשימה'),!1);
}validateDeadline(e) {
if (!e||e.trim()==='') {
return this.errors.push('חובה לבחור תאריך יעד'),!1;
} const t=new Date(e),s=new Date,n=new Date(s.getFullYear(),s.getMonth(),s.getDate());return t<n?(this.errors.push('תאריך היעד לא יכול להיות בעבר'),!1):!0;
}validateEstimatedTime(e) {
const t=parseInt(e);return !e||isNaN(t)?(this.errors.push('חובה להזין זמן משוער בדקות'),!1):t<1?(this.errors.push('זמן משוער חייב להיות לפחות 1 דקה'),!1):t>9999?(this.errors.push('זמן משוער גבוה מדי (מקסימום 9999 דקות)'),!1):!0;
}validateDescription(e) {
return !e||e.trim().length<3?(this.errors.push('תיאור המשימה חייב להכיל לפחות 3 תווים'),!1):e.trim().length>500?(this.errors.push('תיאור המשימה ארוך מדי (מקסימום 500 תווים)'),!1):!0;
}validateAll(e) {
return this.errors=[],this.validateClientCase(e.selectorValues),this.validateBranch(e.branch),this.validateDeadline(e.deadline),this.validateEstimatedTime(e.estimatedTime),this.validateDescription(e.description),{isValid:this.errors.length===0,errors:[...this.errors]};
}showErrors(e,t=null) {
if (!(!e||e.length===0)) {
if (window.NotificationSystem) {
const s=e.join(`
`);window.NotificationSystem.show(s,'error',5e3);return;
}t?t.innerHTML=`
        <div class="validation-errors" style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">
            <i class="fas fa-exclamation-triangle"></i>
            יש לתקן את השגיאות הבאות:
          </h4>
          <ul style="margin: 0; padding-right: 20px; color: #991b1b;">
            ${e.map(s => `<li style="margin-bottom: 8px;">${s}</li>`).join('')}
          </ul>
        </div>
      `:alert(`שגיאות בטופס:

`+e.join(`
`));
}
}clearErrors(e=null) {
if (this.errors=[],e) {
const t=e.querySelector('.validation-errors');t&&t.remove();
}
}markInvalid(e) {
e&&(e.classList.add('invalid'),e.style.borderColor='#ef4444',e.style.boxShadow='0 0 0 3px rgba(239, 68, 68, 0.1)');
}markValid(e) {
e&&(e.classList.remove('invalid'),e.style.borderColor='',e.style.boxShadow='');
}setupRealTimeValidation(e,t) {
!e||!t||(e.addEventListener('blur',() => {
t(e.value)?this.markValid(e):this.markInvalid(e);
}),e.addEventListener('input',() => {
e.classList.contains('invalid')&&this.markValid(e);
}));
}
} const ne='addTaskDraft';class Gt {
constructor(e='addTaskForm') {
this.formId=e,this.form=null;
}init() {
this.form=document.getElementById(this.formId),this.form||console.warn(`⚠️ Form #${this.formId} not found`);
}fillDefaults(e={}) {
if (!this.form) {
console.error('❌ Form not initialized');return;
} if (!e.deadline) {
const t=new Date;t.setDate(t.getDate()+1),t.setHours(17,0,0,0);const s=this.form.querySelector('#taskDeadline');if (s) {
const n=t.toISOString().slice(0,16);s.value=n;
}
} if (!e.estimatedTime) {
const t=this.form.querySelector('#taskEstimatedTime');t&&(t.value='60');
} if (e.branch) {
const t=this.form.querySelector('#taskBranch');t&&(t.value=e.branch);
}
}clear() {
let s,n;if (!this.form) {
console.error('❌ Form not initialized');return;
} this.form.reset(),window.ClientCaseSelectorsManager&&((n=(s=window.ClientCaseSelectorsManager).clearBudget)==null||n.call(s));const e=this.form.querySelector('#taskDescriptionSelector');if (e&&window.SmartComboSelector) {
const o=e._smartComboInstance;o!=null&&o.clear&&o.clear();
} this.form.querySelectorAll('input[type="hidden"]').forEach(o => o.value=''),console.log('✅ Form cleared');
}saveDraft() {
try {
const t={...this.getFormData(),savedAt:new Date().toISOString()};return localStorage.setItem(ne,JSON.stringify(t)),console.log('✅ Draft saved'),!0;
} catch (e) {
return console.error('❌ Failed to save draft:',e),!1;
}
}loadDraft() {
try {
const e=localStorage.getItem(ne);if (!e) {
return null;
} const t=JSON.parse(e),s=new Date(t.savedAt);return (new Date-s)/(1e3*60*60*24)>7?(console.log('⏰ Draft is too old, clearing...'),this.clearDraft(),null):(console.log('✅ Draft loaded'),t);
} catch (e) {
return console.error('❌ Failed to load draft:',e),null;
}
}clearDraft() {
try {
localStorage.removeItem(ne),console.log('✅ Draft cleared');
} catch (e) {
console.error('❌ Failed to clear draft:',e);
}
}fillWithDraft(e) {
if (!(!this.form||!e)) {
if (e.branch) {
const t=this.form.querySelector('#taskBranch');t&&(t.value=e.branch);
} if (e.deadline) {
const t=this.form.querySelector('#taskDeadline');t&&(t.value=e.deadline);
} if (e.estimatedTime) {
const t=this.form.querySelector('#taskEstimatedTime');t&&(t.value=e.estimatedTime);
} if (e.description) {
const t=this.form.querySelector('#taskDescription');t&&(t.value=e.description);
}console.log('✅ Form filled with draft data');
}
}getFormData() {
let l,c,d,u,g,p;if (!this.form) {
return console.error('❌ Form not initialized'),{};
} const e=((c=(l=window.ClientCaseSelectorsManager)==null?void 0:l.getBudgetValues)==null?void 0:c.call(l))||{},t=((d=this.form.querySelector('#taskBranch'))==null?void 0:d.value)||'',s=((u=this.form.querySelector('#budgetDeadline'))==null?void 0:u.value)||'',n=((g=this.form.querySelector('#estimatedTime'))==null?void 0:g.value)||'';let o='';document.getElementById('taskDescriptionGuided')&&window._currentTaskDescriptionInput?o=window._currentTaskDescriptionInput.getValue():o=((p=this.form.querySelector('#budgetDescription'))==null?void 0:p.value)||'';const r='';return {...e,branch:t,deadline:s,estimatedTime:parseInt(n)||0,description:o,categoryId:r,categoryName:this.getCategoryName(r)};
}getCategoryName(e) {
if (!e||!window.WorkCategories) {
return null;
} const t=window.WorkCategories.getCategoryById(e);return (t==null?void 0:t.name)||null;
}hasUnsavedChanges() {
const e=this.getFormData();return !!(e.description||e.branch||e.estimatedTime||e.clientId);
} async promptSaveDraft() {
let t;return this.hasUnsavedChanges()?(t=window.NotificationSystem)!=null&&t.confirm?new Promise(s => {
window.NotificationSystem.confirm('יש לך שינויים לא שמורים. האם לשמור כטיוטה?',() => {
this.saveDraft(),s(!0);
},() => {
s(!0);
},{title:'שמירת טיוטה',confirmText:'כן, שמור',cancelText:'לא, המשך בלי לשמור'});
}):(confirm('יש לך שינויים לא שמורים. האם לשמור כטיוטה?')&&this.saveDraft(),!0):!0;
}
} function jt(i,e) {
if (!i) {
throw new Error('Form data is required');
} if (!e) {
throw new Error('Current user is required');
} return {description:i.description||'',categoryId:i.categoryId||null,categoryName:i.categoryName||null,clientName:i.clientName||'',clientId:i.clientId||'',caseId:i.caseId||'',caseNumber:i.caseNumber||'',caseTitle:i.caseTitle||'',serviceId:i.serviceId||'',serviceName:i.serviceName||'',serviceType:i.serviceType||'',parentServiceId:i.parentServiceId||null,branch:i.branch||'',estimatedMinutes:parseInt(i.estimatedMinutes)||0,originalEstimate:parseInt(i.estimatedMinutes)||0,deadline:i.deadline||'',employee:e,status:'active',timeSpent:0,actualMinutes:0,timeEntries:[],createdAt:new Date,updatedAt:new Date};
} function Kt(i) {
const e=[];return (!i.description||i.description.trim().length<3)&&e.push('תיאור המשימה חייב להכיל לפחות 3 תווים'),i.clientId||e.push('חובה לבחור לקוח'),i.caseId||e.push('חובה לבחור תיק'),i.branch||e.push('חובה לבחור סניף מטפל'),(!i.estimatedMinutes||i.estimatedMinutes<1)&&e.push('זמן משוער חייב להיות לפחות 1 דקה'),i.deadline||e.push('חובה לבחור תאריך יעד'),i.employee||e.push('חסר מידע על העובד המבצע'),{isValid:e.length===0,errors:e};
} class Yt {
constructor(e,t={}) {
this.manager=e,this.options={onSuccess:t.onSuccess||null,onError:t.onError||null,onCancel:t.onCancel||null,enableDrafts:t.enableDrafts!==!1,...t},this.validator=new Wt,this.formManager=new Gt('addTaskForm'),this.overlay=null,this.isVisible=!1,this.clientCaseSelector=null,this.descriptionSelector=null,console.log('✅ AddTaskDialog instance created');
}show() {
if (console.log('🔍 AddTaskDialog.show() called'),this.isVisible) {
console.warn('⚠️ Dialog is already visible');return;
} try {
console.log('🔍 Calling render()...'),this.render(),this.isVisible=!0,console.log('✅ Add Task Dialog shown successfully');
} catch (e) {
throw console.error('❌ Error showing Add Task Dialog:',e),console.error('Stack trace:',e.stack),e;
}
} async hide() {
this.isVisible&&(this.options.enableDrafts&&this.formManager.hasUnsavedChanges()&&!await this.formManager.promptSaveDraft()||(this.overlay&&this.overlay.classList.add('hidden'),this.isVisible=!1,this.options.onCancel&&this.options.onCancel(),console.log('✅ Add Task Dialog hidden')));
}render() {
console.log('🔍 render() called');try {
const e=this.buildHTML();console.log('✅ buildHTML() completed');const t=document.getElementById('budgetTab');if (!t) {
throw console.error('❌ budgetTab not found - element does not exist in DOM'),console.log('Available elements:',document.querySelectorAll('[id*="budget"]')),new Error('budgetTab element not found');
}console.log('✅ budgetTab found:',t);const s=document.createElement('div');if (s.innerHTML=e,this.overlay=s.firstElementChild,console.log('✅ overlay created:',this.overlay),t.insertBefore(this.overlay,t.firstChild),console.log('✅ overlay inserted into budgetTab'),this.overlay.classList.remove('hidden'),console.log('✅ hidden class removed'),this.formManager.init(),console.log('✅ form manager initialized'),this.setupEventListeners(),console.log('✅ event listeners setup'),setTimeout(() => this.initializeSelectors(),100),console.log('✅ selectors initialization scheduled'),this.options.enableDrafts) {
const n=this.formManager.loadDraft();n?this.showDraftPrompt(n):this.formManager.fillDefaults();
} else {
this.formManager.fillDefaults();
}console.log('✅ render() completed successfully');
} catch (e) {
throw console.error('❌ Error in render():',e),console.error('Stack trace:',e.stack),e;
}
}buildHTML() {
return `
      <div class="compact-form" id="budgetFormContainer">
        <form id="budgetForm">
          <!-- ✅ NEW: Unified Client-Case Selector -->
          <div id="budgetClientCaseSelector"></div>

          <!-- Compact Row: סניף + תאריך + דקות - הכל בשורה אחת מאוזנת -->
          <div class="form-row" style="grid-template-columns: 1fr 1fr 160px; gap: 12px;">
            <div class="form-group">
              <label for="budgetBranch">
                <i class="fas fa-map-marker-alt"></i> סניף מטפל
                <span class="category-required">*</span>
              </label>
              <select id="budgetBranch" required>
                <option value="">בחר סניף</option>
                <option value="רחובות">רחובות</option>
                <option value="תל אביב">תל אביב</option>
              </select>
            </div>
            <div class="form-group">
              <label for="budgetDeadline">
                <i class="fas fa-calendar-alt"></i> תאריך יעד
                <span class="category-required">*</span>
              </label>
              <input
                type="datetime-local"
                id="budgetDeadline"
                required
              />
            </div>
            <div class="form-group">
              <label for="estimatedTime">
                <i class="fas fa-hourglass-half"></i> דקות
                <span class="category-required">*</span>
              </label>
              <input
                type="number"
                id="estimatedTime"
                placeholder="120"
                min="1"
                max="99999"
                autocomplete="off"
                required
              />
            </div>
          </div>

          <!-- תיאור המשימה - Guided Text Input -->
          <div class="form-row">
            <div class="form-group full-width">
              <label for="taskDescriptionGuided">
                <i class="fas fa-align-right"></i> תיאור המשימה
                <span class="category-required">*</span>
              </label>
              <div id="taskDescriptionGuided"></div>
            </div>
          </div>

          <div class="form-buttons">
            <button
              type="button"
              class="btn btn-secondary"
              onclick="window.AddTaskSystem.hide()"
            >
              <i class="fas fa-times"></i>
              ביטול
            </button>
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-plus"></i>
              הוסף לתקצוב
            </button>
          </div>
        </form>
      </div>
    `;
}setupEventListeners() {
const e=document.getElementById('addTaskForm');e&&(e.addEventListener('submit',t => {
t.preventDefault(),this.handleSubmit();
}),this.overlay&&this.overlay.addEventListener('click',t => {
t.target===this.overlay&&this.hide();
}),document.addEventListener('keydown',this.handleEscapeKey.bind(this)),console.log('✅ Event listeners setup'));
}handleEscapeKey(e) {
e.key==='Escape'&&this.isVisible&&this.hide();
} async initializeSelectors() {
try {
await this.initClientCaseSelector(),await this.initDescriptionSelector(),console.log('✅ Selectors initialized');
} catch (e) {
console.error('❌ Error initializing selectors:',e);
}
} async initClientCaseSelector() {
if (!window.ClientCaseSelectorsManager) {
console.error('❌ ClientCaseSelectorsManager not available');return;
} if (document.getElementById('addTaskClientCaseSelector')) {
try {
await window.ClientCaseSelectorsManager.initializeBudgetSelector(this.manager.clients,this.manager.currentUser),this.clientCaseSelector=window.ClientCaseSelectorsManager,console.log('✅ ClientCaseSelector initialized');
} catch (t) {
console.error('❌ Error initializing ClientCaseSelector:',t);
}
}
} async initDescriptionSelector() {
if (!window.GuidedTextInput) {
console.warn('⚠️ GuidedTextInput not available');return;
} if (document.getElementById('taskDescriptionGuided')) {
try {
this.descriptionSelector=new window.GuidedTextInput('taskDescriptionGuided',{maxChars:50,placeholder:'תאר את המשימה בקצרה...',required:!0,showQuickSuggestions:!0,showRecentItems:!0}),window._currentTaskDescriptionInput=this.descriptionSelector,console.log('✅ GuidedTextInput initialized for task description');
} catch (t) {
console.error('❌ Error initializing GuidedTextInput:',t);
}
}
} async handleSubmit() {
try {
console.log('📝 Processing form submission...');const e=this.formManager.getFormData();if (this.descriptionSelector&&this.descriptionSelector.validate) {
const a=this.descriptionSelector.validate();if (!a.valid) {
window.NotificationSystem&&window.NotificationSystem.show(a.error,'error');return;
}
} const t=this.validator.validateAll({selectorValues:e,branch:e.branch,deadline:e.deadline,estimatedTime:e.estimatedTime,description:e.description});if (!t.isValid) {
const a=document.getElementById('taskFormErrors');this.validator.showErrors(t.errors,a);return;
} const s=jt(e,this.manager.currentUser),n=Kt(s);if (!n.isValid) {
const a=document.getElementById('taskFormErrors');this.validator.showErrors(n.errors,a);return;
} const o=document.getElementById('addTaskSubmitBtn');o&&(o.disabled=!0,o.innerHTML='<i class="fas fa-spinner fa-spin"></i> שומר...'),await this.saveTask(s);
} catch (e) {
console.error('❌ Error submitting form:',e),window.NotificationSystem?window.NotificationSystem.show('שגיאה בשמירת המשימה: '+e.message,'error'):alert('שגיאה בשמירת המשימה: '+e.message);const t=document.getElementById('addTaskSubmitBtn');t&&(t.disabled=!1,t.innerHTML='<i class="fas fa-plus"></i> הוסף לתקצוב'),this.options.onError&&this.options.onError(e);
}
} async saveTask(e) {
let t;try {
if (console.log('💾 Saving task...',e),window.FirebaseService) {
const s=await window.FirebaseService.call('createBudgetTask',e,{retries:3,timeout:15e3});if (!s.success) {
throw new Error(s.error||'Failed to create task');
} const n=(t=s.data)==null?void 0:t.taskId;console.log('✅ Task created:',n),window.EventBus&&window.EventBus.emit('task:created',{taskId:n||'unknown',clientId:e.clientId,clientName:e.clientName,employee:e.employee,status:'פעיל'}),this.options.enableDrafts&&this.formManager.clearDraft(),this.descriptionSelector&&this.descriptionSelector.saveToRecent&&this.descriptionSelector.saveToRecent(),window.NotificationSystem&&window.NotificationSystem.show('המשימה נוספה בהצלחה','success'),this.options.onSuccess&&this.options.onSuccess(e),this.hide();
} else {
throw new Error('FirebaseService לא זמין');
}
} catch (s) {
throw console.error('❌ Error saving task:',s),s;
}
}showDraftPrompt(e) {
let t;if (!((t=window.NotificationSystem)!=null&&t.confirm)) {
this.formManager.fillWithDraft(e);return;
}window.NotificationSystem.confirm('נמצאה טיוטה שמורה. האם לטעון אותה?',() => {
this.formManager.fillWithDraft(e);
},() => {
this.formManager.clearDraft(),this.formManager.fillDefaults();
},{title:'טיוטה שמורה',confirmText:'כן, טען',cancelText:'לא תודה'});
}cleanup() {
document.removeEventListener('keydown',this.handleEscapeKey.bind(this)),this.clientCaseSelector=null,this.descriptionSelector=null,console.log('✅ AddTaskDialog cleaned up');
}
} function Jt(i,e={}) {
if (console.log('🚀 Initializing Add Task System v2.0...'),!i) {
throw new Error('❌ Manager is required for Add Task System');
} const t=new Yt(i,e);return typeof window<'u'&&(window.AddTaskSystem={dialog:t,show:() => t.show(),hide:() => t.hide(),version:'2.0.0'}),console.log('✅ Add Task System v2.0 initialized'),t;
} function Qt(i) {
const e=i.employee||'unknown',t=i.date,s=Xt(i.action||''),n=i.minutes,o=Date.now();return `timesheet_${e}_${t}_${s}_${n}_${o}`;
} function Xt(i) {
let e=2166136261;for (let t=0;t<i.length;t++) {
e^=i.charCodeAt(t),e+=(e<<1)+(e<<4)+(e<<7)+(e<<8)+(e<<24);
} return (e>>>0).toString(36).slice(0,8);
} async function et(i,e={}) {
const t=Qt(i),s={...i,idempotencyKey:t};i.isInternal!==!0&&e.client&&(s.expectedVersion=e.client._version||0),!i.serviceId&&!i.isInternal&&console.warn('⚠️ [v2 Adapter] No serviceId - backend will use first service'),console.log('✅ [v2 Adapter] Calling createTimesheetEntry_v2:',{isInternal:i.isInternal,hasVersion:!!s.expectedVersion,hasIdempotencyKey:!0,date:i.date,minutes:i.minutes});const n=await window.FirebaseService.call('createTimesheetEntry_v2',s,{retries:3,timeout:15e3});if (!n.success) {
throw new Error(n.error||n.message||'שגיאה ברישום שעתון');
} const o=n.data;return console.log('✅ [v2 Adapter] Success:',{entryId:o.entryId,version:o.version}),o;
} class Zt {
constructor() {
this.announcements=[],this.currentIndex=0,this.isPaused=!1,this.isVisible=!1,this.autoplayInterval=null,this.scrollAnimationDuration=240,this.container=null,this.textElement=null,this.dotsContainer=null,this.unsubscribe=null,this.db=null,this.user=null,this.userRole=null,console.log('📢 SystemAnnouncementTicker initialized');
} async init(e,t) {
if (console.log('🚀 Initializing SystemAnnouncementTicker...'),!e||!t) {
console.error('❌ Missing user or db in ticker init');return;
} if (this.user=e,this.db=t,this.isDismissed()) {
console.log('ℹ️ Ticker was dismissed by user');return;
} await this.fetchUserRole(),this.render(),this.listenToAnnouncements(),console.log('✅ SystemAnnouncementTicker ready');
}isDismissed() {
if (localStorage.getItem('system_ticker_dismissed')!=='true') {
return !1;
} const t=localStorage.getItem('system_ticker_dismissed_at');if (!t) {
return !1;
} const s=parseInt(t);return (Date.now()-s)/(1e3*60*60)>24?(localStorage.removeItem('system_ticker_dismissed'),localStorage.removeItem('system_ticker_dismissed_at'),!1):!0;
} async fetchUserRole() {
try {
if (console.log('👤 Fetching user role from Firestore...'),!this.user||!this.user.email) {
console.warn('⚠️ No user email available'),this.userRole=null;return;
} const e=await this.db.collection('employees').doc(this.user.email).get();if (!e.exists) {
console.warn(`⚠️ User document not found: ${this.user.email}`),this.userRole=null;return;
} const t=e.data();this.userRole=t.role||'employee',console.log(`✅ User role fetched: ${this.userRole} (email: ${this.user.email})`);
} catch (e) {
console.error('❌ Error fetching user role:',e),this.userRole=null;
}
}shouldShowToUser(e) {
if (!e||e==='all') {
return console.log(`✅ shouldShowToUser: targetAudience='${e}' → showing to all users`),!0;
} if (e==='specific') {
return console.log("✅ shouldShowToUser: targetAudience='specific' → filtered by targetEmail"),!0;
} if (e==='admins') {
const t=this.userRole==='admin';return console.log(`${t?'✅':'❌'} shouldShowToUser: targetAudience='admins', userRole='${this.userRole}' → ${t?'SHOW':'HIDE'}`),t;
} return console.log(`✅ shouldShowToUser: targetAudience='${e}' → showing to all non-admin-restricted`),!0;
}listenToAnnouncements() {
console.log('👂 Setting up Firestore listener...'),this.unsubscribe=this.db.collection('system_announcements').where('active','==',!0).onSnapshot(e => {
console.log(`📊 Received ${e.size} announcements from Firestore`);const t=new Date;this.announcements=e.docs.map(s => {
let o,a;const n=s.data();return {id:s.id,title:n.title||'',message:n.message||'',type:n.type||'info',priority:n.priority||3,targetAudience:n.targetAudience||'all',startDate:(o=n.startDate)==null?void 0:o.toDate(),endDate:(a=n.endDate)==null?void 0:a.toDate(),displaySettings:n.displaySettings||{},targetEmail:n.targetEmail||null};
}).filter(s => s.displaySettings.showInHeader?s.startDate&&s.startDate>t?(console.log(`🚫 Announcement ${s.id} filtered out: not started yet`),!1):s.endDate&&s.endDate<t?(console.log(`🚫 Announcement ${s.id} filtered out: expired`),!1):s.targetEmail&&s.targetEmail!==this.user.email?(console.log(`🚫 Announcement ${s.id} filtered out: personal for ${s.targetEmail}`),!1):this.shouldShowToUser(s.targetAudience)?!0:(console.log(`🚫 Announcement ${s.id} filtered out: targetAudience '${s.targetAudience}' doesn't match user role '${this.userRole}'`),!1):(console.log(`🚫 Announcement ${s.id} filtered out: showInHeader = false`),!1)).sort((s,n) => n.priority!==s.priority?n.priority-s.priority:(n.startDate||0)-(s.startDate||0)),console.log(`✅ ${this.announcements.length} active announcements to display`),this.announcements.length>0?(this.container||this.render(),this.show(),this.currentIndex=0,this.updateDisplay(),this.startAutoplay()):this.hide();
},e => {
console.error('❌ Error listening to announcements:',e);
});
}render() {
const e=document.getElementById('systemAnnouncementTicker');e&&e.remove(),document.body.insertAdjacentHTML('afterbegin',`
      <div id="systemAnnouncementTicker" class="ticker-container" style="display: none;">
        <div class="ticker-icon" id="tickerIcon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="ticker-label">עדכוני מערכת</div>
        <div class="ticker-separator">|</div>
        <div class="ticker-content" id="tickerContent">
          <div class="ticker-text" id="tickerText"></div>
        </div>
        <div class="ticker-dots" id="tickerDots"></div>
        <button class="ticker-close" id="tickerClose" title="סגור הודעות" aria-label="סגור הודעות">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `),this.container=document.getElementById('systemAnnouncementTicker'),this.textElement=document.getElementById('tickerText'),this.dotsContainer=document.getElementById('tickerDots'),this.setupEventListeners(),console.log('✅ Ticker DOM created');
}setupEventListeners() {
if (!this.container) {
return;
} this.container.addEventListener('mouseenter',() => {
this.isPaused=!0,this.pauseAnimation(),console.log('⏸️ Ticker paused (hover)');
}),this.container.addEventListener('mouseleave',() => {
this.isPaused=!1,this.resumeAnimation(),console.log('▶️ Ticker resumed');
});const e=document.getElementById('tickerClose');e&&e.addEventListener('click',() => {
this.dismiss();
}),this.dotsContainer&&this.dotsContainer.addEventListener('click',t => {
if (t.target.classList.contains('ticker-dot')) {
const s=parseInt(t.target.dataset.index);this.goToAnnouncement(s);
}
});
}updateDisplay() {
if (this.announcements.length===0) {
return;
} if (this.textElement) {
const t=this.announcements[this.currentIndex],s=t.message,n=this.calculateRepeatCount(t,s);console.log(`📊 Showing announcement ${this.currentIndex+1}/${this.announcements.length}: "${s.substring(0,30)}..." → ${n}x repeats`);let o='';for (let r=0;r<n;r++) {
o+=`<span class="ticker-item">${s}</span>`;
} const a=o+o;this.textElement.innerHTML=a,console.log('✅ Content duplicated exactly 2x for seamless loop');
} const e=this.announcements[this.currentIndex];this.updateIcon(e.type),this.updateColor(e.type),this.updateDots(),this.restartScrollAnimation();
}calculateRepeatCount(e,t) {
return e.displayStyle&&e.displayStyle.mode==='manual'?Math.max(1,e.displayStyle.repeatCount||1):1;
}updateIcon(e) {
document.getElementById('tickerIcon');
}updateColor(e) {
this.container&&(this.container.classList.remove('ticker-info','ticker-success','ticker-warning','ticker-error'),this.container.classList.add(`ticker-${e}`));
}updateDots() {
if (this.dotsContainer) {
if (this.announcements.length<=1) {
this.dotsContainer.style.display='none';return;
} this.dotsContainer.style.display='flex',this.dotsContainer.innerHTML=this.announcements.map((e,t) => `<span class="ticker-dot ${t===this.currentIndex?'active':''}" data-index="${t}"></span>`).join('');
}
}restartScrollAnimation() {
this.textElement&&(this.textElement.style.animation='none',this.textElement.offsetWidth,this.textElement.style.animation='ticker-scroll-loop 60s linear infinite',console.log('🔄 Animation restarted - continuous loop mode'));
}pauseAnimation() {
this.textElement&&(this.textElement.style.animationPlayState='paused');
}resumeAnimation() {
this.textElement&&(this.textElement.style.animationPlayState='running');
}startAutoplay() {
console.log('🔄 Autoplay disabled - all announcements displayed in continuous seamless loop');
}stopAutoplay() {
this.autoplayInterval&&(clearInterval(this.autoplayInterval),this.autoplayInterval=null);
}nextAnnouncement() {
this.announcements.length!==0&&(this.currentIndex=(this.currentIndex+1)%this.announcements.length,this.updateDisplay(),console.log(`➡️ Next announcement (${this.currentIndex+1}/${this.announcements.length})`));
}goToAnnouncement(e) {
e<0||e>=this.announcements.length||(this.currentIndex=e,this.updateDisplay(),this.startAutoplay(),console.log(`🎯 Jumped to announcement ${e+1}`));
}show() {
this.isVisible||this.container&&(this.container.style.display='flex',document.body.classList.add('ticker-active'),this.isVisible=!0,console.log('✅ Ticker shown'));
}hide() {
this.isVisible&&(this.container&&(this.container.style.display='none',document.body.classList.remove('ticker-active'),this.isVisible=!1,console.log('ℹ️ Ticker hidden')),this.stopAutoplay());
}dismiss() {
console.log('👋 User dismissed ticker'),localStorage.setItem('system_ticker_dismissed','true'),localStorage.setItem('system_ticker_dismissed_at',Date.now().toString()),this.hide();
}cleanup() {
console.log('🧹 Cleaning up ticker...'),this.stopAutoplay(),this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.container&&(this.container.remove(),this.container=null),document.body.classList.remove('ticker-active'),console.log('✅ Ticker cleaned up');
}
} const ke={info:{icon:'fa-info-circle',color:'#0ea5e9'},success:{icon:'fa-check-circle',color:'#10b981'},warning:{icon:'fa-exclamation-triangle',color:'#f59e0b'},error:{icon:'fa-times-circle',color:'#ef4444'}};class es {
constructor() {
this.announcements=[],this.currentIndex=0,this.overlay=null,this.db=null,this.user=null,this.userRole=null,this.escapeHandler=null,this.countdownInterval=null,this.overlayClickDisabled=!1;
} async init(e,t) {
if (!e||!t) {
console.error('❌ [AnnouncementPopup] Missing user or db');return;
} this.user=e,this.db=t,await this.fetchUserRole(),await this.fetchUnreadAnnouncements(),this.announcements.length>0&&(this.render(),this.show());
} async fetchUserRole() {
try {
if (!this.user||!this.user.email) {
this.userRole=null;return;
} const e=await this.db.collection('employees').doc(this.user.email).get();if (!e.exists) {
this.userRole=null;return;
} const t=e.data();this.userRole=t.role||'employee';
} catch (e) {
console.error('❌ [AnnouncementPopup] Error fetching user role:',e),this.userRole=null;
}
} async fetchUnreadAnnouncements() {
try {
const e=await this.db.collection('system_announcements').where('active','==',!0).get(),t=new Date,s=this.user.email;this.announcements=e.docs.map(n => {
let a,r;const o=n.data();return {id:n.id,title:o.title||'',message:o.message||'',type:o.type||'info',priority:o.priority||3,targetAudience:o.targetAudience||'all',startDate:(a=o.startDate)==null?void 0:a.toDate(),endDate:(r=o.endDate)==null?void 0:r.toDate(),displaySettings:o.displaySettings||{},readBy:o.readBy||{},dismissedBy:o.dismissedBy||[],popupSettings:o.popupSettings||{requireReadConfirmation:!0,readTimer:'auto'},targetEmail:o.targetEmail||null};
}).filter(n => {
if (!n.displaySettings.showOnLogin||n.startDate&&n.startDate>t||n.endDate&&n.endDate<t||n.targetEmail&&n.targetEmail!==s||!this.shouldShowToUser(n.targetAudience)||n.readBy[s]||n.dismissedBy.includes(s)) {
return !1;
} const o=localStorage.getItem('announcement_popup_dismissed_'+n.id);if (o) {
if ((Date.now()-parseInt(o))/36e5<4) {
return !1;
}localStorage.removeItem('announcement_popup_dismissed_'+n.id);
} return !0;
}).sort((n,o) => o.priority-n.priority);
} catch (e) {
console.error('❌ [AnnouncementPopup] Error fetching announcements:',e),this.announcements=[];
}
}shouldShowToUser(e) {
return !e||e==='all'||e==='specific'?!0:e==='admins'?this.userRole==='admin':!0;
}render() {
const e=document.querySelector('.announcement-popup-overlay');e&&e.remove();const t=document.createElement('div');t.className='announcement-popup-overlay';const s=this.announcements.length>1;t.innerHTML=`
      <div class="announcement-popup-modal">
        <div class="announcement-popup-header">
          <div class="announcement-popup-type-icon" id="apTypeIcon">
            <i class="fas fa-info-circle"></i>
          </div>
          <span class="announcement-popup-counter ${s?'':'announcement-popup-counter-hidden'}" id="apCounter"></span>
          <button class="announcement-popup-close-btn" id="apCloseBtn" title="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="announcement-popup-body">
          <h3 class="announcement-popup-title" id="apTitle"></h3>
          <p class="announcement-popup-message" id="apMessage"></p>
        </div>
        <div class="announcement-popup-footer">
          <div class="announcement-popup-nav ${s?'':'announcement-popup-nav-hidden'}" id="apNav">
            <button class="announcement-popup-prev" id="apPrev" title="הקודם">
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="announcement-popup-dots" id="apDots"></div>
            <button class="announcement-popup-next" id="apNext" title="הבא">
              <i class="fas fa-chevron-left"></i>
            </button>
          </div>
          <div class="announcement-popup-actions">
            <button class="announcement-popup-mark-read" id="apMarkRead">
              <i class="fas fa-check"></i>
              <span>קראתי</span>
            </button>
            <button class="announcement-popup-mark-all-read ${s?'':'announcement-popup-mark-all-hidden'}" id="apMarkAllRead">
              קראתי הכל
            </button>
          </div>
        </div>
      </div>
    `,document.body.appendChild(t),this.overlay=t,this.setupEventListeners();
}setupEventListeners() {
if (!this.overlay) {
return;
} const e=this.overlay.querySelector('#apCloseBtn'),t=this.overlay.querySelector('#apPrev'),s=this.overlay.querySelector('#apNext'),n=this.overlay.querySelector('#apMarkRead'),o=this.overlay.querySelector('#apMarkAllRead');e.addEventListener('click',() => this.dismiss()),this.overlay.addEventListener('click',r => {
r.target===this.overlay&&!this.overlayClickDisabled&&this.dismiss();
}),t.addEventListener('click',() => {
this.currentIndex>0&&this.showAnnouncement(this.currentIndex-1);
}),s.addEventListener('click',() => {
this.currentIndex<this.announcements.length-1&&this.showAnnouncement(this.currentIndex+1);
}),this.overlay.querySelector('#apDots').addEventListener('click',r => {
const l=r.target.closest('.announcement-popup-dot');if (l) {
const c=parseInt(l.dataset.index);this.showAnnouncement(c);
}
}),n.addEventListener('click',() => {
const r=this.announcements[this.currentIndex];r&&this.markAsRead(r.id);
}),o.addEventListener('click',() => this.markAllAsRead()),this.escapeHandler=r => {
r.key==='Escape'&&!this.overlayClickDisabled&&this.dismiss();
},document.addEventListener('keydown',this.escapeHandler);
}showAnnouncement(e) {
let m;if (e<0||e>=this.announcements.length) {
return;
} this.currentIndex=e;const t=this.announcements[e],s=ke[t.type]||ke.info,n=this.overlay.querySelector('.announcement-popup-modal');if (t.targetEmail) {
if (n.classList.add('announcement-popup-personal'),!n.querySelector('.announcement-popup-personal-badge')) {
const f=document.createElement('span');f.className='announcement-popup-personal-badge',f.textContent='הודעה אישית',n.appendChild(f);
}
} else {
n.classList.remove('announcement-popup-personal');const f=n.querySelector('.announcement-popup-personal-badge');f&&f.remove();
} const o=this.overlay.querySelector('#apTypeIcon');o.className='announcement-popup-type-icon announcement-popup-type-'+t.type,o.innerHTML=`<i class="fas ${s.icon}"></i>`;const a=this.overlay.querySelector('#apTitle');t.title?(a.textContent=t.title,a.classList.remove('announcement-popup-title-hidden')):a.classList.add('announcement-popup-title-hidden'),this.overlay.querySelector('#apMessage').textContent=t.message;const r=this.overlay.querySelector('#apCounter');r.textContent=`${e+1} / ${this.announcements.length}`;const l=this.overlay.querySelector('#apDots');l.innerHTML=this.announcements.map((f,y) => `<button class="announcement-popup-dot ${y===e?'announcement-popup-dot-active':''}" data-index="${y}"></button>`).join('');const c=this.overlay.querySelector('#apPrev'),d=this.overlay.querySelector('#apNext');c.disabled=e===0,d.disabled=e===this.announcements.length-1,this.countdownInterval&&(clearInterval(this.countdownInterval),this.countdownInterval=null);const u=this.announcements[e],g=this.overlay.querySelector('.announcement-popup-mark-read'),p=this.getReadTimer(u);g.disabled=!0;let b=p;g.innerHTML=`קראתי (${b})`,this.countdownInterval=setInterval(() => {
b--,b<=0?(clearInterval(this.countdownInterval),this.countdownInterval=null,g.disabled=!1,g.innerHTML='✓ קראתי'):g.innerHTML=`קראתי (${b})`;
},1e3);const w=((m=u.popupSettings)==null?void 0:m.requireReadConfirmation)!==!1,h=this.overlay.querySelector('.announcement-popup-close-btn');w?(h.style.display='none',this.overlayClickDisabled=!0):(h.style.display='',this.overlayClickDisabled=!1);
}getReadTimer(e) {
const t=e.popupSettings||{};if (t.readTimer&&t.readTimer!=='auto') {
return parseInt(t.readTimer);
} const s=(e.title||'').length+(e.message||'').length;return s<=50?3:s<=150?5:8;
} async markAsRead(e) {
try {
const t=this.db.collection('system_announcements').doc(e).set({readBy:{[this.user.email]:{readAt:firebase.firestore.FieldValue.serverTimestamp(),displayName:this.user.displayName||this.user.email}}},{merge:!0}),s=new Promise((n,o) => setTimeout(() => o(new Error('timeout')),1e4));if (await Promise.race([t,s]),localStorage.removeItem('announcement_popup_dismissed_'+e),this.announcements=this.announcements.filter(n => n.id!==e),this.announcements.length>0) {
const n=Math.min(this.currentIndex,this.announcements.length-1);this.updateNavVisibility(),this.showAnnouncement(n);
} else {
this.close();
}
} catch (t) {
if (console.error('❌ [AnnouncementPopup] Error marking as read:',t),this.announcements=this.announcements.filter(s => s.id!==e),this.overlay) {
const s=this.overlay.querySelector('.announcement-popup-close-btn');s&&(s.style.display=''),this.overlayClickDisabled=!1;
} if (this.announcements.length>0) {
const s=Math.min(this.currentIndex,this.announcements.length-1);this.updateNavVisibility(),this.showAnnouncement(s);
} else {
this.close();
}
}
} async markAllAsRead() {
try {
const e=this.announcements.map(s => this.db.collection('system_announcements').doc(s.id).set({readBy:{[this.user.email]:{readAt:firebase.firestore.FieldValue.serverTimestamp(),displayName:this.user.displayName||this.user.email}}},{merge:!0})),t=new Promise((s,n) => setTimeout(() => n(new Error('timeout')),1e4));await Promise.race([Promise.all(e),t]),this.announcements.forEach(s => {
localStorage.removeItem('announcement_popup_dismissed_'+s.id);
}),this.announcements=[],this.close();
} catch (e) {
console.error('❌ [AnnouncementPopup] Error marking all as read:',e),this.announcements=[],this.close();
}
}dismiss() {
this.announcements.forEach(e => {
localStorage.setItem('announcement_popup_dismissed_'+e.id,Date.now().toString());
}),this.close();
}updateNavVisibility() {
if (!this.overlay) {
return;
} const e=this.announcements.length>1,t=this.overlay.querySelector('#apNav'),s=this.overlay.querySelector('#apCounter'),n=this.overlay.querySelector('#apMarkAllRead');e?(t.classList.remove('announcement-popup-nav-hidden'),s.classList.remove('announcement-popup-counter-hidden'),n.classList.remove('announcement-popup-mark-all-hidden')):(t.classList.add('announcement-popup-nav-hidden'),s.classList.add('announcement-popup-counter-hidden'),n.classList.add('announcement-popup-mark-all-hidden'));
}show() {
this.overlay&&this.showAnnouncement(0);
}close() {
this.countdownInterval&&(clearInterval(this.countdownInterval),this.countdownInterval=null),this.escapeHandler&&(document.removeEventListener('keydown',this.escapeHandler),this.escapeHandler=null),this.overlay&&(this.overlay.remove(),this.overlay=null);
}cleanup() {
this.close();
}
} const K='breakState';class ts {
constructor() {
this.active=!1,this.startTime=null,this.timerInterval=null,this.user=null,this.db=null,this.buttonElement=null,this.overlayElement=null,this.recoveryElement=null,this.timerElement=null,this.toastElement=null,this.boundStorageHandler=this._onStorageChange.bind(this);
} async init(e,t) {
this.user=e,this.db=t,this._createDOM(),this._attachEvents(),this._syncTabs();const s=this._loadState();s&&s.active&&this._showRecoveryDialog(s);
}startBreak() {
this.active||(this.active=!0,this.startTime=Date.now(),this._saveState(),this._pauseIdleTimeout(),this._showOverlay(),this._startTimer(),this._updateButtonState());
}endBreak() {
if (!this.active) {
return;
} const e=Math.max(1,Math.round((Date.now()-this.startTime)/6e4));this._stopTimer(),this._hideOverlay(),this._resumeIdleTimeout(),this._recordTimesheet(e),this._clearState(),this.active=!1,this.startTime=null,this._updateButtonState();
}endBreakWithCustomTime(e) {
if (!this.startTime) {
return;
} const t=Math.max(1,Math.round((e-this.startTime)/6e4));this._stopTimer(),this._hideOverlay(),this._hideRecoveryDialog(),this._resumeIdleTimeout(),this._recordTimesheet(t),this._clearState(),this.active=!1,this.startTime=null,this._updateButtonState();
}cleanup() {
this._stopTimer(),window.removeEventListener('storage',this.boundStorageHandler);
}getStatus() {
return {active:this.active,startTime:this.startTime,elapsedMinutes:this.active?Math.round((Date.now()-this.startTime)/6e4):0};
}_createDOM() {
this.buttonElement=document.getElementById('sidebarBreakBtn'),this.overlayElement=document.createElement('div'),this.overlayElement.className='break-overlay',this.overlayElement.innerHTML=`
      <div class="break-overlay-content">
        <div class="break-icon">
          <div class="break-steam">
            <div class="break-steam-line"></div>
            <div class="break-steam-line"></div>
            <div class="break-steam-line"></div>
          </div>
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
          </svg>
        </div>
        <h2 class="break-title">בהפסקה</h2>
        <div class="break-timer">00<span class="break-timer-colon">:</span>00<span class="break-timer-colon">:</span>00</div>
        <button class="break-return-btn">חזרתי מהפסקה</button>
      </div>
    `,this.timerElement=this.overlayElement.querySelector('.break-timer'),this.recoveryElement=document.createElement('div'),this.recoveryElement.className='break-recovery',this.recoveryElement.innerHTML=`
      <div class="break-recovery-card">
        <h3 class="break-recovery-title">הפסקה פתוחה</h3>
        <p class="break-recovery-subtitle"></p>
        <p class="break-recovery-question">מתי חזרת?</p>
        <div class="break-recovery-options">
          <label class="break-recovery-option" data-minutes="15">
            <input type="radio" name="breakRecovery" value="15">
            <span class="break-recovery-radio"></span>
            <span>לפני 15 דקות</span>
          </label>
          <label class="break-recovery-option" data-minutes="30">
            <input type="radio" name="breakRecovery" value="30">
            <span class="break-recovery-radio"></span>
            <span>לפני 30 דקות</span>
          </label>
          <label class="break-recovery-option" data-minutes="60">
            <input type="radio" name="breakRecovery" value="60">
            <span class="break-recovery-radio"></span>
            <span>לפני שעה</span>
          </label>
          <label class="break-recovery-option" data-minutes="custom">
            <input type="radio" name="breakRecovery" value="custom">
            <span class="break-recovery-radio"></span>
            <span>בחירה ידנית</span>
          </label>
        </div>
        <div class="break-recovery-custom">
          <input type="time" class="break-recovery-time-input">
        </div>
        <button class="break-recovery-submit" disabled>סגור הפסקה</button>
      </div>
    `,this.toastElement=document.createElement('div'),this.toastElement.className='break-toast',this.toastElement.style.display='none',document.body.appendChild(this.overlayElement),document.body.appendChild(this.recoveryElement),document.body.appendChild(this.toastElement);
}_attachEvents() {
this.buttonElement.addEventListener('click',() => {
this.active?this.endBreak():this.startBreak();
}),this.overlayElement.querySelector('.break-return-btn').addEventListener('click',() => {
this.endBreak();
});const e=this.recoveryElement.querySelectorAll('.break-recovery-option'),t=this.recoveryElement.querySelector('.break-recovery-submit'),s=this.recoveryElement.querySelector('.break-recovery-custom');e.forEach(n => {
n.addEventListener('click',() => {
e.forEach(a => a.classList.remove('selected')),n.classList.add('selected'),n.querySelector('input').checked=!0,n.dataset.minutes==='custom'?s.classList.add('visible'):s.classList.remove('visible'),t.disabled=!1;
});
}),t.addEventListener('click',() => {
const n=this.recoveryElement.querySelector('input[name="breakRecovery"]:checked');if (!n) {
return;
} let o;if (n.value==='custom') {
const a=this.recoveryElement.querySelector('.break-recovery-time-input');if (!a.value) {
return;
} const [r,l]=a.value.split(':').map(Number),c=new Date;o=new Date(c.getFullYear(),c.getMonth(),c.getDate(),r,l).getTime(),o>Date.now()&&(o-=24*60*60*1e3);
} else {
o=Date.now()-parseInt(n.value)*60*1e3;
}o<=this.startTime&&(o=this.startTime+6e4),this.endBreakWithCustomTime(o);
});
}_showOverlay() {
this.overlayElement.style.display='flex',requestAnimationFrame(() => {
this.overlayElement.classList.add('visible');
});
}_hideOverlay() {
this.overlayElement.classList.remove('visible');const e=() => {
this.overlayElement.classList.contains('visible')||(this.overlayElement.style.display=''),this.overlayElement.removeEventListener('transitionend',e);
};this.overlayElement.addEventListener('transitionend',e);
}_updateButtonState() {
this.active?this.buttonElement.classList.add('active'):this.buttonElement.classList.remove('active');
}_startTimer() {
this._updateTimerDisplay(),this.timerInterval=setInterval(() => {
this._updateTimerDisplay();
},1e3);
}_stopTimer() {
this.timerInterval&&(clearInterval(this.timerInterval),this.timerInterval=null);
}_updateTimerDisplay() {
if (!this.startTime||!this.timerElement) {
return;
} const e=Math.floor((Date.now()-this.startTime)/1e3),t=String(Math.floor(e/3600)).padStart(2,'0'),s=String(Math.floor(e%3600/60)).padStart(2,'0'),n=String(e%60).padStart(2,'0');this.timerElement.innerHTML=`${t}<span class="break-timer-colon">:</span>${s}<span class="break-timer-colon">:</span>${n}`;
}_pauseIdleTimeout() {
try {
window.manager&&window.manager.idleTimeout&&window.manager.idleTimeout.stop();
} catch (e) {
console.warn('BreakManager: Could not pause idle timeout',e);
}
}_resumeIdleTimeout() {
try {
window.manager&&window.manager.idleTimeout&&window.manager.idleTimeout.start();
} catch (e) {
console.warn('BreakManager: Could not resume idle timeout',e);
}
}_saveState() {
const e={active:!0,startTime:this.startTime,employee:this.user.email,employeeName:this.user.username||''};localStorage.setItem(K,JSON.stringify(e));
}_loadState() {
try {
const e=localStorage.getItem(K);return e?JSON.parse(e):null;
} catch {
return null;
}
}_clearState() {
localStorage.removeItem(K);
}_syncTabs() {
window.addEventListener('storage',this.boundStorageHandler);
}_onStorageChange(e) {
if (e.key===K) {
if (e.newValue) {
const t=JSON.parse(e.newValue);this.active=!0,this.startTime=t.startTime,this._pauseIdleTimeout(),this._showOverlay(),this._startTimer(),this._updateButtonState();
} else {
this._stopTimer(),this._hideOverlay(),this._hideRecoveryDialog(),this._resumeIdleTimeout(),this.active=!1,this.startTime=null,this._updateButtonState();
}
}
}_showRecoveryDialog(e) {
this.active=!0,this.startTime=e.startTime,this._pauseIdleTimeout();const t=new Date(e.startTime),s=Date.now()-e.startTime,n=Math.floor(s/36e5),o=Math.floor(s%36e5/6e4),a=t.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});let r;n>0?r=`לפני ${n} שעות ו-${o} דקות`:r=`לפני ${o} דקות`;const l=this.recoveryElement.querySelector('.break-recovery-subtitle');l.textContent=`התחילה ב-${a} (${r})`,this.recoveryElement.querySelectorAll('.break-recovery-option').forEach(d => d.classList.remove('selected')),this.recoveryElement.querySelector('.break-recovery-custom').classList.remove('visible'),this.recoveryElement.querySelector('.break-recovery-submit').disabled=!0;const c=this.recoveryElement.querySelector('.break-recovery-time-input');c&&(c.value=''),this.recoveryElement.style.display='flex',requestAnimationFrame(() => {
this.recoveryElement.classList.add('visible');
}),this._updateButtonState();
}_hideRecoveryDialog() {
this.recoveryElement.classList.remove('visible');const e=() => {
this.recoveryElement.classList.contains('visible')||(this.recoveryElement.style.display=''),this.recoveryElement.removeEventListener('transitionend',e);
};this.recoveryElement.addEventListener('transitionend',e);
} async _recordTimesheet(e) {
try {
const t=new Date,s=t.getFullYear(),n=String(t.getMonth()+1).padStart(2,'0'),o=String(t.getDate()).padStart(2,'0'),a=`${s}-${n}-${o}`;await et({isInternal:!0,date:a,minutes:e,action:'הפסקה',employee:this.user.email}),this._showSuccessToast(e);
} catch (t) {
console.error('BreakManager: Failed to record timesheet',t),this._showErrorToast();
}
}_showSuccessToast(e) {
this.toastElement.textContent=`✓ הפסקה נרשמה — ${e} דקות`,this.toastElement.className='break-toast',this.toastElement.style.display='',setTimeout(() => {
this.toastElement.style.display='none';
},3e3);
}_showErrorToast() {
this.toastElement.textContent='✗ שגיאה ברישום ההפסקה',this.toastElement.className='break-toast error',this.toastElement.style.display='',setTimeout(() => {
this.toastElement.style.display='none';
},5e3);
}
} const ss={status:{פעיל:{padding:'5px 10px',fontSize:'10px',fontWeight:'500',borderRadius:'16px',background:'#f0f9ff',color:'#0369a1',border:'0.5px solid #bae6fd'},pending_approval:{padding:'5px 10px',fontSize:'10px',fontWeight:'500',borderRadius:'16px',background:'#f0f9ff',color:'#0369a1',border:'0.5px solid #bae6fd',icon:'🔒',displayText:''},הושלם:{padding:'5px 10px',fontSize:'10px',fontWeight:'500',borderRadius:'16px',background:'#ecfdf5',color:'#047857',border:'0.5px solid #a7f3d0',icon:'✓'}}};function is(i,e={}) {
if (!i||typeof i!=='string') {
return i||'';
} const t=ss.status[i];if (!t) {
return `<span style="color: #6b7280;">${F(i)}</span>`;
} const s={fontWeight:t.fontWeight||'500',color:t.color||'#6b7280',display:'inline-block',padding:t.padding,fontSize:t.fontSize,borderRadius:t.borderRadius,background:t.background||t.gradient,border:t.border||'none',boxShadow:'none',...e},n=Object.entries(s).map(([r,l]) => `${r.replace(/([A-Z])/g,'-$1').toLowerCase()}: ${l}`).join('; '),o=t.icon?`${t.icon} `:'',a=t.displayText||i;return `
    <span style="${n}">
      ${o}${F(a)}
    </span>
  `;
} function F(i) {
if (!i) {
return '';
} const e=document.createElement('div');return e.textContent=i,e.innerHTML;
} function ee(i,e,t,s='') {
if (!i&&!e) {
return '';
}`${Date.now()}${Math.random().toString(36).substr(2,9)}`;const n=t==='legal_procedure'?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>';return `
    <div class="combined-info-badge" onclick="event.stopPropagation(); window.TimesheetConstants.showCombinedInfoPopup('${F(i)}', '${F(e)}', '${t}', '${F(s)}')">
      ${i?'<i class="fas fa-folder"></i>':''}
      ${e?n:''}
    </div>
  `;
} function ns(i,e,t,s='') {
let n='';t==='legal_procedure'&&s&&(n={stage_a:"א'",stage_b:"ב'",stage_c:"ג'"}[s]||''),console.log('🎯 showCombinedInfoPopup called with:',{caseNumber:i,serviceName:e,serviceType:t,serviceId:s,mappedStage:n});const o=document.querySelector('.info-popup');o&&o.remove();const a=t==='legal_procedure'?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>',r=t==='legal_procedure'?'הליך משפטי':'שירות',l=`
    <div class="info-popup combined-popup" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
    ">
      <div class="info-popup-content" style="
        background: white;
        border-radius: 12px;
        width: 360px;
        max-width: 90vw;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        transform: scale(0.95);
        transition: transform 0.2s ease;
      ">
        <!-- Header - Linear Style -->
        <div class="info-popup-header" style="
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
        ">
          <i class="fas fa-info-circle" style="font-size: 18px; opacity: 0.9;"></i>
          <span style="font-size: 16px; font-weight: 600;">פרטי משימה</span>
        </div>

        <!-- Body - Minimal Info Rows -->
        <div class="info-popup-body" style="
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        ">
          ${i?`
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          ">
            <i class="fas fa-folder" style="
              color: #64748b;
              font-size: 16px;
              width: 20px;
              text-align: center;
            "></i>
            <span style="
              color: #64748b;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">תיק:</span>
            <strong style="
              color: #1e293b;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">${F(i)}</strong>
          </div>
          `:''}
          ${e?`
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #f0f9ff;
            border-radius: 8px;
            border: 1px solid #bae6fd;
          ">
            ${a.replace('>',' style="color: #3b82f6; font-size: 16px; width: 20px; text-align: center;">')}
            <span style="
              color: #0369a1;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">${r}:</span>
            <strong style="
              color: #0c4a6e;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">${F(e)}</strong>
          </div>
          `:''}
          ${n&&t==='legal_procedure'?`
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #faf5ff;
            border-radius: 8px;
            border: 1px solid #e9d5ff;
          ">
            <i class="fas fa-layer-group" style="
              color: #9333ea;
              font-size: 16px;
              width: 20px;
              text-align: center;
            "></i>
            <span style="
              color: #7e22ce;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">שלב:</span>
            <strong style="
              color: #6b21a8;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">שלב ${F(n)}</strong>
          </div>
          `:''}
        </div>

        <!-- Footer - Single Close Button -->
        <div class="info-popup-footer" style="
          padding: 16px 24px 20px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #f1f5f9;
        ">
          <button onclick="window.TimesheetConstants.closeInfoPopup()" style="
            background: white;
            border: 1px solid #e2e8f0;
            color: #64748b;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.15s ease;
          " onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'">
            <i class="fas fa-times" style="font-size: 12px;"></i>
            סגור
          </button>
        </div>
      </div>
    </div>
  `;document.body.insertAdjacentHTML('beforeend',l),setTimeout(() => {
const d=document.querySelector('.info-popup');if (d) {
d.style.opacity='1';const u=d.querySelector('.info-popup-content');u&&(u.style.transform='scale(1)');
}
},10);const c=document.querySelector('.info-popup');c&&c.addEventListener('click',d => {
d.target===c&&tt();
});
} function tt() {
const i=document.querySelector('.info-popup');if (i) {
i.style.opacity='0';const e=i.querySelector('.info-popup-content');e&&(e.style.transform='scale(0.95)'),setTimeout(() => i.remove(),200);
}
} typeof window<'u'&&(window.TimesheetConstants={showCombinedInfoPopup:ns,closeInfoPopup:tt});const J={isMobile:!window.matchMedia('(hover: hover)').matches};function pe(i) {
return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1;
} function os(i,e) {
if (!i||!e||i.classList.contains('has-description-tooltip')||!pe(i)) {
return;
}i.classList.add('is-truncated');const t=document.createElement('i');t.className='fas fa-info-circle description-info-icon',t.setAttribute('title','לחץ לצפייה במלל המלא'),t.setAttribute('data-full-text',e),J.isMobile&&(t.classList.add('mobile-only'),t.addEventListener('click',o => {
o.stopPropagation(),te(e,i);
}));const s=i.parentElement,n=s.querySelector('.combined-info-badge');n?s.insertBefore(t,n):s.appendChild(t),i.classList.add('has-description-tooltip');
} function as(i) {
const e=document.createElement('div');e.className='description-tooltip';const t=document.createElement('div');return t.className='description-tooltip-content',t.textContent=i,e.appendChild(t),e;
} function rs(i,e) {
if (!i||!e||i.querySelector('.description-tooltip')) {
return;
} const t=as(e);i.appendChild(t);
} let $=null;function te(i,e=null) {
$&&V();const t=document.createElement('div');t.className='description-popover-overlay',t.addEventListener('click',l => {
l.target===t&&V();
});const s=document.createElement('div');s.className='description-popover';const n=document.createElement('div');n.className='description-popover-header';const o=document.createElement('div');o.className='description-popover-title',o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const a=document.createElement('button');a.className='description-popover-close',a.innerHTML='<i class="fas fa-times"></i>',a.setAttribute('aria-label','סגור'),a.addEventListener('click',V),n.appendChild(o),n.appendChild(a);const r=document.createElement('div');r.className='description-popover-body',r.textContent=i,s.appendChild(n),s.appendChild(r),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(() => {
t.classList.add('active');
}),$=t,document.addEventListener('keydown',st);
} function V() {
$&&($.classList.remove('active'),setTimeout(() => {
$&&$.parentElement&&$.remove(),$=null;
},200),document.removeEventListener('keydown',st));
} function st(i) {
i.key==='Escape'&&V();
} function ls(i=document) {
const e=i.querySelectorAll('.td-description, .timesheet-cell-action, .task-description-cell');console.log('🔵 Description Tooltips: Found',e.length,'description cells'),e.forEach(t => {
const s=t.querySelector('.table-description-with-icons');if (!s) {
return;
} const n=s.querySelector('span');if (!n) {
return;
} const o=n.textContent.trim();if (!o) {
return;
} const a=pe(n);console.log('🔍 Checking truncation:',{text:o.substring(0,30)+'...',isTruncated:a,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),a&&(console.log('✅ Adding info icon for:',o.substring(0,30)+'...'),os(n,o),J.isMobile||rs(t,o),J.isMobile&&(t.style.cursor='pointer',t.addEventListener('click',r => {
r.target.closest('.combined-info-badge, .action-btn, button')||(r.stopPropagation(),te(o,t));
})));
});
} function cs(i) {
if (!i) {
return;
} const e=i.textContent.trim();if (!e||i.querySelector('.card-description-info-icon')||!pe(i)) {
return;
} const t=document.createElement('span');t.className='linear-card-title-text',t.textContent=e,i.textContent='',i.appendChild(t);const s=document.createElement('i');if (s.className='fas fa-info-circle card-description-info-icon',s.setAttribute('title','לחץ לצפייה בתיאור המלא'),s.addEventListener('click',n => {
n.stopPropagation(),te(e,i);
}),i.appendChild(s),!J.isMobile) {
const n=document.createElement('div');n.className='card-description-tooltip';const o=document.createElement('div');o.className='card-description-tooltip-content',o.textContent=e,n.appendChild(o),i.appendChild(n);
}
} function ds(i=document) {
i.querySelectorAll('.linear-card-title').forEach(t => {
cs(t);
});
} function Q(i=document) {
ls(i),ds(i);
} function it(i=document) {
i.querySelectorAll('.description-tooltip').forEach(e => e.remove()),i.querySelectorAll('.description-info-icon').forEach(e => e.remove()),i.querySelectorAll('.card-description-tooltip').forEach(e => e.remove()),i.querySelectorAll('.card-description-info-icon').forEach(e => e.remove()),i.querySelectorAll('.has-description-tooltip').forEach(e => {
e.classList.remove('has-description-tooltip','is-truncated');
}),i.querySelectorAll('.linear-card-title').forEach(e => {
const t=e.querySelector('.linear-card-title-text');t&&(e.textContent=t.textContent);
}),requestAnimationFrame(() => {
setTimeout(() => {
console.log('⏰ Running truncation check after render...'),Q(i);
},50);
});
}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',() => {
Q();
}):Q();let Ie;window.addEventListener('resize',() => {
clearTimeout(Ie),Ie=setTimeout(() => {
it();
},300);
});window.DescriptionTooltips={init:Q,refresh:it,showPopover:te,closePopover:V};const P=1e3;async function nt(i,e='active',t=P) {
let s;try {
const n=window.firebaseDB;if (!n) {
throw new Error('Firebase לא מחובר');
} let o=n.collection('budget_tasks').where('employee','==',i),a,r=!1;try {
e==='active'?o=o.where('status','==','פעיל'):e==='completed'&&(o=o.where('status','==','הושלם').orderBy('completedAt','desc')),o=o.limit(t),a=await o.get();
} catch (u) {
u.code!=='failed-precondition'&&!((s=u.message)!=null&&s.includes('index'))&&console.warn('⚠️ Unexpected error, using fallback:',u.message),r=!0;try {
o=n.collection('budget_tasks').where('employee','==',i).limit(100),a=await o.get();
} catch (g) {
console.error('Fallback also failed, loading basic query:',g),o=n.collection('budget_tasks').where('employee','==',i),a=await o.get();
}
} const l=[];a.forEach(u => {
const g=u.data(),p={...window.DatesModule.convertTimestampFields(g,['createdAt','updatedAt','completedAt','deadline']),firebaseDocId:u.id,history:g.timeEntries||[]};p.id||(p.id=u.id),l.push(p);
});let c=l;r&&(e==='active'?c=l.filter(u => u.status==='פעיל'):e==='completed'&&(c=l.filter(u => u.status==='הושלם').sort((u,g) => {
const p=u.completedAt?new Date(u.completedAt):new Date(0);return (g.completedAt?new Date(g.completedAt):new Date(0))-p;
})),c=c.slice(0,t));let d=r?c:l;return e==='active'?d=d.filter(u => u.status==='פעיל'):e==='completed'&&(d=d.filter(u => u.status==='הושלם')),console.log(`✅ Loaded ${d.length} tasks (filter: ${e}, fallback: ${r})`),d;
} catch (n) {
throw console.error('Firebase error:',n),new Error('שגיאה בטעינת משימות: '+n.message);
}
} const q=async(i,e={}) => {
try {
return (await firebase.functions().httpsCallable(i)(e)).data;
} catch (t) {
throw console.error(`Error calling function ${i}:`,t),t.code==='unauthenticated'?new Error('נדרשת התחברות למערכת'):t.code==='permission-denied'?new Error('אין לך הרשאה לבצע פעולה זו'):t.code==='invalid-argument'?new Error(t.message||'נתונים לא תקינים'):t.code==='not-found'?new Error('הפריט לא נמצא'):new Error(t.message||'שגיאה בביצוע הפעולה');
}
};function us() {
try {
if (!window.firebaseDB) {
throw console.error('❌ Firebase Database לא זמין'),new Error('Firebase Database לא מחובר');
} return !0;
} catch (i) {
return console.error('❌ שגיאה באתחול Firebase:',i),!1;
}
} async function we() {
try {
const i=window.firebaseDB;if (!i) {
throw new Error('Firebase לא מחובר');
} const e=await i.collection('clients').get(),t=[];return e.forEach(s => {
const n=s.data(),o=s.id;t.push({...n,id:o,firestoreId:o,legacyId:n.id,source:'clients',fullName:n.fullName||n.clientName,fileNumber:n.fileNumber||n.caseNumber,casesCount:1,activeCasesCount:n.status==='active'?1:0,cases:[],hasVirtualCase:!1,type:n.type||n.procedureType||'hours'});
}),Logger.log(`✅ טעינה הושלמה: ${e.size} לקוחות/תיקים | ${t.length} רשומות סה"כ`),t;
} catch (i) {
throw console.error('Firebase error:',i),new Error('שגיאה בטעינת לקוחות: '+i.message);
}
} async function z(i) {
try {
const e=window.firebaseDB;if (!e) {
throw new Error('Firebase לא מחובר');
} const t=await e.collection('timesheet_entries').where('employee','==',i).limit(1e3).get(),s=[];return t.forEach(n => {
const o=n.data(),a=window.DatesModule.convertTimestampFields(o,['createdAt','updatedAt']);s.push({id:n.id,...a});
}),s.sort((n,o) => n.date?o.date?new Date(o.date)-new Date(n.date):-1:1),s;
} catch (e) {
throw console.error('Firebase error:',e),new Error('שגיאה בטעינת שעתון: '+e.message);
}
} async function ot(i) {
let e,t;console.warn('⚠️ [DEPRECATED] saveBudgetTaskToFirebase is deprecated. Use FirebaseService.call("createBudgetTask") instead.');try {
if (!navigator.onLine) {
throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.');
} const s=await q('createBudgetTask',i);if (!s.success) {
throw new Error(s.message||'שגיאה בשמירת משימה');
} return s.taskId;
} catch (s) {
throw console.error('Firebase error:',s),(e=s.message)!=null&&e.includes('אין חיבור לאינטרנט')?s:s.code==='unavailable'||(t=s.message)!=null&&t.includes('network')?new Error('בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב.'):s.code==='permission-denied'?new Error('אין לך הרשאה לבצע פעולה זו.'):s;
}
} async function ye(i,e,t) {
let s,n,o;console.log('✅ [v2.0] Using Enterprise accuracy mode');try {
if (!navigator.onLine) {
throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.');
} const a=await q('createTimesheetEntry_v2',{...i,expectedVersion:e,idempotencyKey:t});if (!a.success) {
throw new Error(a.message||'שגיאה בשמירת שעתון');
} return console.log(`✅ [v2.0] Timesheet saved: ${a.entryId}, Version: ${a.version}`),{entryId:a.entryId,version:a.version,entry:a.entry};
} catch (a) {
throw console.error('❌ [v2.0] Firebase error:',a),a.code==='aborted'&&((s=a.message)!=null&&s.includes('CONFLICT'))?new Error(`המסמך שונה על ידי משתמש אחר. אנא רענן את הדף ונסה שוב.

הסיבה: גרסה לא תואמת - מישהו אחר עדכן את הלקוח בינתיים.`):(n=a.message)!=null&&n.includes('אין חיבור לאינטרנט')?a:a.code==='unavailable'||(o=a.message)!=null&&o.includes('network')?new Error('בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב.'):a.code==='permission-denied'?new Error('אין לך הרשאה לבצע פעולה זו.'):a;
}
} async function at(i,e,t='') {
console.warn('⚠️ [DEPRECATED] updateTimesheetEntryFirebase is deprecated. Use FirebaseService.call("updateTimesheetEntry") instead.');try {
const s=await q('updateTimesheetEntry',{entryId:String(i),minutes:e,reason:t});if (!s.success) {
throw new Error(s.message||'שגיאה בעדכון שעתון');
} return s;
} catch (s) {
throw console.error('Firebase error:',s),s;
}
} async function rt(i,e) {
console.warn('⚠️ [DEPRECATED] addTimeToTaskFirebase is deprecated. Use FirebaseService.call("addTimeToTask") instead.');try {
const t=await q('addTimeToTask',{taskId:String(i),minutes:parseInt(e.minutes),date:e.date,description:e.description});if (!t.success) {
throw new Error(t.message||'שגיאה בהוספת זמן למשימה');
} return t;
} catch (t) {
throw console.error('❌ שגיאה בהוספת זמן למשימה:',t),t;
}
} async function lt(i,e='') {
console.warn('⚠️ [DEPRECATED] completeTaskFirebase is deprecated. Use FirebaseService.call("completeTask") instead.');try {
const t=await q('completeTask',{taskId:String(i),completionNotes:e});if (!t.success) {
throw new Error(t.message||'שגיאה בהשלמת משימה');
} return t;
} catch (t) {
throw console.error('❌ שגיאה בהשלמת משימה:',t),t;
}
} async function ct(i,e,t='') {
console.warn('⚠️ [DEPRECATED] extendTaskDeadlineFirebase is deprecated. Use FirebaseService.call("extendTaskDeadline") instead.');try {
const s=await q('extendTaskDeadline',{taskId:String(i),newDeadline:e,reason:t});if (!s.success) {
throw new Error(s.message||'שגיאה בהארכת תאריך יעד');
} return s;
} catch (s) {
throw console.error('❌ שגיאה בהארכת תאריך יעד:',s),s;
}
} class N {
static async execute(e) {
let f,y,v,T,E;const {loadingMessage:t,message:s,animationType:n='loading',action:o,successMessage:a,errorMessage:r='שגיאה בביצוע הפעולה',onSuccess:l=null,onError:c=null,onFinally:d=null,closePopupOnSuccess:u=!1,popupSelector:g='.popup-overlay',closeDelay:p=500,minLoadingDuration:b=200}=e,w=t||s||'מעבד...';if (typeof o!=='function') {
return console.error('❌ ActionFlowManager: action must be a function'),{success:!1,error:new Error('Invalid action parameter')};
} let h=null,m=null;try {
m=Date.now(),window.NotificationSystem?window.NotificationSystem.showLoading(w,{animationType:n}):(f=window.showSimpleLoading)==null||f.call(window,w),h=await o();const A=Date.now()-m,U=b-A;return U>0&&(Logger.log(`⏱️ Waiting ${U}ms to reach minimum loading duration...`),await new Promise(C => setTimeout(C,U))),window.NotificationSystem?window.NotificationSystem.hideLoading():(y=window.hideSimpleLoading)==null||y.call(window),await new Promise(C => setTimeout(C,100)),a&&(window.NotificationSystem?window.NotificationSystem.success(a,5e3):(v=window.showNotification)==null||v.call(window,a,'success')),l&&typeof l==='function'&&await l(h),u&&setTimeout(() => {
const C=document.querySelector(g);C&&C.remove();
},p),{success:!0,data:h};
} catch (A) {
console.error('❌ ActionFlowManager error:',A);const U=Date.now()-m,C=b-U;C>0&&(Logger.log(`⏱️ Waiting ${C}ms even on error...`),await new Promise(ie => setTimeout(ie,C))),window.NotificationSystem?window.NotificationSystem.hideLoading():(T=window.hideSimpleLoading)==null||T.call(window),await new Promise(ie => setTimeout(ie,100));const Se=`${r}: ${A.message||'שגיאה לא ידועה'}`;return window.NotificationSystem?window.NotificationSystem.error(Se,5e3):(E=window.showNotification)==null||E.call(window,Se,'error'),c&&typeof c==='function'&&await c(A),{success:!1,error:A};
} finally {
d&&typeof d==='function'&&await d();
}
} static async executeWithFormReset(e) {
const {formId:t,formContainerId:s,...n}=e,o=n.onSuccess;return this.execute({...n,onSuccess:async a => {
if (t) {
const r=document.getElementById(t);r&&r.reset();
} if (s) {
const r=document.getElementById(s);r&&r.classList.add('hidden');const l=document.getElementById('smartPlusBtn');l&&l.classList.remove('active');
}o&&await o(a);
}});
}
} function G(i) {
const e=document.getElementById('currentUserDisplay');e&&i&&(e.textContent=`${i} - משרד עו"ד גיא הרשקוביץ`);
} function hs(i) {
const e=document.querySelector('.user-avatar');if (e&&i) {
e.setAttribute('title',`מחובר: ${i}`),e.setAttribute('data-user',i);const t=['linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)','linear-gradient(135deg, #10b981 0%, #059669 100%)','linear-gradient(135deg, #f59e0b 0%, #d97706 100%)','linear-gradient(135deg, #ef4444 0%, #dc2626 100%)','linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)','linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)','linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)','linear-gradient(135deg, #84cc16 0%, #65a30d 100%)'],s=i.charCodeAt(0)%t.length;e.style.background=t[s],e.style.transform='scale(1.05)',setTimeout(() => {
e.style.transform='';
},300);
}
} function ve() {
const i=document.getElementById('loginSection'),e=document.getElementById('forgotPasswordSection'),t=document.getElementById('welcomeScreen'),s=document.getElementById('appContent'),n=document.getElementById('minimalSidebar'),o=document.getElementById('interfaceElements'),a=document.getElementById('mainFooter'),r=document.getElementById('bubblesContainer');i&&i.classList.remove('hidden'),e&&e.classList.add('hidden'),t&&t.classList.add('hidden'),s&&s.classList.add('hidden'),n&&n.classList.add('hidden'),o&&o.classList.add('hidden'),a&&a.classList.add('hidden'),r&&r.classList.remove('hidden'),document.body.classList.remove('logged-in');
} async function Le() {
let n;const i=document.getElementById('email').value,e=document.getElementById('password').value,t=document.getElementById('errorAlert'),s=document.getElementById('errorMessage');if (!i||!e) {
s&&t&&(s.textContent='אנא מלא את כל השדות',t.classList.add('show'),setTimeout(() => t.classList.remove('show'),3e3));return;
} try {
window.isInWelcomeScreen=!0;const o=await firebase.auth().signInWithEmailAndPassword(i,e),a=(n=o.user.email)==null?void 0:n.toLowerCase().trim(),r=o.user.uid;if (!a) {
throw new Error('לא התקבל אימייל מהמערכת');
} const l=await window.firebaseDB.collection('employees').doc(a).get();if (!l.exists) {
throw new Error('משתמש לא נמצא במערכת');
} const c=l.data();if (!c) {
throw new Error('שגיאה בטעינת נתוני עובד');
} this.currentUid=r,this.currentUser=a,this.currentUsername=c.username||c.name,this.currentEmployee=c,G(this.currentUsername),await this.showWelcomeScreen();try {
await this.loadData(),this.activityLogger&&await this.activityLogger.logLogin();try {
await window.firebaseDB.collection('employees').doc(this.currentUser).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),Logger.log('✅ lastLogin updated successfully');
} catch (d) {
console.warn('⚠️ Failed to update lastLogin:',d.message);
} if (window.PresenceSystem) {
try {
await Promise.race([window.PresenceSystem.connect(this.currentUid,this.currentUsername,this.currentUser),new Promise((d,u) => setTimeout(() => u(new Error('PresenceSystem timeout')),5e3))]),Logger.log('✅ PresenceSystem connected successfully');
} catch (d) {
console.warn('⚠️ PresenceSystem failed (non-critical):',d.message);
}
}
} catch (d) {
this.showNotification('שגיאה בטעינת נתונים','error'),console.error('Error loading data:',d);
} await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.initSecurityModules&&this.initSecurityModules(),this.showApp(),this.initAIChatSystem();
} catch (o) {
console.error('Login error:',o),window.isInWelcomeScreen=!1;let a='אימייל או סיסמה שגויים';o.code==='auth/user-not-found'?a='משתמש לא נמצא':o.code==='auth/wrong-password'?a='סיסמה שגויה':o.code==='auth/invalid-email'?a='כתובת אימייל לא תקינה':o.code==='auth/user-disabled'&&(a='חשבון זה הושבת. צור קשר עם המנהל'),s&&t&&(s.textContent=a,t.classList.add('show'),setTimeout(() => t.classList.remove('show'),3e3));
}
} async function ms() {
const i=document.getElementById('loginSection'),e=document.getElementById('welcomeScreen'),t=document.getElementById('welcomeTitle'),s=document.getElementById('lastLoginTime'),n=document.getElementById('bubblesContainer');i&&i.classList.add('hidden'),t&&(t.textContent=`ברוך הבא, ${this.currentUsername}`),e&&e.classList.remove('hidden'),n&&n.classList.remove('hidden'),this.welcomeScreenStartTime=Date.now();const o=document.getElementById('progressBar');if (o&&(o.style.width='0%'),s) {
try {
const a=await window.firebaseDB.collection('employees').doc(this.currentUser).get();if (a.exists) {
const r=a.data();if (r.lastLogin&&r.lastLogin.toDate) {
const c=r.lastLogin.toDate().toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});s.textContent=c;
} else {
s.textContent='זו הכניסה הראשונה שלך';
}
} else {
s.textContent='זו הכניסה הראשונה שלך';
}
} catch (a) {
console.error('⚠️ Failed to load lastLogin from Firebase:',a),s.textContent='זו הכניסה הראשונה שלך';
}
}
} async function fs() {} function gs(i,e=null) {
if (!window.isInWelcomeScreen) {
return;
} const t=document.getElementById('loaderText');if (t&&(t.textContent=i),e!==null) {
const s=document.getElementById('progressBar');s&&(s.style.width=`${Math.min(e,100)}%`);
}
} function be() {
const i=document.getElementById('loginSection'),e=document.getElementById('welcomeScreen'),t=document.getElementById('appContent'),s=document.getElementById('interfaceElements'),n=document.getElementById('minimalSidebar'),o=document.getElementById('mainFooter'),a=document.getElementById('bubblesContainer');i&&i.classList.add('hidden'),e&&e.classList.add('hidden'),t&&t.classList.remove('hidden'),s&&s.classList.remove('hidden'),n&&n.classList.remove('hidden'),o&&o.classList.remove('hidden'),a&&a.classList.add('hidden'),document.body.classList.add('logged-in');const r=document.getElementById('userInfo');r&&(r.innerHTML=`
      <span>שלום ${this.currentUsername}</span>
      <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
    `,r.classList.remove('hidden')),setTimeout(() => {
hs(this.currentUsername);
},500),window.manager&&typeof window.manager.initTicker==='function'&&window.manager.initTicker(),window.manager&&typeof window.manager.initPopup==='function'&&window.manager.initPopup();
} function dt() {
if (window.NotificationSystem&&typeof window.NotificationSystem.confirm==='function') {
console.log('✅ Using NotificationSystem.confirm'),window.NotificationSystem.confirm('האם אתה בטוח שברצונך לצאת? כל הנתונים שלא נשמרו יאבדו.',() => window.confirmLogout(),null,{title:'יציאה מהמערכת',confirmText:'כן, צא מהמערכת',cancelText:'ביטול',type:'warning'});return;
}console.log('⚠️ Using Fallback popup (NotificationSystem not available)');const i=document.createElement('div');i.className='popup-overlay show',i.style.cssText='position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);',i.innerHTML=`
    <div class="popup" style="max-width: 450px;">
      <div class="popup-header" style="color: #dc2626;">
        <i class="fas fa-power-off"></i>
        יציאה מהמערכת
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
        <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
          האם אתה בטוח שברצונך לצאת?
        </h3>
        <p style="color: #6b7280; font-size: 16px;">
          כל הנתונים שלא נשמרו יאבדו.
        </p>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
        <button class="popup-btn popup-btn-confirm" onclick="confirmLogout()">
          <i class="fas fa-check"></i> כן, צא מהמערכת
        </button>
      </div>
    </div>
  `,document.body.appendChild(i);
} async function ut() {
const i=document.getElementById('interfaceElements');if (i&&i.classList.add('hidden'),window.NotificationSystem) {
const t=window.NotificationSystem.info('מתנתק מהמערכת... להתראות',3e3).querySelector('.notification-icon i');t&&(t.className='fas fa-power-off');
} else {
window.manager&&window.manager.showNotification('מתנתק מהמערכת... להתראות','info');
}window.PresenceSystem&&await window.PresenceSystem.disconnect(),window.CaseNumberGenerator&&window.CaseNumberGenerator.cleanup(),await firebase.auth().signOut(),setTimeout(() => location.reload(),1500);
} function ps() {
const i=document.getElementById('loginSection'),e=document.getElementById('forgotPasswordSection'),t=document.getElementById('bubblesContainer');i&&i.classList.add('hidden'),e&&e.classList.remove('hidden'),t&&t.classList.remove('hidden');const s=document.getElementById('resetEmail');s&&(s.value='');const n=document.getElementById('resetErrorMessage'),o=document.getElementById('resetSuccessMessage');n&&n.classList.add('hidden'),o&&o.classList.add('hidden');
} async function ws(i) {
let n,o;i.preventDefault();const e=(o=(n=document.getElementById('resetEmail'))==null?void 0:n.value)==null?void 0:o.trim(),t=document.getElementById('resetErrorMessage'),s=document.getElementById('resetSuccessMessage');if (!e) {
t&&(t.textContent='אנא הזן כתובת אימייל',t.classList.remove('hidden'),setTimeout(() => t.classList.add('hidden'),3e3));return;
} try {
const a={url:window.location.origin+'/reset-password.html',handleCodeInApp:!1};await firebase.auth().sendPasswordResetEmail(e,a),s&&s.classList.remove('hidden'),t&&t.classList.add('hidden'),window.NotificationSystem&&window.NotificationSystem.success('📧 קישור לאיפוס סיסמה נשלח למייל שלך. בדוק את תיבת הדואר.',5e3),setTimeout(() => {
ve.call(this);
},3e3);
} catch (a) {
console.error('Password reset error:',a),console.error('Error code:',a.code),console.error('Error message:',a.message);let r='שגיאה בשליחת מייל לאיפוס סיסמה';a.code==='auth/user-not-found'?r='משתמש עם כתובת מייל זו לא נמצא במערכת':a.code==='auth/invalid-email'?r='כתובת אימייל לא תקינה':a.code==='auth/too-many-requests'?r='יותר מדי ניסיונות. נסה שוב מאוחר יותר':a.code==='auth/missing-continue-uri'||a.code==='auth/invalid-continue-uri'?r='שגיאת הגדרות Firebase - פנה למפתח':a.code==='auth/unauthorized-continue-uri'?r='שגיאת הרשאות Firebase - פנה למפתח':r=`שגיאה: ${a.code||'unknown'} - בדוק את ה-Console`,t&&(t.textContent=r,t.classList.remove('hidden'),setTimeout(() => t.classList.add('hidden'),5e3)),s&&s.classList.add('hidden'),window.NotificationSystem&&window.NotificationSystem.error(r,5e3);
}
} async function ys() {
let e;const i=document.getElementById('googleBtn');i&&(i.disabled=!0),ht();try {
const t=new firebase.auth.GoogleAuthProvider;t.addScope('profile'),t.addScope('email');const n=(await window.firebaseAuth.signInWithPopup(t)).user;console.log('✅ Google Login Success:',n);const o=(e=n.email)==null?void 0:e.toLowerCase().trim();if (!o) {
await window.firebaseAuth.signOut(),D('לא התקבל אימייל מ-Google'),i&&(i.disabled=!1);return;
} const a=await window.firebaseDB.collection('employees').doc(o).get();if (!a.exists) {
await window.firebaseAuth.signOut(),D('משתמש לא מורשה - פנה למנהל המערכת'),i&&(i.disabled=!1);return;
} const r=a.data();if (!r) {
await window.firebaseAuth.signOut(),D('שגיאה בטעינת נתוני עובד'),i&&(i.disabled=!1);return;
}console.log('✅ Employee validated:',r),this.currentUid=n.uid,this.currentUser=o,this.currentUsername=r.username||r.name||o,this.currentEmployee=r,G(this.currentUsername),window.isInWelcomeScreen=!0,await this.showWelcomeScreen(),await this.loadData(),this.activityLogger&&await this.activityLogger.logLogin();try {
await window.firebaseDB.collection('employees').doc(this.currentUser).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)});
} catch (l) {
console.warn('⚠️ Failed to update lastLogin:',l);
} if (window.PresenceSystem) {
try {
await Promise.race([window.PresenceSystem.connect(this.currentUid,this.currentUsername,this.currentUser),new Promise((l,c) => setTimeout(() => c(new Error('PresenceSystem timeout')),5e3))]),console.log('✅ PresenceSystem connected successfully');
} catch (l) {
console.warn('⚠️ PresenceSystem failed (non-critical):',l.message);
}
}console.log('🎯 Calling showApp...'),be.call(this),console.log('✅ showApp completed'),this.initAIChatSystem();
} catch (t) {
console.error('❌ Google Login Error:',t);let s='שגיאה בהתחברות עם Google';t.code==='auth/account-exists-with-different-credential'?s='קיים חשבון עם שיטת התחברות אחרת. היכנס עם סיסמה או פנה למנהל.':t.code==='auth/popup-closed-by-user'?s='הפופאפ נסגר - נסה שוב':t.code==='auth/cancelled-popup-request'&&(s='הבקשה בוטלה'),D(s),i&&(i.disabled=!1);
}
} async function vs() {
let e;const i=document.getElementById('appleBtn');i&&(i.disabled=!0),ht();try {
const t=new firebase.auth.OAuthProvider('apple.com');t.addScope('email'),t.addScope('name');const n=(await window.firebaseAuth.signInWithPopup(t)).user;console.log('✅ Apple Login Success:',n);const o=(e=n.email)==null?void 0:e.toLowerCase().trim();if (!o) {
await window.firebaseAuth.signOut(),D('לא התקבל אימייל מ-Apple'),i&&(i.disabled=!1);return;
} const a=await window.firebaseDB.collection('employees').doc(o).get();if (!a.exists) {
await window.firebaseAuth.signOut(),D('משתמש לא מורשה - פנה למנהל המערכת'),i&&(i.disabled=!1);return;
} const r=a.data();if (!r) {
await window.firebaseAuth.signOut(),D('שגיאה בטעינת נתוני עובד'),i&&(i.disabled=!1);return;
}console.log('✅ Employee validated:',r),this.currentUid=n.uid,this.currentUser=o,this.currentUsername=r.username||r.name||o,this.currentEmployee=r,G(this.currentUsername),window.isInWelcomeScreen=!0,await this.showWelcomeScreen(),await this.loadData(),this.activityLogger&&await this.activityLogger.logLogin();try {
await window.firebaseDB.collection('employees').doc(this.currentUser).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)});
} catch (l) {
console.warn('⚠️ Failed to update lastLogin:',l);
} if (window.PresenceSystem) {
try {
await Promise.race([window.PresenceSystem.connect(this.currentUid,this.currentUsername,this.currentUser),new Promise((l,c) => setTimeout(() => c(new Error('PresenceSystem timeout')),5e3))]),console.log('✅ PresenceSystem connected successfully');
} catch (l) {
console.warn('⚠️ PresenceSystem failed (non-critical):',l.message);
}
}console.log('🎯 Calling showApp...'),be.call(this),console.log('✅ showApp completed'),this.initAIChatSystem();
} catch (t) {
console.error('❌ Apple Login Error:',t);let s='שגיאה בהתחברות עם Apple';t.code==='auth/account-exists-with-different-credential'?s='קיים חשבון עם שיטת התחברות אחרת. היכנס עם סיסמה או פנה למנהל.':t.code==='auth/popup-closed-by-user'&&(s='הפופאפ נסגר - נסה שוב'),D(s),i&&(i.disabled=!1);
}
} function bs() {
const i=document.getElementById('password'),e=document.getElementById('toggleIcon');if (!i||!e) {
return;
} const t=i.type==='password';i.type=t?'text':'password',e.className=t?'fas fa-eye-slash':'fas fa-eye';
} function D(i) {
const e=document.getElementById('errorAlert'),t=document.getElementById('errorMessage');e&&t&&(t.textContent=i,e.classList.add('show'));
} function ht() {
const i=document.getElementById('errorAlert');i&&i.classList.remove('show');
} function Es(i) {
const e=document.querySelector('.password-input-section'),t=document.querySelector('.phone-input-section'),s=document.querySelector('.otp-input-section');e&&e.classList.remove('active'),t&&t.classList.remove('active'),s&&s.classList.remove('active'),document.querySelectorAll('.auth-method-btn').forEach(o => {
o.classList.remove('active');
}),i==='password'?e&&e.classList.add('active'):i==='sms'&&t&&t.classList.add('active');const n=document.querySelector(`.auth-method-btn[data-method="${i}"]`);n&&n.classList.add('active'),loginMethods.switchMethod(i);
} async function Ts() {
const i=document.getElementById('phoneNumber'),e=document.getElementById('smsErrorMessage');if (!i||!i.value) {
e&&(e.textContent='אנא הזן מספר טלפון',e.classList.remove('hidden'));return;
} try {
const t=document.getElementById('sendOTPBtn');t&&(t.disabled=!0,t.classList.add('loading')),await loginMethods.methods.sms.handler.sendOTP(i.value);const s=document.querySelector('.phone-input-section'),n=document.querySelector('.otp-input-section');if (s&&s.classList.remove('active'),n) {
n.classList.add('active');const o=document.querySelector('.otp-phone-display');o&&(o.textContent=loginMethods.methods.sms.handler.constructor.formatForDisplay(i.value));const a=document.querySelector('.otp-input');a&&a.focus(),Cs();
}
} catch (t) {
console.error('SMS login error:',t),e&&(e.textContent=t.message||'שגיאה בשליחת SMS',e.classList.remove('hidden'));
} finally {
const t=document.getElementById('sendOTPBtn');t&&(t.disabled=!1,t.classList.remove('loading'));
}
} async function Ss() {
const i=document.querySelectorAll('.otp-input'),e=document.getElementById('otpErrorMessage');let t='';if (i.forEach(s => {
t+=s.value;
}),t.length!==6) {
e&&(e.textContent='אנא הזן קוד בן 6 ספרות',e.classList.remove('hidden'));return;
} try {
const s=document.getElementById('verifyOTPBtn');s&&(s.disabled=!0,s.textContent='מאמת...');const n=await loginMethods.methods.sms.handler.verifyOTP(t);this.currentUser=n.employeeData.email,this.currentUsername=n.employeeData.username||n.employeeData.name,this.currentEmployee=n.employeeData,G(this.currentUsername),await this.showWelcomeScreen(),await this.loadData(),this.initSecurityModules&&this.initSecurityModules(),await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.showApp();
} catch (s) {
console.error('OTP verification error:',s),i.forEach(n => {
n.classList.add('error'),setTimeout(() => n.classList.remove('error'),500);
}),e&&(e.textContent=s.message||'קוד שגוי',e.classList.remove('hidden'));
} finally {
const s=document.getElementById('verifyOTPBtn');s&&(s.disabled=!1,s.textContent='אמת קוד');
}
} function Cs() {
let i=300;const e=document.querySelector('.otp-timer-countdown'),t=document.querySelector('.resend-otp-btn');t&&(t.disabled=!0);const s=setInterval(() => {
if (i--,e) {
const n=Math.floor(i/60),o=i%60;e.textContent=`${n}:${o.toString().padStart(2,'0')}`;
}i<=0&&(clearInterval(s),e&&(e.textContent='פג תוקף'),t&&(t.disabled=!1));
},1e3);return s;
} async function ks() {
try {
if (window.aiChat) {
Logger.log('[AI Chat] Already initialized, skipping');return;
} if (!window.lazyLoader) {
console.error('[AI Chat] LazyLoader not available');return;
}Logger.log('[AI Chat] 🚀 Starting lazy load...');const i=performance.now(),e=[{src:'js/modules/ai-system/ai-config.js',options:{version:'2.0.0'}},{src:'js/modules/ai-system/ai-engine.js',options:{version:'2.0.0'}},{src:'js/modules/ai-system/ai-context-builder.js',options:{version:'2.0.0'}},{src:'js/modules/UserReplyModal.js',options:{version:'1.0.3-threads'}},{src:'js/config/message-categories.js',options:{version:'1.0.0'}},{src:'js/modules/notification-bell.js',options:{version:'20251210-fix'}},{src:'js/modules/ai-system/ThreadView.js',options:{version:'1.0.4-mark-as-read'}}];if (await window.lazyLoader.loadScripts(e),await window.lazyLoader.loadScript('js/modules/ai-system/ai-chat-ui.js',{version:'2.0.7-categories'}),window.AIChatUI&&!window.aiChat) {
window.aiChat=new window.AIChatUI;const t=(performance.now()-i).toFixed(0);Logger.log(`[AI Chat] ✅ Initialized successfully (${t}ms)`);
} else {
console.warn('[AI Chat] ⚠️ AIChatUI class not available after loading');
} if (window.NotificationBellSystem) {
if (window.notificationBell||(window.notificationBell=new window.NotificationBellSystem,Logger.log('[NotificationBell] Instance created')),this.currentUser&&window.firebaseDB) {
const t={email:this.currentUser};window.notificationBell.startListeningToAdminMessages(t,window.firebaseDB),Logger.log(`[NotificationBell] ✅ Listening to admin messages for ${t.email}`);
} else {
console.warn('[NotificationBell] ⚠️ Cannot start listening - missing user or DB',{currentUser:this.currentUser,firebaseDB:!!window.firebaseDB});
}
}
} catch (i) {
console.error('[AI Chat] ❌ Failed to lazy load:',i);
}
} function Be() {
let t;const i=document.getElementById('appleBtn');if (!i) {
return;
}((t=window.CONFIG)==null?void 0:t.enableAppleOAuth)===!0?console.log('✅ Apple OAuth enabled'):(i.disabled=!0,i.style.opacity='0.5',i.style.cursor='not-allowed',i.title='בקרוב - Apple Sign-In נמצא בפיתוח',i.onclick=s => {
s.preventDefault(),D('Apple Sign-In יהיה זמין בקרוב');
},console.log('🚫 Apple OAuth disabled by feature flag'));
} function Is(i) {
const e=document.getElementById('budgetFormContainer'),t=document.getElementById('timesheetFormContainer');e&&e.classList.add('hidden'),t&&t.classList.add('hidden');const s=document.getElementById('smartPlusBtn');s&&s.classList.remove('active');const n=document.querySelector('.plus-container-new');if (n&&(n.style.display=''),window.beitMidrashInstance&&window.beitMidrashInstance.hide(),document.querySelectorAll('.tab-button, .top-nav-btn').forEach(o => {
o.classList.remove('active');
}),document.querySelectorAll('.tab-content').forEach(o => {
o.classList.remove('active');
}),i==='beit-midrash') {
const o=document.getElementById('beitMidrashTab');o&&o.classList.add('active'),n&&(n.style.display='none'),!window.beitMidrashInstance&&window.initBeitMidrash?(window.initBeitMidrash(),setTimeout(() => {
window.beitMidrashInstance&&window.beitMidrashInstance.show();
},50)):window.beitMidrashInstance&&window.beitMidrashInstance.show(),window.currentActiveTab=i;return;
} if (i==='budget') {
const o=document.getElementById('budgetTab');o&&o.classList.add('active'),document.querySelectorAll('.tab-button[onclick*="budget"], .top-nav-btn[onclick*="budget"]').forEach(a => {
a.classList.add('active');
});
} else if (i==='timesheet') {
const o=document.getElementById('timesheetTab');if (o&&o.classList.add('active'),document.querySelectorAll('.tab-button[onclick*="timesheet"], .top-nav-btn[onclick*="timesheet"]').forEach(r => {
r.classList.add('active');
}),document.getElementById('actionDate')&&window.manager&&window.manager.timesheetCalendar) {
const r=new Date;window.manager.timesheetCalendar.setDate(r,!1);
}
} else if (i==='reports') {
const o=document.getElementById('reportsTab');o&&o.classList.add('active'),document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(a => {
a.classList.add('active');
}),s&&(s.style.display='none'),typeof manager<'u'&&manager.initReportsForm&&manager.initReportsForm();
}i!=='reports'&&s&&(s.style.display='',s.style.visibility='visible',s.style.opacity='1'),window.currentActiveTab=i;
} function Ls() {
window.notificationBell&&window.notificationBell.toggleDropdown();
} function Bs() {
const i=window.notificationSystem||new NotificationSystem;i.confirm('כל ההתראות יימחקו ולא ניתן יהיה לשחזר אותן.',() => {
window.notificationBell&&(window.notificationBell.clearAllNotifications(),i.show('כל ההתראות נמחקו בהצלחה','success'));
},() => {
Logger.log('ביטול מחיקת התראות');
},{title:'⚠️ מחיקת כל ההתראות',confirmText:'מחק הכל',cancelText:'ביטול',type:'warning'});
} function Ds() {
const i=document.getElementById('smartPlusBtn'),e=window.currentActiveTab||'budget';let t,s;e==='budget'?(t=document.getElementById('budgetFormContainer'),s='budget'):e==='timesheet'&&(t=document.getElementById('timesheetFormContainer'),s='timesheet'),t&&(t.classList.contains('hidden')?(t.classList.remove('hidden'),i&&i.classList.add('active'),window.ClientCaseSelectorsManager&&(s==='budget'?(Logger.log('🎯 Opening budget form - initializing selectors...'),window.ClientCaseSelectorsManager.initializeBudget(),window.ClientCaseSelectorsManager.clearBudgetDescription(),window.ClientCaseSelectorsManager.initializeBudgetDescription()):s==='timesheet'&&(Logger.log('🎯 Opening timesheet form - initializing selector...'),window.ClientCaseSelectorsManager.initializeTimesheet())),setTimeout(() => {
const n=t.getBoundingClientRect();if (!(n.top>=0&&n.bottom<=window.innerHeight)) {
const r=t.getBoundingClientRect().top+window.pageYOffset+-80;window.scrollTo({top:r,behavior:'smooth'});
}
},100)):(t.classList.add('hidden'),i&&i.classList.remove('active')));
} class Ms {
constructor(e) {
this.manager=e,this.blockedClients=new Set,this.criticalClients=new Set,this.blockedClientsData=[],this.criticalClientsData=[];
}updateBlockedClients() {
if (this.blockedClients.clear(),this.criticalClients.clear(),this.blockedClientsData=[],this.criticalClientsData=[],!(!this.manager.clients||!Array.isArray(this.manager.clients))) {
for (const e of this.manager.clients) {
e&&(e.isBlocked?(this.blockedClients.add(e.fullName),this.blockedClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining||0})):e.type==='hours'&&typeof e.hoursRemaining==='number'&&e.hoursRemaining<=5&&e.hoursRemaining>0&&(this.criticalClients.add(e.fullName),this.criticalClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining})));
} this.updateNotificationBell();
}
}updateNotificationBell() {
const e=new Date,t=new Date(e.getTime()+24*60*60*1e3),s=(this.manager.budgetTasks||[]).filter(n => n&&n.status==='פעיל'&&n.deadline&&n.description&&new Date(n.deadline)<=t);window.notificationBell&&window.notificationBell.updateFromSystem(this.blockedClientsData,this.criticalClientsData,s);
}validateClientSelection(e,t='רישום') {
return this.blockedClients.has(e)?(this.showBlockedClientDialog(e,t),!1):!0;
}showBlockedClientDialog(e,t) {
const s=document.createElement('div');s.className='popup-overlay';const n=document.createElement('div');n.className='client-name',n.textContent=e;const o=document.createElement('div');o.className='action-blocked',o.textContent=`לא ניתן לבצע ${t} עבור לקוח זה`,s.innerHTML=`
      <div class="popup blocked-client-popup">
        <div class="popup-header" style="color: #ef4444;">
          <i class="fas fa-ban"></i>
          לקוח חסום
        </div>
        <div class="blocked-client-message">
          ${n.outerHTML}
          <div class="reason">נגמרה יתרת השעות</div>
          ${o.outerHTML}
        </div>
        <div class="solutions">
          <h4>פתרונות אפשריים:</h4>
          <ul>
            <li><i class="fas fa-phone"></i> צור קשר עם הלקוח לרכישת שעות נוספות</li>
            <li><i class="fas fa-dollar-sign"></i> עדכן את מערכת הביליטס</li>
            <li><i class="fas fa-user-tie"></i> פנה למנהל המשרד</li>
          </ul>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-confirm" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-check"></i>
            הבנתי
          </button>
        </div>
      </div>
    `,document.body.appendChild(s),setTimeout(() => s.classList.add('show'),10),setTimeout(() => {
document.body.contains(s)&&s.remove();
},1e4);
}
} async function j(i) {
try {
const e=window.firebaseDB;if (!e) {
throw new Error('Firebase לא מחובר');
} const t=await e.collection('clients').where('fullName','==',i).get();if (t.empty) {
throw new Error('לקוח לא נמצא');
} const s=t.docs[0].data(),n=await e.collection('timesheet_entries').where('clientName','==',i).get();let o=0;const a={};n.forEach(w => {
const h=w.data(),m=h.minutes||0,f=h.employee||h.lawyer||'לא ידוע';o+=m,a[f]||(a[f]=0),a[f]+=m;
});const r=s.totalHours||0,l=r*60,c=Math.max(0,l-o),d=c/60;let u='פעיל',g=!1,p=!1;return s.type==='hours'&&(c<=0?(u='חסום - נגמרו השעות',g=!0):d<=5&&(u='קריטי - מעט שעות',p=!0)),{clientName:i,clientData:s,totalHours:r,totalMinutesUsed:o,remainingHours:Math.round(d*100)/100,remainingMinutes:c,status:u,isBlocked:g,isCritical:p,entriesCount:n.size,entriesByLawyer:a,uniqueLawyers:Object.keys(a),lastCalculated:new Date};
} catch (e) {
throw console.error('שגיאה בחישוב שעות:',e),e;
}
} async function Ee(i,e) {
try {
const t=window.firebaseDB;if (!t) {
throw new Error('Firebase לא מחובר');
} const s=await t.collection('clients').where('fullName','==',i).get();if (s.empty) {
return console.warn(`⚠️ לקוח ${i} לא נמצא - לא ניתן לעדכן שעות`),{success:!1,message:'לקוח לא נמצא'};
} const n=s.docs[0];if (n.data().type!=='hours') {
return {success:!0,message:'לקוח פיקס - לא נדרש עדכון'};
} const a=await j(i);if (await n.ref.update({minutesRemaining:Math.max(0,a.remainingMinutes),hoursRemaining:Math.max(0,a.remainingHours),lastActivity:firebase.firestore.FieldValue.serverTimestamp(),lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),totalMinutesUsed:a.totalMinutesUsed,isBlocked:a.isBlocked,isCritical:a.isCritical}),window.manager&&window.manager.clients) {
const r=window.manager.clients.findIndex(l => l.fullName===i);r!==-1&&(window.manager.clients[r].hoursRemaining=Math.max(0,a.remainingHours),window.manager.clients[r].minutesRemaining=Math.max(0,a.remainingMinutes),window.manager.clients[r].isBlocked=a.isBlocked,window.manager.clients[r].isCritical=a.isCritical,window.manager.clients[r].totalMinutesUsed=a.totalMinutesUsed,window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients());
} return {success:!0,hoursData:a,newHoursRemaining:a.remainingHours,newMinutesRemaining:a.remainingMinutes,isBlocked:a.isBlocked,isCritical:a.isCritical};
} catch (t) {
throw console.error('❌ שגיאה בעדכון שעות לקוח:',t),new Error('שגיאה בעדכון שעות: '+t.message);
}
} function xs(i) {
const e=document.getElementById('budgetForm');e&&e.reset();
} function As(i) {
const e=document.getElementById('timesheetForm');if (e&&e.reset(),i&&i.timesheetCalendar) {
const t=new Date;i.timesheetCalendar.setDate(t,!1);
}
} function $s(i,e) {
const t=i.timesheetEntries.find(o => o.id&&o.id.toString()===e.toString()||o.entryId&&o.entryId.toString()===e.toString());if (!t) {
i.showNotification('רשומת שעתון לא נמצאה','error'),console.error('❌ רשומה לא נמצאה:',e);return;
} let s='';try {
s=new Date(t.date).toISOString().split('T')[0];
} catch {
s=new Date().toISOString().split('T')[0];
} const n=document.createElement('div');n.className='popup-overlay',n.innerHTML=`
    <div class="popup edit-timesheet-popup" style="max-width: 500px;">
      <button class="popup-close-btn" onclick="this.closest('.popup-overlay').remove()" aria-label="סגור">
        <i class="fas fa-times"></i>
      </button>
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <!-- Original Entry - Compact -->
        <div style="background: rgba(59, 130, 246, 0.05); padding: 12px 16px; border-radius: 8px; border-right: 3px solid #3b82f6; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #6b7280;">
            <strong style="color: #1f2937;">מקורי:</strong>
            ${k(t.date)} • ${S(t.clientName)} • ${t.minutes} דקות
          </div>
        </div>

        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">
                תאריך <span class="required">*</span>
                <span class="badge-date today" id="editDateBadge" style="margin-right: 8px;">
                  <i class="fas fa-calendar-day"></i> היום
                </span>
              </label>
              <input type="date" id="editDate" value="${s}" required>
            </div>

            <div class="form-group">
              <label for="editMinutes">
                זמן (דקות) <span class="required">*</span>
                <span class="hint-text"><i class="fas fa-lightbulb"></i> 1 שעה = 60 דקות</span>
              </label>
              <input type="number" id="editMinutes" min="1" max="99999" value="${t.minutes}" placeholder="60" required>
            </div>
          </div>

          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <input
              type="text"
              id="editClientSearch"
              value="${S(t.clientName)}"
              disabled
              readonly
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                background: #f9fafb;
                cursor: not-allowed;
                color: #6b7280;
              "
            />
            <small class="form-help" style="color: #9ca3af; font-size: 12px;">
              <i class="fas fa-lock"></i> לא ניתן לשינוי
            </small>
          </div>

          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea
              id="editReason"
              rows="3"
              placeholder="הסבר מדוע אתה משנה את הפרטים..."
              required
            ></textarea>
            <small class="form-help" style="color: #9ca3af; font-size: 12px;">
              <i class="fas fa-info-circle"></i> נדרש למעקב
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${e}')">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `,document.body.appendChild(n),setTimeout(() => n.classList.add('show'),10),window.updateEditDateBadge=function() {
const o=document.getElementById('editDate'),a=document.getElementById('editDateBadge');if (!o||!a) {
return;
} const r=new Date(o.value),l=new Date;l.setHours(0,0,0,0),r.setHours(0,0,0,0);const c=Math.floor((l-r)/(1e3*60*60*24));a.className='badge-date',c===0?(a.classList.add('today'),a.innerHTML='<i class="fas fa-calendar-day"></i> היום'):c===1?(a.classList.add('yesterday'),a.innerHTML='<i class="fas fa-calendar-minus"></i> אתמול'):c===2?(a.classList.add('yesterday'),a.innerHTML='<i class="fas fa-calendar-alt"></i> שלשום'):c>2&&c<=7?(a.classList.add('past'),a.innerHTML=`<i class="fas fa-calendar-times"></i> לפני ${c} ימים`):c>7?(a.classList.add('old'),a.innerHTML=`<i class="fas fa-exclamation-triangle"></i> לפני ${c} ימים`):c===-1?(a.classList.add('tomorrow'),a.innerHTML='<i class="fas fa-calendar-plus"></i> מחר'):c<-1&&(a.classList.add('future'),a.innerHTML=`<i class="fas fa-calendar-plus"></i> בעוד ${Math.abs(c)} ימים`);
},setTimeout(() => {
const o=document.getElementById('editDate'),a=document.getElementById('editMinutes'),r=document.getElementById('editReason');o&&(o.addEventListener('change',window.updateEditDateBadge),window.updateEditDateBadge()),n.querySelectorAll('input:not([disabled]), textarea').forEach(c => {
c.addEventListener('focus',function() {
this.style.borderColor='#3b82f6',this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';
}),c.addEventListener('blur',function() {
this.style.borderColor='#e1e5e9',this.style.boxShadow='none';
});
}),r&&r.addEventListener('input',() => {
let d;r.classList.remove('error'),r.style.borderColor='#e1e5e9',r.style.boxShadow='none';const c=(d=r.parentElement)==null?void 0:d.querySelector('.error-message');c&&c.remove();
}),o&&o.addEventListener('input',() => {
let d;o.classList.remove('error'),o.style.borderColor='#e1e5e9',o.style.boxShadow='none';const c=(d=o.parentElement)==null?void 0:d.querySelector('.error-message');c&&c.remove();
}),a&&a.addEventListener('input',() => {
let d;a.classList.remove('error'),a.style.borderColor='#e1e5e9',a.style.boxShadow='none';const c=(d=a.parentElement)==null?void 0:d.querySelector('.error-message');c&&c.remove();
}),a&&(a.select(),a.focus());
},100);
} function _s(i,e) {
const t=document.getElementById('editClientSearchResults'),s=document.getElementById('editClientSelect');window.ClientSearch.searchClientsUpdateDOM(i.clients,e,{resultsContainer:t,hiddenInput:s},'manager.selectClientForEdit',{fileNumberColor:'#9ca3af'});
} function Fs(i,e,t) {
const s=document.getElementById('editClientSearch'),n=document.getElementById('editClientSelect'),o=document.getElementById('editClientSearchResults');s&&n&&o&&(s.value=e,n.value=e,o.style.display='none',s.style.background='#ecfdf5',s.style.borderColor='#10b981',setTimeout(() => {
s.style.background='white',s.style.borderColor='#e1e5e9';
},500));
} const Ns=1e3;async function H(i,e='active',t=Ns) {
let s;try {
const n=window.firebaseDB;if (!n) {
throw new Error('Firebase לא מחובר');
} let o=n.collection('budget_tasks').where('employee','==',i),a,r=!1;try {
e==='active'?o=o.where('status','==','פעיל'):e==='completed'&&(o=o.where('status','==','הושלם').orderBy('completedAt','desc')),o=o.limit(t),a=await o.get();
} catch (u) {
u.code!=='failed-precondition'&&!((s=u.message)!=null&&s.includes('index'))&&console.warn('⚠️ Unexpected error, using fallback:',u.message),r=!0;try {
o=n.collection('budget_tasks').where('employee','==',i).limit(100),a=await o.get();
} catch (g) {
console.error('Fallback also failed, loading basic query:',g),o=n.collection('budget_tasks').where('employee','==',i),a=await o.get();
}
} const l=[];a.forEach(u => {
const g=u.data(),p={...window.DatesModule.convertTimestampFields(g,['createdAt','updatedAt','completedAt','deadline']),firebaseDocId:u.id,history:g.timeEntries||[]};p.id||(p.id=u.id),l.push(p);
});let c=l;r&&(e==='active'?c=l.filter(u => u.status==='פעיל'):e==='completed'&&(c=l.filter(u => u.status==='הושלם').sort((u,g) => {
const p=u.completedAt?new Date(u.completedAt):new Date(0);return (g.completedAt?new Date(g.completedAt):new Date(0))-p;
})),c=c.slice(0,t));let d=r?c:l;return e==='active'?d=d.filter(u => u.status==='פעיל'):e==='completed'&&(d=d.filter(u => u.status==='הושלם')),console.log(`✅ Loaded ${d.length} tasks (filter: ${e}, fallback: ${r})`),d;
} catch (n) {
throw console.error('Firebase error:',n),new Error('שגיאה בטעינת משימות: '+n.message);
}
} function Rs(i,e,t) {
le(async() => {
const {startTasksListener:s}=await import('./real-time-listeners-CiF_NeJE.js');return {startTasksListener:s};
},[]).then(({startTasksListener:s}) => s(i,e,t)).catch(s => {
console.error('❌ Error importing real-time-listeners:',s),t&&t(s);
});
} function mt(i) {
if (!i) {
return {};
} let e=i.deadline;return i.deadline&&window.DatesModule&&(e=window.DatesModule.convertFirebaseTimestamp(i.deadline)),(!e||e instanceof Date&&isNaN(e.getTime()))&&(e=new Date),{id:i.id||Date.now(),clientName:i.clientName||'לקוח לא ידוע',description:i.taskDescription||i.description||'משימה ללא תיאור',taskDescription:i.taskDescription||i.description||'משימה ללא תיאור',estimatedHours:Number(i.estimatedHours)||0,actualHours:Number(i.actualHours)||0,estimatedMinutes:Number(i.estimatedMinutes)||(Number(i.estimatedHours)||0)*60,actualMinutes:Number(i.actualMinutes)||(Number(i.actualHours)||0)*60,deadline:e,status:i.status||'פעיל',branch:i.branch||'',fileNumber:i.fileNumber||'',history:i.history||i.timeEntries||[],createdAt:i.createdAt||null,updatedAt:i.updatedAt||null,caseId:i.caseId||null,caseTitle:i.caseTitle||null,caseNumber:i.caseNumber||null,serviceName:i.serviceName||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null};
} function ft(i) {
return !i.estimatedMinutes||i.estimatedMinutes<=0?(i._warnedNoEstimate||(console.warn('⚠️ Task missing estimatedMinutes:',i.id),i._warnedNoEstimate=!0),0):Math.round((i.actualMinutes||0)/i.estimatedMinutes*100);
} function Ps(i) {
return i>=100?'red':i>=85?'orange':'blue';
} function qs(i,e,t,s,n,o,a,r,l) {
if (!window.SVGRings) {
return '';
} const c=new Date,d=new Date(i.deadline),u=i.createdAt?new Date(i.createdAt):c,g=u<d?u:d,p=Math.max(1,(d-g)/(1e3*60*60*24)),b=(c-g)/(1e3*60*60*24),w=Math.max(0,Math.round(b/p*100)),h=l<0,m={progress:e,color:Ps(e),icon:'fas fa-clock',label:'תקציב זמן',value:`${t}ש / ${s}ש`,size:80,button:a?{text:o?'עדכן שוב':'עדכן תקציב',onclick:`event.stopPropagation(); manager.showAdjustBudgetDialog('${i.id}')`,icon:'fas fa-edit',cssClass:'budget-btn',show:!0}:null},f=i.deadlineExtensions&&i.deadlineExtensions.length>0;w>100&&console.log(`🔍 Task ${i.id.substring(0,8)}: deadlineProgress = ${w}%`);const y=window.SVGRings.createSVGRing(m),v=window.SVGRings.createDeadlineDisplay({deadline:d,daysRemaining:l,size:80,button:h?{text:f?'הארך שוב':'הארך יעד',onclick:`event.stopPropagation(); manager.showExtendDeadlineDialog('${i.id}')`,icon:'fas fa-calendar-plus',cssClass:'deadline-btn',show:!0}:null});let T=`
    <div class="svg-rings-dual-layout">
      ${y}
      ${v}
    </div>
  `;return o&&(T+=`<div class="budget-adjusted-note" style="text-align: center; margin-top: 12px; font-size: 11px; color: #3b82f6;"><i class="fas fa-info-circle"></i> תקציב עודכן ל-${s}ש</div>`),T;
} function Us(i,e={}) {
const {safeText:t,formatDate:s,formatShort:n}=e,o=mt(i),a=ft(o),r=o.originalEstimate||o.estimatedMinutes,l=o.estimatedMinutes!==r,c=o.actualMinutes>r,d=Math.max(0,o.actualMinutes-r),u=new Date,g=new Date(o.deadline),p=Math.ceil((g-u)/(1e3*60*60*24)),b=Math.round(o.actualMinutes/60*10)/10,w=Math.round(o.estimatedMinutes/60*10)/10,h=t?t(o.description):o.description,m=t?t(o.clientName):o.clientName,f=o.clientName.length>20?t?t(o.clientName.substring(0,20)+'...'):o.clientName.substring(0,20)+'...':m,y=o.status==='הושלם',v=o.status==='pending_approval',T=y?`
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  `:'',E=ee(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||''),A=E?`
    <div class="linear-card-badges">
      ${E}
    </div>
  `:'';return `
    <div class="linear-minimal-card ${v?'pending-approval':''}" data-task-id="${o.id}">
      ${A}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${m}">
          ${h}
          ${T}
        </h3>

        <!-- 🎯 SVG RINGS -->
        ${!y&&window.SVGRings?qs(o,a,b,w,r,l,c,d,p):''}
      </div>

      <!-- החלק התחתון - מחוץ ל-content -->
      <div class="linear-card-meta">
        <div class="linear-client-row">
          <span class="linear-client-label">לקוח:</span>
          <span class="linear-client-name" title="${m}">
            ${f}
          </span>
        </div>
        ${o.createdAt?`
        <div class="creation-date-tag">
          <i class="far fa-clock"></i>
          <span>נוצר ב-${s(o.createdAt)} ${new Date(o.createdAt).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        `:''}
      </div>

      <button class="linear-expand-btn" onclick="manager.expandTaskCard('${o.id}', event)" title="הרחב פרטים">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
} function Hs(i,e={}) {
const {safeText:t,formatDate:s,taskActionsManager:n}=e,o=mt(i),a=ft(o),r=o.status==='הושלם',l=is(o.status),c=ee(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||''),d=window.SVGRings?window.SVGRings.createTableProgressBar({progress:a,actualMinutes:o.actualMinutes||0,estimatedMinutes:o.estimatedMinutes||1}):`${a}%`;let u;if (window.SVGRings) {
const b=new Date,w=new Date(o.deadline),h=o.createdAt?new Date(o.createdAt):b,m=Math.ceil((w-b)/(1e3*60*60*24)),f=h<w?h:w,y=Math.max(1,(w-f)/(1e3*60*60*24)),v=(b-f)/(1e3*60*60*24),T=Math.max(0,Math.round(v/y*100));u=window.SVGRings.createCompactDeadlineRing({daysRemaining:m,progress:T,deadline:w,size:52});
} else {
u=s?s(o.deadline):o.deadline;
} const p=o.status==='pending_approval'?'pending-approval-row':'';return `
    <tr data-task-id="${o.id}" class="${p}">
      <td>${t?t(o.clientName):o.clientName}</td>
      <td class="td-description">
        <div class="table-description-with-icons">
          <span>${t?t(o.description):o.description}</span>
          ${c}
        </div>
      </td>
      <td>${d}</td>
      <td style="text-align: center;">${u}</td>
      <td style="color: #6b7280; font-size: 13px;">${window.DatesModule?window.DatesModule.getCreationDateTableCell(o):''}</td>
      <td>${l}</td>
      <td class="actions-column">
        ${n?n.createTableActionButtons(o,r):''}
      </td>
    </tr>
  `;
} function gt(i='active') {
return i==='completed'?`
      <div class="empty-state">
        <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success-500); margin-bottom: 1rem;"></i>
        <h4>עדיין אין משימות שהושלמו</h4>
        <p style="color: var(--gray-600); font-size: 1.1rem; margin-top: 0.5rem;">
          אבל אל תדאג, סומכים עליך שבקרוב זה יהיה מלא! 💪
        </p>
      </div>
    `:`
    <div class="empty-state">
      <i class="fas fa-chart-bar"></i>
      <h4>אין משימות להצגה</h4>
      <p>הוסף משימה חדשה כדי להתחיל</p>
    </div>
  `;
} function Os(i,e={}) {
const {stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o,safeText:a}=e,r=document.getElementById('budgetContainer'),l=document.getElementById('budgetTableContainer');if (!i||i.length===0) {
r&&(r.innerHTML=gt(s||'active'),r.classList.remove('hidden')),l&&l.classList.add('hidden');return;
} const c=i.map(p => Us(p,e)).join(''),d=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||'active'):'',u=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:'',g=`
    <div class="modern-cards-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${d}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${o==='recent'?'selected':''}>עדכון אחרון</option>
            <option value="name" ${o==='name'?'selected':''}>שם (א-ת)</option>
            <option value="deadline" ${o==='deadline'?'selected':''}>תאריך יעד</option>
            <option value="progress" ${o==='progress'?'selected':''}>התקדמות</option>
          </select>
        </div>
      </div>
      <div class="budget-cards-grid">
        ${c}
      </div>
      ${u}
    </div>
  `;r&&(r.innerHTML=g,r.classList.remove('hidden'),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(r)),l&&l.classList.add('hidden');
} function Vs(i,e={}) {
const {stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o}=e,a=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||'active'):'',r=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:'',l=!i||i.length===0?gt(s||'active'):`
    <div class="modern-table-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${a}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${o==='recent'?'selected':''}>עדכון אחרון</option>
            <option value="name" ${o==='name'?'selected':''}>שם (א-ת)</option>
            <option value="deadline" ${o==='deadline'?'selected':''}>תאריך יעד</option>
            <option value="progress" ${o==='progress'?'selected':''}>התקדמות</option>
          </select>
        </div>
      </div>
      <table class="modern-budget-table">
        <thead>
          <tr>
            <th>לקוח</th>
            <th>תיאור</th>
            <th>התקדמות</th>
            <th>יעד</th>
            <th>נוצר</th>
            <th>סטטוס</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${i.map(u => Hs(u,e)).join('')}
        </tbody>
      </table>
      ${r}
    </div>
  `,c=document.getElementById('budgetContainer'),d=document.getElementById('budgetTableContainer');d&&(d.innerHTML=l,d.classList.remove('hidden'),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(d)),c&&c.classList.add('hidden');
} function zs(i,e,t,s='recent') {
const n=i.map(r => Ws(r)).join(''),o=window.StatisticsModule.createTimesheetStatsBar(e),a=t.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (עד ${t.pageSize||20} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${t.displayedItems} מתוך ${t.filteredItems} רשומות
      </div>
    </div>
  `:'';return `
    <div class="modern-cards-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-clock"></i>
          רשומות שעות
        </h3>
        <div class="modern-table-subtitle">
          ${i.length} רשומות • ${e.totalMinutes} דקות • ${e.totalHours} שעות
        </div>
      </div>
      <div class="stats-with-sort-row">
        ${o}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries(event)">
            <option value="recent" ${s==='recent'?'selected':''}>תאריך אחרון</option>
            <option value="client" ${s==='client'?'selected':''}>שם לקוח (א-ת)</option>
            <option value="hours" ${s==='hours'?'selected':''}>שעות (גבוה-נמוך)</option>
          </select>
        </div>
      </div>
      <div class="timesheet-cards-grid">
        ${n}
      </div>
      ${a}
    </div>
  `;
} function Ws(i) {
if (!i||typeof i!=='object') {
return console.error('Invalid entry provided to createTimesheetCard:',i),'';
} const e={id:i.id||i.entryId||Date.now(),clientName:i.clientName||'',action:i.action||'',minutes:Number(i.minutes)||0,date:i.date||new Date().toISOString(),fileNumber:i.fileNumber||'',caseNumber:i.caseNumber||'',serviceName:i.serviceName||'',notes:i.notes||'',createdAt:i.createdAt||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null},t=Math.round(e.minutes/60*10)/10,s=safeText(e.clientName),n=safeText(e.action);safeText(e.fileNumber),safeText(e.notes);const o=window.DatesModule.formatDate,a=window.DatesModule.formatShort,r=ee(e.caseNumber,e.serviceName,e.serviceType,e.serviceId||''),l=r?`
    <div class="linear-card-badges">
      ${r}
    </div>
  `:'';return `
    <div class="linear-minimal-card" data-entry-id="${e.id}">
      ${l}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${s}">
          ${n}
        </h3>

        <!-- זמן ופרטים נוספים -->
        <div style="margin-top: 8px; color: #6b7280; font-size: 13px;">
          <div style="margin-bottom: 6px;">
            <i class="fas fa-clock" style="width: 16px; text-align: center;"></i>
            ${t}h (${e.minutes} דקות)
          </div>
          <div style="margin-bottom: 6px;">
            <i class="fas fa-calendar-alt" style="width: 16px; text-align: center;"></i>
            ${a(e.date)}
          </div>
        </div>
      </div>

      <!-- החלק התחתון - מחוץ ל-content -->
      <div class="linear-card-meta">
        <div class="linear-client-row">
          <span class="linear-client-label">לקוח:</span>
          <span class="linear-client-name" title="${s}">
            ${s}
          </span>
        </div>
        ${e.createdAt?`
        <div class="creation-date-tag">
          <i class="far fa-clock"></i>
          <span>נוצר ב-${o(e.createdAt)} ${new Date(e.createdAt).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        `:''}
      </div>

      <button class="linear-expand-btn" onclick="event.stopPropagation(); manager.showEditTimesheetDialog('${e.id}')" title="ערוך">
        <i class="fas fa-edit"></i>
      </button>
    </div>
  `;
} function Gs(i,e,t,s='recent') {
if (!i||i.length===0) {
return js();
} const n=i.map(r => {
if (!r||typeof r!=='object') {
return console.warn('Invalid entry in renderTimesheetTable:',r),'';
} const l=ee(r.caseNumber,r.serviceName,r.serviceType,r.serviceId||''),c=r.id||r.entryId||Date.now();return `
      <tr data-entry-id="${c}">
        <td class="timesheet-cell-date">${formatDate(r.date)}</td>
        <td class="timesheet-cell-action">
          <div class="table-description-with-icons">
            <span>${safeText(r.action||'')}</span>
            ${l}
          </div>
        </td>
        <td class="timesheet-cell-time">
          <span class="time-badge">${Number(r.minutes)||0} דק'</span>
        </td>
        <td class="timesheet-cell-client">${safeText(r.clientName||'')}</td>
        <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(r)}</td>
        <td>${safeText(r.notes||'—')}</td>
        <td class="actions-column">
          <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${c}')" title="ערוך שעתון">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `;
}).join(''),o=window.StatisticsModule.createTimesheetStatsBar(e),a=t.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (עד ${t.pageSize||20} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${t.displayedItems} מתוך ${t.filteredItems} רשומות
      </div>
    </div>
  `:'';return `
    <div class="modern-table-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-clock"></i>
          רשומות שעות
        </h3>
        <div class="modern-table-subtitle">
          ${i.length} רשומות • ${e.totalMinutes} דקות • ${e.totalHours} שעות
        </div>
      </div>
      <div class="stats-with-sort-row">
        ${o}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries(event)">
            <option value="recent" ${s==='recent'?'selected':''}>תאריך אחרון</option>
            <option value="client" ${s==='client'?'selected':''}>שם לקוח (א-ת)</option>
            <option value="hours" ${s==='hours'?'selected':''}>שעות (גבוה-נמוך)</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="modern-timesheet-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>פעולה</th>
              <th>זמן</th>
              <th>לקוח</th>
              <th>נוצר</th>
              <th>הערות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${n}
          </tbody>
        </table>
      </div>
      ${a}
    </div>
  `;
} function js() {
return `
    <div class="empty-state">
      <i class="fas fa-clock"></i>
      <h4>אין רשומות שעתון</h4>
      <p>רשום את הפעולה הראשונה שלך</p>
    </div>
  `;
} function De(i) {
return i.reduce((e,t) => e+(t.minutes||0),0);
} function Ks(i,e,t) {
le(async() => {
const {startTimesheetListener:s}=await import('./real-time-listeners-CiF_NeJE.js');return {startTimesheetListener:s};
},[]).then(({startTimesheetListener:s}) => s(i,e,t)).catch(s => {
console.error('❌ Error importing real-time-listeners:',s),t&&t(s);
});
} function Ys(i,e) {
return !i||i.length===0||i.sort((t,s) => {
switch (e) {
case 'recent':const n=new Date(t.lastUpdated||t.createdAt||0).getTime();return new Date(s.lastUpdated||s.createdAt||0).getTime()-n;case 'name':const a=(t.clientName||'').trim(),r=(s.clientName||'').trim();return !a&&!r?0:a?r?a.localeCompare(r,'he'):-1:1;case 'deadline':const l=new Date(t.deadline||'9999-12-31').getTime(),c=new Date(s.deadline||'9999-12-31').getTime();return l-c;case 'progress':const d=t.estimatedMinutes>0?t.actualMinutes/t.estimatedMinutes*100:0;return (s.estimatedMinutes>0?s.actualMinutes/s.estimatedMinutes*100:0)-d;default:return 0;
}
}),i;
} function Js(i,e) {
if (!i||i.length===0) {
return [];
} const t=new Date;if (e==='today') {
const s=new Date(t.getFullYear(),t.getMonth(),t.getDate());return i.filter(n => {
if (!n.date) {
return !1;
} const o=new Date(n.date);return new Date(o.getFullYear(),o.getMonth(),o.getDate()).getTime()===s.getTime();
});
} if (e==='month') {
const s=new Date;return s.setMonth(s.getMonth()-1),i.filter(n => n.date?new Date(n.date)>=s:!0);
} return [...i];
} function Qs(i,e) {
return !i||i.length===0||i.sort((t,s) => {
switch (e) {
case 'recent':const n=new Date(t.date||0).getTime();return new Date(s.date||0).getTime()-n;case 'client':const a=(t.clientName||'').trim(),r=(s.clientName||'').trim();return !a&&!r?0:a?r?a.localeCompare(r,'he'):-1:1;case 'hours':const l=t.minutes||0;return (s.minutes||0)-l;default:return 0;
}
}),i;
} async function pt() {
let i,e;try {
const t=window.firebaseDB;if (!t) {
console.error('❌ Firebase לא מחובר');return;
}window.manager&&window.manager.clients&&window.manager.clients.forEach((o,a) => {});const s=await t.collection('clients').get(),n=[];s.forEach((o,a) => {
const r=o.data();n.push({id:o.id,...r});
});for (const o of n) {
if (o.type==='hours') {
const a=await t.collection('timesheet_entries').where('clientName','==',o.fullName).get();let r=0;const l={},c=[];a.forEach(b => {
const w=b.data(),h=w.minutes||0,m=w.employee||w.lawyer||'לא ידוע';r+=h,l[m]||(l[m]=0),l[m]+=h,c.push({date:w.date,employee:m,minutes:h,action:w.action});
}),c.forEach((b,w) => {}),Object.entries(l).forEach(([b,w]) => {});const g=((o.totalHours||0)*60-r)/60,p=(e=(i=window.manager)==null?void 0:i.clients)==null?void 0:e.find(b => b.fullName===o.fullName);
}
}
} catch (t) {
console.error('❌ שגיאה באבחון:',t);
}
} async function wt() {
try {
const i=window.firebaseDB;if (!i) {
console.error('❌ Firebase לא מחובר');return;
} const e=await i.collection('clients').get();for (const t of e.docs) {
const s=t.data();if (s.type==='hours') {
const n=await j(s.fullName);if (await t.ref.update({hoursRemaining:n.remainingHours,minutesRemaining:n.remainingMinutes,isBlocked:n.isBlocked,isCritical:n.isCritical,lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),fixedAt:firebase.firestore.FieldValue.serverTimestamp()}),window.manager&&window.manager.clients) {
const o=window.manager.clients.findIndex(a => a.fullName===s.fullName);o!==-1&&(window.manager.clients[o].hoursRemaining=n.remainingHours,window.manager.clients[o].minutesRemaining=n.remainingMinutes,window.manager.clients[o].isBlocked=n.isBlocked,window.manager.clients[o].isCritical=n.isCritical);
}
}
}window.manager&&window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients();
} catch (i) {
console.error('❌ שגיאה בתיקון:',i);
}
} function yt() {
!window.manager||!window.manager.clients||(window.manager.clients.length,window.manager.clients.forEach((i,e) => {
i.type==='fixed'||i.isBlocked||i.isCritical;
}));
} typeof window<'u'&&(window.debugClientHoursMismatch=pt,window.fixClientHoursMismatch=wt,window.showClientStatusSummary=yt,window.calculateClientHoursAccurate=j,window.updateClientHoursImmediately=Ee);const Xs=Object.freeze(Object.defineProperty({__proto__:null,debugClientHoursMismatch:pt,fixClientHoursMismatch:wt,showClientStatusSummary:yt},Symbol.toStringTag,{value:'Module'})),Zs={brand:{name:'משרד ע"ד',logoUrl:'/images/logo.png',fallbackIcon:'fa-balance-scale'},width:72,flyoutWidth:200,rootId:'minimalSidebar',breakButtonId:'sidebarBreakBtn',nav:[{id:'work',label:'עבודה שלי',icon:'fa-briefcase',defaultPage:'budget',flyout:[{id:'budget',label:'תקצוב משימות',icon:'fa-tasks',tabName:'budget'},{id:'timesheet',label:'שעתון',icon:'fa-clock',tabName:'timesheet'}]},{id:'beit-midrash',label:'בית מדרש',icon:'fa-book-open',tabName:'beit-midrash',badge:'new'},{id:'new-case',label:'תיק חדש',icon:'fa-folder-plus',flyout:[{id:'new-client',label:'לקוח חדש',icon:'fa-user-plus',actionType:'new-client'},{id:'existing-client',label:'לקוח קיים',icon:'fa-user-check',actionType:'existing-client'}]}],actions:[{id:'refresh',label:'רענן',icon:'fa-sync-alt',actionType:'refresh'}],footer:{breakButton:{label:'הפסקה',icon:'fa-mug-hot'},logout:{label:'יציאה',icon:'fa-power-off',actionType:'logout'}}};class ei {
constructor(e,t=Zs) {
this.container=typeof e==='string'?document.getElementById(e):e,this.config=t,this.activeNavId=null,this.activeFlyoutItemId=null,this._listeners=[],this._cssElement=null,this._onNavigateCallback=null;
}init() {
if (this._injectCSS(),this.render(),this._bindEvents(),this.config.nav.length>0) {
const e=this.config.nav[0];this.setActivePage(e.id,e.defaultPage||e.id);
}
}destroy() {
this._listeners.forEach(({el:e,event:t,handler:s}) => {
e.removeEventListener(t,s);
}),this._listeners=[],this._removeCSS(),this.container&&(this.container.innerHTML='');
}onNavigate(e) {
this._onNavigateCallback=e;
}render() {
const e=this.config,t=`
      <div class="gh-sidebar-root" id="${e.rootId}">
        ${this._renderBrand()}
        <div class="gh-sidebar-group">
          ${e.nav.map(s => this._renderNavItem(s)).join('')}
        </div>
        <div class="gh-sidebar-group">
          ${e.actions.map(s => this._renderActionItem(s)).join('')}
        </div>
        <div class="gh-sidebar-footer">
          ${this._renderFooter()}
        </div>
      </div>
    `;this.container.innerHTML=t;
}_renderBrand() {
const {brand:e}=this.config;return `
      <div class="gh-sidebar-brand">
        <div class="gh-sidebar-brand-logo"></div>
        <div class="gh-sidebar-brand-name">${e.name}</div>
      </div>
    `;
}_renderNavItem(e) {
const t=e.badge==='new'?'<span class="gh-sidebar-badge-new"></span>':'',s=e.flyout?this._renderFlyout(e):'';return `
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item" data-nav-id="${e.id}" title="${e.label}">
          ${t}
          <i class="fas ${e.icon}"></i>
          <span>${e.label}</span>
        </button>
        ${s}
      </div>
    `;
}_renderFlyout(e) {
const t=e.flyout.map(s => `
      <button class="gh-sidebar-flyout-item" data-flyout-id="${s.id}"
              ${s.tabName?`data-tab-name="${s.tabName}"`:''}
              ${s.actionType?`data-action-type="${s.actionType}"`:''}>
        <i class="fas ${s.icon}"></i>
        ${s.label}
      </button>
    `).join('');return `
      <div class="gh-sidebar-flyout">
        <div class="gh-sidebar-flyout-header">${e.label}</div>
        ${t}
      </div>
    `;
}_renderActionItem(e) {
return `
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item${e.style==='cta'?' gh-sidebar-item--cta':''}" data-action="${e.actionType}" title="${e.label}">
          <i class="fas ${e.icon}"></i>
          <span>${e.label}</span>
        </button>
      </div>
    `;
}_renderFooter() {
const {footer:e,breakButtonId:t}=this.config;return `
      <div class="gh-sidebar-item-wrapper">
        <div class="sidebar-break-btn" id="${t}" title="${e.breakButton.label}">
          <div class="sidebar-break-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <span class="sidebar-break-label">${e.breakButton.label}</span>
        </div>
      </div>
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item gh-sidebar-item--danger" data-action="${e.logout.actionType}" title="${e.logout.label}">
          <i class="fas ${e.logout.icon}"></i>
          <span>${e.logout.label}</span>
        </button>
      </div>
      <button class="gh-sidebar-collapse" title="כווץ סרגל">
        <i class="fas fa-chevron-left"></i>
      </button>
    `;
}setActivePage(e,t=null) {
this.activeNavId=e,this.activeFlyoutItemId=t,this.container.querySelectorAll('.gh-sidebar-item[data-nav-id]').forEach(o => {
o.classList.toggle('active',o.dataset.navId===e);
}),this.container.querySelectorAll('.gh-sidebar-flyout-item').forEach(o => {
o.classList.toggle('active',o.dataset.flyoutId===t);
});
}toggle() {
const e=this.container.querySelector('.gh-sidebar-root');e&&e.classList.toggle('open');
}_bindEvents() {
const e=this.container.querySelector('.gh-sidebar-root');e&&(this._on(e,'click',t => {
const s=t.target.closest('.gh-sidebar-item[data-nav-id]');if (!s) {
return;
} const n=s.dataset.navId,o=this.config.nav.find(a => a.id===n);o&&(o.flyout||(this.setActivePage(n),o.tabName&&window.switchTab&&window.switchTab(o.tabName),this._onNavigateCallback&&this._onNavigateCallback(n,null)));
}),this._on(e,'click',t => {
const s=t.target.closest('.gh-sidebar-flyout-item');if (!s) {
return;
} const n=s.dataset.flyoutId,o=s.dataset.tabName,a=s.dataset.actionType,r=s.closest('.gh-sidebar-item-wrapper'),l=r==null?void 0:r.querySelector('.gh-sidebar-item[data-nav-id]'),c=l==null?void 0:l.dataset.navId;this.setActivePage(c,n),o&&window.switchTab?window.switchTab(o):a&&this._handleAction(a),this._onNavigateCallback&&this._onNavigateCallback(c,n),window.innerWidth<=768&&this.toggle();
}),this._on(e,'click',t => {
const s=t.target.closest('.gh-sidebar-item[data-action]');s&&this._handleAction(s.dataset.action);
}),this._on(e,'click',t => {
t.target.closest('.gh-sidebar-collapse');
}));
}_on(e,t,s) {
e.addEventListener(t,s),this._listeners.push({el:e,event:t,handler:s});
}_handleAction(e) {
let t;switch (e) {
case 'new-client':window.CaseCreationDialog&&new window.CaseCreationDialog().open({mode:'new'});break;case 'existing-client':window.CaseCreationDialog&&new window.CaseCreationDialog().open({mode:'existing'});break;case 'refresh':(t=window.manager)!=null&&t.loadDataFromFirebase&&window.manager.loadDataFromFirebase();break;case 'logout':window.logout&&window.logout();break;
}
}_injectCSS() {
if (document.getElementById('gh-sidebar-css')) {
return;
} const e=document.createElement('link');e.id='gh-sidebar-css',e.rel='stylesheet',e.href='/js/modules/components/sidebar/sidebar.css',document.head.appendChild(e),this._cssElement=e;
}_removeCSS() {
this._cssElement&&(this._cssElement.remove(),this._cssElement=null);
}
} class ti {
constructor() {
this.overlay=null,this.presentation=null,this.currentSlide=0,this.totalSlides=0,this._keyHandler=null,this._touchStartX=0,this._touchEndX=0,this.preloadedImages=[];
}open(e) {
let t;if (this.presentation=e,this.currentSlide=0,this.totalSlides=((t=e.slides)==null?void 0:t.length)||0,this.totalSlides===0) {
console.warn('PresentationViewer: No slides');return;
} this.presentation.slides.sort((s,n) => s.order-n.order),this._render(),this._bindEvents(),document.body.style.overflow='hidden';
}destroy() {
let t;const e=(t=this.overlay)==null?void 0:t.querySelector('video');e&&(e.pause(),e.src=''),this._keyHandler&&(document.removeEventListener('keydown',this._keyHandler),this._keyHandler=null),this.overlay&&(this.overlay.remove(),this.overlay=null),document.body.style.overflow='';
}goTo(e) {
let l;if (e<0||e>=this.totalSlides) {
return;
} this.currentSlide=e;const t=this.overlay.querySelector('.gh-bm-viewer-slide');if (!t) {
return;
} const s=(l=this.preloadedImages)==null?void 0:l[e];if (s&&s.complete) {
t.src=s.src,t.style.opacity='1';
} else {
t.style.opacity='0.3';const c=s||new Image;c.onload=() => {
t.src=c.src,t.style.opacity='1';
},s||(c.src=this.presentation.slides[e].url);
} const n=this.overlay.querySelector('.gh-bm-viewer-counter');n&&(n.textContent=`${this.totalSlides} / ${e+1}`),this.overlay.querySelectorAll('.gh-bm-viewer-dot').forEach((c,d) => c.classList.toggle('active',d===e));const a=this.overlay.querySelector('.gh-bm-viewer-arrow-right'),r=this.overlay.querySelector('.gh-bm-viewer-arrow-left');a&&(a.style.opacity=this.currentSlide>0?'1':'0.3',a.style.pointerEvents=this.currentSlide>0?'auto':'none'),r&&(r.style.opacity=this.currentSlide<this.totalSlides-1?'1':'0.3',r.style.pointerEvents=this.currentSlide<this.totalSlides-1?'auto':'none');
}next() {
this.currentSlide<this.totalSlides-1&&this.goTo(this.currentSlide+1);
}prev() {
this.currentSlide>0&&this.goTo(this.currentSlide-1);
}_render() {
let s;const e=!!this.presentation.videoUrl,t=!!((s=this.presentation.infographic)!=null&&s.url);this.overlay=document.createElement('div'),this.overlay.className='gh-bm-viewer-overlay',this.overlay.innerHTML=`
      <div class="gh-bm-viewer">
        <div class="gh-bm-viewer-header">
          <div class="gh-bm-viewer-title">${this.presentation.title||''}</div>
          <div class="gh-bm-viewer-controls">
            ${e||t?`
              <div class="gh-bm-viewer-mode-toggle">
                <button class="gh-bm-viewer-mode active" data-mode="slides">
                  <i class="fas fa-images"></i> שקפים
                </button>
                ${e?`
                  <button class="gh-bm-viewer-mode" data-mode="video">
                    <i class="fas fa-video"></i> סרטון
                  </button>
                `:''}
                ${t?`
                  <button class="gh-bm-viewer-mode" data-mode="infographic">
                    <i class="fas fa-chart-bar"></i> אינפוגרפיקה
                  </button>
                `:''}
              </div>
            `:''}
            <span class="gh-bm-viewer-counter">
              ${this.totalSlides} / 1
            </span>
            ${this.presentation.pdfUrl?`
              <a class="gh-bm-viewer-download" href="${this.presentation.pdfUrl}" target="_blank" title="הורד PDF">
                <i class="fas fa-download"></i>
              </a>
            `:''}
            <button class="gh-bm-viewer-close" title="סגור (ESC)">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="gh-bm-viewer-stage">
          <button class="gh-bm-viewer-arrow gh-bm-viewer-arrow-right" title="הקודם">
            <i class="fas fa-chevron-right"></i>
          </button>
          <div class="gh-bm-viewer-slide-container">
            <img class="gh-bm-viewer-slide" src="${this.presentation.slides[0].url}" alt="Slide 1" />
          </div>
          <div class="gh-bm-viewer-video-container" style="display: none;">
            ${e?`
              <video class="gh-bm-viewer-video" controls>
                <source src="" type="video/mp4">
              </video>
            `:''}
          </div>
          <div class="gh-bm-viewer-infographic-container" style="display: none;">
            ${t?`
              <img class="gh-bm-viewer-infographic" src="${this.presentation.infographic.url}" alt="אינפוגרפיקה" />
            `:''}
          </div>
          <button class="gh-bm-viewer-arrow gh-bm-viewer-arrow-left" title="הבא">
            <i class="fas fa-chevron-left"></i>
          </button>
        </div>
        <div class="gh-bm-viewer-dots">
          ${this.presentation.slides.map((n,o) => `
            <button class="gh-bm-viewer-dot ${o===0?'active':''}" data-index="${o}"></button>
          `).join('')}
        </div>
      </div>
    `,document.body.appendChild(this.overlay),this._preloadSlides(),requestAnimationFrame(() => {
this.overlay.classList.add('visible');
});
}_preloadSlides() {
this.preloadedImages=[],this.presentation.slides.forEach((e,t) => {
const s=new Image;s.src=e.url,this.preloadedImages[t]=s;
});
}_switchMode(e) {
if (!this.overlay) {
return;
} const t=this.overlay.querySelector('.gh-bm-viewer-slide-container'),s=this.overlay.querySelector('.gh-bm-viewer-video-container'),n=this.overlay.querySelector('.gh-bm-viewer-infographic-container'),o=this.overlay.querySelectorAll('.gh-bm-viewer-arrow'),a=this.overlay.querySelector('.gh-bm-viewer-dots'),r=this.overlay.querySelector('.gh-bm-viewer-counter');if (this.overlay.querySelectorAll('.gh-bm-viewer-mode').forEach(c => {
c.classList.toggle('active',c.dataset.mode===e);
}),t&&(t.style.display='none'),s&&(s.style.display='none'),n&&(n.style.display='none'),e==='video') {
if (s) {
s.style.display='flex';const c=s.querySelector('video');if (c) {
const d=c.querySelector('source');d&&(!d.getAttribute('src')||d.getAttribute('src')==='')&&(d.setAttribute('src',this.presentation.videoUrl),c.load()),c.play().catch(() => {});
}
}o.forEach(c => c.style.display='none'),a&&(a.style.display='none'),r&&(r.style.display='none');
} else if (e==='infographic') {
n&&(n.style.display='flex'),o.forEach(d => d.style.display='none'),a&&(a.style.display='none'),r&&(r.style.display='none');const c=s==null?void 0:s.querySelector('video');c&&c.pause();
} else {
t&&(t.style.display='flex'),o.forEach(d => d.style.display='flex'),a&&(a.style.display='flex'),r&&(r.style.display='');const c=s==null?void 0:s.querySelector('video');c&&c.pause();
}
}_bindEvents() {
let s,n,o,a;if (!this.overlay) {
return;
}(s=this.overlay.querySelector('.gh-bm-viewer-close'))==null||s.addEventListener('click',() => this.destroy()),this.overlay.addEventListener('click',r => {
(r.target===this.overlay||r.target.classList.contains('gh-bm-viewer'))&&this.destroy();
}),(n=this.overlay.querySelector('.gh-bm-viewer-arrow-right'))==null||n.addEventListener('click',() => this.prev()),(o=this.overlay.querySelector('.gh-bm-viewer-arrow-left'))==null||o.addEventListener('click',() => this.next()),this.overlay.querySelectorAll('.gh-bm-viewer-dot').forEach(r => {
r.addEventListener('click',() => {
this.goTo(parseInt(r.dataset.index));
});
}),this.overlay.querySelectorAll('.gh-bm-viewer-mode').forEach(r => {
r.addEventListener('click',() => {
this._switchMode(r.dataset.mode);
});
});const e=(a=this.overlay)==null?void 0:a.querySelector('video');e&&e.addEventListener('error',() => {
let r,l;console.error('Video error:',(r=e.error)==null?void 0:r.message,(l=e.error)==null?void 0:l.code);
}),this._keyHandler=r => {
switch (r.key) {
case 'Escape':this.destroy();break;case 'ArrowRight':this.prev();break;case 'ArrowLeft':this.next();break;case 'Home':this.goTo(0);break;case 'End':this.goTo(this.totalSlides-1);break;
}
},document.addEventListener('keydown',this._keyHandler);const t=this.overlay.querySelector('.gh-bm-viewer-stage');t&&(t.addEventListener('touchstart',r => {
this._touchStartX=r.changedTouches[0].screenX;
},{passive:!0}),t.addEventListener('touchend',r => {
this._touchEndX=r.changedTouches[0].screenX;const l=this._touchStartX-this._touchEndX;Math.abs(l)>50&&(l>0?this.prev():this.next());
},{passive:!0}));
}
} class si {
constructor(e) {
this.container=typeof e==='string'?document.getElementById(e):e,this.db=window.firebaseDB,this.presentations=[],this.filteredPresentations=[],this.viewer=null,this._listeners=[],this._cssElement=null,this._cssLoaded=!1,this._showTimeout=null,this._hideTimeout=null;
}_escapeHtml(e) {
if (!e) {
return '';
} const t=document.createElement('div');return t.textContent=e,t.innerHTML;
} async init() {
await this._injectCSS(),this.render(),this._bindEvents(),await this.fetchPresentations();
}destroy() {
this.hide(),this.topbar&&(this.topbar.remove(),this.topbar=null),this.searchFloat&&(this.searchFloat.remove(),this.searchFloat=null),this._listeners.forEach(({el:e,event:t,handler:s}) => {
e.removeEventListener(t,s);
}),this._listeners=[],this.viewer&&(this.viewer.destroy(),this.viewer=null),this._removeCSS(),this.container&&(this.container.innerHTML='');
} async fetchPresentations() {
if (!this.db) {
console.error('BeitMidrash: Firestore not available'),this._renderEmpty('לא ניתן להתחבר למסד הנתונים');return;
} try {
this._renderLoading();const e=await this.db.collection('presentations').where('active','==',!0).orderBy('date','desc').get();this.presentations=e.docs.map(t => ({id:t.id,...t.data()})),this.filteredPresentations=[...this.presentations],this._renderCards();
} catch (e) {
console.error('BeitMidrash: Failed to fetch presentations',e),this._renderEmpty('שגיאה בטעינת המצגות');
}
}_handleSearch(e) {
const t=e.trim().toLowerCase();t?this.filteredPresentations=this.presentations.filter(s => (s.title||'').toLowerCase().includes(t)||(s.topic||'').toLowerCase().includes(t)||(s.description||'').toLowerCase().includes(t)):this.filteredPresentations=[...this.presentations],this._renderCards();
}render() {
let s,n;this.topbar=document.createElement('div'),this.topbar.className='gh-bm-topbar';const e=((s=window.currentUser)==null?void 0:s.email)||'',t=((n=window.manager)==null?void 0:n.currentUsername)||localStorage.getItem('userName')||e.split('@')[0]||'אורח';this.topbar.innerHTML=`
      <div class="gh-bm-topbar-right">
        <div class="gh-bm-topbar-greeting">
          <span class="gh-bm-topbar-greeting-name">שלום, ${this._escapeHtml(t)}</span>
          <span class="gh-bm-topbar-greeting-dot">•</span>
          <span class="gh-bm-topbar-greeting-sub">טוב לראות אותך פה</span>
        </div>
      </div>
      <div class="gh-bm-topbar-left-info">
        <div class="gh-bm-topbar-subtitle"></div>
      </div>
    `,document.body.appendChild(this.topbar),this.searchFloat=document.createElement('div'),this.searchFloat.className='gh-bm-search-float',this.searchFloat.innerHTML=`
      <div class="gh-bm-search-container">
        <div class="gh-bm-search-sparkle">
          <svg class="gh-bm-sparkle-svg" viewBox="0 0 24 24" width="24" height="24">
            <defs>
              <linearGradient id="gh-sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0369a1">
                  <animate attributeName="stop-color" values="#0369a1;#0ea5e9;#6366f1;#0369a1" dur="4s" repeatCount="indefinite"/>
                </stop>
                <stop offset="100%" style="stop-color:#0ea5e9">
                  <animate attributeName="stop-color" values="#0ea5e9;#6366f1;#0369a1;#0ea5e9" dur="4s" repeatCount="indefinite"/>
                </stop>
              </linearGradient>
            </defs>
            <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" fill="url(#gh-sparkle-grad)" />
          </svg>
        </div>
        <input type="text" class="gh-bm-search" placeholder="חיפוש לפי נושא, כותרת..." />
        <i class="fas fa-search gh-bm-search-icon"></i>
      </div>
      <div class="gh-bm-search-welcome">ברוכים הבאים לבית המדרש</div>
    `,document.body.appendChild(this.searchFloat),this.container.innerHTML=`
      <div class="gh-bm-root">
        <div class="gh-bm-grid"></div>
      </div>
    `;
} async show() {
this._hideTimeout&&(clearTimeout(this._hideTimeout),this._hideTimeout=null),await this._injectCSS();const e=document.querySelector('.top-user-bar');e&&e.classList.add('bm-hidden'),this._showTimeout=setTimeout(() => {
requestAnimationFrame(() => {
requestAnimationFrame(() => {
this.topbar&&this.topbar.classList.add('visible'),this.searchFloat&&this.searchFloat.classList.add('visible');
});
});
},300);
}hide() {
this._showTimeout&&(clearTimeout(this._showTimeout),this._showTimeout=null),this.topbar&&this.topbar.classList.remove('visible'),this.searchFloat&&this.searchFloat.classList.remove('visible'),this._hideTimeout=setTimeout(() => {
const e=document.querySelector('.top-user-bar');e&&e.classList.remove('bm-hidden'),this._hideTimeout=null;
},400);
}_renderLoading() {
const e=this.container.querySelector('.gh-bm-grid');e&&(e.innerHTML=`
      <div class="gh-bm-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>טוען מצגות...</span>
      </div>
    `);
}_renderEmpty(e='אין מצגות להצגה') {
const t=this.container.querySelector('.gh-bm-grid');t&&(t.innerHTML=`
      <div class="gh-bm-empty">
        <div class="gh-bm-empty-icon">
          <i class="fas fa-book-open"></i>
        </div>
        <h3 class="gh-bm-empty-title">${e}</h3>
        <p class="gh-bm-empty-subtitle">תכנים חדשים יתווספו בקרוב</p>
      </div>
    `,this._updateCount(0));
}_renderCards() {
const e=this.container.querySelector('.gh-bm-grid');if (e) {
if (this.filteredPresentations.length===0) {
this._renderEmpty();return;
}e.innerHTML=this.filteredPresentations.map(t => this._renderCard(t)).join(''),this._updateCount(this.filteredPresentations.length);
}
}_renderCard(e) {
let a,r;const t=(a=e.date)!=null&&a.toDate?e.date.toDate().toLocaleDateString('he-IL'):'',s=(r=e.thumbnail)!=null&&r.startsWith('http')?encodeURI(e.thumbnail):'',n=s?`background-image: url('${s}')`:'',o=!!e.videoUrl;return `
      <div class="gh-bm-card" data-presentation-id="${e.id}">
        <div class="gh-bm-card-thumb">
          <div class="gh-bm-card-thumbnail" style="${n}">
            ${s?'':'<i class="fas fa-file-powerpoint"></i>'}
            <div class="gh-bm-card-slides-count">
              <i class="fas fa-images"></i>
              ${e.slidesCount||0} שקפים
            </div>
          </div>
        </div>
        <div class="gh-bm-card-body">
          <div class="gh-bm-card-topic">${this._escapeHtml(e.topic)}</div>
          <div class="gh-bm-card-title">${this._escapeHtml(e.title)||'ללא כותרת'}</div>
          ${e.description?`
            <div class="gh-bm-card-desc">
              <span class="gh-bm-card-desc-text">${this._escapeHtml(e.description)}</span>
              <button class="gh-bm-card-read-more">קרא עוד</button>
            </div>
          `:''}
          <div class="gh-bm-card-footer">
            <span class="gh-bm-card-date">
              <i class="fas fa-calendar-alt"></i>
              ${t}
            </span>
            <div class="gh-bm-card-tags">
              ${o?'<span class="gh-bm-tag gh-bm-tag-video"><i class="fas fa-video"></i></span>':''}
              <span class="gh-bm-tag gh-bm-tag-slides"><i class="fas fa-images"></i></span>
            </div>
          </div>
        </div>
      </div>
    `;
}_updateCount(e) {
let s;const t=(s=this.topbar)==null?void 0:s.querySelector('.gh-bm-topbar-subtitle');t&&(t.textContent=`ספריית הלמידה • ${e} מצגות`);
}_bindEvents() {
const e=this.container,t=this.searchFloat?this.searchFloat.querySelector('.gh-bm-search'):null;if (t) {
const s=() => this._handleSearch(t.value);t.addEventListener('input',s),this._listeners.push({el:t,event:'input',handler:s});
} this._on(e,'click',s => {
if (s.target.classList.contains('gh-bm-card-read-more')) {
s.stopPropagation(),s.preventDefault();const n=s.target.previousElementSibling;n&&(n.classList.toggle('expanded'),s.target.textContent=n.classList.contains('expanded')?'פחות':'קרא עוד');
}
}),this._on(e,'click',s => {
if (s.target.closest('.gh-bm-card-read-more')) {
return;
} const n=s.target.closest('.gh-bm-card');if (!n) {
return;
} const o=n.dataset.presentationId,a=this.presentations.find(r => r.id===o);a&&this._openViewer(a);
});
}_openViewer(e) {
this.viewer&&this.viewer.destroy(),this.viewer=new ti,this.viewer.open(e);
}_on(e,t,s) {
e.addEventListener(t,s),this._listeners.push({el:e,event:t,handler:s});
}_injectCSS() {
return new Promise(e => {
if (this._cssLoaded) {
e();return;
} if (document.getElementById('gh-bm-css')) {
this._cssLoaded=!0,e();return;
} const s=document.createElement('link');s.id='gh-bm-css',s.rel='stylesheet',s.href='/js/modules/components/beit-midrash/beit-midrash.css',s.onload=() => {
this._cssLoaded=!0,e();
},s.onerror=() => {
e();
},document.head.appendChild(s),this._cssElement=s;
});
}_removeCSS() {
this._cssElement&&(this._cssElement.remove(),this._cssElement=null);
}
}window.CONFIG={enableAppleOAuth:!1};class vt {
constructor() {
let e,t;this.currentUser=null,this.currentUsername=null,this.currentEmployee=null,this.clients=[],this.budgetTasks=[],this.timesheetEntries=[],this.connectionStatus='unknown',this.addTaskDialog=null,this.currentTaskFilter=B.getStateValue('taskFilter'),this.currentTimesheetFilter=B.getStateValue('timesheetFilter'),this.currentBudgetView=B.getStateValue('budgetView'),this.currentTimesheetView=B.getStateValue('timesheetView'),this.filteredBudgetTasks=[],this.filteredTimesheetEntries=[],this.budgetSortField=null,this.budgetSortDirection='asc',this.timesheetSortField=null,this.timesheetSortDirection='asc',this.currentBudgetSort=B.getStateValue('budgetSort'),this.currentTimesheetSort=B.getStateValue('timesheetSort'),this.currentBudgetPage=1,this.currentTimesheetPage=1,this.budgetPagination=(e=window.PaginationModule)==null?void 0:e.create({pageSize:20}),this.timesheetPagination=(t=window.PaginationModule)==null?void 0:t.create({pageSize:20}),this.welcomeScreenStartTime=null,this.isTaskOperationInProgress=!1,this.isTimesheetOperationInProgress=!1,this.dataCache=new de({maxAge:5*60*1e3,staleAge:10*60*1e3,staleWhileRevalidate:!0,storage:'memory',debug:!1,onError:s => {
Logger.log('❌ [DataCache] Error:',s);
}}),this.domCache=new Ut,this.notificationBell=window.notificationBell,this.clientValidation=new Ms(this),this.announcementTicker=new Zt,this.announcementPopup=new es,this.breakManager=new ts,this.activityLogger=null,this.taskActionsManager=null,this.integrationManager=window.IntegrationManagerModule?window.IntegrationManagerModule.create():null,this.idleTimeout=null,this.sessionManager=null,Logger.log('✅ LawOfficeManager initialized');
}waitForAuthReady() {
return new Promise(e => {
const t=firebase.auth().onAuthStateChanged(s => {
t(),e(s);
});
});
} async init() {
const e=Date.now();Logger.log('🚀 Initializing Law Office System...',{timestamp:e}),this.setupEventListeners(),Logger.log('⏳ Waiting for Firebase Auth...');const t=Date.now(),s=await this.waitForAuthReady(),n=Date.now();if (Logger.log('✅ Firebase Auth ready',{timeTaken:`${n-t}ms`,user:s?s.email:'none'}),s) {
Logger.log('✅ Found saved session for:',s.email),Logger.log('🔐 Showing login screen - manual login required (like banks)');const o=document.getElementById('email');o&&s.email&&(o.value=s.email);
} this.showLogin(),this.setupNotificationBellListener(),Logger.log('✅ System initialized');
} async handleAuthenticatedUser(e) {
try {
if (window.isInWelcomeScreen) {
return;
} const t=await window.firebaseDB.collection('employees').doc(e.email).get();if (t.exists) {
const s=t.data();if (this.currentUser=s.email,this.currentUsername=s.username||s.name,this.currentEmployee=s,G(this.currentUsername),console.log('🔍 [DEBUG] About to start NotificationBell listener...'),console.log('🔍 [DEBUG] this.notificationBell:',!!this.notificationBell),console.log('🔍 [DEBUG] window.firebaseDB:',!!window.firebaseDB),console.log('🔍 [DEBUG] user:',e),this.notificationBell&&window.firebaseDB) {
console.log('🔔 Starting NotificationBell listener for',e.email);try {
this.notificationBell.startListeningToAdminMessages(e,window.firebaseDB),console.log('✅ NotificationBell listener started successfully'),console.log('✅ [DEBUG] Listener confirmed active:',!!this.notificationBell.messagesListener);
} catch (n) {
console.error('❌ Failed to start NotificationBell listener:',n);
}
} else {
console.error('⚠️ CRITICAL: Cannot start NotificationBell listener!',{hasNotificationBell:!!this.notificationBell,hasFirebaseDB:!!window.firebaseDB,notificationBell:this.notificationBell,firebaseDB:window.firebaseDB});
} await this.loadData(),this.showApp(),this.initializeAddTaskSystem();
} else {
await firebase.auth().signOut(),this.showLogin();
}
} catch (t) {
console.error('❌ Error loading user profile:',t),this.showLogin();
}
}setupNotificationBellListener() {
console.log('🔔 Setting up permanent NotificationBell listener...'),firebase.auth().onAuthStateChanged(e => {
if (e&&window.firebaseDB) {
if (console.log('🔔 Auth state changed - User logged in:',e.email),this.notificationBell) {
console.log('🔔 Starting NotificationBell listener...');try {
this.notificationBell.startListeningToAdminMessages(e,window.firebaseDB),console.log('✅ NotificationBell listener started successfully'),console.log('✅ Listener active:',!!this.notificationBell.messagesListener);
} catch (n) {
console.error('❌ Failed to start NotificationBell listener:',n);
}
} else {
console.log('ℹ️ NotificationBell not yet loaded - will auto-init when ready');
} const t=document.getElementById('interfaceElements'),s=t&&!t.classList.contains('hidden');if (s&&this.announcementTicker) {
console.log('📢 Starting System Announcement Ticker...');try {
this.announcementTicker.init(e,window.firebaseDB),console.log('✅ System Announcement Ticker initialized successfully');
} catch (n) {
console.error('❌ Failed to initialize System Announcement Ticker:',n);
} this.announcementPopup&&this.announcementPopup.init(e,window.firebaseDB);
} else {
s||console.log('ℹ️ User on login screen - ticker will init after login');
}
} else {
e?console.warn('⚠️ Cannot start services - missing dependencies:',{hasUser:!!e,hasFirebaseDB:!!window.firebaseDB}):(console.log('🔔 Auth state changed - User logged out, cleaning up...'),this.notificationBell&&this.notificationBell.cleanup(),this.announcementTicker&&this.announcementTicker.cleanup(),this.announcementPopup&&this.announcementPopup.cleanup());
}
});
}initTicker() {
const e=firebase.auth().currentUser;if (e&&window.firebaseDB&&this.announcementTicker) {
console.log('📢 Initializing System Announcement Ticker from showApp()...');try {
this.announcementTicker.init(e,window.firebaseDB),console.log('✅ System Announcement Ticker initialized successfully');
} catch (t) {
console.error('❌ Failed to initialize System Announcement Ticker:',t);
}
}
}initPopup() {
const e=firebase.auth().currentUser;if (e&&window.firebaseDB&&this.announcementPopup) {
console.log('📢 Initializing System Announcement Popup from showApp()...');try {
this.announcementPopup.init(e,window.firebaseDB),console.log('✅ System Announcement Popup initialized successfully');
} catch (t) {
console.error('❌ Failed to initialize System Announcement Popup:',t);
}
} this.initBreakManager();
}initBreakManager() {
if (this.breakManager&&this.currentUser) {
try {
this.breakManager.init({email:this.currentUser,username:this.currentUsername},window.firebaseDB),console.log('✅ Break Manager initialized');
} catch (e) {
console.error('❌ Failed to initialize Break Manager:',e);
}
}
}setupEventListeners() {
const e=document.getElementById('loginForm');e&&e.addEventListener('submit',async a => {
a.preventDefault(),await Le.call(this);
});const t=document.getElementById('forgotPasswordForm');t&&t.addEventListener('submit',async a => {
await ws.call(this,a);
});const s=document.getElementById('budgetForm');s&&s.addEventListener('submit',a => {
a.preventDefault(),this.addBudgetTask();
});const n=document.getElementById('timesheetForm');n&&n.addEventListener('submit',a => {
a.preventDefault(),this.addTimesheetEntry();
});const o=document.getElementById('budgetSearchBox');if (o) {
const a=Xe(r => {
this.searchBudgetTasks(r);
},300);o.addEventListener('input',r => {
a(r.target.value);
});
}Logger.log('✅ Event listeners configured');
}cleanup() {
let e,t;this.refreshInterval&&clearInterval(this.refreshInterval),(e=this.notificationBell)!=null&&e.cleanup&&this.notificationBell.cleanup(),this.stopRealTimeListeners(),(t=this.breakManager)!=null&&t.cleanup&&this.breakManager.cleanup(),Logger.log('✅ Manager cleanup completed');
}stopRealTimeListeners() {
try {
le(async() => {
const {stopAllListeners:e}=await import('./real-time-listeners-CiF_NeJE.js');return {stopAllListeners:e};
},[]).then(({stopAllListeners:e}) => {
e(),Logger.log('✅ Real-time listeners stopped');
}).catch(e => {
console.error('❌ Error stopping listeners:',e);
});
} catch (e) {
console.error('❌ Error stopping real-time listeners:',e);
}
}showLogin() {
ve.call(this);
} async handleLogin() {
await Le.call(this);
}showWelcomeScreen() {
ms.call(this);
} async waitForWelcomeMinimumTime() {
await fs.call(this);
}updateLoaderText(e,t=null) {
gs.call(this,e,t);
}showApp() {
be.call(this);
}logout() {
this.idleTimeout&&this.idleTimeout.stop(),dt();
}switchAuthMethod(e) {
Es.call(this,e);
} async handleSMSLogin() {
await Ts.call(this);
} async verifyOTP() {
await Ss.call(this);
} async loginWithGoogle() {
await ys.call(this);
} async loginWithApple() {
await vs.call(this);
} async initAIChatSystem() {
await ks.call(this);
}initSecurityModules() {
window.IdleTimeoutManager&&!this.idleTimeout?(this.idleTimeout=new window.IdleTimeoutManager({idleTimeout:10*60*1e3,warningTimeout:5*60*1e3,enabled:!0,onWarning:e => {
this.showIdleWarning(e);
},onLogout:async() => {
Logger.log('🚪 [Security] Auto-logout triggered by idle timeout'),await this.confirmLogout();
}}),this.idleTimeout.start(),Logger.log('✅ [Security] Idle Timeout Manager initialized (15 min total)')):window.IdleTimeoutManager?Logger.log('ℹ️ [Security] Idle Timeout Manager already initialized'):console.warn('⚠️ [Security] IdleTimeoutManager not loaded - auto-logout disabled');
}showIdleWarning(e) {
const t=this.currentUsername||localStorage.getItem('userName')||'משתמש',s=Math.floor(e/60),n=e%60,o=`${s}:${n.toString().padStart(2,'0')}`,a=document.createElement('div');a.className='idle-overlay',a.id='idleWarningOverlay',a.innerHTML=`
      <div class="idle-dialog">
        <!-- Header -->
        <div class="idle-header">
          <div class="idle-title">
            <i class="fas fa-clock"></i>
            <span>התנתקות אוטומטית</span>
          </div>
        </div>

        <!-- Message -->
        <p class="idle-message">
          היי <strong>${t}</strong>, המערכת זיהתה שאין פעילות
        </p>

        <!-- Countdown -->
        <div class="idle-countdown" id="idleCountdownTimer">
          ${o}
        </div>

        <!-- Buttons -->
        <div class="idle-buttons">
          <button class="idle-btn idle-btn-secondary" onclick="window.manager.handleIdleLogout()">
            התנתק
          </button>
          <button class="idle-btn idle-btn-primary" onclick="window.manager.handleIdleStayLoggedIn()">
            המשך
          </button>
        </div>
      </div>
    `,document.body.appendChild(a),this.setupIdleCountdownListener();
}setupIdleCountdownListener() {
this.idleCountdownListener&&window.removeEventListener('idle:countdown',this.idleCountdownListener),this.idleCountdownListener=t => {
const s=t.detail.remainingSeconds,n=Math.floor(s/60),o=s%60,a=n>0?`${n}:${o.toString().padStart(2,'0')}`:`${o} שניות`,r=document.getElementById('idleCountdownTimer');r&&(r.textContent=a);
},window.addEventListener('idle:countdown',this.idleCountdownListener);const e=() => {
const t=document.getElementById('idleWarningOverlay');t&&t.remove(),window.removeEventListener('idle:warning-hide',e);
};window.addEventListener('idle:warning-hide',e);
}handleIdleStayLoggedIn() {
this.idleTimeout&&this.idleTimeout.resetActivity();const e=document.getElementById('idleWarningOverlay');e&&e.remove();
} async handleIdleLogout() {
const e=document.getElementById('idleWarningOverlay');e&&e.remove(),this.idleTimeout&&this.idleTimeout.stop(),await this.confirmLogout();
} async confirmLogout() {
await ut.call(this);
}handleUserActivity() {}handleCountdownUpdate(e) {} async loadData() {
let e,t;try {
if (this.updateLoaderText('מתחבר...',10),us(),this.updateLoaderText('מתחבר ל-Firebase...',20),window.CaseNumberGenerator) {
try {
await window.CaseNumberGenerator.initialize(),this.updateLoaderText('מאתחל מערכת...',30);
} catch (d) {
Logger.log('⚠️ CaseNumberGenerator initialization failed:',d);
}
} this.updateLoaderText('טוען לקוחות...',40);const s=Promise.all([this.dataCache.get('clients',() => we()),this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,() => {
let d;return ((d=this.integrationManager)==null?void 0:d.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,P);
}),this.dataCache.get(`timesheetEntries:${this.currentUser}`,() => {
let d;return ((d=this.integrationManager)==null?void 0:d.loadTimesheet(this.currentUser))||z(this.currentUser);
})]),n=[{delay:300,text:'טוען משימות...',progress:55},{delay:300,text:'טוען נתוני זמן...',progress:65}];let o=0;const a=setInterval(() => {
if (o<n.length) {
const d=n[o];this.updateLoaderText(d.text,d.progress),o++;
}
},300),[r,l,c]=await s;if (clearInterval(a),this.updateLoaderText('עיבוד נתונים...',70),this.clients=r,this.budgetTasks=l,this.timesheetEntries=c,await this.loadMonthlyTimesheetStats(),window.clients=r,window.cases=window.cases||[],window.budgetTasks=l,window.timesheetEntries=c,window.lawOfficeManager=this,window.CoreUtils=qt,this.updateLoaderText('מכין ממשק...',85),window.TaskActionsModule&&!this.taskActionsManager&&(this.taskActionsManager=window.TaskActionsModule.create(),this.taskActionsManager.setManager(this),Logger.log('✅ TaskActionsManager initialized')),window.ActivityLoggerModule&&!this.activityLogger&&(this.activityLogger=window.ActivityLoggerModule.create(),Logger.log('✅ ActivityLogger initialized')),this.filterBudgetTasks(),this.filterTimesheetEntries(),this.syncToggleState(),await this.updateTaskCountBadges(),this.clientValidation&&this.clientValidation.updateBlockedClients(),await this.refreshAllClientCaseSelectors(),window.CasesModule&&typeof window.CasesModule.refreshCurrentCase==='function'&&await window.CasesModule.refreshCurrentCase(),this.notificationBell) {
const d=l.filter(p => {
if (p.status==='הושלם') {
return !1;
} const b=new Date(p.deadline),h=Math.ceil((b-new Date)/(1e3*60*60*24));return h<=3&&h>=0;
}),u=((e=this.clientValidation)==null?void 0:e.blockedClients)||[],g=((t=this.clientValidation)==null?void 0:t.criticalClients)||[];this.notificationBell.updateFromSystem(u,g,d);
} this.startRealTimeListeners(),this.updateLoaderText('כמעט מוכן...',95),await new Promise(d => setTimeout(d,200)),Logger.log(`✅ Data loaded: ${r.length} clients, ${l.length} tasks, ${c.length} entries`),this.updateLoaderText('הכל מוכן!',100),await new Promise(d => setTimeout(d,300));
} catch (s) {
throw console.error('❌ Error loading data:',s),this.showNotification('שגיאה בטעינת נתונים','error'),s;
}
}startRealTimeListeners() {
let e,t;try {
Logger.log('🔊 Starting real-time listeners...'),Rs(this.currentUser,s => {
Logger.log(`📡 Tasks updated: ${s.length} tasks`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`),this.budgetTasks=s,window.budgetTasks=s,this.filterBudgetTasks(),this.renderBudgetView(),this.updateTaskCountBadges(),this.updateExpandedCard();
},s => {
console.error('❌ Tasks listener error:',s);
}),((t=(e=this.integrationManager)==null?void 0:e.config)==null?void 0:t.USE_REAL_TIME_TIMESHEET)!==!1?Ks(this.currentUser,s => {
Logger.log(`📡 Timesheet updated: ${s.length} entries`),this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=s,window.timesheetEntries=s,this.filterTimesheetEntries(),this.renderTimesheetView();
},s => {
console.error('❌ Timesheet listener error:',s);
}):Logger.log('⚠️ Real-Time timesheet listener disabled (pagination mode)'),Logger.log('✅ Real-time listeners started');
} catch (s) {
console.error('❌ Error starting real-time listeners:',s);
}
} async refreshAllClientCaseSelectors() {
const e=window.clientCaseSelectorInstances||{},t=Object.keys(e);if (t.length===0) {
return;
}Logger.log(`🔄 Refreshing ${t.length} client-case selector(s)...`);const s=t.map(n => {
const o=e[n];return o&&typeof o.refreshSelectedCase==='function'?o.refreshSelectedCase():Promise.resolve();
});try {
await Promise.all(s),Logger.log('✅ All client-case selectors refreshed');
} catch (n) {
console.error('❌ Error refreshing client-case selectors:',n);
}
} async loadDataFromFirebase() {
window.showSimpleLoading('טוען נתונים מחדש...');try {
this.dataCache.clear(),Logger.log('🔄 Cache cleared - forcing fresh data from Firebase'),await this.loadData();const e=this.dataCache.getStats();Logger.log('📊 Cache stats:',e),this.showNotification('הנתונים עודכנו בהצלחה','success');
} catch {
this.showNotification('שגיאה בטעינת נתונים','error');
} finally {
window.hideSimpleLoading();
}
}initializeAddTaskSystem() {
try {
console.log('🚀 Initializing Add Task System v2.0...'),this.addTaskDialog=Jt(this,{onSuccess:e => {
console.log('✅ Task created successfully:',e),this.filterBudgetTasks();
},onError:e => {
console.error('❌ Error creating task:',e),this.showNotification('שגיאה בשמירת המשימה: '+e.message,'error');
},onCancel:() => {
console.log('ℹ️ User cancelled task creation');
},enableDrafts:!0}),console.log('✅ Add Task System v2.0 initialized');
} catch (e) {
console.error('❌ Error initializing Add Task System:',e);
}
} async addBudgetTask() {
let e,t,s,n,o,a;if (this.isTaskOperationInProgress) {
this.showNotification('אנא המתן לסיום הפעולה הקודמת','warning');return;
} this.isTaskOperationInProgress=!0;try {
const r=(e=window.ClientCaseSelectorsManager)==null?void 0:e.getBudgetValues();if (!r) {
this.showNotification('חובה לבחור לקוח ותיק','error');return;
} const l=parseInt((t=document.getElementById('estimatedTime'))==null?void 0:t.value),c=(s=document.getElementById('budgetDeadline'))==null?void 0:s.value;let d='';const u=window._currentBudgetDescriptionInput;if (u) {
const h=u.validate();if (!h.valid) {
this.showNotification(h.error,'error');return;
}d=u.getValue();
} else if (d=(o=(n=document.getElementById('budgetDescription'))==null?void 0:n.value)==null?void 0:o.trim(),!d||d.length<3) {
this.showNotification('חובה להזין תיאור משימה (לפחות 3 תווים)','error');return;
} const g=null,p=null;if (!l||l<1) {
this.showNotification('חובה להזין זמן משוער','error');return;
} if (!c) {
this.showNotification('חובה לבחור תאריך יעד','error');return;
} const b=(a=document.getElementById('budgetBranch'))==null?void 0:a.value;if (!b) {
this.showNotification('חובה לבחור סניף מטפל','error');return;
} const w=window.NotificationMessages.tasks;await N.execute({...w.loading.create(r.clientName),action:async() => {
let y;const h={description:d,categoryId:g,categoryName:p,clientName:r.clientName,clientId:r.clientId,caseId:r.caseId,caseNumber:r.caseNumber,caseTitle:r.caseTitle,serviceId:r.serviceId,serviceName:r.serviceName,serviceType:r.serviceType,parentServiceId:r.parentServiceId,branch:b,estimatedMinutes:l,originalEstimate:l,deadline:c,employee:this.currentUser,status:'pending_approval',requestedMinutes:l,approvedMinutes:null,timeSpent:0,timeEntries:[],createdAt:new Date};Logger.log('📝 Creating budget task with data:',h),console.log('🔍 FULL taskData:',JSON.stringify(h,null,2)),console.log('🔍 serviceType:',h.serviceType),console.log('🔍 parentServiceId:',h.parentServiceId),console.log('🔍 serviceId:',h.serviceId),Logger.log('  🚀 [v2.0] Using FirebaseService.call');const m=await window.FirebaseService.call('createBudgetTask',h,{retries:3,timeout:15e3});if (!m.success) {
throw new Error(m.error||'Failed to create budget task');
} const f=(y=m.data)==null?void 0:y.taskId;Logger.log('✅ Task created:',f),window.EventBus.emit('task:created',{taskId:f||'unknown',clientId:h.clientId,clientName:h.clientName,employee:h.employee,originalEstimate:h.estimatedMinutes,status:'פעיל'}),Logger.log('  🚀 [v2.0] EventBus: task:created emitted'),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`),this.budgetTasks=await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,() => {
let v;return ((v=this.integrationManager)==null?void 0:v.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,P);
}),this.filterBudgetTasks();
},successMessage:null,errorMessage:w.error.createFailed,onSuccess:() => {
let m,f;if (window.NotificationSystem&&window.NotificationSystem.alert) {
const y=w.success.created(r.clientName,d,l);window.NotificationSystem.alert(y,() => {
console.log('✅ User acknowledged task creation');
},{title:'✅ המשימה נשלחה בהצלחה',okText:'הבנתי',type:'success'});
}u&&u.saveToRecent&&u.saveToRecent(),xs(this),(m=document.getElementById('budgetFormContainer'))==null||m.classList.add('hidden');const h=document.getElementById('smartPlusBtn');h&&h.classList.remove('active'),(f=window.ClientCaseSelectorsManager)==null||f.clearBudget();
}});
} finally {
this.isTaskOperationInProgress=!1;
}
}searchBudgetTasks(e) {
const t=e.toLowerCase().trim();if (!t) {
this.filterBudgetTasks();return;
} this.filteredBudgetTasks=this.budgetTasks.filter(s => {
let a,r,l,c,d,u,g;const n=this.currentTaskFilter==='completed'?s.status==='הושלם':this.currentTaskFilter==='active'?s.status==='פעיל':!0,o=((a=s.description)==null?void 0:a.toLowerCase().includes(t))||((r=s.taskDescription)==null?void 0:r.toLowerCase().includes(t))||((l=s.clientName)==null?void 0:l.toLowerCase().includes(t))||((c=s.caseNumber)==null?void 0:c.toLowerCase().includes(t))||((d=s.fileNumber)==null?void 0:d.toLowerCase().includes(t))||((u=s.serviceName)==null?void 0:u.toLowerCase().includes(t))||((g=s.caseTitle)==null?void 0:g.toLowerCase().includes(t));return n&&o;
}),this.renderBudgetView();
} async handleToggleSwitch(e) {
const t=e.checked?'completed':'active';await this.toggleTaskView(t);
} async toggleTaskView(e) {
if (e!==this.currentTaskFilter) {
if (this.isTogglingView) {
console.warn('⚠️ Toggle already in progress, ignoring duplicate call');return;
} try {
this.isTogglingView=!0,this.currentTaskFilter=e,B.setStateValue('taskFilter',e);const t=document.getElementById('activeFilterBtn'),s=document.getElementById('completedFilterBtn');t&&s&&(e==='active'?(t.classList.add('active'),s.classList.remove('active')):(t.classList.remove('active'),s.classList.add('active'))),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${e}`);const n=await this.dataCache.get(`budgetTasks:${this.currentUser}:${e}`,() => H(this.currentUser,e,P));if (this.currentTaskFilter!==e) {
console.warn('⚠️ View mode changed during load, discarding stale results');return;
} this.budgetTasks=n,this.filteredBudgetTasks=[...this.budgetTasks],this.updateTaskCountBadges(),this.renderBudgetView(),window.EventBus.emit('tasks:view-changed',{view:e,count:this.budgetTasks.length});
} catch (t) {
console.error('Error toggling task view:',t),this.showNotification('שגיאה בטעינת משימות','error');
} finally {
this.isTogglingView=!1;
}
}
}syncToggleState() {
const e=document.getElementById('activeFilterBtn'),t=document.getElementById('completedFilterBtn');!e||!t||(this.currentTaskFilter==='completed'?(e.classList.remove('active'),t.classList.add('active')):(e.classList.add('active'),t.classList.remove('active')),Logger.log(`✅ Toggle state synced: ${this.currentTaskFilter}`));
} async filterBudgetTasks() {
this.currentTaskFilter==='completed'?this.filteredBudgetTasks=this.budgetTasks.filter(e => e.status==='הושלם'):this.currentTaskFilter==='active'?this.filteredBudgetTasks=this.budgetTasks.filter(e => e.status==='פעיל'):this.filteredBudgetTasks=[...this.budgetTasks],this.renderBudgetView();
}sortBudgetTasks(e) {
let s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentBudgetSort=t,B.setStateValue('budgetSort',t),this.filteredBudgetTasks=Ys(this.filteredBudgetTasks,t),this.renderBudgetView();
} async updateTaskCountBadges() {
try {
const e=window.firebaseDB;if (!e) {
console.warn('⚠️ Firebase DB not available for count badges');return;
} const [t,s]=await Promise.all([e.collection('budget_tasks').where('employee','==',this.currentUser).where('status','==','פעיל').get(),e.collection('budget_tasks').where('employee','==',this.currentUser).where('status','==','הושלם').get()]),n=t.size,o=s.size,a=document.getElementById('activeCountBadge');a&&(a.textContent=n,a.style.display=n>0?'inline-flex':'none');const r=document.getElementById('completedCountBadge');r&&(r.textContent=o,r.style.display=o>0?'inline-flex':'none'),Logger.log(`✅ Count badges updated: ${n} active, ${o} completed`);
} catch (e) {
console.error('Error updating count badges:',e);const t=document.getElementById('activeCountBadge'),s=document.getElementById('completedCountBadge');t&&(t.style.display='none'),s&&(s.style.display='none');
}
} async renderBudgetView() {
const t={stats:window.StatisticsModule?await window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks):null,safeText:S,formatDate:k,formatShort:ce,currentBudgetSort:this.currentBudgetSort,currentTaskFilter:this.currentTaskFilter,paginationStatus:null,taskActionsManager:this.taskActionsManager};this.currentBudgetView==='cards'?Os(this.filteredBudgetTasks,t):Vs(this.filteredBudgetTasks,t);
}switchBudgetView(e) {
B.setStateValue('budgetView',e),this.currentBudgetView=e,document.querySelectorAll('.view-tab').forEach(t => {
t.dataset.view===e?t.classList.add('active'):t.classList.remove('active');
}),this.renderBudgetView();
} async addTimesheetEntry() {
let a,r,l,c,d,u;const e=(a=document.getElementById('actionDate'))==null?void 0:a.value,t=parseInt((r=document.getElementById('actionMinutes'))==null?void 0:r.value),s=(c=(l=document.getElementById('actionDescription'))==null?void 0:l.value)==null?void 0:c.trim(),n=(u=(d=document.getElementById('actionNotes'))==null?void 0:d.value)==null?void 0:u.trim();if (!e) {
this.showNotification('חובה לבחור תאריך','error');return;
} if (!t||t<1) {
this.showNotification('חובה להזין זמן בדקות','error');return;
} if (!s||s.length<3) {
this.showNotification('חובה להזין תיאור פעולה (לפחות 3 תווים)','error');return;
} const o=window.NotificationMessages.timesheet;await N.execute({...o.loading.createInternal(),action:async() => {
let b;const g={date:e,minutes:t,clientName:null,clientId:null,fileNumber:null,caseId:null,caseTitle:null,action:s,notes:n,employee:this.currentUser,isInternal:!0,createdAt:new Date};Logger.log('📝 Creating internal timesheet entry:',g),Logger.log('  🚀 [Migration v1→v2] Using createTimesheetEntry_v2 via adapter');const p=await et(g);if (!p.success) {
throw new Error(p.error||'שגיאה ברישום פעילות');
} this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=await this.dataCache.get(`timesheetEntries:${this.currentUser}`,() => {
let w;return ((w=this.integrationManager)==null?void 0:w.loadTimesheet(this.currentUser))||z(this.currentUser);
}),this.filterTimesheetEntries(),this.loadMonthlyTimesheetStats(),window.EventBus.emit('timesheet:entry-created',{entryId:((b=p.data)==null?void 0:b.entryId)||'unknown',date:e,minutes:t,action:s,notes:n,employee:this.currentUser,isInternal:!0}),Logger.log('  🚀 [v2.0] EventBus: timesheet:entry-created emitted');
},successMessage:o.success.internalCreated(t),errorMessage:o.error.createFailed,onSuccess:() => {
let p;As(this),(p=document.getElementById('timesheetFormContainer'))==null||p.classList.add('hidden');const g=document.getElementById('smartPlusBtn');g&&g.classList.remove('active');
}});
}filterTimesheetEntries() {
const e=document.getElementById('timesheetFilter');e&&(this.currentTimesheetFilter=e.value);const t=this.currentTimesheetFilter;this.filteredTimesheetEntries=Js(this.timesheetEntries,t),this.renderTimesheetView();
}sortTimesheetEntries(e) {
let s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentTimesheetSort=t,this.filteredTimesheetEntries=Qs(this.filteredTimesheetEntries,t),this.renderTimesheetView();
} async loadMonthlyTimesheetStats() {
try {
const e=new Date,t=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,'0')}-01`,s=await window.firebaseDB.collection('timesheet_entries').where('employee','==',this.currentUser).where('date','>=',t).get();this.monthlyEntries=s.docs.map(l => ({id:l.id,...l.data()}));const n=new Date(e);n.setDate(e.getDate()-e.getDay()),n.setHours(0,0,0,0);const o=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;let a=0,r=0;s.docs.forEach(l => {
const c=l.data(),d=c.minutes||0;a+=d,(c.date||'').substring(0,10)>=o&&(r+=d);
}),this.monthlyStats={monthMinutes:a,monthHours:Math.round(a/60*10)/10,weekMinutes:r,weekHours:Math.round(r/60*10)/10,monthEntries:s.docs.length};
} catch (e) {
console.error('Failed to load monthly stats:',e),this.monthlyStats=null;
}
}renderTimesheetView() {
let a,r,l,c,d;const e=this.monthlyEntries||this.timesheetEntries,t=window.StatisticsModule?window.StatisticsModule.calculateTimesheetStatistics(e):{totalMinutes:De(e),totalHours:Math.round(De(e)/60*10)/10,totalEntries:e.length},s={currentPage:this.currentTimesheetPage,totalPages:Math.ceil(this.filteredTimesheetEntries.length/20),hasMore:((l=(r=(a=this.integrationManager)==null?void 0:a.firebasePagination)==null?void 0:r.hasMore)==null?void 0:l.timesheet_entries)||!1,displayedItems:this.filteredTimesheetEntries.length,filteredItems:this.filteredTimesheetEntries.length,pageSize:((d=(c=this.integrationManager)==null?void 0:c.config)==null?void 0:d.PAGINATION_PAGE_SIZE)||20},n=document.querySelector('#timesheetTab > div:last-child');if (!n) {
console.error('❌ Timesheet parent container not found');return;
} let o;this.currentTimesheetView==='cards'?o=zs(this.filteredTimesheetEntries,t,s,this.currentTimesheetSort):o=Gs(this.filteredTimesheetEntries,t,s,this.currentTimesheetSort),n.innerHTML=o,window.DescriptionTooltips&&window.DescriptionTooltips.refresh(n);
}switchTimesheetView(e) {
this.currentTimesheetView=e,document.querySelectorAll('#timesheetTab .view-tab').forEach(t => {
t.dataset.view===e?t.classList.add('active'):t.classList.remove('active');
}),this.renderTimesheetView();
}showEditTimesheetDialog(e) {
$s(this,e);
}searchClientsForEdit(e) {
_s(this,e);
}selectClientForEdit(e,t) {
Fs(this,e);
} async submitAdvancedTimesheetEdit(e) {
let u,g,p,b;const t=this.timesheetEntries.find(w => w.id&&w.id.toString()===e.toString()||w.entryId&&w.entryId.toString()===e.toString());if (!t) {
this.showNotification('רשומת שעתון לא נמצאה','error');return;
} const s=(u=document.getElementById('editDate'))==null?void 0:u.value,n=parseInt((g=document.getElementById('editMinutes'))==null?void 0:g.value),o=(b=(p=document.getElementById('editReason'))==null?void 0:p.value)==null?void 0:b.trim(),a=(w,h) => {
let v;const m=document.getElementById(w);if (!m) {
return;
}m.classList.add('error'),m.style.borderColor='#ef4444',m.style.boxShadow='0 0 0 3px rgba(239, 68, 68, 0.1)';const f=(v=m.parentElement)==null?void 0:v.querySelector('.error-message');f&&f.remove();const y=document.createElement('div');y.className='error-message',y.style.color='#ef4444',y.style.fontSize='13px',y.style.marginTop='6px',y.innerHTML=`<i class="fas fa-exclamation-circle"></i> ${h}`,m.parentElement&&m.parentElement.appendChild(y),m.focus(),this.showNotification(h,'error');
},r=window.NotificationMessages.timesheet.validation;if (!s) {
a('editDate',r.noDate());return;
} if (!n||n<1) {
a('editMinutes',r.noMinutes());return;
} if (!o||o.length<5) {
a('editReason',r.noEditReason());return;
} const l=t.minutes,c=n-l,d=window.NotificationMessages.timesheet;await N.execute({...d.loading.updating(),action:async() => {
const w={editedAt:new Date().toISOString(),editedBy:this.currentUsername||this.currentUser,reason:o,changes:{oldDate:t.date,newDate:s,oldMinutes:l,newMinutes:n}},h={entryId:t.id||t.entryId,date:s,minutes:n,editHistory:t.editHistory?[...t.editHistory,w]:[w],isInternal:t.isInternal||!1,autoGenerated:t.autoGenerated||!1,taskId:t.taskId||null,clientId:t.clientId||null,serviceId:t.serviceId||null,minutesDiff:c};Logger.log('📝 Updating timesheet entry:',h);const m=await window.FirebaseService.call('updateTimesheetEntry',h,{retries:3,timeout:15e3});if (!m.success) {
throw new Error(m.error||'שגיאה בעדכון רשומת שעתון');
} this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=await this.dataCache.get(`timesheetEntries:${this.currentUser}`,() => {
let f;return ((f=this.integrationManager)==null?void 0:f.loadTimesheet(this.currentUser))||z(this.currentUser);
}),this.filterTimesheetEntries(),this.loadMonthlyTimesheetStats(),window.EventBus.emit('timesheet:entry-updated',{entryId:h.entryId,oldDate:t.date,newDate:s,oldMinutes:l,newMinutes:n,minutesDiff:c,employee:this.currentUser,editReason:o}),Logger.log('  🚀 [v2.0] EventBus: timesheet:entry-updated emitted');
},successMessage:d.success.updated(n),errorMessage:d.error.updateFailed,onSuccess:() => {
const w=document.querySelector('.popup-overlay');w&&w.remove();
}});
} async loadMoreTimesheetEntries() {
if (!this.integrationManager) {
this.showNotification('מנהל אינטגרציה לא זמין','error');return;
} try {
this.showNotification('טוען רשומות נוספות...','info');const e=this.timesheetEntries.length,t=await this.integrationManager.loadMoreTimesheet(this.currentUser,this.timesheetEntries);this.timesheetEntries=t,this.filterTimesheetEntries();const s=t.length-e;this.showNotification(s>0?`נטענו ${s} רשומות נוספות`:'אין רשומות נוספות',s>0?'success':'info');
} catch (e) {
console.error('❌ Error loading more timesheet:',e),this.showNotification('שגיאה בטעינת רשומות נוספות','error');
}
}expandTaskCard(e,t) {
t.stopPropagation();const s=this.filteredBudgetTasks.find(n => n.id===e);s&&this.showExpandedCard(s);
}showExpandedCard(e) {
let t=0;e.estimatedMinutes&&e.estimatedMinutes>0&&(t=Math.round((e.actualMinutes||0)/e.estimatedMinutes*100));const s=e.status==='הושלם',n=`
      <div class="linear-expanded-overlay" data-task-id="${e.id}" onclick="manager.closeExpandedCard(event)">
        <div class="linear-expanded-card" onclick="event.stopPropagation()">
          <div class="linear-expanded-header">
            <h2 class="linear-expanded-title">${S(e.description||e.taskDescription)}</h2>
            <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="linear-expanded-body">
            <div class="linear-info-grid">
              <div class="linear-info-item">
                <label>לקוח:</label>
                <span>${S(e.clientName)}</span>
              </div>
              <div class="linear-info-item">
                <label>סטטוס:</label>
                <span>${S(e.status)}</span>
              </div>
              <div class="linear-info-item">
                <label>התקדמות:</label>
                <span>${t}%</span>
              </div>
              <div class="linear-info-item">
                <label>תאריך יעד:</label>
                <span>${O(new Date(e.deadline))}</span>
              </div>
            </div>
            ${this.taskActionsManager?this.taskActionsManager.createCardActionButtons(e,s):''}
          </div>
        </div>
      </div>
    `;document.body.insertAdjacentHTML('beforeend',n),setTimeout(() => {
const o=document.querySelector('.linear-expanded-overlay');o&&o.classList.add('active');
},10);
}closeExpandedCard() {
const e=document.querySelector('.linear-expanded-overlay');e&&(e.classList.remove('active'),setTimeout(() => e.remove(),300));
}updateExpandedCard(e) {
const t=document.querySelector('.linear-expanded-overlay.active');if (!t||(e||(e=t.dataset.taskId),!e)) {
return;
} const s=this.budgetTasks.find(l => l.id===e);if (!s) {
this.closeExpandedCard();return;
} const n=t.querySelector('.linear-actions');if (!n) {
return;
} let o=0;s.estimatedMinutes&&s.estimatedMinutes>0&&(o=Math.round((s.actualMinutes||0)/s.estimatedMinutes*100));const a=s.status==='הושלם';if (t.querySelectorAll('.linear-info-item').forEach(l => {
const c=l.querySelector('label'),d=l.querySelector('span');!c||!d||(c.textContent==='התקדמות:'?d.textContent=`${o}%`:c.textContent==='סטטוס:'&&(d.textContent=S(s.status)));
}),this.taskActionsManager) {
const l=this.taskActionsManager.createCardActionButtons(s,a);n.outerHTML=l;
}
}showAdvancedTimeDialog(e) {
if (!window.DialogsModule) {
this.showNotification('מודול דיאלוגים לא נטען','error');return;
}window.DialogsModule.showAdvancedTimeDialog(e,this);
}showTaskHistory(e) {
const t=this.budgetTasks.find(s => s.id===e);if (!t) {
this.showNotification('המשימה לא נמצאה','error');return;
}window.TaskTimelineInstance?window.TaskTimelineInstance.show(t):(console.error('TaskTimeline component not loaded'),this.showNotification('שגיאה בטעינת ציר הזמן','error'));
}showExtendDeadlineDialog(e) {
const t=this.budgetTasks.find(m => m.id===e);if (!t) {
this.showNotification('המשימה לא נמצאה','error');return;
} const s=document.createElement('div');s.className='popup-overlay',s.id='extendDeadlineOverlay';let n=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(t.deadline):new Date(t.deadline);(!n||isNaN(n.getTime()))&&(n=new Date,console.warn('⚠️ task.deadline is invalid, using current date',t.deadline));const o=new Date(n);o.setDate(o.getDate()+7);const a=o.toISOString().split('T')[0],r=n.toISOString().split('T')[0],l=this._buildExtensionsHistoryHTML(t);s.innerHTML=`
      <div class="popup" style="max-width: 580px;">
        <div class="popup-header">
          <i class="fas fa-calendar-plus"></i>
          הארכת תאריך יעד
        </div>
        <div class="popup-content">
          <div class="form-group">
            <label>משימה:</label>
            <div style="font-weight: bold; color: #333;">${t.description||t.taskDescription}</div>
          </div>
          <div class="form-group">
            <label>תאריך יעד נוכחי:</label>
            <div style="color: #dc2626; font-weight: bold;">${O(n)}</div>
          </div>

          ${l}

          <div class="form-group">
            <label for="newDeadlineDate">תאריך יעד חדש:</label>

            <!-- ✅ NEW: Quick Actions -->
            <div class="quick-actions-row">
              <button type="button" class="quick-action-btn" data-days="3">
                <i class="fas fa-clock"></i> +3 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="7">
                <i class="fas fa-calendar-week"></i> +7 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="14">
                <i class="fas fa-calendar-alt"></i> +14 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="30">
                <i class="fas fa-calendar"></i> +30 ימים
              </button>
            </div>

            <input
              type="date"
              id="newDeadlineDate"
              value="${a}"
              min="${r}"
              required
            >

            <!-- ✅ NEW: Days difference display -->
            <div id="daysDifferenceDisplay" style="display: none; margin-top: 8px; padding: 10px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-right: 3px solid #3b82f6; border-radius: 6px; font-size: 13px; color: #1e40af;">
              <i class="fas fa-calendar-check" style="color: #3b82f6;"></i>
              <strong>הארכה של: <span id="daysCount">0</span> ימים</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                מ-<span id="oldDateDisplay">${k(n)}</span>
                →
                <span id="newDateDisplay" style="color: #10b981; font-weight: 600;"></span>
              </div>
            </div>

            <small id="dateValidationError" style="color: #dc2626; display: none; margin-top: 4px; font-size: 12px;">
              <i class="fas fa-exclamation-triangle"></i> התאריך החדש חייב להיות מאוחר מהיעד הנוכחי
            </small>
          </div>
          <div class="form-group">
            <label for="extensionReason">סיבת ההארכה:</label>
            <textarea id="extensionReason" rows="3" placeholder="מדוע נדרשת הארכה?" required></textarea>
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitDeadlineExtension('${e}')">
            <i class="fas fa-calendar-check"></i> אשר הארכה
          </button>
        </div>
      </div>
    `,document.body.appendChild(s);const c=document.getElementById('newDeadlineDate'),d=document.getElementById('dateValidationError'),u=s.querySelector('.popup-btn-confirm'),g=document.getElementById('daysDifferenceDisplay'),p=document.getElementById('daysCount'),b=document.getElementById('newDateDisplay'),w=m => {
if (!m) {
g.style.display='none';return;
} const f=new Date(m),y=new Date(r),v=f-y,T=Math.ceil(v/(1e3*60*60*24));T>0?(p.textContent=T,b.textContent=k(f),g.style.display='block'):g.style.display='none';
},h=s.querySelectorAll('.quick-action-btn');h.forEach(m => {
m.addEventListener('click',f => {
f.preventDefault();const y=parseInt(m.dataset.days),v=new Date(n);v.setDate(v.getDate()+y);const T=v.toISOString().split('T')[0];c.value=T,c.dispatchEvent(new Event('change')),h.forEach(E => E.classList.remove('selected')),m.classList.add('selected');
});
}),c.addEventListener('change',() => {
const m=new Date(c.value),f=new Date(r);h.forEach(y => y.classList.remove('selected')),m<=f?(d.style.display='block',c.style.borderColor='#dc2626',u.disabled=!0,u.style.opacity='0.5',u.style.cursor='not-allowed',g.style.display='none'):(d.style.display='none',c.style.borderColor='',u.disabled=!1,u.style.opacity='1',u.style.cursor='pointer',w(c.value));
}),w(c.value),setTimeout(() => s.classList.add('show'),10);
}_buildExtensionsHistoryHTML(e) {
if (!e.deadlineExtensions||e.deadlineExtensions.length===0) {
return '';
} const t=e.deadlineExtensions.map(s => {
const n=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.oldDeadline):new Date(s.oldDeadline),o=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.newDeadline):new Date(s.newDeadline),a=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.extendedAt):new Date(s.extendedAt);return `
          <div class="extension-history-item">
            <div class="extension-header">
              <span class="extension-date">
                <i class="fas fa-calendar-alt"></i>
                ${k(a)}
              </span>
              <span class="extension-user">
                <i class="fas fa-user"></i>
                ${s.extendedBy||'לא ידוע'}
              </span>
            </div>
            <div class="extension-details">
              <div class="extension-dates">
                <span class="old-date">${k(n)}</span>
                <i class="fas fa-arrow-left"></i>
                <span class="new-date">${k(o)}</span>
              </div>
              <div class="extension-reason">${s.reason||'ללא סיבה'}</div>
            </div>
          </div>
        `;
}).reverse().join('');return `
      <div class="extensions-history-section">
        <div class="extensions-history-header">
          <i class="fas fa-history"></i>
          היסטוריית הארכות (${e.deadlineExtensions.length})
        </div>
        <div class="extensions-history-list">
          ${t}
        </div>
      </div>
    `;
} async submitDeadlineExtension(e) {
let o,a,r;const t=(o=document.getElementById('newDeadlineDate'))==null?void 0:o.value,s=(r=(a=document.getElementById('extensionReason'))==null?void 0:a.value)==null?void 0:r.trim();if (!t||!s) {
this.showNotification('אנא מלא את כל השדות','error');return;
} const n=window.NotificationMessages.tasks;await N.execute({...n.loading.extendDeadline(),action:async() => {
Logger.log('  🚀 [v2.0] Using FirebaseService.call for extendTaskDeadline');const l=await window.FirebaseService.call('extendTaskDeadline',{taskId:e,newDeadline:t,reason:s},{retries:3,timeout:1e4});if (!l.success) {
throw new Error(l.error||'שגיאה בהארכת יעד');
} await this.loadData(),this.filterBudgetTasks();const c=this.budgetTasks.find(d => d.id===e);window.EventBus.emit('task:deadline-extended',{taskId:e,oldDeadline:(c==null?void 0:c.deadline)||t,newDeadline:t,reason:s,extendedBy:this.currentUser}),Logger.log('  🚀 [v2.0] EventBus: task:deadline-extended emitted');
},successMessage:n.success.deadlineExtended(t),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500});
} async completeTask(e) {
const t=this.budgetTasks.find(s => s.id===e);if (!t) {
this.showNotification('המשימה לא נמצאה','error');return;
} if (!window.DialogsModule) {
this.showNotification('מודול דיאלוגים לא נטען','error');return;
}window.TaskCompletionValidation?window.TaskCompletionValidation.initiateTaskCompletion(t,this):window.DialogsModule.showTaskCompletionModal(t,this);
}showCancelTaskDialog(e) {
const t=this.budgetTasks.find(o => o.id===e);if (!t) {
this.showNotification('המשימה לא נמצאה','error');return;
} if (t.status!=='פעיל') {
this.showNotification('ניתן לבטל רק משימות פעילות','error');return;
} if (t.actualMinutes>0) {
this.showNotification('לא ניתן לבטל משימה עם זמן רשום. נא לפנות למנהל/ת.','error');return;
} const s=t.actualMinutes?Math.round(t.actualMinutes/60*10)/10:0,n=document.createElement('div');n.className='popup-overlay',n.innerHTML=`
      <div class="popup" style="max-width: 480px;">
        <div class="popup-header">
          <i class="fas fa-ban"></i>
          ביטול משימה
        </div>
        <div class="popup-content">
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <i class="fas fa-user" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">לקוח:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${S(t.clientName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <i class="fas fa-tasks" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">משימה:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${S(t.description||t.taskDescription)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-clock" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">זמן רשום:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${s} שעות</span>
            </div>
          </div>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-right: 3px solid #f59e0b; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; color: #92400e; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 12px;"></i>
            <span>המשימה תוסר מרשימת המשימות הפעילות</span>
          </div>
          <div class="form-group">
            <label for="cancelReason">סיבת ביטול:</label>
            <textarea id="cancelReason" rows="3" placeholder="נא לתאר את סיבת ביטול המשימה..." required></textarea>
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitCancelTask('${e}')" style="background: #dc2626; border-color: #dc2626;">
            <i class="fas fa-ban"></i> אשר ביטול
          </button>
        </div>
      </div>
    `,document.body.appendChild(n),setTimeout(() => n.classList.add('show'),10),setTimeout(() => {
const o=document.getElementById('cancelReason');o&&o.focus();
},100);
} async submitCancelTask(e) {
let r;const t=document.getElementById('cancelReason'),s=(r=t==null?void 0:t.value)==null?void 0:r.trim();t==null||t.classList.remove('error');const n=t==null?void 0:t.parentElement.querySelector('.error-message');if (n&&n.remove(),!s) {
t==null||t.classList.add('error');const l=document.createElement('span');l.className='error-message',l.textContent='נא למלא סיבת ביטול',t==null||t.parentElement.appendChild(l);return;
} const o=document.querySelector('.popup-overlay.show'),a=o==null?void 0:o.querySelector('.popup-btn-confirm');try {
a&&(a.disabled=!0,a.classList.add('loading'));const c=await firebase.functions().httpsCallable('cancelBudgetTask')({taskId:e,reason:s});this.showNotification('המשימה בוטלה בהצלחה','success'),o&&(o.classList.remove('show'),setTimeout(() => o.remove(),300));const d=document.querySelector('.linear-expanded-overlay.active');d&&(d.style.opacity='0',setTimeout(() => this.closeExpandedCard(),200));
} catch (l) {
console.error('❌ Cancel task failed:',l),a&&(a.disabled=!1,a.classList.remove('loading'));const c=l.message||'שגיאה בביטול המשימה';this.showNotification(c,'error');
}
} async submitTimeEntry(e) {
let p,b,w,h;const t=this.budgetTasks.find(m => m.id===e);if (!t) {
return;
} const s=(p=document.getElementById('workDate'))==null?void 0:p.value,n=parseInt((b=document.getElementById('workMinutes'))==null?void 0:b.value),o=document.getElementById('workDate'),a=document.getElementById('workMinutes'),r=window._currentGuidedInput;o==null||o.classList.remove('error'),a==null||a.classList.remove('error');const l=document.querySelector('.guided-textarea');l==null||l.classList.remove('error');const c=document.querySelector('.popup-overlay.show .popup');c&&c.querySelectorAll('.error-message').forEach(m => m.remove());let d=!1;if (!s) {
d=!0,o==null||o.classList.add('error');const m=document.createElement('span');m.className='error-message',m.textContent='נא לבחור תאריך',o==null||o.parentElement.appendChild(m);
} if (!n||n<=0) {
d=!0,a==null||a.classList.add('error');const m=document.createElement('span');m.className='error-message',m.textContent='נא להזין מספר דקות תקין',a==null||a.parentElement.appendChild(m);
} let u='';if (r) {
if (r.validate().valid) {
u=r.getValue();const f=document.querySelector('.guided-textarea');f&&f.classList.remove('error');
} else {
d=!0;const f=document.querySelector('.guided-textarea');f&&f.classList.add('error');const y=document.querySelector('.guided-input-wrapper');if (y&&!y.querySelector('.error-message')) {
const v=document.createElement('span');v.className='error-message',v.textContent='נא למלא תיאור',y.appendChild(v);
}
}
} else if (u=(h=(w=document.getElementById('workDescription'))==null?void 0:w.value)==null?void 0:h.trim(),!u) {
d=!0;const m=document.getElementById('workDescription');m==null||m.classList.add('error');const f=document.createElement('span');f.className='error-message',f.textContent='נא להזין תיאור',m==null||m.parentElement.appendChild(f);
} if (d) {
this.showNotification('נא למלא את כל השדות הנדרשים','error');return;
}r&&r.saveToRecent();const g=window.NotificationMessages.tasks;await N.execute({...g.loading.addTime(),action:async() => {
Logger.log('  🚀 [v2.0] Using FirebaseService.call for addTimeToTask');const m=await window.FirebaseService.call('addTimeToTask',{taskId:e,minutes:n,description:u,date:s},{retries:3,timeout:15e3});if (!m.success) {
throw new Error(m.error||'שגיאה בהוספת זמן');
} await this.loadData(),this.filterBudgetTasks(),window.EventBus.emit('task:time-added',{taskId:e,clientId:t.clientId,clientName:t.clientName,minutes:n,description:u,date:s,addedBy:this.currentUser}),Logger.log('  🚀 [v2.0] EventBus: task:time-added emitted');
},successMessage:g.success.timeAdded(n),errorMessage:g.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:() => {
this.closeExpandedCard();
}});
} async submitTaskCompletion(e) {
let a,r;const t=this.budgetTasks.find(l => l.id===e);if (!t) {
return;
} const s=(r=(a=document.getElementById('completionNotes'))==null?void 0:a.value)==null?void 0:r.trim(),n=window._taskCompletionMetadata||{},o=window.NotificationMessages.tasks;await N.execute({...o.loading.complete(),action:async() => {
let c;Logger.log('  🚀 [v2.0] Using FirebaseService.call for completeTask');const l=await window.FirebaseService.call('completeTask',{taskId:e,completionNotes:s,gapReason:n.gapReason||null,gapNotes:n.gapNotes||null},{retries:3,timeout:15e3});if (delete window._taskCompletionMetadata,!l.success) {
throw new Error(l.error||'שגיאה בסיום משימה');
} this.budgetTasks=await(((c=this.integrationManager)==null?void 0:c.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,P)),this.filterBudgetTasks(),window.EventBus.emit('task:completed',{taskId:e,clientId:t.clientId,clientName:t.clientName,completionNotes:s,completedBy:this.currentUser,estimatedMinutes:t.estimatedMinutes,actualMinutes:t.totalMinutesSpent||0}),Logger.log('  🚀 [v2.0] EventBus: task:completed emitted');
},successMessage:null,errorMessage:o.error.completeFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:async() => {
this.closeExpandedCard(),await this.toggleTaskView('completed'),this.showNotification(o.success.completed(t.clientName),'success');
}});
} async submitBudgetAdjustment(e) {
let o,a,r;const t=parseInt((o=document.getElementById('newBudgetMinutes'))==null?void 0:o.value),s=(r=(a=document.getElementById('adjustReason'))==null?void 0:a.value)==null?void 0:r.trim();if (!t||t<=0) {
this.showNotification('אנא הזן תקציב תקין','error');return;
} const n=window.NotificationMessages.tasks;await N.execute({...n.loading.updateBudget(),action:async() => {
let d;Logger.log('  🚀 [v2.0] Using FirebaseService.call for adjustTaskBudget');const l=await window.FirebaseService.call('adjustTaskBudget',{taskId:e,newEstimate:t,reason:s},{retries:3,timeout:1e4});if (!l.success) {
throw new Error(l.error||'שגיאה בעדכון תקציב');
} this.budgetTasks=await(((d=this.integrationManager)==null?void 0:d.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,P)),this.filterBudgetTasks();const c=this.budgetTasks.find(u => u.id===e);window.EventBus.emit('task:budget-adjusted',{taskId:e,oldEstimate:(c==null?void 0:c.estimatedMinutes)||0,newEstimate:t,reason:s,adjustedBy:this.currentUser}),Logger.log('  🚀 [v2.0] EventBus: task:budget-adjusted emitted');
},successMessage:n.success.budgetUpdated(Math.round(t/60*10)/10),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500});
}showAdjustBudgetDialog(e) {
window.DialogsModule&&window.DialogsModule.showAdjustBudgetDialog?window.DialogsModule.showAdjustBudgetDialog(e,this):console.error('DialogsModule not loaded');
}showNotification(e,t='info') {
window.NotificationSystem?window.NotificationSystem.show(e,t,3e3):console.warn('⚠️ Notification system not loaded:',e);
}safeText(e) {
return S(e);
}formatDate(e) {
return k(e);
}formatDateTime(e) {
return O(e);
}
} const I=new vt;window.manager=I;window.addEventListener('beforeunload',() => {
console.log('🧹 Page unloading - cleaning up resources'),I.cleanup();
});window.addEventListener('pagehide',() => {
console.log('🧹 Page hiding - cleaning up resources'),I.cleanup();
});window.notificationBell=I.notificationBell;window.switchTab=Is;window.toggleNotifications=Ls;window.clearAllNotifications=Bs;window.openSmartForm=Ds;window.logout=dt;window.confirmLogout=ut;window.showLogin=ve;window.showForgotPassword=ps;window.togglePasswordVisibility=bs;window.safeText=S;window.toggleTimesheetClientSelector=function(i) {
const e=document.getElementById('timesheetClientCaseSelector');e&&(i?e.style.display='none':e.style.display='');
};window.formatDate=k;window.formatDateTime=O;window.formatShort=ce;window._firebase_loadClientsFromFirebase_ORIGINAL=we;window._firebase_loadTimesheetFromFirebase_ORIGINAL=z;window._firebase_loadBudgetTasksFromFirebase_ORIGINAL=nt;window._firebase_saveTimesheetToFirebase_v2_ORIGINAL=ye;window._firebase_saveBudgetTaskToFirebase_ORIGINAL=ot;window._firebase_updateTimesheetEntryFirebase_ORIGINAL=at;window._firebase_calculateClientHoursByCaseNumber_ORIGINAL=void 0;window._firebase_updateClientHoursImmediatelyByCaseNumber_ORIGINAL=void 0;window._firebase_calculateClientHoursAccurate_ORIGINAL=j;window._firebase_updateClientHoursImmediately_ORIGINAL=Ee;window._firebase_addTimeToTaskFirebase_ORIGINAL=rt;window._firebase_completeTaskFirebase_ORIGINAL=lt;window._firebase_extendTaskDeadlineFirebase_ORIGINAL=ct;window.loadClientsFromFirebase=we;window.loadTimesheetFromFirebase=z;window.loadBudgetTasksFromFirebase=nt;window.saveTimesheetToFirebase=ye;window.saveTimesheetToFirebase_v2=ye;window.saveBudgetTaskToFirebase=ot;window.updateTimesheetEntryFirebase=at;window.calculateClientHoursByCaseNumber=void 0;window.updateClientHoursImmediatelyByCaseNumber=void 0;window.updateClientHoursImmediately=Ee;window.calculateClientHoursAccurate=j;window.addTimeToTaskFirebase=rt;window.completeTaskFirebase=lt;window.extendTaskDeadlineFirebase=ct;(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')&&(window.debug=Xs,Logger.log('🐛 Debug tools enabled'));window.manager=I;window.LawOfficeManager=vt;window.getCacheStats=() => {
const i=I.dataCache.getStats();return console.log('📊 Data Cache Statistics:'),console.log('━'.repeat(50)),console.log(`✅ Cache Hits: ${i.hits}`),console.log(`❌ Cache Misses: ${i.misses}`),console.log(`🔄 Background Revalidations: ${i.revalidations}`),console.log(`⚠️  Errors: ${i.errors}`),console.log(`📦 Cache Size: ${i.size} entries`),console.log(`📈 Hit Rate: ${i.hitRate}%`),console.log('━'.repeat(50)),i;
};window.clearCache=() => {
const i=I.dataCache.clear();return console.log(`🗑️  Cache cleared: ${i} entries removed`),i;
};window.invalidateCache=i => {
const e=I.dataCache.invalidate(i);return console.log(e?`✅ Cache invalidated: ${i}`:`⚠️  Key not found: ${i}`),e;
};function Me() {
if (!window.EventBus) {
console.warn('⚠️ EventBus not available - skipping UI listeners');return;
}window.EventBus.on('system:data-loaded',i => {
Logger.log('👂 [UI] system:data-loaded received - hiding spinner'),window.hideSimpleLoading();
}),window.EventBus.on('system:error',i => {
Logger.log('👂 [UI] system:error received:',i.message);
}),Logger.log('✅ UI EventBus listeners initialized (v2.0)');
} function xe() {
const i=document.getElementById('sidebarRoot');if (i) {
const e=new ei(i);e.init(),window.sidebarInstance=e,window.toggleSidebar=() => e.toggle();
}
} let Y=null;function ii() {
if (Y) {
return;
} const i=document.getElementById('beitMidrashRoot');i&&(Y=new si(i),Y.init(),window.beitMidrashInstance=Y);
}window.initBeitMidrash=ii;document.readyState==='loading'?document.addEventListener('DOMContentLoaded',() => {
xe(),Be(),Me(),I.init();
}):(xe(),Be(),Me(),I.init());Logger.log('🎉 Law Office System v5.0.0 - Fully Modular - Ready');const X={isMobile:!window.matchMedia('(hover: hover)').matches};function Te(i) {
return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1;
} function ni(i,e) {
if (!i||!e||i.classList.contains('has-description-tooltip')||!Te(i)) {
return;
}i.classList.add('is-truncated');const t=document.createElement('i');t.className='fas fa-info-circle description-info-icon',t.setAttribute('title','לחץ לצפייה במלל המלא'),t.setAttribute('data-full-text',e),X.isMobile&&(t.classList.add('mobile-only'),t.addEventListener('click',o => {
o.stopPropagation(),se(e,i);
}));const s=i.parentElement,n=s.querySelector('.combined-info-badge');n?s.insertBefore(t,n):s.appendChild(t),i.classList.add('has-description-tooltip');
} function oi(i) {
const e=document.createElement('div');e.className='description-tooltip';const t=document.createElement('div');return t.className='description-tooltip-content',t.textContent=i,e.appendChild(t),e;
} function ai(i,e) {
if (!i||!e||i.querySelector('.description-tooltip')) {
return;
} const t=oi(e);i.appendChild(t);
} let _=null;function se(i,e=null) {
_&&W();const t=document.createElement('div');t.className='description-popover-overlay',t.addEventListener('click',l => {
l.target===t&&W();
});const s=document.createElement('div');s.className='description-popover';const n=document.createElement('div');n.className='description-popover-header';const o=document.createElement('div');o.className='description-popover-title',o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const a=document.createElement('button');a.className='description-popover-close',a.innerHTML='<i class="fas fa-times"></i>',a.setAttribute('aria-label','סגור'),a.addEventListener('click',W),n.appendChild(o),n.appendChild(a);const r=document.createElement('div');r.className='description-popover-body',r.textContent=i,s.appendChild(n),s.appendChild(r),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(() => {
t.classList.add('active');
}),_=t,document.addEventListener('keydown',bt);
} function W() {
_&&(_.classList.remove('active'),setTimeout(() => {
_&&_.parentElement&&_.remove(),_=null;
},200),document.removeEventListener('keydown',bt));
} function bt(i) {
i.key==='Escape'&&W();
} function ri(i=document) {
const e=i.querySelectorAll('.td-description, .timesheet-cell-action, .task-description-cell');console.log('🔵 Description Tooltips: Found',e.length,'description cells'),e.forEach(t => {
const s=t.querySelector('.table-description-with-icons');if (!s) {
return;
} const n=s.querySelector('span');if (!n) {
return;
} const o=n.textContent.trim();if (!o) {
return;
} const a=Te(n);console.log('🔍 Checking truncation:',{text:o.substring(0,30)+'...',isTruncated:a,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),a&&(console.log('✅ Adding info icon for:',o.substring(0,30)+'...'),ni(n,o),X.isMobile||ai(t,o),X.isMobile&&(t.style.cursor='pointer',t.addEventListener('click',r => {
r.target.closest('.combined-info-badge, .action-btn, button')||(r.stopPropagation(),se(o,t));
})));
});
} function li(i) {
if (!i) {
return;
} const e=i.textContent.trim();if (!e||i.querySelector('.card-description-info-icon')||!Te(i)) {
return;
} const t=document.createElement('span');t.className='linear-card-title-text',t.textContent=e,i.textContent='',i.appendChild(t);const s=document.createElement('i');if (s.className='fas fa-info-circle card-description-info-icon',s.setAttribute('title','לחץ לצפייה בתיאור המלא'),s.addEventListener('click',n => {
n.stopPropagation(),se(e,i);
}),i.appendChild(s),!X.isMobile) {
const n=document.createElement('div');n.className='card-description-tooltip';const o=document.createElement('div');o.className='card-description-tooltip-content',o.textContent=e,n.appendChild(o),i.appendChild(n);
}
} function ci(i=document) {
i.querySelectorAll('.linear-card-title').forEach(t => {
li(t);
});
} function Z(i=document) {
ri(i),ci(i);
} function Et(i=document) {
i.querySelectorAll('.description-tooltip').forEach(e => e.remove()),i.querySelectorAll('.description-info-icon').forEach(e => e.remove()),i.querySelectorAll('.card-description-tooltip').forEach(e => e.remove()),i.querySelectorAll('.card-description-info-icon').forEach(e => e.remove()),i.querySelectorAll('.has-description-tooltip').forEach(e => {
e.classList.remove('has-description-tooltip','is-truncated');
}),i.querySelectorAll('.linear-card-title').forEach(e => {
const t=e.querySelector('.linear-card-title-text');t&&(e.textContent=t.textContent);
}),requestAnimationFrame(() => {
setTimeout(() => {
console.log('⏰ Running truncation check after render...'),Z(i);
},50);
});
}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',() => {
Z();
}):Z();let Ae;window.addEventListener('resize',() => {
clearTimeout(Ae),Ae=setTimeout(() => {
Et();
},300);
});window.DescriptionTooltips={init:Z,refresh:Et,showPopover:se,closePopover:W};(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')&&setTimeout(() => {
window.EventBus&&(window.EventBus.setDebugMode(!0),console.log('🎉 EventBus loaded and debug mode enabled!')),window.FirebaseService&&(window.FirebaseService.setDebugMode(!0),console.log('🎉 FirebaseService loaded and debug mode enabled!'));
},1e3);export {P as B};

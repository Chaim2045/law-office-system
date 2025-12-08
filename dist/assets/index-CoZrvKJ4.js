var bt=(i,e)=>()=>(e||i((e={exports:{}}).exports,e),e.exports);var os=bt((cs,E)=>{(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function t(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(n){if(n.ep)return;n.ep=!0;const o=t(n);fetch(n.href,o)}})();let Tt=class{constructor(){this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 EventBus Debug Mode: ENABLED")}emit(e,t){const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if(!n||n.size===0){this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return}const o=Array.from(n).sort((d,u)=>u.priority-d.priority);let r=0,a=0;for(const d of o)try{d.callback(t),r++,d.once&&n.delete(d)}catch(u){a++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,u),this.emit("system:error",{error:u,context:`Event listener for ${String(e)}`,severity:"medium"})}const c=performance.now()-s;this.updateStats(e,c,a),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:c,listenersNotified:r,errors:a}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${c.toFixed(2)}ms (${r} listeners)`)}on(e,t,s={}){const{priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const r=this.listeners.get(e),a={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return r.add(a),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${a.id}, Priority: ${n})`),()=>{r.delete(a),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${a.id})`)}}once(e,t,s=0){return this.on(e,t,{priority:s,once:!0})}off(e){const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`))}clear(){this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log("🗑️ [EventBus] Cleared all listeners")}getHistory(){return[...this.history]}getLastEvents(e){return this.history.slice(-e)}clearHistory(){this.history=[],this.debugMode&&console.log("🗑️ [EventBus] History cleared")}getStats(){return{...this.stats}}resetStats(){this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log("🗑️ [EventBus] Statistics reset")}getEventSummary(){const e={};for(const[t,s]of this.listeners.entries())e[String(t)]=s.size;return e}replay(e=0,t){const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for(const n of s)this.emit(n.event,n.data)}addToHistory(e){this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift()}updateStats(e,t,s){this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o}};const Et=new Tt;typeof window<"u"&&(window.EventBus=Et);class St{constructor(){this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 EventBus Debug Mode: ENABLED")}emit(e,t){const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if(!n||n.size===0){this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return}const o=Array.from(n).sort((d,u)=>u.priority-d.priority);let r=0,a=0;for(const d of o)try{d.callback(t),r++,d.once&&n.delete(d)}catch(u){a++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,u),this.emit("system:error",{error:u,context:`Event listener for ${String(e)}`,severity:"medium"})}const c=performance.now()-s;this.updateStats(e,c,a),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:c,listenersNotified:r,errors:a}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${c.toFixed(2)}ms (${r} listeners)`)}on(e,t,s={}){const{priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const r=this.listeners.get(e),a={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return r.add(a),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${a.id}, Priority: ${n})`),()=>{r.delete(a),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${a.id})`)}}once(e,t,s=0){return this.on(e,t,{priority:s,once:!0})}off(e){const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`))}clear(){this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log("🗑️ [EventBus] Cleared all listeners")}getHistory(){return[...this.history]}getLastEvents(e){return this.history.slice(-e)}clearHistory(){this.history=[],this.debugMode&&console.log("🗑️ [EventBus] History cleared")}getStats(){return{...this.stats}}resetStats(){this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log("🗑️ [EventBus] Statistics reset")}getEventSummary(){const e={};for(const[t,s]of this.listeners.entries())e[String(t)]=s.size;return e}replay(e=0,t){const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for(const n of s)this.emit(n.event,n.data)}addToHistory(e){this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift()}updateStats(e,t,s){this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o}}const H=new St;typeof window<"u"&&(window.EventBus=H);class Ct{constructor(){this.cache=new Map,this.queue=[],this.processingQueue=!1,this.rateLimitBucket={count:0,resetTime:Date.now()+1e3},this.maxRequestsPerSecond=10,this.inFlightRequests=new Map,this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:0},this.debugMode=!1}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 FirebaseService Debug Mode: ENABLED")}async call(e,t={},s={}){const n=performance.now(),{retries:o=3,cacheTTL:r=0,timeout:a=3e4,priority:c=0,skipRateLimit:d=!1,onError:u}=s;this.debugMode&&console.log(`📤 [Firebase] Calling: ${e}`,t),this.stats.totalCalls++;try{if(r>0){const g=this.getFromCache(e,t);if(g)return this.debugMode&&console.log(`💾 [Firebase] Cache hit: ${e}`),this.stats.cachedCalls++,{success:!0,data:g,duration:performance.now()-n,cached:!0}}const l=this.getRequestKey(e,t);if(this.inFlightRequests.has(l))return this.debugMode&&console.log(`🔄 [Firebase] Deduplicating: ${e}`),this.inFlightRequests.get(l);if(!d&&!this.checkRateLimit())return this.debugMode&&console.log(`⏳ [Firebase] Rate limited, queuing: ${e}`),this.stats.rateLimitHits++,this.stats.queuedRequests++,new Promise((g,f)=>{this.queue.push({functionName:e,data:t,options:s,resolve:g,reject:f,priority:c,timestamp:Date.now()}),this.processQueue()});const m=this.executeCall(e,t,o,a,u);this.inFlightRequests.set(l,m);const h=await m;this.inFlightRequests.delete(l),h.success&&r>0&&this.addToCache(e,t,h.data,r),h.success?this.stats.successfulCalls++:this.stats.failedCalls++;const p=performance.now()-n;return this.updateAverageResponseTime(p),this.debugMode&&console.log(`✅ [Firebase] ${e} completed in ${p.toFixed(2)}ms`),H.emit("system:data-loaded",{dataType:e,recordCount:1,duration:p}),{...h,duration:p}}catch(l){this.stats.failedCalls++;const m=l instanceof Error?l.message:"Unknown error";return this.debugMode&&console.error(`❌ [Firebase] Error in ${e}:`,l),H.emit("system:error",{error:l,context:`Firebase function: ${e}`,severity:"high"}),{success:!1,error:m,duration:performance.now()-n}}}async executeCall(e,t,s,n,o){let r=null,a=0;for(let u=0;u<=s;u++)try{if(u>0){const m=Math.min(1e3*Math.pow(2,u-1),1e4);this.debugMode&&console.log(`⏳ [Firebase] Retry ${u}/${s} after ${m}ms for: ${e}`),await this.sleep(m),this.stats.retriedCalls++,a++}return{success:!0,data:await this.callWithTimeout(e,t,n),duration:0,retries:a}}catch(l){if(r=l,!this.isRetryableError(l)){this.debugMode&&console.log(`🚫 [Firebase] Non-retryable error: ${e}`);break}o&&o(r)}const c=(r==null?void 0:r.message)||"Unknown error",d=this.getErrorCode(r);return{success:!1,error:c,errorCode:d,duration:0,retries:a}}async callWithTimeout(e,t,s){const n=new Promise((a,c)=>{setTimeout(()=>{c(new Error(`Request timeout after ${s}ms`))},s)}),o=firebase.functions().httpsCallable(e)(t);return(await Promise.race([o,n])).data}isRetryableError(e){var t;return e?!!(e.code==="unavailable"||e.code==="deadline-exceeded"||(t=e.message)!=null&&t.includes("timeout")||e.code==="internal"||e.code==="unknown"):!1}getErrorCode(e){var t,s;if(e!=null&&e.code)return e.code;if((t=e==null?void 0:e.message)!=null&&t.includes("timeout"))return"timeout";if((s=e==null?void 0:e.message)!=null&&s.includes("network"))return"network"}checkRateLimit(){const e=Date.now();return e>=this.rateLimitBucket.resetTime&&(this.rateLimitBucket={count:0,resetTime:e+1e3}),this.rateLimitBucket.count<this.maxRequestsPerSecond?(this.rateLimitBucket.count++,!0):!1}async processQueue(){if(!(this.processingQueue||this.queue.length===0)){for(this.processingQueue=!0;this.queue.length>0;){if(!this.checkRateLimit()){await this.sleep(100);continue}this.queue.sort((t,s)=>s.priority-t.priority);const e=this.queue.shift();if(!e)break;this.stats.queuedRequests--;try{const t=await this.call(e.functionName,e.data,{...e.options,skipRateLimit:!0});e.resolve(t)}catch(t){e.reject(t)}}this.processingQueue=!1}}getCacheKey(e,t){return`${e}:${JSON.stringify(t)}`}getRequestKey(e,t){return this.getCacheKey(e,t)}getFromCache(e,t){const s=this.getCacheKey(e,t),n=this.cache.get(s);return n?Date.now()-n.timestamp>n.ttl?(this.cache.delete(s),null):n.data:null}addToCache(e,t,s,n){const o=this.getCacheKey(e,t);this.cache.set(o,{data:s,timestamp:Date.now(),ttl:n}),H.emit("system:cache-updated",{cacheKey:o,action:"add"})}clearCache(){this.cache.clear(),H.emit("system:cache-updated",{cacheKey:"all",action:"clear"}),this.debugMode&&console.log("🗑️ [Firebase] Cache cleared")}clearCacheEntry(e,t){const s=this.getCacheKey(e,t);this.cache.delete(s),H.emit("system:cache-updated",{cacheKey:s,action:"delete"})}getStats(){return{...this.stats}}resetStats(){this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:this.queue.length},this.debugMode&&console.log("🗑️ [Firebase] Statistics reset")}updateAverageResponseTime(e){const t=this.stats.totalCalls;this.stats.averageResponseTime=(this.stats.averageResponseTime*(t-1)+e)/t}sleep(e){return new Promise(t=>setTimeout(t,e))}}const Bt=new Ct;typeof window<"u"&&(window.FirebaseService=Bt);function L(i){return i?i.type==="legal_procedure"&&i.stages&&Array.isArray(i.stages)?i.stages.filter(e=>e.status==="active"||e.status==="pending").reduce((e,t)=>{if(t.packages&&Array.isArray(t.packages)&&t.packages.length>0){const s=t.packages.filter(n=>n.status==="active"||n.status==="pending"||!n.status).reduce((n,o)=>n+(o.hoursRemaining||0),0);return e+s}return e+(t.hoursRemaining||0)},0):i.packages&&Array.isArray(i.packages)&&i.packages.length>0?i.packages.filter(t=>t.status==="active"||!t.status).reduce((t,s)=>t+(s.hoursRemaining||0),0):i.hoursRemaining||0:0}function A(i){return!i||!i.packages||i.packages.length===0?i.totalHours||0:i.packages.reduce((e,t)=>e+(t.hours||0),0)}function F(i){return!i||!i.packages||i.packages.length===0?i.hoursUsed||0:i.packages.reduce((e,t)=>e+(t.hoursUsed||0),0)}function re(i){const e=A(i);if(e===0)return 0;const t=F(i);return Math.round(t/e*100*10)/10}function xe(i,e=2){return Math.round(i/60*Math.pow(10,e))/Math.pow(10,e)}function $e(i){return Math.round(i*60)}function Ae(i,e=!1){if(!i||i===0)return"0 שעות";if(e){const t=Math.floor(i),s=Math.round((i-t)*60);return s===0?`${t} שעות`:`${t}:${s.toString().padStart(2,"0")} שעות`}return`${i.toFixed(1)} שעות`}typeof E<"u"&&E.exports&&(E.exports={calculateRemainingHours:L,calculateTotalHours:A,calculateHoursUsed:F,calculateProgress:re,minutesToHours:xe,hoursToMinutes:$e,formatHours:Ae});function Fe(i,e){return i?e?!i.serviceType||!i.parentServiceId?{valid:!1,error:"המשימה חסרה מידע על שירות"}:i.serviceType==="legal_procedure"&&!i.serviceId?{valid:!1,error:"המשימה חסרה מידע על שלב"}:!e.services||e.services.length===0?{valid:!1,error:"ללקוח אין שירותים פעילים"}:{valid:!0}:{valid:!1,error:"לקוח לא נמצא"}:{valid:!1,error:"משימה לא נמצאה"}}function Ne(i){const e=[];return(!i.hours||i.hours<=0)&&e.push("חובה להזין כמות שעות תקינה"),i.hours>500&&e.push("כמות שעות גבוהה מדי (מקסימום 500)"),(!i.type||!["initial","additional","renewal"].includes(i.type))&&e.push("סוג חבילה לא תקין"),{valid:e.length===0,errors:e}}function _e(i,e){const t=[];return(!i||i<=0)&&t.push("חובה להזין כמות שעות תקינה"),i>500&&t.push("כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)"),(!e||e.trim().length<3)&&t.push("חובה להזין סיבה/הערה (לפחות 3 תווים)"),{valid:t.length===0,errors:t}}function Re(i,e="hourly"){const t=[];return!Array.isArray(i)||i.length!==3?(t.push("חובה למלא בדיוק 3 שלבים"),{valid:!1,errors:t}):(i.forEach((s,n)=>{const o=n+1;(!s.description||!s.description.trim())&&t.push(`שלב ${o}: חובה למלא תיאור השלב`),e==="hourly"?((!s.hours||s.hours<=0)&&t.push(`שלב ${o}: חובה למלא תקרת שעות תקינה`),s.hours&&s.hours>1e3&&t.push(`שלב ${o}: תקרת שעות גבוהה מדי (מקסימום 1000)`)):((!s.fixedPrice||s.fixedPrice<=0)&&t.push(`שלב ${o}: חובה למלא מחיר פיקס תקין`),s.fixedPrice&&s.fixedPrice>1e6&&t.push(`שלב ${o}: מחיר גבוה מדי (מקסימום 1,000,000 ₪)`))}),{valid:t.length===0,errors:t})}function Ue(i,e){return!i||i<=0?{valid:!1,error:"כמות שעות לקיזוז חייבת להיות חיובית"}:i>24?{valid:!1,error:"לא ניתן לקזז יותר מ-24 שעות בפעולה אחת"}:e?{valid:!0}:{valid:!1,error:"לא נמצא שירות או שלב לקיזוז"}}typeof E<"u"&&E.exports&&(E.exports={validateTimeEntry:Fe,validatePackage:Ne,validateHoursPackage:_e,validateStages:Re,validateDeduction:Ue});function Pe(i,e){return i&&(i.totalHours=A(i),i.hoursUsed=F(i),i.hoursRemaining=L(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e),i)}function ae(i,e){return i&&(i.totalHours=A(i),i.hoursUsed=F(i),i.hoursRemaining=L(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i)}function He(i,e){if(!i||!i.services||i.services.length===0)return{};const t=i.services.reduce((o,r)=>o+(r.totalHours||0),0),s=i.services.reduce((o,r)=>o+(r.hoursUsed||0),0),n=i.services.reduce((o,r)=>o+L(r),0);return{totalHours:t,hoursUsed:s,hoursRemaining:n,minutesUsed:Math.round(s*60),minutesRemaining:Math.round(n*60),totalMinutes:Math.round(t*60),lastActivity:new Date().toISOString(),_lastModified:new Date().toISOString(),_modifiedBy:e||"system",_version:(i._version||0)+1}}function qe(i,e){return!i||!i.stages||(i.stages.forEach(t=>{ae(t)}),i.totalHours=i.stages.reduce((t,s)=>t+(s.totalHours||0),0),i.hoursUsed=i.stages.reduce((t,s)=>t+(s.hoursUsed||0),0),i.hoursRemaining=i.stages.reduce((t,s)=>t+L(s),0),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e)),i}function Oe(i,e){const t=Math.round(i*60);return{hoursUsed:e.increment(i),hoursRemaining:e.increment(-i),minutesUsed:e.increment(t),minutesRemaining:e.increment(-t),lastActivity:e.serverTimestamp(),_lastModified:e.serverTimestamp()}}typeof E<"u"&&E.exports&&(E.exports={updateServiceAggregates:Pe,updateStageAggregates:ae,updateClientAggregates:He,updateLegalProcedureAggregates:qe,createIncrementUpdate:Oe});function Ve(i){return!i||!i.packages||i.packages.length===0?null:i.packages.find(e=>{const t=!e.status||e.status==="active",s=(e.hoursRemaining||0)>0;return t&&s})||null}function Mt(i){return i?!i.packages||i.packages.length===0?i.hoursRemaining||0:i.packages.filter(e=>e.status==="active"||!e.status).reduce((e,t)=>e+(t.hoursRemaining||0),0):0}function ze(i,e){return i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=(i.hoursRemaining||0)-e,i.status||(i.status="active"),i.hoursRemaining<=0&&(i.status="depleted",i.hoursRemaining=0,i.closedDate=new Date().toISOString()),i}function We(i,e){const t=Ve(i);return t?(ze(t,e),i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=Mt(i),{success:!0,packageId:t.id,stageId:i.id}):{success:!1,error:"אין חבילה פעילה לניכוי שעות"}}function Dt(i,e,t){const s=t/60,n={clientUpdate:null,error:null};if(e.serviceType==="legal_procedure"&&e.parentServiceId){const o=i.services||[],r=o.findIndex(m=>m.id===e.parentServiceId);if(r===-1)return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;const a=o[r],c=a.stages||[],d=c.findIndex(m=>m.id===e.serviceId);if(d===-1)return n.error=`שלב ${e.serviceId} לא נמצא בשירות`,n;const u=c[d],l=We(u,s);if(!l.success)return n.error=l.error,n;a.hoursUsed=(a.hoursUsed||0)+s,a.hoursRemaining=a.stages.reduce((m,h)=>m+(h.hoursRemaining||0),0),n.clientUpdate={[`services.${r}`]:a,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1}}else if(e.serviceType==="hours"&&e.parentServiceId){const o=i.services||[],r=o.findIndex(c=>c.id===e.parentServiceId);if(r===-1)return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;const a=o[r];a.hoursUsed=(a.hoursUsed||0)+s,a.hoursRemaining=(a.hoursRemaining||0)-s,a.hoursRemaining<0&&(a.hoursRemaining=0),n.clientUpdate={[`services.${r}`]:a,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1}}else n.error="סוג שירות לא נתמך או חסר מידע";return n}function ce({stageId:i,type:e,hours:t,status:s,description:n}){return{id:`pkg_${e}_${i}_${Date.now()}`,type:e,hours:t,hoursUsed:0,hoursRemaining:t,status:s,description:n||(e==="initial"?"חבילה ראשונית":"חבילה נוספת"),createdAt:new Date().toISOString()}}function je({id:i,name:e,description:t,order:s,status:n,hours:o}){const r=ce({stageId:i,type:"initial",hours:o,status:n==="active"?"active":"pending"});return{id:i,name:e,description:t,order:s,status:n,totalHours:o,hoursUsed:0,hoursRemaining:o,packages:[r],createdAt:new Date().toISOString()}}function Ge(i){if(!i||i.length!==3)throw new Error("Legal procedure requires exactly 3 stages");const e=["stage_a","stage_b","stage_c"],t=["שלב א'","שלב ב'","שלב ג'"];return i.map((s,n)=>je({id:e[n],name:t[n],description:s.description||"",order:n+1,status:n===0?"active":"pending",hours:s.hours||0}))}function Lt({id:i,name:e,stagesData:t,currentStage:s}){const n=Ge(t),o=n.reduce((r,a)=>r+a.totalHours,0);return{id:i,type:"legal_procedure",name:e,currentStage:s||"stage_a",stages:n,totalHours:o,hoursUsed:0,hoursRemaining:o,createdAt:new Date().toISOString()}}function It({id:i,name:e,hours:t}){return{id:i,type:"hours",name:e,totalHours:t,hoursUsed:0,hoursRemaining:t,createdAt:new Date().toISOString()}}function kt(i,e,t){const s=ce({stageId:i.id,type:"additional",hours:e,status:i.status==="active"?"active":"pending",description:t});return i.packages.push(s),i.totalHours+=e,i.hoursRemaining+=e,s}const Ke={calculateRemainingHours:L,calculateTotalHours:A,calculateHoursUsed:F,calculateProgress:re,minutesToHours:xe,hoursToMinutes:$e,formatHours:Ae,validateTimeEntry:Fe,validatePackage:Ne,validateHoursPackage:_e,validateStages:Re,validateDeduction:Ue,updateServiceAggregates:Pe,updateStageAggregates:ae,updateClientAggregates:He,updateLegalProcedureAggregates:qe,createIncrementUpdate:Oe,getActivePackage:Ve,deductHoursFromPackage:ze,deductHoursFromStage:We,calculateClientUpdates:Dt,createPackage:ce,createStage:je,createLegalProcedureStages:Ge,createLegalProcedureService:Lt,createHourlyService:It,addPackageToStage:kt};typeof window<"u"&&(window.DeductionSystem=Ke,window.calculateRemainingHours=L,window.calculateHoursUsed=F,window.calculateTotalHours=A,window.calculateProgress=re);typeof E<"u"&&E.exports&&(E.exports=Ke);(function(){const i={DEFAULT_PAGE_SIZE:20};class e{constructor(){this.lastDocs={clients:null,budget_tasks:null,timesheet_entries:null},this.cache={clients:[],budget_tasks:[],timesheet_entries:[]},this.hasMore={clients:!0,budget_tasks:!0,timesheet_entries:!0}}_log(s,n=null){}_convertTimestamps(s){const n={...s};return["createdAt","updatedAt","completedAt","deadline","date"].forEach(r=>{var a;(a=n[r])!=null&&a.toDate&&typeof n[r].toDate=="function"&&(n[r]=n[r].toDate())}),n}reset(s){this.lastDocs[s]!==void 0&&(this.lastDocs[s]=null,this.cache[s]=[],this.hasMore[s]=!0,this._log(`Reset pagination for ${s}`))}resetAll(){Object.keys(this.lastDocs).forEach(s=>this.reset(s)),this._log("Reset all pagination")}async loadClientsPaginated(s=i.DEFAULT_PAGE_SIZE,n=!1){try{const o=window.firebaseDB;if(!o)throw new Error("Firebase לא מחובר");if(n||this.reset("clients"),!this.hasMore.clients&&n)return this._log("No more clients to load"),{items:[],hasMore:!1,total:this.cache.clients.length};let r=o.collection("clients").orderBy("createdAt","desc").limit(s);this.lastDocs.clients&&n&&(r=r.startAfter(this.lastDocs.clients)),this._log(`Loading clients (limit: ${s}, loadMore: ${n})`);const a=await r.get(),c=[];return a.forEach(d=>{const u=this._convertTimestamps(d.data());c.push({id:d.id,...u})}),a.docs.length>0&&(this.lastDocs.clients=a.docs[a.docs.length-1]),this.hasMore.clients=a.docs.length===s,n?this.cache.clients=[...this.cache.clients,...c]:this.cache.clients=c,this._log(`Loaded ${c.length} clients (hasMore: ${this.hasMore.clients})`),{items:c,hasMore:this.hasMore.clients,total:this.cache.clients.length}}catch(o){throw console.error("Firebase Pagination error (clients):",o),new Error("שגיאה בטעינת לקוחות: "+o.message)}}async loadBudgetTasksPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1,r="active"){try{const a=window.firebaseDB;if(!a)throw new Error("Firebase לא מחובר");const c=`budget_tasks_${r}`;if(o||this.reset(c),!this.hasMore[c]&&o)return this._log(`No more budget tasks to load (filter: ${r})`),{items:[],hasMore:!1,total:(this.cache[c]||[]).length};let d=a.collection("budget_tasks").where("employee","==",s).orderBy("createdAt","desc").limit(n);this.lastDocs[c]&&o&&(d=d.startAfter(this.lastDocs[c])),this._log(`Loading budget tasks for ${s} (limit: ${n}, loadMore: ${o}, filter: ${r})`);const u=await d.get(),l=[];u.forEach(h=>{const g={...this._convertTimestamps(h.data()),firebaseDocId:h.id};g.id||(g.id=h.id),l.push(g)});let m=l;return r==="active"?m=l.filter(h=>h.status!=="הושלם"):r==="completed"&&(m=l.filter(h=>h.status==="הושלם")),u.docs.length>0&&(this.lastDocs[c]=u.docs[u.docs.length-1]),this.hasMore[c]=u.docs.length===n,o?this.cache[c]=[...this.cache[c]||[],...m]:this.cache[c]=m,this._log(`Loaded ${m.length} budget tasks (hasMore: ${this.hasMore[c]}, filtered from ${l.length}, cacheKey: ${c})`),{items:m,hasMore:this.hasMore[c],total:(this.cache[c]||[]).length}}catch(a){throw console.error("Firebase Pagination error (budget_tasks):",a),new Error("שגיאה בטעינת משימות: "+a.message)}}async loadTimesheetPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1){try{const r=window.firebaseDB;if(!r)throw new Error("Firebase לא מחובר");if(o||this.reset("timesheet_entries"),!this.hasMore.timesheet_entries&&o)return this._log("No more timesheet entries to load"),{items:[],hasMore:!1,total:this.cache.timesheet_entries.length};let a=r.collection("timesheet_entries").where("employee","==",s).orderBy("createdAt","desc").limit(n);this.lastDocs.timesheet_entries&&o&&(a=a.startAfter(this.lastDocs.timesheet_entries)),this._log(`Loading timesheet for ${s} (limit: ${n}, loadMore: ${o})`);const c=await a.get(),d=[];return c.forEach(u=>{const l=this._convertTimestamps(u.data());d.push({id:u.id,...l})}),c.docs.length>0&&(this.lastDocs.timesheet_entries=c.docs[c.docs.length-1]),this.hasMore.timesheet_entries=c.docs.length===n,o?this.cache.timesheet_entries=[...this.cache.timesheet_entries,...d]:this.cache.timesheet_entries=d,this._log(`Loaded ${d.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`),{items:d,hasMore:this.hasMore.timesheet_entries,total:this.cache.timesheet_entries.length}}catch(r){throw console.error("Firebase Pagination error (timesheet):",r),new Error("שגיאה בטעינת שעתון: "+r.message)}}getCachedData(s){return this.cache[s]||[]}getStatus(s){var n;return{collection:s,cachedItems:((n=this.cache[s])==null?void 0:n.length)||0,hasMore:this.hasMore[s],hasLastDoc:!!this.lastDocs[s]}}}window.FirebasePaginationModule={FirebasePaginationManager:e,create(){return new e}}})();const le={CACHE_TTL:3e5,DEBUG:!1},b={log:(...i)=>{le.DEBUG&&console.log("[EmployeesManager]",...i)},error:(...i)=>{console.error("[EmployeesManager ERROR]",...i)}};let O=null,de=0;function xt(){return O!==null&&Date.now()-de<le.CACHE_TTL}function G(){O=null,de=0,b.log("🗑️ Cache cleared")}function Ye(i,e){return{username:i,password:e.password,name:e.name||e.displayName,displayName:e.displayName||e.name,email:e.email,isActive:e.isActive!==!1,role:e.role||"employee",createdAt:e.createdAt,updatedAt:e.updatedAt,lastLogin:e.lastLogin,loginCount:e.loginCount||0}}async function ee(i=!1){if(!window.firebaseDB)throw new Error("Firebase DB not available");if(!i&&xt()&&O)return b.log("📦 Using cached employees"),O;try{b.log("🔄 Loading employees from Firebase...");const e=await window.firebaseDB.collection("employees").get(),t={};return e.forEach(s=>{const n=s.data();t[s.id]=Ye(s.id,n)}),O=t,de=Date.now(),b.log(`✅ Loaded ${Object.keys(t).length} employees`),t}catch(e){throw b.error("Failed to load employees:",e),e}}async function Qe(i){if(!window.firebaseDB)throw new Error("Firebase DB not available");try{const e=await window.firebaseDB.collection("employees").doc(i).get();if(!e.exists)return null;const t=e.data();return t?Ye(e.id,t):null}catch(e){throw b.error(`Failed to get employee ${i}:`,e),e}}async function $t(i){if(!window.firebaseDB)throw new Error("Firebase DB not available");if(!i.username||!i.password||!i.name)return{success:!1,error:"Missing required fields: username, password, name"};if((await window.firebaseDB.collection("employees").doc(i.username).get()).exists)return{success:!1,error:`Employee ${i.username} already exists`};try{const t={username:i.username,password:i.password,name:i.name,displayName:i.name,email:i.email||"",isActive:i.isActive!==!1,role:i.role||"employee",createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:i.createdBy||"admin",lastLogin:null,loginCount:0};return await window.firebaseDB.collection("employees").doc(i.username).set(t),G(),b.log(`✅ Employee ${i.username} added successfully`),{success:!0,data:i.username}}catch(t){return b.error("Failed to add employee:",t),{success:!1,error:t instanceof Error?t.message:"Unknown error"}}}async function At(i,e){if(!window.firebaseDB)throw new Error("Firebase DB not available");if(!(await window.firebaseDB.collection("employees").doc(i).get()).exists)return{success:!1,error:`Employee ${i} not found`};try{const s={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};return e.password!==void 0&&(s.password=e.password),e.name!==void 0&&(s.name=e.name,s.displayName=e.name),e.email!==void 0&&(s.email=e.email),e.isActive!==void 0&&(s.isActive=e.isActive),e.role!==void 0&&(s.role=e.role),await window.firebaseDB.collection("employees").doc(i).update(s),G(),b.log(`✅ Employee ${i} updated successfully`),{success:!0,data:i}}catch(s){return b.error("Failed to update employee:",s),{success:!1,error:s instanceof Error?s.message:"Unknown error"}}}async function Ft(i,e=!1){if(!window.firebaseDB)throw new Error("Firebase DB not available");try{return e?(await window.firebaseDB.collection("employees").doc(i).delete(),b.log(`✅ Employee ${i} deleted permanently`)):(await window.firebaseDB.collection("employees").doc(i).update({isActive:!1,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.serverTimestamp()}),b.log(`✅ Employee ${i} deactivated`)),G(),{success:!0,data:i}}catch(t){return b.error("Failed to delete employee:",t),{success:!1,error:t instanceof Error?t.message:"Unknown error"}}}async function Nt(i){if(!window.firebaseDB)throw new Error("Firebase DB not available");try{return await window.firebaseDB.collection("employees").doc(i).update({isActive:!0,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.delete()}),G(),b.log(`✅ Employee ${i} restored`),{success:!0,data:i}}catch(e){return b.error("Failed to restore employee:",e),{success:!1,error:e instanceof Error?e.message:"Unknown error"}}}async function _t(i,e){try{const t=await Qe(i);return t?t.isActive?t.password!==e?{success:!1,error:"סיסמה שגויה"}:(await window.firebaseDB.collection("employees").doc(i).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),b.log(`✅ User ${i} authenticated successfully`),{success:!0,employee:t}):{success:!1,error:"החשבון מושבת"}:{success:!1,error:"המשתמש לא קיים"}}catch(t){return b.error("Authentication failed:",t),{success:!1,error:"שגיאה באימות"}}}async function Rt(i){const e=await ee(),t=[],s=i.toLowerCase();return Object.values(e).forEach(n=>{(n.username.toLowerCase().includes(s)||n.name.toLowerCase().includes(s)||n.email.toLowerCase().includes(s))&&t.push(n)}),t}async function Ut(){const i=await ee();return Object.values(i).filter(e=>e.isActive)}async function Pt(){const i=await ee(),e=Object.values(i);return{total:e.length,active:e.filter(t=>t.isActive).length,inactive:e.filter(t=>!t.isActive).length,admins:e.filter(t=>t.role==="admin").length,employees:e.filter(t=>t.role==="employee").length,managers:e.filter(t=>t.role==="manager").length}}(function(){window.EmployeesManager={async loadAll(i=!1){return await ee(i)},async get(i){return await Qe(i)},async add(i){return await $t(i)},async update(i,e){return await At(i,e)},async delete(i,e=!1){return await Ft(i,e)},async restore(i){return await Nt(i)},async authenticate(i,e){return await _t(i,e)},async search(i){return await Rt(i)},async getActive(){return await Ut()},async getStats(){return await Pt()},clearCache(){G()},config:le},b.log("📦 Employees Manager module loaded (TypeScript Edition)")})();const Ht="modulepreload",qt=function(i){return"/"+i},Be={},j=function(e,t,s){let n=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),a=(r==null?void 0:r.nonce)||(r==null?void 0:r.getAttribute("nonce"));n=Promise.allSettled(t.map(c=>{if(c=qt(c),c in Be)return;Be[c]=!0;const d=c.endsWith(".css"),u=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${u}`))return;const l=document.createElement("link");if(l.rel=d?"stylesheet":Ht,d||(l.as="script"),l.crossOrigin="",l.href=c,a&&l.setAttribute("nonce",a),document.head.appendChild(l),d)return new Promise((m,h)=>{l.addEventListener("load",m),l.addEventListener("error",()=>h(new Error(`Unable to preload CSS for ${c}`)))})}))}function o(r){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=r,window.dispatchEvent(a),!a.defaultPrevented)throw r}return n.then(r=>{for(const a of r||[])a.status==="rejected"&&o(a.reason);return e().catch(o)})},Ot="budget",Vt=!1,zt={documentClick:null,documentKeydown:null,windowResize:null,notificationClick:null};function y(i){if(typeof i!="string")return String(i||"");const e=document.createElement("div");return e.textContent=i,e.innerHTML}function Wt(i){return new Promise(e=>setTimeout(e,i))}function Je(i,e){let t;return function(...n){const o=()=>{clearTimeout(t),i(...n)};clearTimeout(t),t=setTimeout(o,e)}}window.isInWelcomeScreen=!1;const Ze=document.createElement("style");Ze.textContent=`
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
`;document.head.appendChild(Ze);const V=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatDateTime(i))||"-"},q=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatDate(i))||"-"},ue=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatShort(i))||"-"};typeof window<"u"&&(window.calculateRemainingHours=L,window.calculateTotalHours=A,window.calculateHoursUsed=F,window.safeText=y);const jt=Object.freeze(Object.defineProperty({__proto__:null,calculateHoursUsed:F,calculateRemainingHours:L,calculateTotalHours:A,currentActiveTab:Ot,debounce:Je,delay:Wt,formatDate:q,formatDateTime:V,formatShort:ue,globalListeners:zt,isScrolled:Vt,safeText:y},Symbol.toStringTag,{value:"Module"}));class Gt{constructor(){this.elements=new Map}getElementById(e){if(this.elements.has(e))return this.elements.get(e);const t=document.getElementById(e);return t&&this.elements.set(e,t),t}querySelector(e){if(this.elements.has(e))return this.elements.get(e);const t=document.querySelector(e);return t&&this.elements.set(e,t),t}clear(){this.elements.clear()}remove(e){this.elements.delete(e)}}class me{constructor(e={}){this.maxAge=e.maxAge||5*60*1e3,this.staleWhileRevalidate=e.staleWhileRevalidate!==!1,this.staleAge=e.staleAge||10*60*1e3,this.storage=e.storage||"memory",this.onError=e.onError||(t=>console.error("[DataCache]",t)),this.debug=e.debug||!1,this.namespace=e.namespace||"dataCache",this.cache=new Map,this.stats={hits:0,misses:0,revalidations:0,errors:0},this.pendingRevalidations=new Map,this.storage==="localStorage"&&!this._isLocalStorageAvailable()&&(this._log("warn","localStorage not available, falling back to memory"),this.storage="memory"),this._log("info","DataCache initialized",{maxAge:this.maxAge,staleAge:this.staleAge,storage:this.storage,staleWhileRevalidate:this.staleWhileRevalidate})}async get(e,t,s={}){if(!e||typeof e!="string")throw new Error("[DataCache] Key must be a non-empty string");if(typeof t!="function")throw new Error("[DataCache] fetchFunction must be a function");if(s.force)return this._log("info",`Force fetch for key: ${e}`),await this._fetchAndCache(e,t);const n=Date.now(),o=this._getEntry(e);if(!o)return this.stats.misses++,this._log("info",`Cache MISS for key: ${e}`),await this._fetchAndCache(e,t);const r=s.maxAge||this.maxAge,a=n-o.timestamp,c=a<r,d=a>=r&&a<r+this.staleAge;if(a>=r+this.staleAge)return this.stats.misses++,this._log("info",`Cache EXPIRED for key: ${e} (age: ${a}ms)`),await this._fetchAndCache(e,t);if(c)return this.stats.hits++,this._log("info",`Cache HIT (fresh) for key: ${e} (age: ${a}ms)`),o.data;if(d&&this.staleWhileRevalidate){this.stats.hits++,this._log("info",`Cache HIT (stale) for key: ${e} (age: ${a}ms) - revalidating in background`);const l=o.data;return this._revalidateInBackground(e,t),l}return this.stats.misses++,await this._fetchAndCache(e,t)}async _fetchAndCache(e,t){try{const s=await t();return this._setEntry(e,s),s}catch(s){throw this.stats.errors++,this._log("error",`Error fetching data for key: ${e}`,s),this.onError(s),s}}_revalidateInBackground(e,t){if(this.pendingRevalidations.has(e)){this._log("debug",`Revalidation already in progress for key: ${e}`);return}this.stats.revalidations++;const s=(async()=>{try{this._log("debug",`Starting background revalidation for key: ${e}`);const n=await t();this._setEntry(e,n),this._log("debug",`Background revalidation complete for key: ${e}`)}catch(n){this.stats.errors++,this._log("error",`Background revalidation failed for key: ${e}`,n),this.onError(n)}finally{this.pendingRevalidations.delete(e)}})();this.pendingRevalidations.set(e,s)}_getEntry(e){if(this.storage==="memory")return this.cache.get(e)||null;if(this.storage==="localStorage")try{const t=localStorage.getItem(this._getStorageKey(e));return t?JSON.parse(t):null}catch(t){return this._log("error","Error reading from localStorage",t),null}return null}_setEntry(e,t){const s=Date.now(),n={data:t,timestamp:s,expiresAt:s+this.maxAge};if(this.storage==="memory"&&this.cache.set(e,n),this.storage==="localStorage")try{localStorage.setItem(this._getStorageKey(e),JSON.stringify(n))}catch(o){this._log("error","Error writing to localStorage",o),this.stats.errors++,this.cache.set(e,n)}this._log("debug",`Cached data for key: ${e}`)}invalidate(e){this._log("info",`Invalidating cache for key: ${e}`);let t=!1;if(this.storage==="memory"&&(t=this.cache.delete(e)),this.storage==="localStorage"){const s=this._getStorageKey(e);t=localStorage.getItem(s)!==null,localStorage.removeItem(s)}return this.pendingRevalidations.has(e)&&this.pendingRevalidations.delete(e),t}clear(){this._log("info","Clearing all cache entries");let e=0;if(this.storage==="memory"&&(e=this.cache.size,this.cache.clear()),this.storage==="localStorage"){const t=Object.keys(localStorage),s=this._getStorageKey("");t.forEach(n=>{n.startsWith(s)&&(localStorage.removeItem(n),e++)})}return this.pendingRevalidations.clear(),e}getStats(){const e=this.stats.hits+this.stats.misses,t=e>0?Math.round(this.stats.hits/e*100):0;return{...this.stats,size:this.storage==="memory"?this.cache.size:this._getLocalStorageSize(),hitRate:t}}resetStats(){this.stats={hits:0,misses:0,revalidations:0,errors:0},this._log("info","Statistics reset")}_getStorageKey(e){return`${this.namespace}:${e}`}_getLocalStorageSize(){const e=Object.keys(localStorage),t=this._getStorageKey("");return e.filter(s=>s.startsWith(t)).length}_isLocalStorageAvailable(){try{const e="__localStorage_test__";return localStorage.setItem(e,e),localStorage.removeItem(e),!0}catch{return!1}}_log(e,t,s){if(!this.debug&&e==="debug")return;const n="[DataCache]",o=new Date().toISOString();s?console[e==="debug"?"log":e](`${n} ${o} ${t}`,s):console[e==="debug"?"log":e](`${n} ${o} ${t}`)}}typeof E<"u"&&E.exports&&(E.exports=me);typeof window<"u"&&(window.DataCache=me);const he={TASK_FILTER:"active",TIMESHEET_FILTER:"month",BUDGET_VIEW:"cards",TIMESHEET_VIEW:"table",BUDGET_SORT:"recent",TIMESHEET_SORT:"recent"},fe=["taskFilter","timesheetFilter","currentPage","searchQuery"],ge=["budgetView","timesheetView","budgetSort","timesheetSort"];function pe(i){return fe.includes(i)}function we(i){return ge.includes(i)}function Kt(i){return he[i]}function Yt(i){const e=i.replace(/([A-Z])/g,"_$1").toUpperCase(),t=he[e];if(pe(i))return t;if(we(i)){const s=localStorage.getItem(i);return s!==null?s:t}return t}function Qt(i,e){return pe(i)?(console.debug(`⚠️ ${i} is session-only, not persisting to localStorage`),!1):we(i)?(localStorage.setItem(i,e),console.debug(`✅ ${i} persisted to localStorage: ${e}`),!0):(console.warn(`⚠️ Unknown state key: ${i}`),!1)}function Jt(i=!1){ge.forEach(e=>{localStorage.removeItem(e)}),i&&fe.forEach(e=>{localStorage.removeItem(e)}),console.log("✅ State cleared")}const D={DEFAULTS:he,SESSION_ONLY_KEYS:fe,PERSISTED_KEYS:ge,isSessionOnly:pe,isPersisted:we,getDefault:Kt,getStateValue:Yt,setStateValue:Qt,clearAllState:Jt};class Zt{constructor(){this.errors=[]}validateClientCase(e){return e?!e.clientId||!e.clientName?(this.errors.push("חובה לבחור לקוח"),!1):e.caseId?!0:(this.errors.push("חובה לבחור תיק"),!1):(this.errors.push("חובה לבחור לקוח ותיק"),!1)}validateBranch(e){return!e||e.trim()===""?(this.errors.push("חובה לבחור סניף מטפל"),!1):["רחובות","תל אביב"].includes(e)?!0:(this.errors.push("סניף לא תקין. אנא בחר מהרשימה"),!1)}validateDeadline(e){if(!e||e.trim()==="")return this.errors.push("חובה לבחור תאריך יעד"),!1;const t=new Date(e),s=new Date,n=new Date(s.getFullYear(),s.getMonth(),s.getDate());return t<n?(this.errors.push("תאריך היעד לא יכול להיות בעבר"),!1):!0}validateEstimatedTime(e){const t=parseInt(e);return!e||isNaN(t)?(this.errors.push("חובה להזין זמן משוער בדקות"),!1):t<1?(this.errors.push("זמן משוער חייב להיות לפחות 1 דקה"),!1):t>9999?(this.errors.push("זמן משוער גבוה מדי (מקסימום 9999 דקות)"),!1):!0}validateDescription(e){return!e||e.trim().length<3?(this.errors.push("תיאור המשימה חייב להכיל לפחות 3 תווים"),!1):e.trim().length>500?(this.errors.push("תיאור המשימה ארוך מדי (מקסימום 500 תווים)"),!1):!0}validateAll(e){return this.errors=[],this.validateClientCase(e.selectorValues),this.validateBranch(e.branch),this.validateDeadline(e.deadline),this.validateEstimatedTime(e.estimatedTime),this.validateDescription(e.description),{isValid:this.errors.length===0,errors:[...this.errors]}}showErrors(e,t=null){if(!(!e||e.length===0)){if(window.NotificationSystem){const s=e.join(`
`);window.NotificationSystem.show(s,"error",5e3);return}t?t.innerHTML=`
        <div class="validation-errors" style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">
            <i class="fas fa-exclamation-triangle"></i>
            יש לתקן את השגיאות הבאות:
          </h4>
          <ul style="margin: 0; padding-right: 20px; color: #991b1b;">
            ${e.map(s=>`<li style="margin-bottom: 8px;">${s}</li>`).join("")}
          </ul>
        </div>
      `:alert(`שגיאות בטופס:

`+e.join(`
`))}}clearErrors(e=null){if(this.errors=[],e){const t=e.querySelector(".validation-errors");t&&t.remove()}}markInvalid(e){e&&(e.classList.add("invalid"),e.style.borderColor="#ef4444",e.style.boxShadow="0 0 0 3px rgba(239, 68, 68, 0.1)")}markValid(e){e&&(e.classList.remove("invalid"),e.style.borderColor="",e.style.boxShadow="")}setupRealTimeValidation(e,t){!e||!t||(e.addEventListener("blur",()=>{t(e.value)?this.markValid(e):this.markInvalid(e)}),e.addEventListener("input",()=>{e.classList.contains("invalid")&&this.markValid(e)}))}}const oe="addTaskDraft";class Xt{constructor(e="addTaskForm"){this.formId=e,this.form=null}init(){this.form=document.getElementById(this.formId),this.form||console.warn(`⚠️ Form #${this.formId} not found`)}fillDefaults(e={}){if(!this.form){console.error("❌ Form not initialized");return}if(!e.deadline){const t=new Date;t.setDate(t.getDate()+1),t.setHours(17,0,0,0);const s=this.form.querySelector("#taskDeadline");if(s){const n=t.toISOString().slice(0,16);s.value=n}}if(!e.estimatedTime){const t=this.form.querySelector("#taskEstimatedTime");t&&(t.value="60")}if(e.branch){const t=this.form.querySelector("#taskBranch");t&&(t.value=e.branch)}}clear(){var s,n;if(!this.form){console.error("❌ Form not initialized");return}this.form.reset(),window.ClientCaseSelectorsManager&&((n=(s=window.ClientCaseSelectorsManager).clearBudget)==null||n.call(s));const e=this.form.querySelector("#taskDescriptionSelector");if(e&&window.SmartComboSelector){const o=e._smartComboInstance;o!=null&&o.clear&&o.clear()}this.form.querySelectorAll('input[type="hidden"]').forEach(o=>o.value=""),console.log("✅ Form cleared")}saveDraft(){try{const t={...this.getFormData(),savedAt:new Date().toISOString()};return localStorage.setItem(oe,JSON.stringify(t)),console.log("✅ Draft saved"),!0}catch(e){return console.error("❌ Failed to save draft:",e),!1}}loadDraft(){try{const e=localStorage.getItem(oe);if(!e)return null;const t=JSON.parse(e),s=new Date(t.savedAt);return(new Date-s)/(1e3*60*60*24)>7?(console.log("⏰ Draft is too old, clearing..."),this.clearDraft(),null):(console.log("✅ Draft loaded"),t)}catch(e){return console.error("❌ Failed to load draft:",e),null}}clearDraft(){try{localStorage.removeItem(oe),console.log("✅ Draft cleared")}catch(e){console.error("❌ Failed to clear draft:",e)}}fillWithDraft(e){if(!(!this.form||!e)){if(e.branch){const t=this.form.querySelector("#taskBranch");t&&(t.value=e.branch)}if(e.deadline){const t=this.form.querySelector("#taskDeadline");t&&(t.value=e.deadline)}if(e.estimatedTime){const t=this.form.querySelector("#taskEstimatedTime");t&&(t.value=e.estimatedTime)}if(e.description){const t=this.form.querySelector("#taskDescription");t&&(t.value=e.description)}console.log("✅ Form filled with draft data")}}getFormData(){var a,c,d,u,l,m,h;if(!this.form)return console.error("❌ Form not initialized"),{};const e=((c=(a=window.ClientCaseSelectorsManager)==null?void 0:a.getBudgetValues)==null?void 0:c.call(a))||{},t=((d=this.form.querySelector("#taskBranch"))==null?void 0:d.value)||"",s=((u=this.form.querySelector("#taskDeadline"))==null?void 0:u.value)||"",n=((l=this.form.querySelector("#taskEstimatedTime"))==null?void 0:l.value)||"",o=((m=this.form.querySelector("#taskDescription"))==null?void 0:m.value)||"",r=((h=this.form.querySelector("#taskDescriptionCategory"))==null?void 0:h.value)||"";return{...e,branch:t,deadline:s,estimatedTime:parseInt(n)||0,description:o,categoryId:r,categoryName:this.getCategoryName(r)}}getCategoryName(e){if(!e||!window.WorkCategories)return null;const t=window.WorkCategories.getCategoryById(e);return(t==null?void 0:t.name)||null}hasUnsavedChanges(){const e=this.getFormData();return!!(e.description||e.branch||e.estimatedTime||e.clientId)}async promptSaveDraft(){var t;return this.hasUnsavedChanges()?(t=window.NotificationSystem)!=null&&t.confirm?new Promise(s=>{window.NotificationSystem.confirm("יש לך שינויים לא שמורים. האם לשמור כטיוטה?",()=>{this.saveDraft(),s(!0)},()=>{s(!0)},{title:"שמירת טיוטה",confirmText:"כן, שמור",cancelText:"לא, המשך בלי לשמור"})}):(confirm("יש לך שינויים לא שמורים. האם לשמור כטיוטה?")&&this.saveDraft(),!0):!0}}function ei(i,e){if(!i)throw new Error("Form data is required");if(!e)throw new Error("Current user is required");return{description:i.description||"",categoryId:i.categoryId||null,categoryName:i.categoryName||null,clientName:i.clientName||"",clientId:i.clientId||"",caseId:i.caseId||"",caseNumber:i.caseNumber||"",caseTitle:i.caseTitle||"",serviceId:i.serviceId||"",serviceName:i.serviceName||"",serviceType:i.serviceType||"",parentServiceId:i.parentServiceId||null,branch:i.branch||"",estimatedMinutes:parseInt(i.estimatedMinutes)||0,originalEstimate:parseInt(i.estimatedMinutes)||0,deadline:i.deadline||"",employee:e,status:"active",timeSpent:0,actualMinutes:0,timeEntries:[],createdAt:new Date,updatedAt:new Date}}function ti(i){const e=[];return(!i.description||i.description.trim().length<3)&&e.push("תיאור המשימה חייב להכיל לפחות 3 תווים"),i.clientId||e.push("חובה לבחור לקוח"),i.caseId||e.push("חובה לבחור תיק"),i.branch||e.push("חובה לבחור סניף מטפל"),(!i.estimatedMinutes||i.estimatedMinutes<1)&&e.push("זמן משוער חייב להיות לפחות 1 דקה"),i.deadline||e.push("חובה לבחור תאריך יעד"),i.employee||e.push("חסר מידע על העובד המבצע"),{isValid:e.length===0,errors:e}}class ii{constructor(e,t={}){this.manager=e,this.options={onSuccess:t.onSuccess||null,onError:t.onError||null,onCancel:t.onCancel||null,enableDrafts:t.enableDrafts!==!1,...t},this.validator=new Zt,this.formManager=new Xt("addTaskForm"),this.overlay=null,this.isVisible=!1,this.clientCaseSelector=null,this.descriptionSelector=null,console.log("✅ AddTaskDialog instance created")}show(){if(console.log("🔍 AddTaskDialog.show() called"),this.isVisible){console.warn("⚠️ Dialog is already visible");return}try{console.log("🔍 Calling render()..."),this.render(),this.isVisible=!0,console.log("✅ Add Task Dialog shown successfully")}catch(e){throw console.error("❌ Error showing Add Task Dialog:",e),console.error("Stack trace:",e.stack),e}}async hide(){this.isVisible&&(this.options.enableDrafts&&this.formManager.hasUnsavedChanges()&&!await this.formManager.promptSaveDraft()||(this.overlay&&this.overlay.classList.add("hidden"),this.isVisible=!1,this.options.onCancel&&this.options.onCancel(),console.log("✅ Add Task Dialog hidden")))}render(){console.log("🔍 render() called");try{const e=this.buildHTML();console.log("✅ buildHTML() completed");const t=document.getElementById("budgetTab");if(!t)throw console.error("❌ budgetTab not found - element does not exist in DOM"),console.log("Available elements:",document.querySelectorAll('[id*="budget"]')),new Error("budgetTab element not found");console.log("✅ budgetTab found:",t);const s=document.createElement("div");if(s.innerHTML=e,this.overlay=s.firstElementChild,console.log("✅ overlay created:",this.overlay),t.insertBefore(this.overlay,t.firstChild),console.log("✅ overlay inserted into budgetTab"),this.overlay.classList.remove("hidden"),console.log("✅ hidden class removed"),this.formManager.init(),console.log("✅ form manager initialized"),this.setupEventListeners(),console.log("✅ event listeners setup"),setTimeout(()=>this.initializeSelectors(),100),console.log("✅ selectors initialization scheduled"),this.options.enableDrafts){const n=this.formManager.loadDraft();n?this.showDraftPrompt(n):this.formManager.fillDefaults()}else this.formManager.fillDefaults();console.log("✅ render() completed successfully")}catch(e){throw console.error("❌ Error in render():",e),console.error("Stack trace:",e.stack),e}}buildHTML(){return`
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
                max="999"
                autocomplete="off"
                required
              />
            </div>
          </div>

          <!-- תיאור המשימה - Smart Selector -->
          <div class="form-row">
            <div class="form-group">
              <label for="budgetDescriptionSelector">
                <i class="fas fa-align-right"></i> תיאור המשימה
                <span class="category-required">*</span>
              </label>
              <div id="budgetDescriptionSelector"></div>
              <!-- Hidden inputs for validation -->
              <input type="hidden" id="budgetDescription" required>
              <input type="hidden" id="budgetDescriptionCategory">
            </div>
          </div>

          <div class="form-buttons">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-plus"></i>
              הוסף לתקצוב
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              onclick="window.AddTaskSystem.hide()"
            >
              <i class="fas fa-times"></i>
              ביטול
            </button>
          </div>
        </form>
      </div>
    `}setupEventListeners(){const e=document.getElementById("addTaskForm");e&&(e.addEventListener("submit",t=>{t.preventDefault(),this.handleSubmit()}),this.overlay&&this.overlay.addEventListener("click",t=>{t.target===this.overlay&&this.hide()}),document.addEventListener("keydown",this.handleEscapeKey.bind(this)),console.log("✅ Event listeners setup"))}handleEscapeKey(e){e.key==="Escape"&&this.isVisible&&this.hide()}async initializeSelectors(){try{await this.initClientCaseSelector(),await this.initDescriptionSelector(),console.log("✅ Selectors initialized")}catch(e){console.error("❌ Error initializing selectors:",e)}}async initClientCaseSelector(){if(!window.ClientCaseSelectorsManager){console.error("❌ ClientCaseSelectorsManager not available");return}if(document.getElementById("addTaskClientCaseSelector"))try{await window.ClientCaseSelectorsManager.initializeBudgetSelector(this.manager.clients,this.manager.currentUser),this.clientCaseSelector=window.ClientCaseSelectorsManager,console.log("✅ ClientCaseSelector initialized")}catch(t){console.error("❌ Error initializing ClientCaseSelector:",t)}}async initDescriptionSelector(){if(!window.SmartComboSelector){console.warn("⚠️ SmartComboSelector not available");return}if(document.getElementById("taskDescriptionSelector"))try{this.descriptionSelector=new window.SmartComboSelector("taskDescriptionSelector",{required:!0,placeholder:"בחר או הקלד תיאור עבודה...",suggestLastUsed:!0,autoSelectSuggestion:!1}),console.log("✅ Description selector initialized")}catch(t){console.error("❌ Error initializing description selector:",t)}}async handleSubmit(){try{console.log("📝 Processing form submission...");const e=this.formManager.getFormData(),t=this.validator.validateAll({selectorValues:e,branch:e.branch,deadline:e.deadline,estimatedTime:e.estimatedTime,description:e.description});if(!t.isValid){const r=document.getElementById("taskFormErrors");this.validator.showErrors(t.errors,r);return}const s=ei(e,this.manager.currentUser),n=ti(s);if(!n.isValid){const r=document.getElementById("taskFormErrors");this.validator.showErrors(n.errors,r);return}const o=document.getElementById("addTaskSubmitBtn");o&&(o.disabled=!0,o.innerHTML='<i class="fas fa-spinner fa-spin"></i> שומר...'),await this.saveTask(s)}catch(e){console.error("❌ Error submitting form:",e),window.NotificationSystem?window.NotificationSystem.show("שגיאה בשמירת המשימה: "+e.message,"error"):alert("שגיאה בשמירת המשימה: "+e.message);const t=document.getElementById("addTaskSubmitBtn");t&&(t.disabled=!1,t.innerHTML='<i class="fas fa-plus"></i> הוסף לתקצוב'),this.options.onError&&this.options.onError(e)}}async saveTask(e){var t;try{console.log("💾 Saving task with approval request...",e);const s={...e,status:"pending_approval",requestedMinutes:e.estimatedMinutes,approvedMinutes:null,approvalId:null};if(window.FirebaseService){const n=await window.FirebaseService.call("createBudgetTask",s,{retries:3,timeout:15e3});if(!n.success)throw new Error(n.error||"Failed to create task");const o=(t=n.data)==null?void 0:t.taskId;console.log("✅ Task created with pending_approval status:",o);try{const{taskApprovalService:r}=await j(async()=>{const{taskApprovalService:c}=await import("./task-approval-service-C7qOLevG.js");return{taskApprovalService:c}},[]);window.firebaseDB&&this.manager.currentUser&&r.init(window.firebaseDB,this.manager.currentUser);const a=await r.createApprovalRequest(o,e,this.manager.currentUser.email||this.manager.currentUser,this.manager.currentUser.displayName||this.manager.currentUser.email||"משתמש");console.log("✅ Approval request created:",a),window.firebaseDB&&await window.firebaseDB.collection("budget_tasks").doc(o).update({approvalId:a})}catch(r){console.error("⚠️ Error creating approval request:",r)}window.EventBus&&window.EventBus.emit("task:created",{taskId:o||"unknown",clientId:e.clientId,clientName:e.clientName,employee:e.employee,status:"pending_approval"}),this.options.enableDrafts&&this.formManager.clearDraft(),window.NotificationSystem&&window.NotificationSystem.show(`✅ המשימה הועברה למנהל לאישור תקציב

תקציב מבוקש: ${e.estimatedMinutes} דקות

💬 תקבל התראה באייקון המעטפה כשהמנהל יאשר`,"success",5e3),this.options.onSuccess&&this.options.onSuccess(e),this.manager.refreshBudgetTasks?await this.manager.refreshBudgetTasks():this.manager.filterBudgetTasks&&await this.manager.filterBudgetTasks(),this.hide()}else throw new Error("FirebaseService לא זמין")}catch(s){throw console.error("❌ Error saving task:",s),s}}showDraftPrompt(e){var t;if(!((t=window.NotificationSystem)!=null&&t.confirm)){this.formManager.fillWithDraft(e);return}window.NotificationSystem.confirm("נמצאה טיוטה שמורה. האם לטעון אותה?",()=>{this.formManager.fillWithDraft(e)},()=>{this.formManager.clearDraft(),this.formManager.fillDefaults()},{title:"טיוטה שמורה",confirmText:"כן, טען",cancelText:"לא תודה"})}cleanup(){document.removeEventListener("keydown",this.handleEscapeKey.bind(this)),this.clientCaseSelector=null,this.descriptionSelector=null,console.log("✅ AddTaskDialog cleaned up")}}function si(i,e={}){if(console.log("🚀 Initializing Add Task System v2.0..."),!i)throw new Error("❌ Manager is required for Add Task System");const t=new ii(i,e);return typeof window<"u"&&(window.AddTaskSystem={dialog:t,show:()=>t.show(),hide:()=>t.hide(),version:"2.0.0"}),console.log("✅ Add Task System v2.0 initialized"),t}class ni{constructor(){this.notifications=[],this.isDropdownOpen=!1,this.clickHandler=null,this.messagesListener=null,this.currentUser=null,this.init()}init(){this.clickHandler=e=>{const t=document.getElementById("notificationBell"),s=document.getElementById("notificationsDropdown");t&&s&&!t.contains(e.target)&&!s.contains(e.target)&&this.hideDropdown()},document.addEventListener("click",this.clickHandler)}cleanup(){this.clickHandler&&document.removeEventListener("click",this.clickHandler),this.messagesListener&&(this.messagesListener(),this.messagesListener=null)}startListeningToAdminMessages(e,t){if(!e||!t){console.warn("NotificationBell: Cannot listen to messages - user or db missing");return}this.currentUser=e,this.messagesListener=t.collection("user_messages").where("to","==",e.email).where("status","==","unread").orderBy("createdAt","desc").onSnapshot(s=>{console.log(`📨 NotificationBell: Received ${s.size} admin messages`),this.notifications=this.notifications.filter(o=>!o.isAdminMessage),s.docs.map(o=>{const r=o.data();return{id:"msg_"+o.id,type:r.type||"info",title:`📩 הודעה מ-${r.fromName||"מנהל"}`,description:r.message,time:r.createdAt?new Date(r.createdAt.toDate()).toLocaleString("he-IL"):"",urgent:r.priority>=5,isAdminMessage:!0,messageId:o.id,status:r.status,timestamp:r.createdAt?r.createdAt.toMillis():0}}).sort((o,r)=>r.timestamp-o.timestamp).forEach(o=>{this.notifications.unshift(o)}),this.updateBell(),this.renderNotifications(),this.updateMessagesIconBadge()},s=>{console.error("NotificationBell: Error listening to admin messages:",s)}),console.log("✅ NotificationBell: Listening to admin messages for",e.email)}addAdminMessage(e,t){const s={id:"msg_"+e,type:t.type||"info",title:`📩 הודעה מ-${t.fromName||"מנהל"}`,description:t.message,time:t.createdAt?new Date(t.createdAt.toDate()).toLocaleString("he-IL"):"",urgent:t.priority>=5,isAdminMessage:!0,messageId:e,status:t.status};this.notifications.unshift(s),this.updateBell(),this.renderNotifications()}addNotification(e,t,s,n=!1){const o={id:Date.now()+Math.random(),type:e,title:t,description:s,time:new Date().toLocaleString("he-IL"),urgent:n};this.notifications.unshift(o),this.updateBell(),this.renderNotifications()}async removeNotification(e){const t=this.notifications.find(s=>s.id===e);if(t&&t.isAdminMessage&&t.messageId)try{window.firebaseDB&&(await window.firebaseDB.collection("user_messages").doc(t.messageId).update({status:"dismissed",dismissedAt:firebase.firestore.FieldValue.serverTimestamp()}),console.log(`✅ Message ${t.messageId} dismissed`))}catch(s){console.error("Error dismissing message:",s)}this.notifications=this.notifications.filter(s=>s.id!==e),this.updateBell(),this.renderNotifications(),this.updateMessagesIconBadge()}async clearAllNotifications(){const e=this.notifications.filter(t=>t.isAdminMessage&&t.messageId);if(e.length>0&&window.firebaseDB)try{const t=window.firebaseDB.batch();e.forEach(s=>{const n=window.firebaseDB.collection("user_messages").doc(s.messageId);t.update(n,{status:"dismissed",dismissedAt:firebase.firestore.FieldValue.serverTimestamp()})}),await t.commit(),console.log(`✅ Dismissed ${e.length} messages`)}catch(t){console.error("Error dismissing messages:",t)}this.notifications=[],this.updateBell(),this.renderNotifications(),this.updateMessagesIconBadge()}updateMessagesIconBadge(){const e=this.notifications.filter(c=>c.isAdminMessage===!0&&c.status==="unread").length,t=document.getElementById("messagesCountBadge");t&&(e>0?(t.textContent=e,t.classList.remove("hidden")):t.classList.add("hidden"));const s=document.getElementById("aiMessagesBadge");s&&(e>0?(s.textContent=e,s.style.display="flex"):s.style.display="none");const n=this.notifications.filter(c=>c.isAdminMessage!==!0).length,o=document.getElementById("aiNotificationBadge");o&&(n>0?(o.textContent=n,o.style.display="flex"):o.style.display="none");const r=e+n,a=document.getElementById("aiFloatNotificationBadge");a&&(r>0?(a.textContent=r,a.style.display="flex"):a.style.display="none")}updateBell(){const e=document.getElementById("notificationBell"),t=document.getElementById("notificationCount");if(e&&t){const s=this.notifications.filter(n=>n.isAdminMessage!==!0).length;s>0?(e.classList.add("has-notifications"),t.classList.remove("hidden"),t.textContent=s):(e.classList.remove("has-notifications"),t.classList.add("hidden"))}}showDropdown(){const e=document.getElementById("notificationsDropdown");e&&(e.classList.add("show"),this.isDropdownOpen=!0)}hideDropdown(){const e=document.getElementById("notificationsDropdown");e&&(e.classList.remove("show"),this.isDropdownOpen=!1)}toggleDropdown(){this.isDropdownOpen?this.hideDropdown():this.showDropdown()}renderNotifications(){const e=document.getElementById("notificationsContent");if(!e)return;if(this.notifications.length===0){e.innerHTML=`
        <div class="no-notifications">
          <div class="no-notifications-icon"><i class="fas fa-bell-slash"></i></div>
          <h4>אין התראות</h4>
          <p>כל ההתראות יופיעו כאן</p>
        </div>
      `;return}const t={blocked:"fas fa-ban",critical:"fas fa-exclamation-triangle",urgent:"fas fa-clock"},s=this.notifications.map(n=>{const o=document.createElement("div");o.className=`notification-item ${n.type} ${n.urgent?"urgent":""}`,o.id=`notification-${n.id}`;const r=n.isAdminMessage?`
          <button class="notification-reply-btn" onclick="notificationBell.openReplyModal('${n.messageId}', '${y(n.description).replace(/'/g,"\\'")}', '${y(n.title).replace(/'/g,"\\'")}')">
            <i class="fas fa-reply"></i> השב
          </button>
        `:"";return o.innerHTML=`
          <button class="notification-close" onclick="notificationBell.removeNotification('${n.id}')">
            <i class="fas fa-times"></i>
          </button>
          <div class="notification-content">
            <div class="notification-icon ${n.type}">
              <i class="${t[n.type]||"fas fa-info-circle"}"></i>
            </div>
            <div class="notification-text">
              <div class="notification-title">${y(n.title)}</div>
              <div class="notification-description">${y(n.description)}</div>
              <div class="notification-time">${y(n.time)}</div>
            </div>
          </div>
          ${r}
        `,o.outerHTML}).join("");e.innerHTML=s}updateFromSystem(e,t,s){if(this.notifications=this.notifications.filter(n=>!n.isSystemGenerated),e&&e.length>0&&e.forEach(n=>{const o=n.hoursRemaining!==void 0?` (${n.hoursRemaining.toFixed(1)} שעות נותרו)`:"";this.addSystemNotification("blocked",`🚫 לקוח חסום: ${n.name}`,`נגמרה יתרת השעות${o} - לא ניתן לרשום שעות נוספות`,!0)}),t&&t.length>0&&t.forEach(n=>{const o=n.hoursRemaining.toFixed(1);this.addSystemNotification("critical",`⚠️ שעות אוזלות: ${n.name}`,`נותרו ${o} שעות בלבד - יש ליידע את הלקוח ולהוסיף שעות`,!1)}),s&&s.length>0){const n=new Date;n.setHours(0,0,0,0),s.forEach(o=>{const r=new Date(o.deadline);r.setHours(0,0,0,0);const a=n-r,c=Math.floor(a/(1e3*60*60*24));let d,u,l;c>0?(d=`🔴 משימה באיחור: ${o.description||"ללא תיאור"}`,u=`עבר ${c} ${c===1?"יום":"ימים"} מתאריך היעד${o.clientName?` | לקוח: ${o.clientName}`:""}`,l=!0):c===0?(d=`⏰ משימה דחופה: ${o.description||"ללא תיאור"}`,u=`תאריך היעד היום!${o.clientName?` | לקוח: ${o.clientName}`:""}`,l=!0):(d=`📅 משימה מתקרבת: ${o.description||"ללא תיאור"}`,u=`תאריך יעד מחר${o.clientName?` | לקוח: ${o.clientName}`:""}`,l=!1),this.addSystemNotification("urgent",d,u,l)})}}addSystemNotification(e,t,s,n){const o={id:Date.now()+Math.random(),type:e,title:t,description:s,time:new Date().toLocaleString("he-IL"),urgent:n,isSystemGenerated:!0};this.notifications.unshift(o),this.updateBell(),this.renderNotifications()}openReplyModal(e,t,s){if(window.userReplyModal&&window.userReplyModal.open)window.userReplyModal.open(e,t,()=>{this.removeNotification("msg_"+e)});else{console.warn("⚠️ UserReplyModal not available, using fallback prompt");const n=prompt(`תגובה ל: ${s}

הודעה: ${t}

התגובה שלך:`);n&&n.trim()&&this.sendResponse(e,n.trim())}}async sendResponse(e,t){if(!window.firebaseDB){alert("שגיאה: Firebase לא זמין");return}try{await window.firebaseDB.collection("user_messages").doc(e).update({response:t,status:"responded",respondedAt:firebase.firestore.FieldValue.serverTimestamp()}),window.notify?window.notify.success("התגובה נשלחה בהצלחה"):alert("התגובה נשלחה בהצלחה!"),this.removeNotification("msg_"+e)}catch(s){console.error("Error sending response:",s),window.notify?window.notify.error("שגיאה בשליחת התגובה"):alert("שגיאה בשליחת התגובה")}}async sendReplyToAdmin(e,t,s){if(!e||!t||!s)throw new Error("Missing required parameters: messageId, replyText, or user");if(!window.firebaseDB)throw new Error("Firebase DB not available");try{const n=await window.firebaseDB.collection("user_messages").doc(e).collection("replies").add({from:s.email,fromName:s.displayName||s.email,message:t.trim(),createdAt:firebase.firestore.FieldValue.serverTimestamp(),readBy:[]});return await window.firebaseDB.collection("user_messages").doc(e).update({repliesCount:firebase.firestore.FieldValue.increment(1),lastReplyAt:firebase.firestore.FieldValue.serverTimestamp(),lastReplyBy:s.email,status:"responded"}),console.log(`✅ Reply sent successfully: ${n.id}`),n.id}catch(n){throw console.error("❌ Error sending reply:",n),n}}async loadThreadReplies(e){if(!e)throw new Error("Missing messageId parameter");if(!window.firebaseDB)throw new Error("Firebase DB not available");try{const s=(await window.firebaseDB.collection("user_messages").doc(e).collection("replies").orderBy("createdAt","asc").get()).docs.map(n=>{var o;return{id:n.id,...n.data(),createdAt:(o=n.data().createdAt)!=null&&o.toDate?n.data().createdAt.toDate():null}});return console.log(`📨 Loaded ${s.length} replies for message ${e}`),s}catch(t){throw console.error("❌ Error loading replies:",t),t}}listenToThreadReplies(e,t){if(!e||!t)throw new Error("Missing required parameters: messageId or callback");if(!window.firebaseDB)throw new Error("Firebase DB not available");try{const s=window.firebaseDB.collection("user_messages").doc(e).collection("replies").orderBy("createdAt","asc").onSnapshot(n=>{const o=n.docs.map(r=>{var a;return{id:r.id,...r.data(),createdAt:(a=r.data().createdAt)!=null&&a.toDate?r.data().createdAt.toDate():null}});console.log(`🔄 Thread updated: ${o.length} replies`),t(o)},n=>{console.error("❌ Error in thread listener:",n),t([])});return console.log(`👂 Listening to thread: ${e}`),s}catch(s){throw console.error("❌ Error setting up thread listener:",s),s}}}const oi={status:{פעיל:{padding:"5px 10px",fontSize:"10px",fontWeight:"500",borderRadius:"16px",background:"#f0f9ff",color:"#0369a1",border:"0.5px solid #bae6fd"},הושלם:{padding:"5px 10px",fontSize:"10px",fontWeight:"500",borderRadius:"16px",background:"#ecfdf5",color:"#047857",border:"0.5px solid #a7f3d0",icon:"✓"}}};function ri(i,e={}){if(!i||typeof i!="string")return i||"";const t=oi.status[i];if(!t)return`<span style="color: #6b7280;">${$(i)}</span>`;const s={fontWeight:t.fontWeight||"500",color:t.color||"#6b7280",display:"inline-block",padding:t.padding,fontSize:t.fontSize,borderRadius:t.borderRadius,background:t.background||t.gradient,border:t.border||"none",boxShadow:"none",...e},n=Object.entries(s).map(([r,a])=>`${r.replace(/([A-Z])/g,"-$1").toLowerCase()}: ${a}`).join("; "),o=t.icon?`${t.icon} `:"";return`
    <span style="${n}">
      ${o}${$(i)}
    </span>
  `}function $(i){if(!i)return"";const e=document.createElement("div");return e.textContent=i,e.innerHTML}function te(i,e,t,s=""){if(!i&&!e)return"";`${Date.now()}${Math.random().toString(36).substr(2,9)}`;const n=t==="legal_procedure"?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>';return`
    <div class="combined-info-badge" onclick="event.stopPropagation(); window.TimesheetConstants.showCombinedInfoPopup('${$(i)}', '${$(e)}', '${t}', '${$(s)}')">
      ${i?'<i class="fas fa-folder"></i>':""}
      ${e?n:""}
    </div>
  `}function ai(i,e,t,s=""){let n="";t==="legal_procedure"&&s&&(n={stage_a:"א'",stage_b:"ב'",stage_c:"ג'"}[s]||""),console.log("🎯 showCombinedInfoPopup called with:",{caseNumber:i,serviceName:e,serviceType:t,serviceId:s,mappedStage:n});const o=document.querySelector(".info-popup");o&&o.remove();const r=t==="legal_procedure"?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>',a=t==="legal_procedure"?"הליך משפטי":"שירות",c=`
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
            ">${$(i)}</strong>
          </div>
          `:""}
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
            ${r.replace(">",' style="color: #3b82f6; font-size: 16px; width: 20px; text-align: center;">')}
            <span style="
              color: #0369a1;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">${a}:</span>
            <strong style="
              color: #0c4a6e;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">${$(e)}</strong>
          </div>
          `:""}
          ${n&&t==="legal_procedure"?`
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
            ">שלב ${$(n)}</strong>
          </div>
          `:""}
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
  `;document.body.insertAdjacentHTML("beforeend",c),setTimeout(()=>{const u=document.querySelector(".info-popup");if(u){u.style.opacity="1";const l=u.querySelector(".info-popup-content");l&&(l.style.transform="scale(1)")}},10);const d=document.querySelector(".info-popup");d&&d.addEventListener("click",u=>{u.target===d&&Xe()})}function Xe(){const i=document.querySelector(".info-popup");if(i){i.style.opacity="0";const e=i.querySelector(".info-popup-content");e&&(e.style.transform="scale(0.95)"),setTimeout(()=>i.remove(),200)}}typeof window<"u"&&(window.TimesheetConstants={showCombinedInfoPopup:ai,closeInfoPopup:Xe});const Y={isMobile:!window.matchMedia("(hover: hover)").matches};function ye(i){return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1}function ci(i,e){if(!i||!e||i.classList.contains("has-description-tooltip")||!ye(i))return;i.classList.add("is-truncated");const t=document.createElement("i");t.className="fas fa-info-circle description-info-icon",t.setAttribute("title","לחץ לצפייה במלל המלא"),t.setAttribute("data-full-text",e),Y.isMobile&&(t.classList.add("mobile-only"),t.addEventListener("click",o=>{o.stopPropagation(),ie(e,i)}));const s=i.parentElement,n=s.querySelector(".combined-info-badge");n?s.insertBefore(t,n):s.appendChild(t),i.classList.add("has-description-tooltip")}function li(i){const e=document.createElement("div");e.className="description-tooltip";const t=document.createElement("div");return t.className="description-tooltip-content",t.textContent=i,e.appendChild(t),e}function di(i,e){if(!i||!e||i.querySelector(".description-tooltip"))return;const t=li(e);i.appendChild(t)}let k=null;function ie(i,e=null){k&&z();const t=document.createElement("div");t.className="description-popover-overlay",t.addEventListener("click",c=>{c.target===t&&z()});const s=document.createElement("div");s.className="description-popover";const n=document.createElement("div");n.className="description-popover-header";const o=document.createElement("div");o.className="description-popover-title",o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const r=document.createElement("button");r.className="description-popover-close",r.innerHTML='<i class="fas fa-times"></i>',r.setAttribute("aria-label","סגור"),r.addEventListener("click",z),n.appendChild(o),n.appendChild(r);const a=document.createElement("div");a.className="description-popover-body",a.textContent=i,s.appendChild(n),s.appendChild(a),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("active")}),k=t,document.addEventListener("keydown",et)}function z(){k&&(k.classList.remove("active"),setTimeout(()=>{k&&k.parentElement&&k.remove(),k=null},200),document.removeEventListener("keydown",et))}function et(i){i.key==="Escape"&&z()}function ui(i=document){const e=i.querySelectorAll(".td-description, .timesheet-cell-action, .task-description-cell");console.log("🔵 Description Tooltips: Found",e.length,"description cells"),e.forEach(t=>{const s=t.querySelector(".table-description-with-icons");if(!s)return;const n=s.querySelector("span");if(!n)return;const o=n.textContent.trim();if(!o)return;const r=ye(n);console.log("🔍 Checking truncation:",{text:o.substring(0,30)+"...",isTruncated:r,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),r&&(console.log("✅ Adding info icon for:",o.substring(0,30)+"..."),ci(n,o),Y.isMobile||di(t,o),Y.isMobile&&(t.style.cursor="pointer",t.addEventListener("click",a=>{a.target.closest(".combined-info-badge, .action-btn, button")||(a.stopPropagation(),ie(o,t))})))})}function mi(i){if(!i)return;const e=i.textContent.trim();if(!e||i.querySelector(".card-description-info-icon")||!ye(i))return;const t=document.createElement("span");t.className="linear-card-title-text",t.textContent=e,i.textContent="",i.appendChild(t);const s=document.createElement("i");if(s.className="fas fa-info-circle card-description-info-icon",s.setAttribute("title","לחץ לצפייה בתיאור המלא"),s.addEventListener("click",n=>{n.stopPropagation(),ie(e,i)}),i.appendChild(s),!Y.isMobile){const n=document.createElement("div");n.className="card-description-tooltip";const o=document.createElement("div");o.className="card-description-tooltip-content",o.textContent=e,n.appendChild(o),i.appendChild(n)}}function hi(i=document){i.querySelectorAll(".linear-card-title").forEach(t=>{mi(t)})}function Q(i=document){ui(i),hi(i)}function tt(i=document){i.querySelectorAll(".description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".card-description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".card-description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".has-description-tooltip").forEach(e=>{e.classList.remove("has-description-tooltip","is-truncated")}),i.querySelectorAll(".linear-card-title").forEach(e=>{const t=e.querySelector(".linear-card-title-text");t&&(e.textContent=t.textContent)}),requestAnimationFrame(()=>{setTimeout(()=>{console.log("⏰ Running truncation check after render..."),Q(i)},50)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Q()}):Q();let Me;window.addEventListener("resize",()=>{clearTimeout(Me),Me=setTimeout(()=>{tt()},300)});window.DescriptionTooltips={init:Q,refresh:tt,showPopover:ie,closePopover:z};async function it(i,e="active",t=50){var s;try{const n=window.firebaseDB;if(!n)throw new Error("Firebase לא מחובר");let o=n.collection("budget_tasks").where("employee","==",i),r,a=!1;try{e==="active"?o=o.where("status","!=","הושלם"):e==="completed"&&(o=o.where("status","==","הושלם").orderBy("completedAt","desc")),o=o.limit(t),r=await o.get()}catch(l){l.code!=="failed-precondition"&&!((s=l.message)!=null&&s.includes("index"))&&console.warn("⚠️ Unexpected error, using fallback:",l.message),a=!0;try{o=n.collection("budget_tasks").where("employee","==",i).limit(100),r=await o.get()}catch(m){console.error("Fallback also failed, loading basic query:",m),o=n.collection("budget_tasks").where("employee","==",i),r=await o.get()}}const c=[];r.forEach(l=>{const m=l.data(),h={...window.DatesModule.convertTimestampFields(m,["createdAt","updatedAt","completedAt","deadline"]),firebaseDocId:l.id};h.id||(h.id=l.id),c.push(h)});let d=c;a&&(e==="active"?d=c.filter(l=>l.status!=="הושלם"):e==="completed"&&(d=c.filter(l=>l.status==="הושלם").sort((l,m)=>{const h=l.completedAt?new Date(l.completedAt):new Date(0);return(m.completedAt?new Date(m.completedAt):new Date(0))-h})),d=d.slice(0,t));let u=a?d:c;return e==="active"?u=u.filter(l=>l.status!=="הושלם"):e==="completed"&&(u=u.filter(l=>l.status==="הושלם")),console.log(`✅ Loaded ${u.length} tasks (filter: ${e}, fallback: ${a})`),u}catch(n){throw console.error("Firebase error:",n),new Error("שגיאה בטעינת משימות: "+n.message)}}const U=async(i,e={})=>{try{return(await firebase.functions().httpsCallable(i)(e)).data}catch(t){throw console.error(`Error calling function ${i}:`,t),t.code==="unauthenticated"?new Error("נדרשת התחברות למערכת"):t.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו"):t.code==="invalid-argument"?new Error(t.message||"נתונים לא תקינים"):t.code==="not-found"?new Error("הפריט לא נמצא"):new Error(t.message||"שגיאה בביצוע הפעולה")}};function fi(){try{if(!window.firebaseDB)throw console.error("❌ Firebase Database לא זמין"),new Error("Firebase Database לא מחובר");return!0}catch(i){return console.error("❌ שגיאה באתחול Firebase:",i),!1}}async function ve(){try{const i=window.firebaseDB;if(!i)throw new Error("Firebase לא מחובר");const e=await i.collection("clients").get(),t=[];return e.forEach(s=>{const n=s.data(),o=s.id;t.push({...n,id:o,firestoreId:o,legacyId:n.id,source:"clients",fullName:n.fullName||n.clientName,fileNumber:n.fileNumber||n.caseNumber,casesCount:1,activeCasesCount:n.status==="active"?1:0,cases:[],hasVirtualCase:!1,type:n.type||n.procedureType||"hours"})}),Logger.log(`✅ טעינה הושלמה: ${e.size} לקוחות/תיקים | ${t.length} רשומות סה"כ`),t}catch(i){throw console.error("Firebase error:",i),new Error("שגיאה בטעינת לקוחות: "+i.message)}}async function J(i){try{const e=window.firebaseDB;if(!e)throw new Error("Firebase לא מחובר");const t=await e.collection("timesheet_entries").where("employee","==",i).limit(50).get(),s=[];return t.forEach(n=>{const o=n.data(),r=window.DatesModule.convertTimestampFields(o,["createdAt","updatedAt"]);s.push({id:n.id,...r})}),s.sort((n,o)=>n.date?o.date?new Date(o.date)-new Date(n.date):-1:1),s}catch(e){throw console.error("Firebase error:",e),new Error("שגיאה בטעינת שעתון: "+e.message)}}async function st(i){var e,t;console.warn('⚠️ [DEPRECATED] saveBudgetTaskToFirebase is deprecated. Use FirebaseService.call("createBudgetTask") instead.');try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const s=await U("createBudgetTask",i);if(!s.success)throw new Error(s.message||"שגיאה בשמירת משימה");return s.taskId}catch(s){throw console.error("Firebase error:",s),(e=s.message)!=null&&e.includes("אין חיבור לאינטרנט")?s:s.code==="unavailable"||(t=s.message)!=null&&t.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):s.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):s}}async function nt(i){var e,t;console.warn('⚠️ [DEPRECATED] saveTimesheetToFirebase is deprecated. Use FirebaseService.call("createTimesheetEntry") instead.');try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const s=await U("createTimesheetEntry",i);if(!s.success)throw new Error(s.message||"שגיאה בשמירת שעתון");return s.entryId}catch(s){throw console.error("Firebase error:",s),(e=s.message)!=null&&e.includes("אין חיבור לאינטרנט")?s:s.code==="unavailable"||(t=s.message)!=null&&t.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):s.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):s}}async function ot(i,e,t){var s,n,o;console.log("✅ [v2.0] Using Enterprise accuracy mode");try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const r=await U("createTimesheetEntry_v2",{...i,expectedVersion:e,idempotencyKey:t});if(!r.success)throw new Error(r.message||"שגיאה בשמירת שעתון");return console.log(`✅ [v2.0] Timesheet saved: ${r.entryId}, Version: ${r.version}`),{entryId:r.entryId,version:r.version,entry:r.entry}}catch(r){throw console.error("❌ [v2.0] Firebase error:",r),r.code==="aborted"&&((s=r.message)!=null&&s.includes("CONFLICT"))?new Error(`המסמך שונה על ידי משתמש אחר. אנא רענן את הדף ונסה שוב.

הסיבה: גרסה לא תואמת - מישהו אחר עדכן את הלקוח בינתיים.`):(n=r.message)!=null&&n.includes("אין חיבור לאינטרנט")?r:r.code==="unavailable"||(o=r.message)!=null&&o.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):r.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):r}}async function rt(i,e,t=""){console.warn('⚠️ [DEPRECATED] updateTimesheetEntryFirebase is deprecated. Use FirebaseService.call("updateTimesheetEntry") instead.');try{const s=await U("updateTimesheetEntry",{entryId:String(i),minutes:e,reason:t});if(!s.success)throw new Error(s.message||"שגיאה בעדכון שעתון");return s}catch(s){throw console.error("Firebase error:",s),s}}async function at(i,e){console.warn('⚠️ [DEPRECATED] addTimeToTaskFirebase is deprecated. Use FirebaseService.call("addTimeToTask") instead.');try{const t=await U("addTimeToTask",{taskId:String(i),minutes:parseInt(e.minutes),date:e.date,description:e.description});if(!t.success)throw new Error(t.message||"שגיאה בהוספת זמן למשימה");return t}catch(t){throw console.error("❌ שגיאה בהוספת זמן למשימה:",t),t}}async function ct(i,e=""){console.warn('⚠️ [DEPRECATED] completeTaskFirebase is deprecated. Use FirebaseService.call("completeTask") instead.');try{const t=await U("completeTask",{taskId:String(i),completionNotes:e});if(!t.success)throw new Error(t.message||"שגיאה בהשלמת משימה");return t}catch(t){throw console.error("❌ שגיאה בהשלמת משימה:",t),t}}async function lt(i,e,t=""){console.warn('⚠️ [DEPRECATED] extendTaskDeadlineFirebase is deprecated. Use FirebaseService.call("extendTaskDeadline") instead.');try{const s=await U("extendTaskDeadline",{taskId:String(i),newDeadline:e,reason:t});if(!s.success)throw new Error(s.message||"שגיאה בהארכת תאריך יעד");return s}catch(s){throw console.error("❌ שגיאה בהארכת תאריך יעד:",s),s}}class P{static async execute(e){var v,S,T,I,N;const{loadingMessage:t,message:s,animationType:n="loading",action:o,successMessage:r,errorMessage:a="שגיאה בביצוע הפעולה",onSuccess:c=null,onError:d=null,onFinally:u=null,closePopupOnSuccess:l=!1,popupSelector:m=".popup-overlay",closeDelay:h=500,minLoadingDuration:p=200}=e,g=t||s||"מעבד...";if(typeof o!="function")return console.error("❌ ActionFlowManager: action must be a function"),{success:!1,error:new Error("Invalid action parameter")};let f=null,w=null;try{w=Date.now(),window.NotificationSystem?window.NotificationSystem.showLoading(g,{animationType:n}):(v=window.showSimpleLoading)==null||v.call(window,g),f=await o();const M=Date.now()-w,_=p-M;return _>0&&(Logger.log(`⏱️ Waiting ${_}ms to reach minimum loading duration...`),await new Promise(C=>setTimeout(C,_))),window.NotificationSystem?window.NotificationSystem.hideLoading():(S=window.hideSimpleLoading)==null||S.call(window),await new Promise(C=>setTimeout(C,100)),r&&(window.NotificationSystem?window.NotificationSystem.success(r,5e3):(T=window.showNotification)==null||T.call(window,r,"success")),c&&typeof c=="function"&&await c(f),l&&setTimeout(()=>{const C=document.querySelector(m);C&&C.remove()},h),{success:!0,data:f}}catch(M){console.error("❌ ActionFlowManager error:",M);const _=Date.now()-w,C=p-_;C>0&&(Logger.log(`⏱️ Waiting ${C}ms even on error...`),await new Promise(ne=>setTimeout(ne,C))),window.NotificationSystem?window.NotificationSystem.hideLoading():(I=window.hideSimpleLoading)==null||I.call(window),await new Promise(ne=>setTimeout(ne,100));const Ce=`${a}: ${M.message||"שגיאה לא ידועה"}`;return window.NotificationSystem?window.NotificationSystem.error(Ce,5e3):(N=window.showNotification)==null||N.call(window,Ce,"error"),d&&typeof d=="function"&&await d(M),{success:!1,error:M}}finally{u&&typeof u=="function"&&await u()}}static async executeWithFormReset(e){const{formId:t,formContainerId:s,...n}=e,o=n.onSuccess;return this.execute({...n,onSuccess:async r=>{if(t){const a=document.getElementById(t);a&&a.reset()}if(s){const a=document.getElementById(s);a&&a.classList.add("hidden");const c=document.getElementById("smartPlusBtn");c&&c.classList.remove("active")}o&&await o(r)}})}}function be(i){const e=document.getElementById("currentUserDisplay");e&&i&&(e.textContent=`${i} - משרד עו"ד גיא הרשקוביץ`)}function gi(i){const e=document.querySelector(".user-avatar");if(e&&i){e.setAttribute("title",`מחובר: ${i}`),e.setAttribute("data-user",i);const t=["linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)","linear-gradient(135deg, #10b981 0%, #059669 100%)","linear-gradient(135deg, #f59e0b 0%, #d97706 100%)","linear-gradient(135deg, #ef4444 0%, #dc2626 100%)","linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)","linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)","linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)","linear-gradient(135deg, #84cc16 0%, #65a30d 100%)"],s=i.charCodeAt(0)%t.length;e.style.background=t[s],e.style.transform="scale(1.05)",setTimeout(()=>{e.style.transform=""},300)}}function Te(){const i=document.getElementById("loginSection"),e=document.getElementById("forgotPasswordSection"),t=document.getElementById("welcomeScreen"),s=document.getElementById("appContent"),n=document.getElementById("minimalSidebar"),o=document.getElementById("interfaceElements"),r=document.getElementById("mainFooter"),a=document.getElementById("bubblesContainer");i&&i.classList.remove("hidden"),e&&e.classList.add("hidden"),t&&t.classList.add("hidden"),s&&s.classList.add("hidden"),n&&n.classList.add("hidden"),o&&o.classList.add("hidden"),r&&r.classList.add("hidden"),a&&a.classList.remove("hidden"),document.body.classList.remove("logged-in")}async function De(){const i=document.getElementById("email").value,e=document.getElementById("password").value,t=document.getElementById("errorMessage");if(!i||!e){t&&(t.textContent="אנא מלא את כל השדות",t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3));return}try{window.isInWelcomeScreen=!0;const s=await firebase.auth().signInWithEmailAndPassword(i,e),n=s.user.email,o=s.user.uid,r=await window.firebaseDB.collection("employees").doc(n).get();if(!r.exists)throw new Error("משתמש לא נמצא במערכת");const a=r.data();this.currentUid=o,this.currentUser=a.email,this.currentUsername=a.username||a.name,be(this.currentUsername),await this.showWelcomeScreen();try{await this.loadData(),this.activityLogger&&await this.activityLogger.logLogin();try{await window.firebaseDB.collection("employees").doc(this.currentUser).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),Logger.log("✅ lastLogin updated successfully")}catch(c){console.warn("⚠️ Failed to update lastLogin:",c.message)}if(window.PresenceSystem)try{await Promise.race([window.PresenceSystem.connect(this.currentUid,this.currentUsername,this.currentUser),new Promise((c,d)=>setTimeout(()=>d(new Error("PresenceSystem timeout")),5e3))]),Logger.log("✅ PresenceSystem connected successfully")}catch(c){console.warn("⚠️ PresenceSystem failed (non-critical):",c.message)}}catch(c){this.showNotification("שגיאה בטעינת נתונים","error"),console.error("Error loading data:",c)}await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.initSecurityModules&&this.initSecurityModules(),this.showApp()}catch(s){console.error("Login error:",s),window.isInWelcomeScreen=!1;let n="אימייל או סיסמה שגויים";s.code==="auth/user-not-found"?n="משתמש לא נמצא":s.code==="auth/wrong-password"?n="סיסמה שגויה":s.code==="auth/invalid-email"?n="כתובת אימייל לא תקינה":s.code==="auth/user-disabled"&&(n="חשבון זה הושבת. צור קשר עם המנהל"),t&&(t.textContent=n,t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3))}}async function pi(){const i=document.getElementById("loginSection"),e=document.getElementById("welcomeScreen"),t=document.getElementById("welcomeTitle"),s=document.getElementById("lastLoginTime"),n=document.getElementById("bubblesContainer");if(i&&i.classList.add("hidden"),t&&(t.textContent=`ברוך הבא, ${this.currentUsername}`),e&&e.classList.remove("hidden"),n&&n.classList.remove("hidden"),this.welcomeScreenStartTime=Date.now(),s)try{const o=await window.firebaseDB.collection("employees").doc(this.currentUser).get();if(o.exists){const r=o.data();if(r.lastLogin&&r.lastLogin.toDate){const c=r.lastLogin.toDate().toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});s.textContent=c}else s.textContent="זו הכניסה הראשונה שלך"}else s.textContent="זו הכניסה הראשונה שלך"}catch(o){console.error("⚠️ Failed to load lastLogin from Firebase:",o),s.textContent="זו הכניסה הראשונה שלך"}}async function wi(){const i=Date.now()-this.welcomeScreenStartTime,e=Math.max(0,3e3-i);e>0&&await new Promise(t=>setTimeout(t,e))}function yi(i){if(!window.isInWelcomeScreen)return;const e=document.getElementById("loaderText");e&&(e.textContent=i)}function vi(){const i=document.getElementById("loginSection"),e=document.getElementById("welcomeScreen"),t=document.getElementById("appContent"),s=document.getElementById("interfaceElements"),n=document.getElementById("minimalSidebar"),o=document.getElementById("mainFooter"),r=document.getElementById("bubblesContainer");i&&i.classList.add("hidden"),e&&e.classList.add("hidden"),t&&t.classList.remove("hidden"),s&&s.classList.remove("hidden"),n&&n.classList.remove("hidden"),o&&o.classList.remove("hidden"),r&&r.classList.add("hidden"),document.body.classList.add("logged-in");const a=document.getElementById("userInfo");a&&(a.innerHTML=`
      <span>שלום ${this.currentUsername}</span>
      <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
    `,a.classList.remove("hidden")),setTimeout(()=>{gi(this.currentUsername)},500)}function dt(){if(window.NotificationSystem&&typeof window.NotificationSystem.confirm=="function"){console.log("✅ Using NotificationSystem.confirm"),window.NotificationSystem.confirm("האם אתה בטוח שברצונך לצאת? כל הנתונים שלא נשמרו יאבדו.",()=>window.confirmLogout(),null,{title:"יציאה מהמערכת",confirmText:"כן, צא מהמערכת",cancelText:"ביטול",type:"warning"});return}console.log("⚠️ Using Fallback popup (NotificationSystem not available)");const i=document.createElement("div");i.className="popup-overlay show",i.style.cssText="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);",i.innerHTML=`
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
  `,document.body.appendChild(i)}async function bi(){const i=document.getElementById("interfaceElements");i&&i.classList.add("hidden"),window.NotificationSystem?window.NotificationSystem.info("מתנתק מהמערכת... להתראות! 👋",3e3):window.manager&&window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋","info"),window.PresenceSystem&&await window.PresenceSystem.disconnect(),window.CaseNumberGenerator&&window.CaseNumberGenerator.cleanup(),await firebase.auth().signOut(),setTimeout(()=>location.reload(),1500)}function Ti(){const i=document.getElementById("loginSection"),e=document.getElementById("forgotPasswordSection"),t=document.getElementById("bubblesContainer");i&&i.classList.add("hidden"),e&&e.classList.remove("hidden"),t&&t.classList.remove("hidden");const s=document.getElementById("resetEmail");s&&(s.value="");const n=document.getElementById("resetErrorMessage"),o=document.getElementById("resetSuccessMessage");n&&n.classList.add("hidden"),o&&o.classList.add("hidden")}async function Ei(i){var n,o;i.preventDefault();const e=(o=(n=document.getElementById("resetEmail"))==null?void 0:n.value)==null?void 0:o.trim(),t=document.getElementById("resetErrorMessage"),s=document.getElementById("resetSuccessMessage");if(!e){t&&(t.textContent="אנא הזן כתובת אימייל",t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3));return}try{const r={url:window.location.origin+"/reset-password.html",handleCodeInApp:!1};await firebase.auth().sendPasswordResetEmail(e,r),s&&s.classList.remove("hidden"),t&&t.classList.add("hidden"),window.NotificationSystem&&window.NotificationSystem.success("📧 קישור לאיפוס סיסמה נשלח למייל שלך. בדוק את תיבת הדואר.",5e3),setTimeout(()=>{Te.call(this)},3e3)}catch(r){console.error("Password reset error:",r),console.error("Error code:",r.code),console.error("Error message:",r.message);let a="שגיאה בשליחת מייל לאיפוס סיסמה";r.code==="auth/user-not-found"?a="משתמש עם כתובת מייל זו לא נמצא במערכת":r.code==="auth/invalid-email"?a="כתובת אימייל לא תקינה":r.code==="auth/too-many-requests"?a="יותר מדי ניסיונות. נסה שוב מאוחר יותר":r.code==="auth/missing-continue-uri"||r.code==="auth/invalid-continue-uri"?a="שגיאת הגדרות Firebase - פנה למפתח":r.code==="auth/unauthorized-continue-uri"?a="שגיאת הרשאות Firebase - פנה למפתח":a=`שגיאה: ${r.code||"unknown"} - בדוק את ה-Console`,t&&(t.textContent=a,t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),5e3)),s&&s.classList.add("hidden"),window.NotificationSystem&&window.NotificationSystem.error(a,5e3)}}function Si(i){const e=document.querySelector(".password-input-section"),t=document.querySelector(".phone-input-section"),s=document.querySelector(".otp-input-section");e&&e.classList.remove("active"),t&&t.classList.remove("active"),s&&s.classList.remove("active"),document.querySelectorAll(".auth-method-btn").forEach(o=>{o.classList.remove("active")}),i==="password"?e&&e.classList.add("active"):i==="sms"&&t&&t.classList.add("active");const n=document.querySelector(`.auth-method-btn[data-method="${i}"]`);n&&n.classList.add("active"),loginMethods.switchMethod(i)}async function Ci(){const i=document.getElementById("phoneNumber"),e=document.getElementById("smsErrorMessage");if(!i||!i.value){e&&(e.textContent="אנא הזן מספר טלפון",e.classList.remove("hidden"));return}try{const t=document.getElementById("sendOTPBtn");t&&(t.disabled=!0,t.classList.add("loading")),await loginMethods.methods.sms.handler.sendOTP(i.value);const s=document.querySelector(".phone-input-section"),n=document.querySelector(".otp-input-section");if(s&&s.classList.remove("active"),n){n.classList.add("active");const o=document.querySelector(".otp-phone-display");o&&(o.textContent=loginMethods.methods.sms.handler.constructor.formatForDisplay(i.value));const r=document.querySelector(".otp-input");r&&r.focus(),Mi()}}catch(t){console.error("SMS login error:",t),e&&(e.textContent=t.message||"שגיאה בשליחת SMS",e.classList.remove("hidden"))}finally{const t=document.getElementById("sendOTPBtn");t&&(t.disabled=!1,t.classList.remove("loading"))}}async function Bi(){const i=document.querySelectorAll(".otp-input"),e=document.getElementById("otpErrorMessage");let t="";if(i.forEach(s=>{t+=s.value}),t.length!==6){e&&(e.textContent="אנא הזן קוד בן 6 ספרות",e.classList.remove("hidden"));return}try{const s=document.getElementById("verifyOTPBtn");s&&(s.disabled=!0,s.textContent="מאמת...");const n=await loginMethods.methods.sms.handler.verifyOTP(t);this.currentUser=n.employeeData.email,this.currentUsername=n.employeeData.username||n.employeeData.name,be(this.currentUsername),await this.showWelcomeScreen(),await this.loadData(),this.initSecurityModules&&this.initSecurityModules(),await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.showApp()}catch(s){console.error("OTP verification error:",s),i.forEach(n=>{n.classList.add("error"),setTimeout(()=>n.classList.remove("error"),500)}),e&&(e.textContent=s.message||"קוד שגוי",e.classList.remove("hidden"))}finally{const s=document.getElementById("verifyOTPBtn");s&&(s.disabled=!1,s.textContent="אמת קוד")}}function Mi(){let i=300;const e=document.querySelector(".otp-timer-countdown"),t=document.querySelector(".resend-otp-btn");t&&(t.disabled=!0);const s=setInterval(()=>{if(i--,e){const n=Math.floor(i/60),o=i%60;e.textContent=`${n}:${o.toString().padStart(2,"0")}`}i<=0&&(clearInterval(s),e&&(e.textContent="פג תוקף"),t&&(t.disabled=!1))},1e3);return s}function Di(i){const e=document.getElementById("budgetFormContainer"),t=document.getElementById("timesheetFormContainer");e&&e.classList.add("hidden"),t&&t.classList.add("hidden");const s=document.getElementById("smartPlusBtn");if(s&&s.classList.remove("active"),document.querySelectorAll(".tab-button, .top-nav-btn").forEach(n=>{n.classList.remove("active")}),document.querySelectorAll(".tab-content").forEach(n=>{n.classList.remove("active")}),i==="budget"){const n=document.getElementById("budgetTab");n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="budget"], .top-nav-btn[onclick*="budget"]').forEach(o=>{o.classList.add("active")})}else if(i==="timesheet"){const n=document.getElementById("timesheetTab");if(n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="timesheet"], .top-nav-btn[onclick*="timesheet"]').forEach(r=>{r.classList.add("active")}),document.getElementById("actionDate")&&window.manager&&window.manager.timesheetCalendar){const r=new Date;window.manager.timesheetCalendar.setDate(r,!1)}}else if(i==="reports"){const n=document.getElementById("reportsTab");n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(o=>{o.classList.add("active")}),s&&(s.style.display="none"),typeof manager<"u"&&manager.initReportsForm&&manager.initReportsForm()}i!=="reports"&&s&&(s.style.display="",s.style.visibility="visible",s.style.opacity="1"),window.currentActiveTab=i}function Li(){window.notificationBell&&window.notificationBell.toggleDropdown()}function Ii(){const i=window.notificationSystem||new NotificationSystem;i.confirm("כל ההתראות יימחקו ולא ניתן יהיה לשחזר אותן.",()=>{window.notificationBell&&(window.notificationBell.clearAllNotifications(),i.show("כל ההתראות נמחקו בהצלחה","success"))},()=>{Logger.log("ביטול מחיקת התראות")},{title:"⚠️ מחיקת כל ההתראות",confirmText:"מחק הכל",cancelText:"ביטול",type:"warning"})}function ki(){const i=document.getElementById("smartPlusBtn"),e=document.querySelector(".tab-button.active");if(!e)return;let t,s;e.onclick&&e.onclick.toString().includes("budget")?(t=document.getElementById("budgetFormContainer"),s="budget"):e.onclick&&e.onclick.toString().includes("timesheet")&&(t=document.getElementById("timesheetFormContainer"),s="timesheet"),t&&(t.classList.contains("hidden")?(t.classList.remove("hidden"),i&&i.classList.add("active"),window.ClientCaseSelectorsManager&&(s==="budget"?(Logger.log("🎯 Opening budget form - initializing selectors..."),window.ClientCaseSelectorsManager.initializeBudget(),window.ClientCaseSelectorsManager.clearBudgetDescription(),window.ClientCaseSelectorsManager.initializeBudgetDescription()):s==="timesheet"&&(Logger.log("🎯 Opening timesheet form - initializing selector..."),window.ClientCaseSelectorsManager.initializeTimesheet()))):(t.classList.add("hidden"),i&&i.classList.remove("active")))}class xi{constructor(e){this.manager=e,this.blockedClients=new Set,this.criticalClients=new Set,this.blockedClientsData=[],this.criticalClientsData=[]}updateBlockedClients(){if(this.blockedClients.clear(),this.criticalClients.clear(),this.blockedClientsData=[],this.criticalClientsData=[],!(!this.manager.clients||!Array.isArray(this.manager.clients))){for(const e of this.manager.clients)e&&(e.isBlocked?(this.blockedClients.add(e.fullName),this.blockedClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining||0})):e.type==="hours"&&typeof e.hoursRemaining=="number"&&e.hoursRemaining<=5&&e.hoursRemaining>0&&(this.criticalClients.add(e.fullName),this.criticalClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining})));this.updateNotificationBell()}}updateNotificationBell(){const e=new Date,t=new Date(e.getTime()+24*60*60*1e3),s=(this.manager.budgetTasks||[]).filter(n=>n&&n.status!=="הושלם"&&n.deadline&&n.description&&new Date(n.deadline)<=t);window.notificationBell&&window.notificationBell.updateFromSystem(this.blockedClientsData,this.criticalClientsData,s)}validateClientSelection(e,t="רישום"){return this.blockedClients.has(e)?(this.showBlockedClientDialog(e,t),!1):!0}showBlockedClientDialog(e,t){const s=document.createElement("div");s.className="popup-overlay";const n=document.createElement("div");n.className="client-name",n.textContent=e;const o=document.createElement("div");o.className="action-blocked",o.textContent=`לא ניתן לבצע ${t} עבור לקוח זה`,s.innerHTML=`
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
    `,document.body.appendChild(s),setTimeout(()=>s.classList.add("show"),10),setTimeout(()=>{document.body.contains(s)&&s.remove()},1e4)}}async function K(i){try{const e=window.firebaseDB;if(!e)throw new Error("Firebase לא מחובר");const t=await e.collection("clients").where("fullName","==",i).get();if(t.empty)throw new Error("לקוח לא נמצא");const s=t.docs[0].data(),n=await e.collection("timesheet_entries").where("clientName","==",i).get();let o=0;const r={};n.forEach(g=>{const f=g.data(),w=f.minutes||0,v=f.employee||f.lawyer||"לא ידוע";o+=w,r[v]||(r[v]=0),r[v]+=w});const a=s.totalHours||0,c=a*60,d=Math.max(0,c-o),u=d/60;let l="פעיל",m=!1,h=!1;return s.type==="hours"&&(d<=0?(l="חסום - נגמרו השעות",m=!0):u<=5&&(l="קריטי - מעט שעות",h=!0)),{clientName:i,clientData:s,totalHours:a,totalMinutesUsed:o,remainingHours:Math.round(u*100)/100,remainingMinutes:d,status:l,isBlocked:m,isCritical:h,entriesCount:n.size,entriesByLawyer:r,uniqueLawyers:Object.keys(r),lastCalculated:new Date}}catch(e){throw console.error("שגיאה בחישוב שעות:",e),e}}async function Ee(i,e){try{const t=window.firebaseDB;if(!t)throw new Error("Firebase לא מחובר");const s=await t.collection("clients").where("fullName","==",i).get();if(s.empty)return console.warn(`⚠️ לקוח ${i} לא נמצא - לא ניתן לעדכן שעות`),{success:!1,message:"לקוח לא נמצא"};const n=s.docs[0];if(n.data().type!=="hours")return{success:!0,message:"לקוח פיקס - לא נדרש עדכון"};const r=await K(i);if(await n.ref.update({minutesRemaining:Math.max(0,r.remainingMinutes),hoursRemaining:Math.max(0,r.remainingHours),lastActivity:firebase.firestore.FieldValue.serverTimestamp(),lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),totalMinutesUsed:r.totalMinutesUsed,isBlocked:r.isBlocked,isCritical:r.isCritical}),window.manager&&window.manager.clients){const a=window.manager.clients.findIndex(c=>c.fullName===i);a!==-1&&(window.manager.clients[a].hoursRemaining=Math.max(0,r.remainingHours),window.manager.clients[a].minutesRemaining=Math.max(0,r.remainingMinutes),window.manager.clients[a].isBlocked=r.isBlocked,window.manager.clients[a].isCritical=r.isCritical,window.manager.clients[a].totalMinutesUsed=r.totalMinutesUsed,window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients())}return{success:!0,hoursData:r,newHoursRemaining:r.remainingHours,newMinutesRemaining:r.remainingMinutes,isBlocked:r.isBlocked,isCritical:r.isCritical}}catch(t){throw console.error("❌ שגיאה בעדכון שעות לקוח:",t),new Error("שגיאה בעדכון שעות: "+t.message)}}function $i(i){const e=document.getElementById("budgetForm");e&&e.reset()}function Ai(i){const e=document.getElementById("timesheetForm");if(e&&e.reset(),i&&i.timesheetCalendar){const t=new Date;i.timesheetCalendar.setDate(t,!1)}}function Fi(i,e){const t=i.timesheetEntries.find(o=>o.id&&o.id.toString()===e.toString()||o.entryId&&o.entryId.toString()===e.toString());if(!t){i.showNotification("רשומת שעתון לא נמצאה","error"),console.error("❌ רשומה לא נמצאה:",e);return}let s="";try{s=new Date(t.date).toISOString().split("T")[0]}catch{s=new Date().toISOString().split("T")[0]}const n=document.createElement("div");n.className="popup-overlay",n.innerHTML=`
    <div class="popup edit-timesheet-popup" style="max-width: 600px;">
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <div class="task-overview">
          <h3>
            <i class="fas fa-info-circle"></i>
            רשומה מקורית
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; color: #6b7280; background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>תאריך מקורי:</strong> ${q(t.date)}</p>
            <p><strong>לקוח מקורי:</strong> ${y(t.clientName)}</p>
            <p><strong>זמן מקורי:</strong> ${t.minutes} דקות</p>
            <p><strong>פעולה:</strong> ${y(t.action)}</p>
          </div>
        </div>

        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">תאריך <span class="required">*</span></label>
              <input
                type="date"
                id="editDate"
                value="${s}"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  transition: all 0.2s ease;
                "
              >
            </div>

            <div class="form-group">
              <label for="editMinutes">זמן (דקות) <span class="required">*</span></label>
              <input
                type="number"
                id="editMinutes"
                min="1"
                max="999"
                value="${t.minutes}"
                required
                placeholder="60"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  text-align: center;
                  transition: all 0.2s ease;
                "
              >
            </div>
          </div>

          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <div class="modern-client-search">
              <input
                type="text"
                class="search-input"
                id="editClientSearch"
                placeholder="התחל להקליד שם לקוח..."
                value="${y(t.clientName)}"
                autocomplete="off"
                oninput="manager.searchClientsForEdit(this.value)"
                style="
                  width: 100%;
                  padding: 12px 16px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                "
              />
              <div
                class="search-results"
                id="editClientSearchResults"
                style="
                  position: absolute;
                  top: 100%;
                  left: 0;
                  right: 0;
                  background: white;
                  border: 1px solid #d1d5db;
                  border-top: none;
                  border-radius: 0 0 8px 8px;
                  max-height: 200px;
                  overflow-y: auto;
                  z-index: 1000;
                  display: none;
                "
              ></div>
              <input
                type="hidden"
                id="editClientSelect"
                value="${y(t.clientName)}"
                required
              />
            </div>
            <small class="form-help">
              <i class="fas fa-search"></i>
              התחל להקליד לחיפוש לקוחות קיימים
            </small>
          </div>

          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea
              id="editReason"
              rows="3"
              placeholder="הסבר מדוע אתה משנה את הפרטים (חובה למעקב)"
              required
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                resize: vertical;
                transition: all 0.2s ease;
              "
            ></textarea>
            <small class="form-help">
              <i class="fas fa-exclamation-circle"></i>
              סיבת העריכה נדרשת למעקב ובקרה
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${e}')" style="min-width: 140px;">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `,document.body.appendChild(n),setTimeout(()=>n.classList.add("show"),10),setTimeout(()=>{n.querySelectorAll("input, textarea").forEach(a=>{a.addEventListener("focus",function(){this.style.borderColor="#3b82f6",this.style.boxShadow="0 0 0 3px rgba(59, 130, 246, 0.1)"}),a.addEventListener("blur",function(){this.style.borderColor="#e1e5e9",this.style.boxShadow="none"})});const r=document.getElementById("editMinutes");r&&(r.select(),r.focus())},100)}function Ni(i,e){const t=document.getElementById("editClientSearchResults"),s=document.getElementById("editClientSelect");window.ClientSearch.searchClientsUpdateDOM(i.clients,e,{resultsContainer:t,hiddenInput:s},"manager.selectClientForEdit",{fileNumberColor:"#9ca3af"})}function _i(i,e,t){const s=document.getElementById("editClientSearch"),n=document.getElementById("editClientSelect"),o=document.getElementById("editClientSearchResults");s&&n&&o&&(s.value=e,n.value=e,o.style.display="none",s.style.background="#ecfdf5",s.style.borderColor="#10b981",setTimeout(()=>{s.style.background="white",s.style.borderColor="#e1e5e9"},500))}async function R(i,e="active",t=50){var s;try{const n=window.firebaseDB;if(!n)throw new Error("Firebase לא מחובר");let o=n.collection("budget_tasks").where("employee","==",i),r,a=!1;try{e==="active"?o=o.where("status","!=","הושלם"):e==="completed"&&(o=o.where("status","==","הושלם").orderBy("completedAt","desc")),o=o.limit(t),r=await o.get()}catch(l){l.code!=="failed-precondition"&&!((s=l.message)!=null&&s.includes("index"))&&console.warn("⚠️ Unexpected error, using fallback:",l.message),a=!0;try{o=n.collection("budget_tasks").where("employee","==",i).limit(100),r=await o.get()}catch(m){console.error("Fallback also failed, loading basic query:",m),o=n.collection("budget_tasks").where("employee","==",i),r=await o.get()}}const c=[];r.forEach(l=>{const m=l.data(),h={...window.DatesModule.convertTimestampFields(m,["createdAt","updatedAt","completedAt","deadline"]),firebaseDocId:l.id};h.id||(h.id=l.id),c.push(h)});let d=c;a&&(e==="active"?d=c.filter(l=>l.status!=="הושלם"):e==="completed"&&(d=c.filter(l=>l.status==="הושלם").sort((l,m)=>{const h=l.completedAt?new Date(l.completedAt):new Date(0);return(m.completedAt?new Date(m.completedAt):new Date(0))-h})),d=d.slice(0,t));let u=a?d:c;return e==="active"?u=u.filter(l=>l.status!=="הושלם"):e==="completed"&&(u=u.filter(l=>l.status==="הושלם")),console.log(`✅ Loaded ${u.length} tasks (filter: ${e}, fallback: ${a})`),u}catch(n){throw console.error("Firebase error:",n),new Error("שגיאה בטעינת משימות: "+n.message)}}function Ri(i,e,t){j(async()=>{const{startTasksListener:s}=await import("./real-time-listeners-BzLKVeci.js");return{startTasksListener:s}},[]).then(({startTasksListener:s})=>s(i,e,t)).catch(s=>{console.error("❌ Error importing real-time-listeners:",s),t&&t(s)})}function ut(i){if(!i)return{};let e=i.deadline;return i.deadline&&window.DatesModule&&(e=window.DatesModule.convertFirebaseTimestamp(i.deadline)),(!e||e instanceof Date&&isNaN(e.getTime()))&&(e=new Date),{id:i.id||Date.now(),clientName:i.clientName||"לקוח לא ידוע",description:i.taskDescription||i.description||"משימה ללא תיאור",taskDescription:i.taskDescription||i.description||"משימה ללא תיאור",estimatedHours:Number(i.estimatedHours)||0,actualHours:Number(i.actualHours)||0,estimatedMinutes:Number(i.estimatedMinutes)||(Number(i.estimatedHours)||0)*60,actualMinutes:Number(i.actualMinutes)||(Number(i.actualHours)||0)*60,deadline:e,status:i.status||"פעיל",branch:i.branch||"",fileNumber:i.fileNumber||"",history:i.history||[],createdAt:i.createdAt||null,updatedAt:i.updatedAt||null,caseId:i.caseId||null,caseTitle:i.caseTitle||null,caseNumber:i.caseNumber||null,serviceName:i.serviceName||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null}}function mt(i){return!i.estimatedMinutes||i.estimatedMinutes<=0?(i._warnedNoEstimate||(console.warn("⚠️ Task missing estimatedMinutes:",i.id),i._warnedNoEstimate=!0),0):Math.round((i.actualMinutes||0)/i.estimatedMinutes*100)}function Ui(i){return i>=100?"red":i>=85?"orange":"blue"}function Pi(i,e,t,s,n,o,r,a,c){if(!window.SVGRings)return"";const d=new Date,u=new Date(i.deadline),l=i.createdAt?new Date(i.createdAt):d,m=l<u?l:u,h=Math.max(1,(u-m)/(1e3*60*60*24)),p=(d-m)/(1e3*60*60*24),g=Math.max(0,Math.round(p/h*100)),f=c<0,w=Math.abs(Math.min(0,c)),v={progress:e,color:Ui(e),icon:"fas fa-clock",label:"תקציב זמן",value:`${t}ש / ${s}ש`,size:80,button:r?{text:o?"עדכן שוב":"עדכן תקציב",onclick:`event.stopPropagation(); manager.showAdjustBudgetDialog('${i.id}')`,icon:"fas fa-edit",cssClass:"budget-btn",show:!0}:null},S=i.deadlineExtensions&&i.deadlineExtensions.length>0;let T="blue";g>=100?T="red":g>=85&&(T="orange"),g>100&&console.log(`🔍 Task ${i.id.substring(0,8)}: deadlineProgress = ${g}%`);const I={progress:g,color:T,icon:"fas fa-calendar-alt",label:"תאריך יעד",value:f?`איחור ${w} ${w===1?"יום":"ימים"}`:`${c} ${c===1?"יום":"ימים"} נותרו`,size:80,button:f?{text:S?"הארך שוב":"הארך יעד",onclick:`event.stopPropagation(); manager.showExtendDeadlineDialog('${i.id}')`,icon:"fas fa-calendar-plus",cssClass:"deadline-btn",show:!0}:null};let N=window.SVGRings.createDualRings(v,I);return o&&(N+=`<div class="budget-adjusted-note" style="text-align: center; margin-top: 12px; font-size: 11px; color: #3b82f6;"><i class="fas fa-info-circle"></i> תקציב עודכן ל-${s}ש</div>`),N}function Hi(i,e={}){const{safeText:t,formatDate:s,formatShort:n}=e,o=ut(i),r=mt(o),a=o.originalEstimate||o.estimatedMinutes,c=o.estimatedMinutes!==a,d=o.actualMinutes>a,u=Math.max(0,o.actualMinutes-a),l=new Date,m=new Date(o.deadline),h=Math.ceil((m-l)/(1e3*60*60*24)),p=Math.round(o.actualMinutes/60*10)/10,g=Math.round(o.estimatedMinutes/60*10)/10,f=t?t(o.description):o.description,w=t?t(o.clientName):o.clientName,v=o.clientName.length>20?t?t(o.clientName.substring(0,20)+"..."):o.clientName.substring(0,20)+"...":w,S=o.status==="הושלם",T=o.status==="pending_approval",I=S?`
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  `:"",N=T?`
    <span class="pending-approval-badge">
      <i class="fas fa-lock"></i>
      ממתין לאישור מנהל
    </span>
  `:"",M=te(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||""),_=M?`
    <div class="linear-card-badges">
      ${M}
    </div>
  `:"";return`
    <div class="linear-minimal-card ${T?"pending-approval":""}" data-task-id="${o.id}">
      ${_}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${w}">
          ${f}
          ${I}
          ${N}
        </h3>

        <!-- 🎯 SVG RINGS -->
        ${!S&&window.SVGRings?Pi(o,r,p,g,a,c,d,u,h):""}
      </div>

      <!-- החלק התחתון - מחוץ ל-content -->
      <div class="linear-card-meta">
        <div class="linear-client-row">
          <span class="linear-client-label">לקוח:</span>
          <span class="linear-client-name" title="${w}">
            ${v}
          </span>
        </div>
        ${o.createdAt?`
        <div class="creation-date-tag">
          <i class="far fa-clock"></i>
          <span>נוצר ב-${s(o.createdAt)} ${new Date(o.createdAt).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        `:""}
      </div>

      <button class="linear-expand-btn" onclick="manager.expandTaskCard('${o.id}', event)" title="הרחב פרטים">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `}function qi(i,e={}){const{safeText:t,formatDate:s,taskActionsManager:n}=e,o=ut(i),r=mt(o),a=o.status==="הושלם",c=ri(o.status),d=te(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||""),u=window.SVGRings?window.SVGRings.createTableProgressBar({progress:r,actualMinutes:o.actualMinutes||0,estimatedMinutes:o.estimatedMinutes||1}):`${r}%`;let l;if(window.SVGRings){const m=new Date,h=new Date(o.deadline),p=o.createdAt?new Date(o.createdAt):m,g=Math.ceil((h-m)/(1e3*60*60*24)),f=p<h?p:h,w=Math.max(1,(h-f)/(1e3*60*60*24)),v=(m-f)/(1e3*60*60*24),S=Math.max(0,Math.round(v/w*100));l=window.SVGRings.createCompactDeadlineRing({daysRemaining:g,progress:S,size:52})}else l=s?s(o.deadline):o.deadline;return`
    <tr data-task-id="${o.id}">
      <td>${t?t(o.clientName):o.clientName}</td>
      <td class="td-description">
        <div class="table-description-with-icons">
          <span>${t?t(o.description):o.description}</span>
          ${d}
        </div>
      </td>
      <td>${u}</td>
      <td style="text-align: center;">${l}</td>
      <td style="color: #6b7280; font-size: 13px;">${window.DatesModule?window.DatesModule.getCreationDateTableCell(o):""}</td>
      <td>${c}</td>
      <td class="actions-column">
        ${n?n.createTableActionButtons(o,a):""}
      </td>
    </tr>
  `}function ht(i="active"){return i==="completed"?`
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
  `}function Oi(i,e={}){const{stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o,safeText:r}=e,a=document.getElementById("budgetContainer"),c=document.getElementById("budgetTableContainer");if(!i||i.length===0){a&&(a.innerHTML=ht(s||"active"),a.classList.remove("hidden")),c&&c.classList.add("hidden");return}const d=i.map(h=>Hi(h,e)).join(""),u=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||"active"):"",l=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:"",m=`
    <div class="modern-cards-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${u}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${o==="recent"?"selected":""}>עדכון אחרון</option>
            <option value="name" ${o==="name"?"selected":""}>שם (א-ת)</option>
            <option value="deadline" ${o==="deadline"?"selected":""}>תאריך יעד</option>
            <option value="progress" ${o==="progress"?"selected":""}>התקדמות</option>
          </select>
        </div>
      </div>
      <div class="budget-cards-grid">
        ${d}
      </div>
      ${l}
    </div>
  `;a&&(a.innerHTML=m,a.classList.remove("hidden"),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(a)),c&&c.classList.add("hidden")}function Vi(i,e={}){const{stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o}=e,r=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||"active"):"",a=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:"",c=!i||i.length===0?ht(s||"active"):`
    <div class="modern-table-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${r}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${o==="recent"?"selected":""}>עדכון אחרון</option>
            <option value="name" ${o==="name"?"selected":""}>שם (א-ת)</option>
            <option value="deadline" ${o==="deadline"?"selected":""}>תאריך יעד</option>
            <option value="progress" ${o==="progress"?"selected":""}>התקדמות</option>
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
          ${i.map(l=>qi(l,e)).join("")}
        </tbody>
      </table>
      ${a}
    </div>
  `,d=document.getElementById("budgetContainer"),u=document.getElementById("budgetTableContainer");u&&(u.innerHTML=c,u.classList.remove("hidden"),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(u)),d&&d.classList.add("hidden")}function zi(i,e,t,s="recent"){const n=i.map(a=>Wi(a)).join(""),o=window.StatisticsModule.createTimesheetStatsBar(e);return`
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
            <option value="recent" ${s==="recent"?"selected":""}>תאריך אחרון</option>
            <option value="client" ${s==="client"?"selected":""}>שם לקוח (א-ת)</option>
            <option value="hours" ${s==="hours"?"selected":""}>שעות (גבוה-נמוך)</option>
          </select>
        </div>
      </div>
      <div class="timesheet-cards-grid">
        ${n}
      </div>
      
    </div>
  `}function Wi(i){if(!i||typeof i!="object")return console.error("Invalid entry provided to createTimesheetCard:",i),"";const e={id:i.id||i.entryId||Date.now(),clientName:i.clientName||"",action:i.action||"",minutes:Number(i.minutes)||0,date:i.date||new Date().toISOString(),fileNumber:i.fileNumber||"",caseNumber:i.caseNumber||"",serviceName:i.serviceName||"",notes:i.notes||"",createdAt:i.createdAt||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null},t=Math.round(e.minutes/60*10)/10,s=safeText(e.clientName),n=safeText(e.action);safeText(e.fileNumber),safeText(e.notes);const o=window.DatesModule.formatDate,r=window.DatesModule.formatShort,a=te(e.caseNumber,e.serviceName,e.serviceType,e.serviceId||""),c=a?`
    <div class="linear-card-badges">
      ${a}
    </div>
  `:"";return`
    <div class="linear-minimal-card" data-entry-id="${e.id}">
      ${c}
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
            ${r(e.date)}
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
          <span>נוצר ב-${o(e.createdAt)} ${new Date(e.createdAt).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        `:""}
      </div>

      <button class="linear-expand-btn" onclick="event.stopPropagation(); manager.showEditTimesheetDialog('${e.id}')" title="ערוך">
        <i class="fas fa-edit"></i>
      </button>
    </div>
  `}function ji(i,e,t,s="recent"){if(!i||i.length===0)return Gi();const n=i.map(a=>{if(!a||typeof a!="object")return console.warn("Invalid entry in renderTimesheetTable:",a),"";const c=te(a.caseNumber,a.serviceName,a.serviceType,a.serviceId||""),d=a.id||a.entryId||Date.now();return`
      <tr data-entry-id="${d}">
        <td class="timesheet-cell-date">${formatDate(a.date)}</td>
        <td class="timesheet-cell-action">
          <div class="table-description-with-icons">
            <span>${safeText(a.action||"")}</span>
            ${c}
          </div>
        </td>
        <td class="timesheet-cell-time">
          <span class="time-badge">${Number(a.minutes)||0} דק'</span>
        </td>
        <td class="timesheet-cell-client">${safeText(a.clientName||"")}</td>
        <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(a)}</td>
        <td>${safeText(a.notes||"—")}</td>
        <td class="actions-column">
          <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${d}')" title="ערוך שעתון">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `}).join(""),o=window.StatisticsModule.createTimesheetStatsBar(e);return`
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
            <option value="recent" ${s==="recent"?"selected":""}>תאריך אחרון</option>
            <option value="client" ${s==="client"?"selected":""}>שם לקוח (א-ת)</option>
            <option value="hours" ${s==="hours"?"selected":""}>שעות (גבוה-נמוך)</option>
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
      
    </div>
  `}function Gi(){return`
    <div class="empty-state">
      <i class="fas fa-clock"></i>
      <h4>אין רשומות שעתון</h4>
      <p>רשום את הפעולה הראשונה שלך</p>
    </div>
  `}function Le(i){return i.reduce((e,t)=>e+(t.minutes||0),0)}function Ki(i,e,t){j(async()=>{const{startTimesheetListener:s}=await import("./real-time-listeners-BzLKVeci.js");return{startTimesheetListener:s}},[]).then(({startTimesheetListener:s})=>s(i,e,t)).catch(s=>{console.error("❌ Error importing real-time-listeners:",s),t&&t(s)})}function Yi(i,e){return!i||i.length===0||i.sort((t,s)=>{switch(e){case"recent":const n=new Date(t.lastUpdated||t.createdAt||0).getTime();return new Date(s.lastUpdated||s.createdAt||0).getTime()-n;case"name":const r=(t.clientName||"").trim(),a=(s.clientName||"").trim();return!r&&!a?0:r?a?r.localeCompare(a,"he"):-1:1;case"deadline":const c=new Date(t.deadline||"9999-12-31").getTime(),d=new Date(s.deadline||"9999-12-31").getTime();return c-d;case"progress":const u=t.estimatedMinutes>0?t.actualMinutes/t.estimatedMinutes*100:0;return(s.estimatedMinutes>0?s.actualMinutes/s.estimatedMinutes*100:0)-u;default:return 0}}),i}function Qi(i,e){if(!i||i.length===0)return[];const t=new Date;if(e==="today"){const s=new Date(t.getFullYear(),t.getMonth(),t.getDate());return i.filter(n=>{if(!n.date)return!1;const o=new Date(n.date);return new Date(o.getFullYear(),o.getMonth(),o.getDate()).getTime()===s.getTime()})}if(e==="month"){const s=new Date;return s.setMonth(s.getMonth()-1),i.filter(n=>n.date?new Date(n.date)>=s:!0)}return[...i]}function Ji(i,e){return!i||i.length===0||i.sort((t,s)=>{switch(e){case"recent":const n=new Date(t.date||0).getTime();return new Date(s.date||0).getTime()-n;case"client":const r=(t.clientName||"").trim(),a=(s.clientName||"").trim();return!r&&!a?0:r?a?r.localeCompare(a,"he"):-1:1;case"hours":const c=t.minutes||0;return(s.minutes||0)-c;default:return 0}}),i}async function ft(){var i,e;try{const t=window.firebaseDB;if(!t){console.error("❌ Firebase לא מחובר");return}window.manager&&window.manager.clients&&window.manager.clients.forEach((o,r)=>{});const s=await t.collection("clients").get(),n=[];s.forEach((o,r)=>{const a=o.data();n.push({id:o.id,...a})});for(const o of n)if(o.type==="hours"){const r=await t.collection("timesheet_entries").where("clientName","==",o.fullName).get();let a=0;const c={},d=[];r.forEach(p=>{const g=p.data(),f=g.minutes||0,w=g.employee||g.lawyer||"לא ידוע";a+=f,c[w]||(c[w]=0),c[w]+=f,d.push({date:g.date,employee:w,minutes:f,action:g.action})}),d.forEach((p,g)=>{}),Object.entries(c).forEach(([p,g])=>{});const m=((o.totalHours||0)*60-a)/60,h=(e=(i=window.manager)==null?void 0:i.clients)==null?void 0:e.find(p=>p.fullName===o.fullName)}}catch(t){console.error("❌ שגיאה באבחון:",t)}}async function gt(){try{const i=window.firebaseDB;if(!i){console.error("❌ Firebase לא מחובר");return}const e=await i.collection("clients").get();for(const t of e.docs){const s=t.data();if(s.type==="hours"){const n=await K(s.fullName);if(await t.ref.update({hoursRemaining:n.remainingHours,minutesRemaining:n.remainingMinutes,isBlocked:n.isBlocked,isCritical:n.isCritical,lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),fixedAt:firebase.firestore.FieldValue.serverTimestamp()}),window.manager&&window.manager.clients){const o=window.manager.clients.findIndex(r=>r.fullName===s.fullName);o!==-1&&(window.manager.clients[o].hoursRemaining=n.remainingHours,window.manager.clients[o].minutesRemaining=n.remainingMinutes,window.manager.clients[o].isBlocked=n.isBlocked,window.manager.clients[o].isCritical=n.isCritical)}}}window.manager&&window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients()}catch(i){console.error("❌ שגיאה בתיקון:",i)}}function pt(){!window.manager||!window.manager.clients||(window.manager.clients.length,window.manager.clients.forEach((i,e)=>{i.type==="fixed"||i.isBlocked||i.isCritical}))}typeof window<"u"&&(window.debugClientHoursMismatch=ft,window.fixClientHoursMismatch=gt,window.showClientStatusSummary=pt,window.calculateClientHoursAccurate=K,window.updateClientHoursImmediately=Ee);const Zi=Object.freeze(Object.defineProperty({__proto__:null,debugClientHoursMismatch:ft,fixClientHoursMismatch:gt,showClientStatusSummary:pt},Symbol.toStringTag,{value:"Module"}));class wt{constructor(){var e,t;this.currentUser=null,this.currentUsername=null,this.clients=[],this.budgetTasks=[],this.timesheetEntries=[],this.connectionStatus="unknown",this.addTaskDialog=null,this.currentTaskFilter=D.getStateValue("taskFilter"),this.currentTimesheetFilter=D.getStateValue("timesheetFilter"),this.currentBudgetView=D.getStateValue("budgetView"),this.currentTimesheetView=D.getStateValue("timesheetView"),this.filteredBudgetTasks=[],this.filteredTimesheetEntries=[],this.budgetSortField=null,this.budgetSortDirection="asc",this.timesheetSortField=null,this.timesheetSortDirection="asc",this.currentBudgetSort=D.getStateValue("budgetSort"),this.currentTimesheetSort=D.getStateValue("timesheetSort"),this.currentBudgetPage=1,this.currentTimesheetPage=1,this.budgetPagination=(e=window.PaginationModule)==null?void 0:e.create({pageSize:20}),this.timesheetPagination=(t=window.PaginationModule)==null?void 0:t.create({pageSize:20}),this.welcomeScreenStartTime=null,this.isTaskOperationInProgress=!1,this.isTimesheetOperationInProgress=!1,this.dataCache=new me({maxAge:5*60*1e3,staleAge:10*60*1e3,staleWhileRevalidate:!0,storage:"memory",debug:!1,onError:s=>{Logger.log("❌ [DataCache] Error:",s)}}),this.domCache=new Gt,this.notificationBell=new ni,this.clientValidation=new xi(this),this.activityLogger=null,this.taskActionsManager=null,this.integrationManager=window.IntegrationManagerModule?window.IntegrationManagerModule.create():null,this.idleTimeout=null,this.sessionManager=null,Logger.log("✅ LawOfficeManager initialized")}waitForAuthReady(){return new Promise(e=>{const t=firebase.auth().onAuthStateChanged(s=>{t(),e(s)})})}async init(){Logger.log("🚀 Initializing Law Office System..."),this.setupEventListeners(),Logger.log("⏳ Waiting for Firebase Auth...");const e=await this.waitForAuthReady();e?await this.handleAuthenticatedUser(e):this.showLogin(),Logger.log("✅ System initialized")}async handleAuthenticatedUser(e){try{if(window.isInWelcomeScreen)return;const t=await window.firebaseDB.collection("employees").doc(e.email).get();if(t.exists){const s=t.data();this.currentUser=s.email,this.currentUsername=s.username||s.name,be(this.currentUsername),this.notificationBell&&window.firebaseDB&&this.notificationBell.startListeningToAdminMessages(e,window.firebaseDB),await this.loadData(),this.showApp(),this.initializeAddTaskSystem()}else await firebase.auth().signOut(),this.showLogin()}catch(t){console.error("❌ Error loading user profile:",t),this.showLogin()}}setupEventListeners(){const e=document.getElementById("loginForm");e&&e.addEventListener("submit",async r=>{r.preventDefault(),await De.call(this)});const t=document.getElementById("forgotPasswordForm");t&&t.addEventListener("submit",async r=>{await Ei.call(this,r)});const s=document.getElementById("budgetForm");s&&s.addEventListener("submit",r=>{r.preventDefault(),this.addBudgetTask()});const n=document.getElementById("timesheetForm");n&&n.addEventListener("submit",r=>{r.preventDefault(),this.addTimesheetEntry()});const o=document.getElementById("budgetSearchBox");if(o){const r=Je(a=>{this.searchBudgetTasks(a)},300);o.addEventListener("input",a=>{r(a.target.value)})}Logger.log("✅ Event listeners configured")}cleanup(){var e;this.refreshInterval&&clearInterval(this.refreshInterval),(e=this.notificationBell)!=null&&e.cleanup&&this.notificationBell.cleanup(),this.stopRealTimeListeners(),Logger.log("✅ Manager cleanup completed")}stopRealTimeListeners(){try{j(async()=>{const{stopAllListeners:e}=await import("./real-time-listeners-BzLKVeci.js");return{stopAllListeners:e}},[]).then(({stopAllListeners:e})=>{e(),Logger.log("✅ Real-time listeners stopped")}).catch(e=>{console.error("❌ Error stopping listeners:",e)})}catch(e){console.error("❌ Error stopping real-time listeners:",e)}}showLogin(){Te.call(this)}async handleLogin(){await De.call(this)}showWelcomeScreen(){pi.call(this)}async waitForWelcomeMinimumTime(){await wi.call(this)}updateLoaderText(e){yi.call(this,e)}showApp(){vi.call(this)}logout(){this.idleTimeout&&this.idleTimeout.stop(),dt()}switchAuthMethod(e){Si.call(this,e)}async handleSMSLogin(){await Ci.call(this)}async verifyOTP(){await Bi.call(this)}initSecurityModules(){Logger.log("ℹ️ Security modules disabled")}handleUserActivity(){}handleCountdownUpdate(e){}async loadData(){var e,t;try{if(this.updateLoaderText("טוען נתונים..."),fi(),window.CaseNumberGenerator)try{await window.CaseNumberGenerator.initialize()}catch(r){Logger.log("⚠️ CaseNumberGenerator initialization failed:",r)}const[s,n,o]=await Promise.all([this.dataCache.get("clients",()=>ve()),this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,()=>{var r;return((r=this.integrationManager)==null?void 0:r.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||R(this.currentUser,this.currentTaskFilter,50)}),this.dataCache.get(`timesheetEntries:${this.currentUser}`,()=>{var r;return((r=this.integrationManager)==null?void 0:r.loadTimesheet(this.currentUser))||J(this.currentUser)})]);if(this.clients=s,this.budgetTasks=n,this.timesheetEntries=o,window.clients=s,window.cases=window.cases||[],window.budgetTasks=n,window.timesheetEntries=o,window.lawOfficeManager=this,window.CoreUtils=jt,this.updateLoaderText("מכין ממשק..."),window.TaskActionsModule&&!this.taskActionsManager&&(this.taskActionsManager=window.TaskActionsModule.create(),this.taskActionsManager.setManager(this),Logger.log("✅ TaskActionsManager initialized")),window.ActivityLoggerModule&&!this.activityLogger&&(this.activityLogger=window.ActivityLoggerModule.create(),Logger.log("✅ ActivityLogger initialized")),this.filterBudgetTasks(),this.filterTimesheetEntries(),this.syncToggleState(),await this.updateTaskCountBadges(),this.clientValidation&&this.clientValidation.updateBlockedClients(),await this.refreshAllClientCaseSelectors(),window.CasesModule&&typeof window.CasesModule.refreshCurrentCase=="function"&&await window.CasesModule.refreshCurrentCase(),this.notificationBell){const r=n.filter(d=>{if(d.status==="הושלם")return!1;const u=new Date(d.deadline),m=Math.ceil((u-new Date)/(1e3*60*60*24));return m<=3&&m>=0}),a=((e=this.clientValidation)==null?void 0:e.blockedClients)||[],c=((t=this.clientValidation)==null?void 0:t.criticalClients)||[];this.notificationBell.updateFromSystem(a,c,r)}this.startRealTimeListeners(),Logger.log(`✅ Data loaded: ${s.length} clients, ${n.length} tasks, ${o.length} entries`)}catch(s){throw console.error("❌ Error loading data:",s),this.showNotification("שגיאה בטעינת נתונים","error"),s}}startRealTimeListeners(){try{Logger.log("🔊 Starting real-time listeners..."),Ri(this.currentUser,e=>{Logger.log(`📡 Tasks updated: ${e.length} tasks`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`),this.budgetTasks=e,window.budgetTasks=e,this.filterBudgetTasks(),this.renderBudgetView(),this.updateTaskCountBadges()},e=>{console.error("❌ Tasks listener error:",e)}),Ki(this.currentUser,e=>{Logger.log(`📡 Timesheet updated: ${e.length} entries`),this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=e,window.timesheetEntries=e,this.filterTimesheetEntries(),this.renderTimesheetView()},e=>{console.error("❌ Timesheet listener error:",e)}),Logger.log("✅ Real-time listeners started")}catch(e){console.error("❌ Error starting real-time listeners:",e)}}async refreshAllClientCaseSelectors(){const e=window.clientCaseSelectorInstances||{},t=Object.keys(e);if(t.length===0)return;Logger.log(`🔄 Refreshing ${t.length} client-case selector(s)...`);const s=t.map(n=>{const o=e[n];return o&&typeof o.refreshSelectedCase=="function"?o.refreshSelectedCase():Promise.resolve()});try{await Promise.all(s),Logger.log("✅ All client-case selectors refreshed")}catch(n){console.error("❌ Error refreshing client-case selectors:",n)}}async loadDataFromFirebase(){window.showSimpleLoading("טוען נתונים מחדש...");try{this.dataCache.clear(),Logger.log("🔄 Cache cleared - forcing fresh data from Firebase"),await this.loadData();const e=this.dataCache.getStats();Logger.log("📊 Cache stats:",e),this.showNotification("הנתונים עודכנו בהצלחה","success")}catch{this.showNotification("שגיאה בטעינת נתונים","error")}finally{window.hideSimpleLoading()}}initializeAddTaskSystem(){try{console.log("🚀 Initializing Add Task System v2.0..."),this.addTaskDialog=si(this,{onSuccess:e=>{console.log("✅ Task created successfully:",e),this.filterBudgetTasks()},onError:e=>{console.error("❌ Error creating task:",e),this.showNotification("שגיאה בשמירת המשימה: "+e.message,"error")},onCancel:()=>{console.log("ℹ️ User cancelled task creation")},enableDrafts:!0}),console.log("✅ Add Task System v2.0 initialized")}catch(e){console.error("❌ Error initializing Add Task System:",e)}}async addBudgetTask(){var e,t,s,n,o,r,a;if(this.isTaskOperationInProgress){this.showNotification("אנא המתן לסיום הפעולה הקודמת","warning");return}this.isTaskOperationInProgress=!0;try{const c=(e=window.ClientCaseSelectorsManager)==null?void 0:e.getBudgetValues();if(!c){this.showNotification("חובה לבחור לקוח ותיק","error");return}const d=(s=(t=document.getElementById("budgetDescription"))==null?void 0:t.value)==null?void 0:s.trim(),u=((n=document.getElementById("budgetDescriptionCategory"))==null?void 0:n.value)||null,l=parseInt((o=document.getElementById("estimatedTime"))==null?void 0:o.value),m=(r=document.getElementById("budgetDeadline"))==null?void 0:r.value;let h=null;if(u&&window.WorkCategories){const f=window.WorkCategories.getCategoryById(u);h=(f==null?void 0:f.name)||null}if(!d||d.length<3){this.showNotification("חובה להזין תיאור משימה (לפחות 3 תווים)","error");return}if(!l||l<1){this.showNotification("חובה להזין זמן משוער","error");return}if(!m){this.showNotification("חובה לבחור תאריך יעד","error");return}const p=(a=document.getElementById("budgetBranch"))==null?void 0:a.value;if(!p){this.showNotification("חובה לבחור סניף מטפל","error");return}const g=window.NotificationMessages.tasks;await P.execute({...g.loading.create(c.clientName),action:async()=>{var S;const f={description:d,categoryId:u,categoryName:h,clientName:c.clientName,clientId:c.clientId,caseId:c.caseId,caseNumber:c.caseNumber,caseTitle:c.caseTitle,serviceId:c.serviceId,serviceName:c.serviceName,serviceType:c.serviceType,parentServiceId:c.parentServiceId,branch:p,estimatedMinutes:l,originalEstimate:l,deadline:m,employee:this.currentUser,status:"pending_approval",requestedMinutes:l,approvedMinutes:null,timeSpent:0,timeEntries:[],createdAt:new Date};Logger.log("📝 Creating budget task with data:",f),console.log("🔍 FULL taskData:",JSON.stringify(f,null,2)),console.log("🔍 serviceType:",f.serviceType),console.log("🔍 parentServiceId:",f.parentServiceId),console.log("🔍 serviceId:",f.serviceId),Logger.log("  🚀 [v2.0] Using FirebaseService.call");const w=await window.FirebaseService.call("createBudgetTask",f,{retries:3,timeout:15e3});if(!w.success)throw new Error(w.error||"Failed to create budget task");const v=(S=w.data)==null?void 0:S.taskId;Logger.log("✅ Task created with pending_approval status:",v);try{const{taskApprovalService:T}=await j(async()=>{const{taskApprovalService:I}=await import("./task-approval-service-C7qOLevG.js");return{taskApprovalService:I}},[]);T.init(window.firebaseDB,{email:this.currentUser}),await T.createApprovalRequest(v,f,this.currentUser,this.currentUser.split("@")[0]),Logger.log("✅ Approval request created for task:",v)}catch(T){console.error("❌ Error creating approval request:",T)}window.EventBus.emit("task:created",{taskId:v||"unknown",clientId:f.clientId,clientName:f.clientName,employee:f.employee,originalEstimate:f.estimatedMinutes,status:"pending_approval"}),Logger.log("  🚀 [v2.0] EventBus: task:created emitted"),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`),this.budgetTasks=await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,()=>{var T;return((T=this.integrationManager)==null?void 0:T.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||R(this.currentUser,this.currentTaskFilter,50)}),this.filterBudgetTasks()},successMessage:null,errorMessage:g.error.createFailed,onSuccess:()=>{var w,v;if(window.NotificationSystem&&window.NotificationSystem.alert){const S=g.success.created(c.clientName,d,l);window.NotificationSystem.alert(S,()=>{console.log("✅ User acknowledged task creation")},{title:"✅ המשימה נשלחה בהצלחה",okText:"הבנתי",type:"success"})}$i(this),(w=document.getElementById("budgetFormContainer"))==null||w.classList.add("hidden");const f=document.getElementById("smartPlusBtn");f&&f.classList.remove("active"),(v=window.ClientCaseSelectorsManager)==null||v.clearBudget()}})}finally{this.isTaskOperationInProgress=!1}}searchBudgetTasks(e){const t=e.toLowerCase().trim();if(!t){this.filterBudgetTasks();return}this.filteredBudgetTasks=this.budgetTasks.filter(s=>{var n,o,r,a,c,d,u;return((n=s.description)==null?void 0:n.toLowerCase().includes(t))||((o=s.taskDescription)==null?void 0:o.toLowerCase().includes(t))||((r=s.clientName)==null?void 0:r.toLowerCase().includes(t))||((a=s.caseNumber)==null?void 0:a.toLowerCase().includes(t))||((c=s.fileNumber)==null?void 0:c.toLowerCase().includes(t))||((d=s.serviceName)==null?void 0:d.toLowerCase().includes(t))||((u=s.caseTitle)==null?void 0:u.toLowerCase().includes(t))}),this.renderBudgetView()}async handleToggleSwitch(e){const t=e.checked?"completed":"active";await this.toggleTaskView(t)}async toggleTaskView(e){if(e!==this.currentTaskFilter){if(this.isTogglingView){console.warn("⚠️ Toggle already in progress, ignoring duplicate call");return}try{this.isTogglingView=!0,this.currentTaskFilter=e,D.setStateValue("taskFilter",e);const t=document.getElementById("activeFilterBtn"),s=document.getElementById("completedFilterBtn");t&&s&&(e==="active"?(t.classList.add("active"),s.classList.remove("active")):(t.classList.remove("active"),s.classList.add("active"))),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${e}`);const n=await this.dataCache.get(`budgetTasks:${this.currentUser}:${e}`,()=>R(this.currentUser,e,50));if(this.currentTaskFilter!==e){console.warn("⚠️ View mode changed during load, discarding stale results");return}this.budgetTasks=n,this.filteredBudgetTasks=[...this.budgetTasks],this.updateTaskCountBadges(),this.renderBudgetView(),window.EventBus.emit("tasks:view-changed",{view:e,count:this.budgetTasks.length})}catch(t){console.error("Error toggling task view:",t),this.showNotification("שגיאה בטעינת משימות","error")}finally{this.isTogglingView=!1}}}syncToggleState(){const e=document.getElementById("activeFilterBtn"),t=document.getElementById("completedFilterBtn");!e||!t||(this.currentTaskFilter==="completed"?(e.classList.remove("active"),t.classList.add("active")):(e.classList.add("active"),t.classList.remove("active")),Logger.log(`✅ Toggle state synced: ${this.currentTaskFilter}`))}async filterBudgetTasks(){this.currentTaskFilter==="completed"?this.filteredBudgetTasks=this.budgetTasks.filter(e=>e.status==="הושלם"):this.currentTaskFilter==="active"?this.filteredBudgetTasks=this.budgetTasks.filter(e=>e.status!=="הושלם"):this.filteredBudgetTasks=[...this.budgetTasks],this.renderBudgetView()}sortBudgetTasks(e){var s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentBudgetSort=t,D.setStateValue("budgetSort",t),this.filteredBudgetTasks=Yi(this.filteredBudgetTasks,t),this.renderBudgetView()}async updateTaskCountBadges(){try{const[e,t]=await Promise.all([R(this.currentUser,"active",50),R(this.currentUser,"completed",50)]),s=document.getElementById("activeCountBadge");s&&(s.textContent=e.length,s.style.display=e.length>0?"inline-flex":"none");const n=document.getElementById("completedCountBadge");n&&(n.textContent=t.length,n.style.display=t.length>0?"inline-flex":"none")}catch(e){console.error("Error updating count badges:",e)}}async renderBudgetView(){const t={stats:window.StatisticsModule?await window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks):null,safeText:y,formatDate:q,formatShort:ue,currentBudgetSort:this.currentBudgetSort,currentTaskFilter:this.currentTaskFilter,paginationStatus:null,taskActionsManager:this.taskActionsManager};this.currentBudgetView==="cards"?Oi(this.filteredBudgetTasks,t):Vi(this.filteredBudgetTasks,t)}switchBudgetView(e){D.setStateValue("budgetView",e),this.currentBudgetView=e,document.querySelectorAll(".view-tab").forEach(t=>{t.dataset.view===e?t.classList.add("active"):t.classList.remove("active")}),this.renderBudgetView()}async addTimesheetEntry(){var r,a,c,d,u,l;const e=(r=document.getElementById("actionDate"))==null?void 0:r.value,t=parseInt((a=document.getElementById("actionMinutes"))==null?void 0:a.value),s=(d=(c=document.getElementById("actionDescription"))==null?void 0:c.value)==null?void 0:d.trim(),n=(l=(u=document.getElementById("actionNotes"))==null?void 0:u.value)==null?void 0:l.trim();if(!e){this.showNotification("חובה לבחור תאריך","error");return}if(!t||t<1){this.showNotification("חובה להזין זמן בדקות","error");return}if(!s||s.length<3){this.showNotification("חובה להזין תיאור פעולה (לפחות 3 תווים)","error");return}const o=window.NotificationMessages.timesheet;await P.execute({...o.loading.createInternal(),action:async()=>{var p;const m={date:e,minutes:t,clientName:null,clientId:null,fileNumber:null,caseId:null,caseTitle:null,action:s,notes:n,employee:this.currentUser,isInternal:!0,createdAt:new Date};Logger.log("📝 Creating internal timesheet entry:",m),Logger.log("  🚀 [v2.0] Using FirebaseService.call for createTimesheetEntry");const h=await window.FirebaseService.call("createTimesheetEntry",m,{retries:3,timeout:15e3});if(!h.success)throw new Error(h.error||"שגיאה ברישום פעילות");this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=await this.dataCache.get(`timesheetEntries:${this.currentUser}`,()=>{var g;return((g=this.integrationManager)==null?void 0:g.loadTimesheet(this.currentUser))||J(this.currentUser)}),this.filterTimesheetEntries(),window.EventBus.emit("timesheet:entry-created",{entryId:((p=h.data)==null?void 0:p.entryId)||"unknown",date:e,minutes:t,action:s,notes:n,employee:this.currentUser,isInternal:!0}),Logger.log("  🚀 [v2.0] EventBus: timesheet:entry-created emitted")},successMessage:o.success.internalCreated(t),errorMessage:o.error.createFailed,onSuccess:()=>{var h;Ai(this),(h=document.getElementById("timesheetFormContainer"))==null||h.classList.add("hidden");const m=document.getElementById("smartPlusBtn");m&&m.classList.remove("active")}})}filterTimesheetEntries(){const e=document.getElementById("timesheetFilter");e&&(this.currentTimesheetFilter=e.value);const t=this.currentTimesheetFilter;this.filteredTimesheetEntries=Qi(this.timesheetEntries,t),this.renderTimesheetView()}sortTimesheetEntries(e){var s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentTimesheetSort=t,this.filteredTimesheetEntries=Ji(this.filteredTimesheetEntries,t),this.renderTimesheetView()}renderTimesheetView(){const e=window.StatisticsModule?window.StatisticsModule.calculateTimesheetStatistics(this.timesheetEntries):{totalMinutes:Le(this.filteredTimesheetEntries),totalHours:Math.round(Le(this.filteredTimesheetEntries)/60*10)/10,totalEntries:this.filteredTimesheetEntries.length},t={currentPage:this.currentTimesheetPage,totalPages:Math.ceil(this.filteredTimesheetEntries.length/20),displayedItems:this.filteredTimesheetEntries.length,filteredItems:this.filteredTimesheetEntries.length},s=document.querySelector("#timesheetTab > div:last-child");if(!s){console.error("❌ Timesheet parent container not found");return}let n;this.currentTimesheetView==="cards"?n=zi(this.filteredTimesheetEntries,e,t,this.currentTimesheetSort):n=ji(this.filteredTimesheetEntries,e,t,this.currentTimesheetSort),s.innerHTML=n,window.DescriptionTooltips&&window.DescriptionTooltips.refresh(s)}switchTimesheetView(e){this.currentTimesheetView=e,document.querySelectorAll("#timesheetTab .view-tab").forEach(t=>{t.dataset.view===e?t.classList.add("active"):t.classList.remove("active")}),this.renderTimesheetView()}showEditTimesheetDialog(e){Fi(this,e)}searchClientsForEdit(e){Ni(this,e)}selectClientForEdit(e,t){_i(this,e)}expandTaskCard(e,t){t.stopPropagation();const s=this.filteredBudgetTasks.find(n=>n.id===e);s&&this.showExpandedCard(s)}showExpandedCard(e){let t=0;e.estimatedMinutes&&e.estimatedMinutes>0&&(t=Math.round((e.actualMinutes||0)/e.estimatedMinutes*100));const s=e.status==="הושלם",n=`
      <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
        <div class="linear-expanded-card" onclick="event.stopPropagation()">
          <div class="linear-expanded-header">
            <h2 class="linear-expanded-title">${y(e.description||e.taskDescription)}</h2>
            <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="linear-expanded-body">
            <div class="linear-info-grid">
              <div class="linear-info-item">
                <label>לקוח:</label>
                <span>${y(e.clientName)}</span>
              </div>
              <div class="linear-info-item">
                <label>סטטוס:</label>
                <span>${y(e.status)}</span>
              </div>
              <div class="linear-info-item">
                <label>התקדמות:</label>
                <span>${t}%</span>
              </div>
              <div class="linear-info-item">
                <label>תאריך יעד:</label>
                <span>${V(new Date(e.deadline))}</span>
              </div>
            </div>
            ${this.taskActionsManager?this.taskActionsManager.createCardActionButtons(e,s):""}
          </div>
        </div>
      </div>
    `;document.body.insertAdjacentHTML("beforeend",n),setTimeout(()=>{const o=document.querySelector(".linear-expanded-overlay");o&&o.classList.add("active")},10)}closeExpandedCard(){const e=document.querySelector(".linear-expanded-overlay");e&&(e.classList.remove("active"),setTimeout(()=>e.remove(),300))}showAdvancedTimeDialog(e){if(!window.DialogsModule){this.showNotification("מודול דיאלוגים לא נטען","error");return}window.DialogsModule.showAdvancedTimeDialog(e,this)}showTaskHistory(e){var o;const t=this.budgetTasks.find(r=>r.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}const s=document.createElement("div");s.className="popup-overlay";let n="";((o=t.history)==null?void 0:o.length)>0?n=t.history.map(r=>`
        <div class="history-entry">
          <div class="history-header">
            <span class="history-date">${q(r.date)}</span>
            <span class="history-minutes">${r.minutes} דקות</span>
          </div>
          <div class="history-description">${y(r.description||"")}</div>
          <div class="history-timestamp">נוסף ב: ${y(r.timestamp||"")}</div>
        </div>
      `).join(""):n='<div style="text-align: center; color: #6b7280; padding: 40px;">אין היסטוריה עדיין</div>',s.innerHTML=`
      <div class="popup" style="max-width: 600px;">
        <div class="popup-header">
          <i class="fas fa-history"></i>
          היסטוריית זמנים - ${y(t.clientName||"")}
        </div>
        <div class="popup-content">
          <div class="task-summary">
            <h4>${y(t.description||"")}</h4>
            <p>סה"כ זמן: ${t.actualMinutes||0} דקות מתוך ${t.estimatedMinutes||0}</p>
          </div>
          <div class="history-container">
            ${n}
          </div>
        </div>
        <div class="popup-buttons" style="justify-content: flex-start;">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> סגור
          </button>
        </div>
      </div>
    `,document.body.appendChild(s),setTimeout(()=>s.classList.add("show"),10)}showExtendDeadlineDialog(e){const t=this.budgetTasks.find(a=>a.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}const s=document.createElement("div");s.className="popup-overlay";let n=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(t.deadline):new Date(t.deadline);(!n||isNaN(n.getTime()))&&(n=new Date,console.warn("⚠️ task.deadline is invalid, using current date",t.deadline));const o=new Date(n);o.setDate(o.getDate()+7);const r=o.toISOString().split("T")[0];s.innerHTML=`
      <div class="popup" style="max-width: 500px;">
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
            <div style="color: #dc2626; font-weight: bold;">${V(n)}</div>
          </div>
          <div class="form-group">
            <label for="newDeadlineDate">תאריך יעד חדש:</label>
            <input type="date" id="newDeadlineDate" value="${r}" required>
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
    `,document.body.appendChild(s),setTimeout(()=>s.classList.add("show"),10)}async submitDeadlineExtension(e){var o,r,a;const t=(o=document.getElementById("newDeadlineDate"))==null?void 0:o.value,s=(a=(r=document.getElementById("extensionReason"))==null?void 0:r.value)==null?void 0:a.trim();if(!t||!s){this.showNotification("אנא מלא את כל השדות","error");return}const n=window.NotificationMessages.tasks;await P.execute({...n.loading.extendDeadline(),action:async()=>{Logger.log("  🚀 [v2.0] Using FirebaseService.call for extendTaskDeadline");const c=await window.FirebaseService.call("extendTaskDeadline",{taskId:e,newDeadline:t,reason:s},{retries:3,timeout:1e4});if(!c.success)throw new Error(c.error||"שגיאה בהארכת יעד");await this.loadData(),this.filterBudgetTasks();const d=this.budgetTasks.find(u=>u.id===e);window.EventBus.emit("task:deadline-extended",{taskId:e,oldDeadline:(d==null?void 0:d.deadline)||t,newDeadline:t,reason:s,extendedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:deadline-extended emitted")},successMessage:n.success.deadlineExtended(t),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500})}async completeTask(e){const t=this.budgetTasks.find(s=>s.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}if(!window.DialogsModule){this.showNotification("מודול דיאלוגים לא נטען","error");return}window.TaskCompletionValidation?window.TaskCompletionValidation.initiateTaskCompletion(t,this):window.DialogsModule.showTaskCompletionModal(t,this)}async submitTimeEntry(e){var a,c,d,u;const t=this.budgetTasks.find(l=>l.id===e);if(!t)return;const s=(a=document.getElementById("workDate"))==null?void 0:a.value,n=parseInt((c=document.getElementById("workMinutes"))==null?void 0:c.value),o=(u=(d=document.getElementById("workDescription"))==null?void 0:d.value)==null?void 0:u.trim();if(!s||!n||!o){this.showNotification("נא למלא את כל השדות","error");return}const r=window.NotificationMessages.tasks;await P.execute({...r.loading.addTime(),action:async()=>{Logger.log("  🚀 [v2.0] Using FirebaseService.call for addTimeToTask");const l=await window.FirebaseService.call("addTimeToTask",{taskId:e,minutes:n,description:o,date:s},{retries:3,timeout:15e3});if(!l.success)throw new Error(l.error||"שגיאה בהוספת זמן");await this.loadData(),this.filterBudgetTasks(),window.EventBus.emit("task:time-added",{taskId:e,clientId:t.clientId,clientName:t.clientName,minutes:n,description:o,date:s,addedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:time-added emitted")},successMessage:r.success.timeAdded(n),errorMessage:r.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:()=>{this.closeExpandedCard()}})}async submitTaskCompletion(e){var r,a;const t=this.budgetTasks.find(c=>c.id===e);if(!t)return;const s=(a=(r=document.getElementById("completionNotes"))==null?void 0:r.value)==null?void 0:a.trim(),n=window._taskCompletionMetadata||{},o=window.NotificationMessages.tasks;await P.execute({...o.loading.complete(),action:async()=>{var d;Logger.log("  🚀 [v2.0] Using FirebaseService.call for completeTask");const c=await window.FirebaseService.call("completeTask",{taskId:e,completionNotes:s,gapReason:n.gapReason||null,gapNotes:n.gapNotes||null},{retries:3,timeout:15e3});if(delete window._taskCompletionMetadata,!c.success)throw new Error(c.error||"שגיאה בסיום משימה");this.budgetTasks=await(((d=this.integrationManager)==null?void 0:d.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||R(this.currentUser,this.currentTaskFilter,50)),this.filterBudgetTasks(),window.EventBus.emit("task:completed",{taskId:e,clientId:t.clientId,clientName:t.clientName,completionNotes:s,completedBy:this.currentUser,estimatedMinutes:t.estimatedMinutes,actualMinutes:t.totalMinutesSpent||0}),Logger.log("  🚀 [v2.0] EventBus: task:completed emitted")},successMessage:null,errorMessage:o.error.completeFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:async()=>{this.closeExpandedCard(),await this.toggleTaskView("completed"),this.showNotification(o.success.completed(t.clientName),"success")}})}async submitBudgetAdjustment(e){var o,r,a;const t=parseInt((o=document.getElementById("newBudgetMinutes"))==null?void 0:o.value),s=(a=(r=document.getElementById("adjustReason"))==null?void 0:r.value)==null?void 0:a.trim();if(!t||t<=0){this.showNotification("אנא הזן תקציב תקין","error");return}const n=window.NotificationMessages.tasks;await P.execute({...n.loading.updateBudget(),action:async()=>{var u;Logger.log("  🚀 [v2.0] Using FirebaseService.call for adjustTaskBudget");const c=await window.FirebaseService.call("adjustTaskBudget",{taskId:e,newEstimate:t,reason:s},{retries:3,timeout:1e4});if(!c.success)throw new Error(c.error||"שגיאה בעדכון תקציב");this.budgetTasks=await(((u=this.integrationManager)==null?void 0:u.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||R(this.currentUser,this.currentTaskFilter,50)),this.filterBudgetTasks();const d=this.budgetTasks.find(l=>l.id===e);window.EventBus.emit("task:budget-adjusted",{taskId:e,oldEstimate:(d==null?void 0:d.estimatedMinutes)||0,newEstimate:t,reason:s,adjustedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:budget-adjusted emitted")},successMessage:n.success.budgetUpdated(Math.round(t/60*10)/10),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500})}showAdjustBudgetDialog(e){window.DialogsModule&&window.DialogsModule.showAdjustBudgetDialog?window.DialogsModule.showAdjustBudgetDialog(e,this):console.error("DialogsModule not loaded")}showNotification(e,t="info"){window.NotificationSystem?window.NotificationSystem.show(e,t,3e3):console.warn("⚠️ Notification system not loaded:",e)}safeText(e){return y(e)}formatDate(e){return q(e)}formatDateTime(e){return V(e)}}const B=new wt;window.manager=B;window.addEventListener("beforeunload",()=>{console.log("🧹 Page unloading - cleaning up resources"),B.cleanup()});window.addEventListener("pagehide",()=>{console.log("🧹 Page hiding - cleaning up resources"),B.cleanup()});window.notificationBell=B.notificationBell;window.switchTab=Di;window.toggleNotifications=Li;window.clearAllNotifications=Ii;window.openSmartForm=ki;window.logout=dt;window.confirmLogout=bi;window.showLogin=Te;window.showForgotPassword=Ti;window.safeText=y;window.toggleTimesheetClientSelector=function(i){const e=document.getElementById("timesheetClientCaseSelector");e&&(i?e.style.display="none":e.style.display="")};window.formatDate=q;window.formatDateTime=V;window.formatShort=ue;window._firebase_loadClientsFromFirebase_ORIGINAL=ve;window._firebase_loadTimesheetFromFirebase_ORIGINAL=J;window._firebase_loadBudgetTasksFromFirebase_ORIGINAL=it;window._firebase_saveTimesheetToFirebase_ORIGINAL=nt;window._firebase_saveTimesheetToFirebase_v2_ORIGINAL=ot;window._firebase_saveBudgetTaskToFirebase_ORIGINAL=st;window._firebase_updateTimesheetEntryFirebase_ORIGINAL=rt;window._firebase_calculateClientHoursByCaseNumber_ORIGINAL=void 0;window._firebase_updateClientHoursImmediatelyByCaseNumber_ORIGINAL=void 0;window._firebase_calculateClientHoursAccurate_ORIGINAL=K;window._firebase_updateClientHoursImmediately_ORIGINAL=Ee;window._firebase_addTimeToTaskFirebase_ORIGINAL=at;window._firebase_completeTaskFirebase_ORIGINAL=ct;window._firebase_extendTaskDeadlineFirebase_ORIGINAL=lt;window.loadClientsFromFirebase=ve;window.loadTimesheetFromFirebase=J;window.loadBudgetTasksFromFirebase=it;window.saveTimesheetToFirebase=nt;window.saveTimesheetToFirebase_v2=ot;window.saveBudgetTaskToFirebase=st;window.updateTimesheetEntryFirebase=rt;window.calculateClientHoursByCaseNumber=void 0;window.updateClientHoursImmediatelyByCaseNumber=void 0;window.updateClientHoursImmediately=Ee;window.calculateClientHoursAccurate=K;window.addTimeToTaskFirebase=at;window.completeTaskFirebase=ct;window.extendTaskDeadlineFirebase=lt;(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")&&(window.debug=Zi,Logger.log("🐛 Debug tools enabled"));window.manager=B;window.LawOfficeManager=wt;window.getCacheStats=()=>{const i=B.dataCache.getStats();return console.log("📊 Data Cache Statistics:"),console.log("━".repeat(50)),console.log(`✅ Cache Hits: ${i.hits}`),console.log(`❌ Cache Misses: ${i.misses}`),console.log(`🔄 Background Revalidations: ${i.revalidations}`),console.log(`⚠️  Errors: ${i.errors}`),console.log(`📦 Cache Size: ${i.size} entries`),console.log(`📈 Hit Rate: ${i.hitRate}%`),console.log("━".repeat(50)),i};window.clearCache=()=>{const i=B.dataCache.clear();return console.log(`🗑️  Cache cleared: ${i} entries removed`),i};window.invalidateCache=i=>{const e=B.dataCache.invalidate(i);return console.log(e?`✅ Cache invalidated: ${i}`:`⚠️  Key not found: ${i}`),e};function Ie(){if(!window.EventBus){console.warn("⚠️ EventBus not available - skipping UI listeners");return}window.EventBus.on("system:data-loaded",i=>{Logger.log("👂 [UI] system:data-loaded received - hiding spinner"),window.hideSimpleLoading()}),window.EventBus.on("system:error",i=>{Logger.log("👂 [UI] system:error received:",i.message)}),Logger.log("✅ UI EventBus listeners initialized (v2.0)")}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Ie(),B.init()}):(Ie(),B.init());Logger.log("🎉 Law Office System v5.0.0 - Fully Modular - Ready");const Z={isMobile:!window.matchMedia("(hover: hover)").matches};function Se(i){return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1}function Xi(i,e){if(!i||!e||i.classList.contains("has-description-tooltip")||!Se(i))return;i.classList.add("is-truncated");const t=document.createElement("i");t.className="fas fa-info-circle description-info-icon",t.setAttribute("title","לחץ לצפייה במלל המלא"),t.setAttribute("data-full-text",e),Z.isMobile&&(t.classList.add("mobile-only"),t.addEventListener("click",o=>{o.stopPropagation(),se(e,i)}));const s=i.parentElement,n=s.querySelector(".combined-info-badge");n?s.insertBefore(t,n):s.appendChild(t),i.classList.add("has-description-tooltip")}function es(i){const e=document.createElement("div");e.className="description-tooltip";const t=document.createElement("div");return t.className="description-tooltip-content",t.textContent=i,e.appendChild(t),e}function ts(i,e){if(!i||!e||i.querySelector(".description-tooltip"))return;const t=es(e);i.appendChild(t)}let x=null;function se(i,e=null){x&&W();const t=document.createElement("div");t.className="description-popover-overlay",t.addEventListener("click",c=>{c.target===t&&W()});const s=document.createElement("div");s.className="description-popover";const n=document.createElement("div");n.className="description-popover-header";const o=document.createElement("div");o.className="description-popover-title",o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const r=document.createElement("button");r.className="description-popover-close",r.innerHTML='<i class="fas fa-times"></i>',r.setAttribute("aria-label","סגור"),r.addEventListener("click",W),n.appendChild(o),n.appendChild(r);const a=document.createElement("div");a.className="description-popover-body",a.textContent=i,s.appendChild(n),s.appendChild(a),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("active")}),x=t,document.addEventListener("keydown",yt)}function W(){x&&(x.classList.remove("active"),setTimeout(()=>{x&&x.parentElement&&x.remove(),x=null},200),document.removeEventListener("keydown",yt))}function yt(i){i.key==="Escape"&&W()}function is(i=document){const e=i.querySelectorAll(".td-description, .timesheet-cell-action, .task-description-cell");console.log("🔵 Description Tooltips: Found",e.length,"description cells"),e.forEach(t=>{const s=t.querySelector(".table-description-with-icons");if(!s)return;const n=s.querySelector("span");if(!n)return;const o=n.textContent.trim();if(!o)return;const r=Se(n);console.log("🔍 Checking truncation:",{text:o.substring(0,30)+"...",isTruncated:r,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),r&&(console.log("✅ Adding info icon for:",o.substring(0,30)+"..."),Xi(n,o),Z.isMobile||ts(t,o),Z.isMobile&&(t.style.cursor="pointer",t.addEventListener("click",a=>{a.target.closest(".combined-info-badge, .action-btn, button")||(a.stopPropagation(),se(o,t))})))})}function ss(i){if(!i)return;const e=i.textContent.trim();if(!e||i.querySelector(".card-description-info-icon")||!Se(i))return;const t=document.createElement("span");t.className="linear-card-title-text",t.textContent=e,i.textContent="",i.appendChild(t);const s=document.createElement("i");if(s.className="fas fa-info-circle card-description-info-icon",s.setAttribute("title","לחץ לצפייה בתיאור המלא"),s.addEventListener("click",n=>{n.stopPropagation(),se(e,i)}),i.appendChild(s),!Z.isMobile){const n=document.createElement("div");n.className="card-description-tooltip";const o=document.createElement("div");o.className="card-description-tooltip-content",o.textContent=e,n.appendChild(o),i.appendChild(n)}}function ns(i=document){i.querySelectorAll(".linear-card-title").forEach(t=>{ss(t)})}function X(i=document){is(i),ns(i)}function vt(i=document){i.querySelectorAll(".description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".card-description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".card-description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".has-description-tooltip").forEach(e=>{e.classList.remove("has-description-tooltip","is-truncated")}),i.querySelectorAll(".linear-card-title").forEach(e=>{const t=e.querySelector(".linear-card-title-text");t&&(e.textContent=t.textContent)}),requestAnimationFrame(()=>{setTimeout(()=>{console.log("⏰ Running truncation check after render..."),X(i)},50)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{X()}):X();let ke;window.addEventListener("resize",()=>{clearTimeout(ke),ke=setTimeout(()=>{vt()},300)});window.DescriptionTooltips={init:X,refresh:vt,showPopover:se,closePopover:W};(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")&&setTimeout(()=>{window.EventBus&&(window.EventBus.setDebugMode(!0),console.log("🎉 EventBus loaded and debug mode enabled!")),window.FirebaseService&&(window.FirebaseService.setDebugMode(!0),console.log("🎉 FirebaseService loaded and debug mode enabled!"))},1e3)});export default os();

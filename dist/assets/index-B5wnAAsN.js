var ft=(i,e)=>()=>(e||i((e={exports:{}}).exports,e),e.exports);var Wi=ft((Ki,C)=>{(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function t(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(n){if(n.ep)return;n.ep=!0;const o=t(n);fetch(n.href,o)}})();let gt=class{constructor(){this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 EventBus Debug Mode: ENABLED")}emit(e,t){const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if(!n||n.size===0){this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return}const o=Array.from(n).sort((c,d)=>d.priority-c.priority);let r=0,a=0;for(const c of o)try{c.callback(t),r++,c.once&&n.delete(c)}catch(d){a++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,d),this.emit("system:error",{error:d,context:`Event listener for ${String(e)}`,severity:"medium"})}const l=performance.now()-s;this.updateStats(e,l,a),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:l,listenersNotified:r,errors:a}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${l.toFixed(2)}ms (${r} listeners)`)}on(e,t,s={}){const{priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const r=this.listeners.get(e),a={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return r.add(a),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${a.id}, Priority: ${n})`),()=>{r.delete(a),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${a.id})`)}}once(e,t,s=0){return this.on(e,t,{priority:s,once:!0})}off(e){const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`))}clear(){this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log("🗑️ [EventBus] Cleared all listeners")}getHistory(){return[...this.history]}getLastEvents(e){return this.history.slice(-e)}clearHistory(){this.history=[],this.debugMode&&console.log("🗑️ [EventBus] History cleared")}getStats(){return{...this.stats}}resetStats(){this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log("🗑️ [EventBus] Statistics reset")}getEventSummary(){const e={};for(const[t,s]of this.listeners.entries())e[String(t)]=s.size;return e}replay(e=0,t){const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for(const n of s)this.emit(n.event,n.data)}addToHistory(e){this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift()}updateStats(e,t,s){this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o}};const pt=new gt;typeof window<"u"&&(window.EventBus=pt);class wt{constructor(){this.listeners=new Map,this.history=[],this.maxHistorySize=100,this.debugMode=!1,this.stats={totalEventsEmitted:0,totalListeners:0,eventCounts:{},averageEmitTime:0,errors:0},this.listenerIdCounter=0}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 EventBus Debug Mode: ENABLED")}emit(e,t){const s=performance.now();this.debugMode&&console.log(`📤 [EventBus] Emitting: ${String(e)}`,t);const n=this.listeners.get(e);if(!n||n.size===0){this.debugMode&&console.warn(`⚠️ [EventBus] No listeners for: ${String(e)}`);return}const o=Array.from(n).sort((c,d)=>d.priority-c.priority);let r=0,a=0;for(const c of o)try{c.callback(t),r++,c.once&&n.delete(c)}catch(d){a++,console.error(`❌ [EventBus] Error in listener for ${String(e)}:`,d),this.emit("system:error",{error:d,context:`Event listener for ${String(e)}`,severity:"medium"})}const l=performance.now()-s;this.updateStats(e,l,a),this.addToHistory({event:e,data:t,timestamp:Date.now(),duration:l,listenersNotified:r,errors:a}),this.debugMode&&console.log(`✅ [EventBus] ${String(e)} completed in ${l.toFixed(2)}ms (${r} listeners)`)}on(e,t,s={}){const{priority:n=0,once:o=!1}=s;this.listeners.has(e)||this.listeners.set(e,new Set);const r=this.listeners.get(e),a={callback:t,priority:n,once:o,id:`listener-${++this.listenerIdCounter}`};return r.add(a),this.stats.totalListeners++,this.debugMode&&console.log(`📥 [EventBus] Subscribed to: ${String(e)} (ID: ${a.id}, Priority: ${n})`),()=>{r.delete(a),this.stats.totalListeners--,this.debugMode&&console.log(`📤 [EventBus] Unsubscribed from: ${String(e)} (ID: ${a.id})`)}}once(e,t,s=0){return this.on(e,t,{priority:s,once:!0})}off(e){const t=this.listeners.get(e);t&&(this.stats.totalListeners-=t.size,this.listeners.delete(e),this.debugMode&&console.log(`🗑️ [EventBus] Removed all listeners for: ${String(e)}`))}clear(){this.listeners.clear(),this.stats.totalListeners=0,this.debugMode&&console.log("🗑️ [EventBus] Cleared all listeners")}getHistory(){return[...this.history]}getLastEvents(e){return this.history.slice(-e)}clearHistory(){this.history=[],this.debugMode&&console.log("🗑️ [EventBus] History cleared")}getStats(){return{...this.stats}}resetStats(){this.stats={totalEventsEmitted:0,totalListeners:this.stats.totalListeners,eventCounts:{},averageEmitTime:0,errors:0},this.debugMode&&console.log("🗑️ [EventBus] Statistics reset")}getEventSummary(){const e={};for(const[t,s]of this.listeners.entries())e[String(t)]=s.size;return e}replay(e=0,t){const s=t?this.history.slice(e,t):this.history.slice(e);console.log(`🔄 [EventBus] Replaying ${s.length} events...`);for(const n of s)this.emit(n.event,n.data)}addToHistory(e){this.history.push(e),this.history.length>this.maxHistorySize&&this.history.shift()}updateStats(e,t,s){this.stats.totalEventsEmitted++,this.stats.errors+=s;const n=String(e);this.stats.eventCounts[n]=(this.stats.eventCounts[n]||0)+1;const o=this.stats.totalEventsEmitted;this.stats.averageEmitTime=(this.stats.averageEmitTime*(o-1)+t)/o}}const U=new wt;typeof window<"u"&&(window.EventBus=U);class yt{constructor(){this.cache=new Map,this.queue=[],this.processingQueue=!1,this.rateLimitBucket={count:0,resetTime:Date.now()+1e3},this.maxRequestsPerSecond=10,this.inFlightRequests=new Map,this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:0},this.debugMode=!1}setDebugMode(e){this.debugMode=e,e&&console.log("🔍 FirebaseService Debug Mode: ENABLED")}async call(e,t={},s={}){const n=performance.now(),{retries:o=3,cacheTTL:r=0,timeout:a=3e4,priority:l=0,skipRateLimit:c=!1,onError:d}=s;this.debugMode&&console.log(`📤 [Firebase] Calling: ${e}`,t),this.stats.totalCalls++;try{if(r>0){const y=this.getFromCache(e,t);if(y)return this.debugMode&&console.log(`💾 [Firebase] Cache hit: ${e}`),this.stats.cachedCalls++,{success:!0,data:y,duration:performance.now()-n,cached:!0}}const u=this.getRequestKey(e,t);if(this.inFlightRequests.has(u))return this.debugMode&&console.log(`🔄 [Firebase] Deduplicating: ${e}`),this.inFlightRequests.get(u);if(!c&&!this.checkRateLimit())return this.debugMode&&console.log(`⏳ [Firebase] Rate limited, queuing: ${e}`),this.stats.rateLimitHits++,this.stats.queuedRequests++,new Promise((y,m)=>{this.queue.push({functionName:e,data:t,options:s,resolve:y,reject:m,priority:l,timestamp:Date.now()}),this.processQueue()});const g=this.executeCall(e,t,o,a,d);this.inFlightRequests.set(u,g);const p=await g;this.inFlightRequests.delete(u),p.success&&r>0&&this.addToCache(e,t,p.data,r),p.success?this.stats.successfulCalls++:this.stats.failedCalls++;const b=performance.now()-n;return this.updateAverageResponseTime(b),this.debugMode&&console.log(`✅ [Firebase] ${e} completed in ${b.toFixed(2)}ms`),U.emit("system:data-loaded",{dataType:e,recordCount:1,duration:b}),{...p,duration:b}}catch(u){this.stats.failedCalls++;const g=u instanceof Error?u.message:"Unknown error";return this.debugMode&&console.error(`❌ [Firebase] Error in ${e}:`,u),U.emit("system:error",{error:u,context:`Firebase function: ${e}`,severity:"high"}),{success:!1,error:g,duration:performance.now()-n}}}async executeCall(e,t,s,n,o){let r=null,a=0;for(let d=0;d<=s;d++)try{if(d>0){const g=Math.min(1e3*Math.pow(2,d-1),1e4);this.debugMode&&console.log(`⏳ [Firebase] Retry ${d}/${s} after ${g}ms for: ${e}`),await this.sleep(g),this.stats.retriedCalls++,a++}return{success:!0,data:await this.callWithTimeout(e,t,n),duration:0,retries:a}}catch(u){if(r=u,!this.isRetryableError(u)){this.debugMode&&console.log(`🚫 [Firebase] Non-retryable error: ${e}`);break}o&&o(r)}const l=(r==null?void 0:r.message)||"Unknown error",c=this.getErrorCode(r);return{success:!1,error:l,errorCode:c,duration:0,retries:a}}async callWithTimeout(e,t,s){const n=new Promise((a,l)=>{setTimeout(()=>{l(new Error(`Request timeout after ${s}ms`))},s)}),o=firebase.functions().httpsCallable(e)(t);return(await Promise.race([o,n])).data}isRetryableError(e){var t;return e?!!(e.code==="unavailable"||e.code==="deadline-exceeded"||(t=e.message)!=null&&t.includes("timeout")||e.code==="internal"||e.code==="unknown"):!1}getErrorCode(e){var t,s;if(e!=null&&e.code)return e.code;if((t=e==null?void 0:e.message)!=null&&t.includes("timeout"))return"timeout";if((s=e==null?void 0:e.message)!=null&&s.includes("network"))return"network"}checkRateLimit(){const e=Date.now();return e>=this.rateLimitBucket.resetTime&&(this.rateLimitBucket={count:0,resetTime:e+1e3}),this.rateLimitBucket.count<this.maxRequestsPerSecond?(this.rateLimitBucket.count++,!0):!1}async processQueue(){if(!(this.processingQueue||this.queue.length===0)){for(this.processingQueue=!0;this.queue.length>0;){if(!this.checkRateLimit()){await this.sleep(100);continue}this.queue.sort((t,s)=>s.priority-t.priority);const e=this.queue.shift();if(!e)break;this.stats.queuedRequests--;try{const t=await this.call(e.functionName,e.data,{...e.options,skipRateLimit:!0});e.resolve(t)}catch(t){e.reject(t)}}this.processingQueue=!1}}getCacheKey(e,t){return`${e}:${JSON.stringify(t)}`}getRequestKey(e,t){return this.getCacheKey(e,t)}getFromCache(e,t){const s=this.getCacheKey(e,t),n=this.cache.get(s);return n?Date.now()-n.timestamp>n.ttl?(this.cache.delete(s),null):n.data:null}addToCache(e,t,s,n){const o=this.getCacheKey(e,t);this.cache.set(o,{data:s,timestamp:Date.now(),ttl:n}),U.emit("system:cache-updated",{cacheKey:o,action:"add"})}clearCache(){this.cache.clear(),U.emit("system:cache-updated",{cacheKey:"all",action:"clear"}),this.debugMode&&console.log("🗑️ [Firebase] Cache cleared")}clearCacheEntry(e,t){const s=this.getCacheKey(e,t);this.cache.delete(s),U.emit("system:cache-updated",{cacheKey:s,action:"delete"})}getStats(){return{...this.stats}}resetStats(){this.stats={totalCalls:0,successfulCalls:0,failedCalls:0,cachedCalls:0,retriedCalls:0,averageResponseTime:0,rateLimitHits:0,queuedRequests:this.queue.length},this.debugMode&&console.log("🗑️ [Firebase] Statistics reset")}updateAverageResponseTime(e){const t=this.stats.totalCalls;this.stats.averageResponseTime=(this.stats.averageResponseTime*(t-1)+e)/t}sleep(e){return new Promise(t=>setTimeout(t,e))}}const vt=new yt;typeof window<"u"&&(window.FirebaseService=vt);function k(i){return i?i.type==="legal_procedure"&&i.stages&&Array.isArray(i.stages)?i.stages.filter(e=>e.status==="active"||e.status==="pending").reduce((e,t)=>{if(t.packages&&Array.isArray(t.packages)&&t.packages.length>0){const s=t.packages.filter(n=>n.status==="active"||n.status==="pending"||!n.status).reduce((n,o)=>n+(o.hoursRemaining||0),0);return e+s}return e+(t.hoursRemaining||0)},0):i.packages&&Array.isArray(i.packages)&&i.packages.length>0?i.packages.filter(t=>t.status==="active"||!t.status).reduce((t,s)=>t+(s.hoursRemaining||0),0):i.hoursRemaining||0:0}function x(i){return!i||!i.packages||i.packages.length===0?i.totalHours||0:i.packages.reduce((e,t)=>e+(t.hours||0),0)}function M(i){return!i||!i.packages||i.packages.length===0?i.hoursUsed||0:i.packages.reduce((e,t)=>e+(t.hoursUsed||0),0)}function ie(i){const e=x(i);if(e===0)return 0;const t=M(i);return Math.round(t/e*100*10)/10}function Be(i,e=2){return Math.round(i/60*Math.pow(10,e))/Math.pow(10,e)}function De(i){return Math.round(i*60)}function Ie(i,e=!1){if(!i||i===0)return"0 שעות";if(e){const t=Math.floor(i),s=Math.round((i-t)*60);return s===0?`${t} שעות`:`${t}:${s.toString().padStart(2,"0")} שעות`}return`${i.toFixed(1)} שעות`}typeof C<"u"&&C.exports&&(C.exports={calculateRemainingHours:k,calculateTotalHours:x,calculateHoursUsed:M,calculateProgress:ie,minutesToHours:Be,hoursToMinutes:De,formatHours:Ie});function ke(i,e){return i?e?!i.serviceType||!i.parentServiceId?{valid:!1,error:"המשימה חסרה מידע על שירות"}:i.serviceType==="legal_procedure"&&!i.serviceId?{valid:!1,error:"המשימה חסרה מידע על שלב"}:!e.services||e.services.length===0?{valid:!1,error:"ללקוח אין שירותים פעילים"}:{valid:!0}:{valid:!1,error:"לקוח לא נמצא"}:{valid:!1,error:"משימה לא נמצאה"}}function Le(i){const e=[];return(!i.hours||i.hours<=0)&&e.push("חובה להזין כמות שעות תקינה"),i.hours>500&&e.push("כמות שעות גבוהה מדי (מקסימום 500)"),(!i.type||!["initial","additional","renewal"].includes(i.type))&&e.push("סוג חבילה לא תקין"),{valid:e.length===0,errors:e}}function xe(i,e){const t=[];return(!i||i<=0)&&t.push("חובה להזין כמות שעות תקינה"),i>500&&t.push("כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)"),(!e||e.trim().length<3)&&t.push("חובה להזין סיבה/הערה (לפחות 3 תווים)"),{valid:t.length===0,errors:t}}function Me(i,e="hourly"){const t=[];return!Array.isArray(i)||i.length!==3?(t.push("חובה למלא בדיוק 3 שלבים"),{valid:!1,errors:t}):(i.forEach((s,n)=>{const o=n+1;(!s.description||!s.description.trim())&&t.push(`שלב ${o}: חובה למלא תיאור השלב`),e==="hourly"?((!s.hours||s.hours<=0)&&t.push(`שלב ${o}: חובה למלא תקרת שעות תקינה`),s.hours&&s.hours>1e3&&t.push(`שלב ${o}: תקרת שעות גבוהה מדי (מקסימום 1000)`)):((!s.fixedPrice||s.fixedPrice<=0)&&t.push(`שלב ${o}: חובה למלא מחיר פיקס תקין`),s.fixedPrice&&s.fixedPrice>1e6&&t.push(`שלב ${o}: מחיר גבוה מדי (מקסימום 1,000,000 ₪)`))}),{valid:t.length===0,errors:t})}function Ae(i,e){return!i||i<=0?{valid:!1,error:"כמות שעות לקיזוז חייבת להיות חיובית"}:i>24?{valid:!1,error:"לא ניתן לקזז יותר מ-24 שעות בפעולה אחת"}:e?{valid:!0}:{valid:!1,error:"לא נמצא שירות או שלב לקיזוז"}}typeof C<"u"&&C.exports&&(C.exports={validateTimeEntry:ke,validatePackage:Le,validateHoursPackage:xe,validateStages:Me,validateDeduction:Ae});function $e(i,e){return i&&(i.totalHours=x(i),i.hoursUsed=M(i),i.hoursRemaining=k(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e),i)}function se(i,e){return i&&(i.totalHours=x(i),i.hoursUsed=M(i),i.hoursRemaining=k(i),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.totalMinutes=Math.round(i.totalHours*60),i.lastActivity=new Date().toISOString(),i)}function Fe(i,e){if(!i||!i.services||i.services.length===0)return{};const t=i.services.reduce((o,r)=>o+(r.totalHours||0),0),s=i.services.reduce((o,r)=>o+(r.hoursUsed||0),0),n=i.services.reduce((o,r)=>o+k(r),0);return{totalHours:t,hoursUsed:s,hoursRemaining:n,minutesUsed:Math.round(s*60),minutesRemaining:Math.round(n*60),totalMinutes:Math.round(t*60),lastActivity:new Date().toISOString(),_lastModified:new Date().toISOString(),_modifiedBy:e||"system",_version:(i._version||0)+1}}function Ne(i,e){return!i||!i.stages||(i.stages.forEach(t=>{se(t)}),i.totalHours=i.stages.reduce((t,s)=>t+(s.totalHours||0),0),i.hoursUsed=i.stages.reduce((t,s)=>t+(s.hoursUsed||0),0),i.hoursRemaining=i.stages.reduce((t,s)=>t+k(s),0),i.minutesUsed=Math.round(i.hoursUsed*60),i.minutesRemaining=Math.round(i.hoursRemaining*60),i.lastActivity=new Date().toISOString(),i._lastModified=new Date().toISOString(),e&&(i._modifiedBy=e)),i}function _e(i,e){const t=Math.round(i*60);return{hoursUsed:e.increment(i),hoursRemaining:e.increment(-i),minutesUsed:e.increment(t),minutesRemaining:e.increment(-t),lastActivity:e.serverTimestamp(),_lastModified:e.serverTimestamp()}}typeof C<"u"&&C.exports&&(C.exports={updateServiceAggregates:$e,updateStageAggregates:se,updateClientAggregates:Fe,updateLegalProcedureAggregates:Ne,createIncrementUpdate:_e});function Re(i){return!i||!i.packages||i.packages.length===0?null:i.packages.find(e=>{const t=!e.status||e.status==="active",s=(e.hoursRemaining||0)>0;return t&&s})||null}function bt(i){return i?!i.packages||i.packages.length===0?i.hoursRemaining||0:i.packages.filter(e=>e.status==="active"||!e.status).reduce((e,t)=>e+(t.hoursRemaining||0),0):0}function Ue(i,e){return i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=(i.hoursRemaining||0)-e,i.status||(i.status="active"),i.hoursRemaining<=0&&(i.status="depleted",i.hoursRemaining=0,i.closedDate=new Date().toISOString()),i}function Pe(i,e){const t=Re(i);return t?(Ue(t,e),i.hoursUsed=(i.hoursUsed||0)+e,i.hoursRemaining=bt(i),{success:!0,packageId:t.id,stageId:i.id}):{success:!1,error:"אין חבילה פעילה לניכוי שעות"}}function Tt(i,e,t){const s=t/60,n={clientUpdate:null,error:null};if(e.serviceType==="legal_procedure"&&e.parentServiceId){const o=i.services||[],r=o.findIndex(g=>g.id===e.parentServiceId);if(r===-1)return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;const a=o[r],l=a.stages||[],c=l.findIndex(g=>g.id===e.serviceId);if(c===-1)return n.error=`שלב ${e.serviceId} לא נמצא בשירות`,n;const d=l[c],u=Pe(d,s);if(!u.success)return n.error=u.error,n;a.hoursUsed=(a.hoursUsed||0)+s,a.hoursRemaining=a.stages.reduce((g,p)=>g+(p.hoursRemaining||0),0),n.clientUpdate={[`services.${r}`]:a,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1}}else if(e.serviceType==="hours"&&e.parentServiceId){const o=i.services||[],r=o.findIndex(l=>l.id===e.parentServiceId);if(r===-1)return n.error=`שירות ${e.parentServiceId} לא נמצא`,n;const a=o[r];a.hoursUsed=(a.hoursUsed||0)+s,a.hoursRemaining=(a.hoursRemaining||0)-s,a.hoursRemaining<0&&(a.hoursRemaining=0),n.clientUpdate={[`services.${r}`]:a,hoursUsed:(i.hoursUsed||0)+s,_version:(i._version||0)+1}}else n.error="סוג שירות לא נתמך או חסר מידע";return n}function ne({stageId:i,type:e,hours:t,status:s,description:n}){return{id:`pkg_${e}_${i}_${Date.now()}`,type:e,hours:t,hoursUsed:0,hoursRemaining:t,status:s,description:n||(e==="initial"?"חבילה ראשונית":"חבילה נוספת"),createdAt:new Date().toISOString()}}function He({id:i,name:e,description:t,order:s,status:n,hours:o}){const r=ne({stageId:i,type:"initial",hours:o,status:n==="active"?"active":"pending"});return{id:i,name:e,description:t,order:s,status:n,totalHours:o,hoursUsed:0,hoursRemaining:o,packages:[r],createdAt:new Date().toISOString()}}function qe(i){if(!i||i.length!==3)throw new Error("Legal procedure requires exactly 3 stages");const e=["stage_a","stage_b","stage_c"],t=["שלב א'","שלב ב'","שלב ג'"];return i.map((s,n)=>He({id:e[n],name:t[n],description:s.description||"",order:n+1,status:n===0?"active":"pending",hours:s.hours||0}))}function Et({id:i,name:e,stagesData:t,currentStage:s}){const n=qe(t),o=n.reduce((r,a)=>r+a.totalHours,0);return{id:i,type:"legal_procedure",name:e,currentStage:s||"stage_a",stages:n,totalHours:o,hoursUsed:0,hoursRemaining:o,createdAt:new Date().toISOString()}}function St({id:i,name:e,hours:t}){return{id:i,type:"hours",name:e,totalHours:t,hoursUsed:0,hoursRemaining:t,createdAt:new Date().toISOString()}}function Ct(i,e,t){const s=ne({stageId:i.id,type:"additional",hours:e,status:i.status==="active"?"active":"pending",description:t});return i.packages.push(s),i.totalHours+=e,i.hoursRemaining+=e,s}const Oe={calculateRemainingHours:k,calculateTotalHours:x,calculateHoursUsed:M,calculateProgress:ie,minutesToHours:Be,hoursToMinutes:De,formatHours:Ie,validateTimeEntry:ke,validatePackage:Le,validateHoursPackage:xe,validateStages:Me,validateDeduction:Ae,updateServiceAggregates:$e,updateStageAggregates:se,updateClientAggregates:Fe,updateLegalProcedureAggregates:Ne,createIncrementUpdate:_e,getActivePackage:Re,deductHoursFromPackage:Ue,deductHoursFromStage:Pe,calculateClientUpdates:Tt,createPackage:ne,createStage:He,createLegalProcedureStages:qe,createLegalProcedureService:Et,createHourlyService:St,addPackageToStage:Ct};typeof window<"u"&&(window.DeductionSystem=Oe,window.calculateRemainingHours=k,window.calculateHoursUsed=M,window.calculateTotalHours=x,window.calculateProgress=ie);typeof C<"u"&&C.exports&&(C.exports=Oe);(function(){const i={DEFAULT_PAGE_SIZE:20};class e{constructor(){this.lastDocs={clients:null,budget_tasks:null,timesheet_entries:null},this.cache={clients:[],budget_tasks:[],timesheet_entries:[]},this.hasMore={clients:!0,budget_tasks:!0,timesheet_entries:!0}}_log(s,n=null){}_convertTimestamps(s){const n={...s};return["createdAt","updatedAt","completedAt","deadline","date"].forEach(r=>{var a;(a=n[r])!=null&&a.toDate&&typeof n[r].toDate=="function"&&(n[r]=n[r].toDate())}),n}reset(s){this.lastDocs[s]!==void 0&&(this.lastDocs[s]=null,this.cache[s]=[],this.hasMore[s]=!0,this._log(`Reset pagination for ${s}`))}resetAll(){Object.keys(this.lastDocs).forEach(s=>this.reset(s)),this._log("Reset all pagination")}async loadClientsPaginated(s=i.DEFAULT_PAGE_SIZE,n=!1){try{const o=window.firebaseDB;if(!o)throw new Error("Firebase לא מחובר");if(n||this.reset("clients"),!this.hasMore.clients&&n)return this._log("No more clients to load"),{items:[],hasMore:!1,total:this.cache.clients.length};let r=o.collection("clients").orderBy("createdAt","desc").limit(s);this.lastDocs.clients&&n&&(r=r.startAfter(this.lastDocs.clients)),this._log(`Loading clients (limit: ${s}, loadMore: ${n})`);const a=await r.get(),l=[];return a.forEach(c=>{const d=this._convertTimestamps(c.data());l.push({id:c.id,...d})}),a.docs.length>0&&(this.lastDocs.clients=a.docs[a.docs.length-1]),this.hasMore.clients=a.docs.length===s,n?this.cache.clients=[...this.cache.clients,...l]:this.cache.clients=l,this._log(`Loaded ${l.length} clients (hasMore: ${this.hasMore.clients})`),{items:l,hasMore:this.hasMore.clients,total:this.cache.clients.length}}catch(o){throw console.error("Firebase Pagination error (clients):",o),new Error("שגיאה בטעינת לקוחות: "+o.message)}}async loadBudgetTasksPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1,r="active"){try{const a=window.firebaseDB;if(!a)throw new Error("Firebase לא מחובר");const l=`budget_tasks_${r}`;if(o||this.reset(l),!this.hasMore[l]&&o)return this._log(`No more budget tasks to load (filter: ${r})`),{items:[],hasMore:!1,total:(this.cache[l]||[]).length};let c=a.collection("budget_tasks").where("employee","==",s).orderBy("createdAt","desc").limit(n);this.lastDocs[l]&&o&&(c=c.startAfter(this.lastDocs[l])),this._log(`Loading budget tasks for ${s} (limit: ${n}, loadMore: ${o}, filter: ${r})`);const d=await c.get(),u=[];d.forEach(p=>{const y={...this._convertTimestamps(p.data()),firebaseDocId:p.id};y.id||(y.id=p.id),u.push(y)});let g=u;return r==="active"?g=u.filter(p=>p.status!=="הושלם"):r==="completed"&&(g=u.filter(p=>p.status==="הושלם")),d.docs.length>0&&(this.lastDocs[l]=d.docs[d.docs.length-1]),this.hasMore[l]=d.docs.length===n,o?this.cache[l]=[...this.cache[l]||[],...g]:this.cache[l]=g,this._log(`Loaded ${g.length} budget tasks (hasMore: ${this.hasMore[l]}, filtered from ${u.length}, cacheKey: ${l})`),{items:g,hasMore:this.hasMore[l],total:(this.cache[l]||[]).length}}catch(a){throw console.error("Firebase Pagination error (budget_tasks):",a),new Error("שגיאה בטעינת משימות: "+a.message)}}async loadTimesheetPaginated(s,n=i.DEFAULT_PAGE_SIZE,o=!1){try{const r=window.firebaseDB;if(!r)throw new Error("Firebase לא מחובר");if(o||this.reset("timesheet_entries"),!this.hasMore.timesheet_entries&&o)return this._log("No more timesheet entries to load"),{items:[],hasMore:!1,total:this.cache.timesheet_entries.length};let a=r.collection("timesheet_entries").where("employee","==",s).orderBy("createdAt","desc").limit(n);this.lastDocs.timesheet_entries&&o&&(a=a.startAfter(this.lastDocs.timesheet_entries)),this._log(`Loading timesheet for ${s} (limit: ${n}, loadMore: ${o})`);const l=await a.get(),c=[];return l.forEach(d=>{const u=this._convertTimestamps(d.data());c.push({id:d.id,...u})}),l.docs.length>0&&(this.lastDocs.timesheet_entries=l.docs[l.docs.length-1]),this.hasMore.timesheet_entries=l.docs.length===n,o?this.cache.timesheet_entries=[...this.cache.timesheet_entries,...c]:this.cache.timesheet_entries=c,this._log(`Loaded ${c.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`),{items:c,hasMore:this.hasMore.timesheet_entries,total:this.cache.timesheet_entries.length}}catch(r){throw console.error("Firebase Pagination error (timesheet):",r),new Error("שגיאה בטעינת שעתון: "+r.message)}}getCachedData(s){return this.cache[s]||[]}getStatus(s){var n;return{collection:s,cachedItems:((n=this.cache[s])==null?void 0:n.length)||0,hasMore:this.hasMore[s],hasLastDoc:!!this.lastDocs[s]}}}window.FirebasePaginationModule={FirebasePaginationManager:e,create(){return new e}}})();(function(){const i={CACHE_TTL:3e5,DEBUG:!1},e={log:(...m)=>{i.DEBUG&&console.log("[EmployeesManager]",...m)},error:(...m)=>{console.error("[EmployeesManager ERROR]",...m)}};let t=null,s=0;function n(){return t&&Date.now()-s<i.CACHE_TTL}function o(){t=null,s=0,e.log("🗑️ Cache cleared")}async function r(m=!1){if(!window.firebaseDB)throw new Error("Firebase DB not available");if(!m&&n())return e.log("📦 Using cached employees"),t;try{e.log("🔄 Loading employees from Firebase...");const h=await window.firebaseDB.collection("employees").get(),f={};return h.forEach(v=>{const w=v.data();f[v.id]={email:v.id,username:w.username,password:w.password,name:w.name||w.displayName,displayName:w.displayName||w.name,isActive:w.isActive!==!1,role:w.role||"employee",createdAt:w.createdAt,updatedAt:w.updatedAt,lastLogin:w.lastLogin,loginCount:w.loginCount||0}}),t=f,s=Date.now(),e.log(`✅ Loaded ${Object.keys(f).length} employees`),f}catch(h){throw e.error("Failed to load employees:",h),h}}async function a(m){if(!window.firebaseDB)throw new Error("Firebase DB not available");try{const h=await window.firebaseDB.collection("employees").doc(m).get();if(!h.exists)return null;const f=h.data();return{username:h.id,password:f.password,name:f.name||f.displayName,displayName:f.displayName||f.name,email:f.email,isActive:f.isActive!==!1,role:f.role||"employee",createdAt:f.createdAt,updatedAt:f.updatedAt,lastLogin:f.lastLogin,loginCount:f.loginCount||0}}catch(h){throw e.error(`Failed to get employee ${m}:`,h),h}}async function l(m){if(!window.firebaseDB)throw new Error("Firebase DB not available");if(!m.email||!m.username||!m.password||!m.name)throw new Error("Missing required fields: email, username, password, name");if((await window.firebaseDB.collection("employees").doc(m.email).get()).exists)throw new Error(`Employee with email ${m.email} already exists`);try{const f={username:m.username,password:m.password,name:m.name,displayName:m.name,email:m.email,isActive:m.isActive!==!1,role:m.role||"employee",createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:m.createdBy||"admin",lastLogin:null,loginCount:0};return await window.firebaseDB.collection("employees").doc(m.email).set(f),o(),e.log(`✅ Employee ${m.username} (${m.email}) added successfully`),{success:!0,email:m.email,username:m.username}}catch(f){throw e.error("Failed to add employee:",f),f}}async function c(m,h){if(!window.firebaseDB)throw new Error("Firebase DB not available");let f=window.firebaseDB.collection("employees").doc(m),v=await f.get();if(!v.exists){const E=await window.firebaseDB.collection("employees").where("username","==",m).limit(1).get();if(E.empty)throw new Error(`Employee ${m} not found`);f=E.docs[0].ref,v=E.docs[0]}const w=v.data(),T=v.id;try{const E={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};return h.password!==void 0&&(E.password=h.password),h.name!==void 0&&(E.name=h.name,E.displayName=h.name),h.email!==void 0&&(E.email=h.email),h.isActive!==void 0&&(E.isActive=h.isActive),h.role!==void 0&&(E.role=h.role),await f.update(E),o(),e.log(`✅ Employee ${T} updated successfully`),{success:!0,email:T,username:w.username}}catch(E){throw e.error("Failed to update employee:",E),E}}async function d(m,h=!1){if(!window.firebaseDB)throw new Error("Firebase DB not available");let f=window.firebaseDB.collection("employees").doc(m),v=await f.get();if(!v.exists){const E=await window.firebaseDB.collection("employees").where("username","==",m).limit(1).get();if(E.empty)throw new Error(`Employee ${m} not found`);f=E.docs[0].ref,v=E.docs[0]}const w=v.data(),T=v.id;try{return h?(await f.delete(),e.log(`✅ Employee ${T} deleted permanently`)):(await f.update({isActive:!1,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.serverTimestamp()}),e.log(`✅ Employee ${T} deactivated`)),o(),{success:!0,email:T,username:w.username}}catch(E){throw e.error("Failed to delete employee:",E),E}}async function u(m){if(!window.firebaseDB)throw new Error("Firebase DB not available");let h=window.firebaseDB.collection("employees").doc(m),f=await h.get();if(!f.exists){const T=await window.firebaseDB.collection("employees").where("username","==",m).limit(1).get();if(T.empty)throw new Error(`Employee ${m} not found`);h=T.docs[0].ref,f=T.docs[0]}const v=f.data(),w=f.id;try{return await h.update({isActive:!0,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedAt:firebase.firestore.FieldValue.delete()}),o(),e.log(`✅ Employee ${w} restored`),{success:!0,email:w,username:v.username}}catch(T){throw e.error("Failed to restore employee:",T),T}}async function g(m,h){try{const f=await a(m);return f?f.isActive?f.password!==h?{success:!1,error:"סיסמה שגויה"}:(await window.firebaseDB.collection("employees").doc(m).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),e.log(`✅ User ${m} authenticated successfully`),{success:!0,employee:f}):{success:!1,error:"החשבון מושבת"}:{success:!1,error:"המשתמש לא קיים"}}catch(f){return e.error("Authentication failed:",f),{success:!1,error:"שגיאה באימות"}}}async function p(m){const h=await r(),f=[],v=m.toLowerCase();return Object.values(h).forEach(w=>{(w.username.toLowerCase().includes(v)||w.name.toLowerCase().includes(v)||w.email.toLowerCase().includes(v))&&f.push(w)}),f}async function b(){const m=await r();return Object.values(m).filter(h=>h.isActive)}async function y(){const m=await r(),h=Object.values(m);return{total:h.length,active:h.filter(f=>f.isActive).length,inactive:h.filter(f=>!f.isActive).length,admins:h.filter(f=>f.role==="admin").length,employees:h.filter(f=>f.role==="employee").length}}window.EmployeesManager={async loadAll(m=!1){return await r(m)},async get(m){return await a(m)},async add(m){return await l(m)},async update(m,h){return await c(m,h)},async delete(m,h=!1){return await d(m,h)},async restore(m){return await u(m)},async authenticate(m,h){return await g(m,h)},async search(m){return await p(m)},async getActive(){return await b()},async getStats(){return await y()},clearCache(){o()},config:i},e.log("📦 Employees Manager module loaded")})();function Bt(i){if(typeof i!="string")return String(i||"");const e=document.createElement("div");return e.textContent=i,e.innerHTML}window.isInWelcomeScreen=!1;const ze=document.createElement("style");ze.textContent=`
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
`;document.head.appendChild(ze);typeof window<"u"&&(window.calculateRemainingHours=k,window.calculateTotalHours=x,window.calculateHoursUsed=M,window.safeText=Bt);const Dt="modulepreload",It=function(i){return"/"+i},ve={},V=function(e,t,s){let n=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),a=(r==null?void 0:r.nonce)||(r==null?void 0:r.getAttribute("nonce"));n=Promise.allSettled(t.map(l=>{if(l=It(l),l in ve)return;ve[l]=!0;const c=l.endsWith(".css"),d=c?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${d}`))return;const u=document.createElement("link");if(u.rel=c?"stylesheet":Dt,c||(u.as="script"),u.crossOrigin="",u.href=l,a&&u.setAttribute("nonce",a),document.head.appendChild(u),c)return new Promise((g,p)=>{u.addEventListener("load",g),u.addEventListener("error",()=>p(new Error(`Unable to preload CSS for ${l}`)))})}))}function o(r){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=r,window.dispatchEvent(a),!a.defaultPrevented)throw r}return n.then(r=>{for(const a of r||[])a.status==="rejected"&&o(a.reason);return e().catch(o)})},kt="budget",Lt=!1,xt={documentClick:null,documentKeydown:null,windowResize:null,notificationClick:null};function S(i){if(typeof i!="string")return String(i||"");const e=document.createElement("div");return e.textContent=i,e.innerHTML}function Mt(i){return new Promise(e=>setTimeout(e,i))}function Ve(i,e){let t;return function(...n){const o=()=>{clearTimeout(t),i(...n)};clearTimeout(t),t=setTimeout(o,e)}}window.isInWelcomeScreen=!1;const We=document.createElement("style");We.textContent=`
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
`;document.head.appendChild(We);const q=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatDateTime(i))||"-"},B=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatDate(i))||"-"},oe=i=>{var e;return((e=window.DatesModule)==null?void 0:e.formatShort(i))||"-"};typeof window<"u"&&(window.calculateRemainingHours=k,window.calculateTotalHours=x,window.calculateHoursUsed=M,window.safeText=S);const At=Object.freeze(Object.defineProperty({__proto__:null,calculateHoursUsed:M,calculateRemainingHours:k,calculateTotalHours:x,currentActiveTab:kt,debounce:Ve,delay:Mt,formatDate:B,formatDateTime:q,formatShort:oe,globalListeners:xt,isScrolled:Lt,safeText:S},Symbol.toStringTag,{value:"Module"}));class $t{constructor(){this.elements=new Map}getElementById(e){if(this.elements.has(e))return this.elements.get(e);const t=document.getElementById(e);return t&&this.elements.set(e,t),t}querySelector(e){if(this.elements.has(e))return this.elements.get(e);const t=document.querySelector(e);return t&&this.elements.set(e,t),t}clear(){this.elements.clear()}remove(e){this.elements.delete(e)}}class re{constructor(e={}){this.maxAge=e.maxAge||5*60*1e3,this.staleWhileRevalidate=e.staleWhileRevalidate!==!1,this.staleAge=e.staleAge||10*60*1e3,this.storage=e.storage||"memory",this.onError=e.onError||(t=>console.error("[DataCache]",t)),this.debug=e.debug||!1,this.namespace=e.namespace||"dataCache",this.cache=new Map,this.stats={hits:0,misses:0,revalidations:0,errors:0},this.pendingRevalidations=new Map,this.storage==="localStorage"&&!this._isLocalStorageAvailable()&&(this._log("warn","localStorage not available, falling back to memory"),this.storage="memory"),this._log("info","DataCache initialized",{maxAge:this.maxAge,staleAge:this.staleAge,storage:this.storage,staleWhileRevalidate:this.staleWhileRevalidate})}async get(e,t,s={}){if(!e||typeof e!="string")throw new Error("[DataCache] Key must be a non-empty string");if(typeof t!="function")throw new Error("[DataCache] fetchFunction must be a function");if(s.force)return this._log("info",`Force fetch for key: ${e}`),await this._fetchAndCache(e,t);const n=Date.now(),o=this._getEntry(e);if(!o)return this.stats.misses++,this._log("info",`Cache MISS for key: ${e}`),await this._fetchAndCache(e,t);const r=s.maxAge||this.maxAge,a=n-o.timestamp,l=a<r,c=a>=r&&a<r+this.staleAge;if(a>=r+this.staleAge)return this.stats.misses++,this._log("info",`Cache EXPIRED for key: ${e} (age: ${a}ms)`),await this._fetchAndCache(e,t);if(l)return this.stats.hits++,this._log("info",`Cache HIT (fresh) for key: ${e} (age: ${a}ms)`),o.data;if(c&&this.staleWhileRevalidate){this.stats.hits++,this._log("info",`Cache HIT (stale) for key: ${e} (age: ${a}ms) - revalidating in background`);const u=o.data;return this._revalidateInBackground(e,t),u}return this.stats.misses++,await this._fetchAndCache(e,t)}async _fetchAndCache(e,t){try{const s=await t();return this._setEntry(e,s),s}catch(s){throw this.stats.errors++,this._log("error",`Error fetching data for key: ${e}`,s),this.onError(s),s}}_revalidateInBackground(e,t){if(this.pendingRevalidations.has(e)){this._log("debug",`Revalidation already in progress for key: ${e}`);return}this.stats.revalidations++;const s=(async()=>{try{this._log("debug",`Starting background revalidation for key: ${e}`);const n=await t();this._setEntry(e,n),this._log("debug",`Background revalidation complete for key: ${e}`)}catch(n){this.stats.errors++,this._log("error",`Background revalidation failed for key: ${e}`,n),this.onError(n)}finally{this.pendingRevalidations.delete(e)}})();this.pendingRevalidations.set(e,s)}_getEntry(e){if(this.storage==="memory")return this.cache.get(e)||null;if(this.storage==="localStorage")try{const t=localStorage.getItem(this._getStorageKey(e));return t?JSON.parse(t):null}catch(t){return this._log("error","Error reading from localStorage",t),null}return null}_setEntry(e,t){const s=Date.now(),n={data:t,timestamp:s,expiresAt:s+this.maxAge};if(this.storage==="memory"&&this.cache.set(e,n),this.storage==="localStorage")try{localStorage.setItem(this._getStorageKey(e),JSON.stringify(n))}catch(o){this._log("error","Error writing to localStorage",o),this.stats.errors++,this.cache.set(e,n)}this._log("debug",`Cached data for key: ${e}`)}invalidate(e){this._log("info",`Invalidating cache for key: ${e}`);let t=!1;if(this.storage==="memory"&&(t=this.cache.delete(e)),this.storage==="localStorage"){const s=this._getStorageKey(e);t=localStorage.getItem(s)!==null,localStorage.removeItem(s)}return this.pendingRevalidations.has(e)&&this.pendingRevalidations.delete(e),t}clear(){this._log("info","Clearing all cache entries");let e=0;if(this.storage==="memory"&&(e=this.cache.size,this.cache.clear()),this.storage==="localStorage"){const t=Object.keys(localStorage),s=this._getStorageKey("");t.forEach(n=>{n.startsWith(s)&&(localStorage.removeItem(n),e++)})}return this.pendingRevalidations.clear(),e}getStats(){const e=this.stats.hits+this.stats.misses,t=e>0?Math.round(this.stats.hits/e*100):0;return{...this.stats,size:this.storage==="memory"?this.cache.size:this._getLocalStorageSize(),hitRate:t}}resetStats(){this.stats={hits:0,misses:0,revalidations:0,errors:0},this._log("info","Statistics reset")}_getStorageKey(e){return`${this.namespace}:${e}`}_getLocalStorageSize(){const e=Object.keys(localStorage),t=this._getStorageKey("");return e.filter(s=>s.startsWith(t)).length}_isLocalStorageAvailable(){try{const e="__localStorage_test__";return localStorage.setItem(e,e),localStorage.removeItem(e),!0}catch{return!1}}_log(e,t,s){if(!this.debug&&e==="debug")return;const n="[DataCache]",o=new Date().toISOString();s?console[e==="debug"?"log":e](`${n} ${o} ${t}`,s):console[e==="debug"?"log":e](`${n} ${o} ${t}`)}}typeof C<"u"&&C.exports&&(C.exports=re);typeof window<"u"&&(window.DataCache=re);const ae={TASK_FILTER:"active",TIMESHEET_FILTER:"month",BUDGET_VIEW:"cards",TIMESHEET_VIEW:"table",BUDGET_SORT:"recent",TIMESHEET_SORT:"recent"},le=["taskFilter","timesheetFilter","currentPage","searchQuery"],ce=["budgetView","timesheetView","budgetSort","timesheetSort"];function de(i){return le.includes(i)}function ue(i){return ce.includes(i)}function Ft(i){return ae[i]}function Nt(i){const e=i.replace(/([A-Z])/g,"_$1").toUpperCase(),t=ae[e];if(de(i))return t;if(ue(i)){const s=localStorage.getItem(i);return s!==null?s:t}return t}function _t(i,e){return de(i)?(console.debug(`⚠️ ${i} is session-only, not persisting to localStorage`),!1):ue(i)?(localStorage.setItem(i,e),console.debug(`✅ ${i} persisted to localStorage: ${e}`),!0):(console.warn(`⚠️ Unknown state key: ${i}`),!1)}function Rt(i=!1){ce.forEach(e=>{localStorage.removeItem(e)}),i&&le.forEach(e=>{localStorage.removeItem(e)}),console.log("✅ State cleared")}const L={DEFAULTS:ae,SESSION_ONLY_KEYS:le,PERSISTED_KEYS:ce,isSessionOnly:de,isPersisted:ue,getDefault:Ft,getStateValue:Nt,setStateValue:_t,clearAllState:Rt};class Ut{constructor(){this.errors=[]}validateClientCase(e){return e?!e.clientId||!e.clientName?(this.errors.push("חובה לבחור לקוח"),!1):e.caseId?!0:(this.errors.push("חובה לבחור תיק"),!1):(this.errors.push("חובה לבחור לקוח ותיק"),!1)}validateBranch(e){return!e||e.trim()===""?(this.errors.push("חובה לבחור סניף מטפל"),!1):["רחובות","תל אביב"].includes(e)?!0:(this.errors.push("סניף לא תקין. אנא בחר מהרשימה"),!1)}validateDeadline(e){if(!e||e.trim()==="")return this.errors.push("חובה לבחור תאריך יעד"),!1;const t=new Date(e),s=new Date,n=new Date(s.getFullYear(),s.getMonth(),s.getDate());return t<n?(this.errors.push("תאריך היעד לא יכול להיות בעבר"),!1):!0}validateEstimatedTime(e){const t=parseInt(e);return!e||isNaN(t)?(this.errors.push("חובה להזין זמן משוער בדקות"),!1):t<1?(this.errors.push("זמן משוער חייב להיות לפחות 1 דקה"),!1):t>9999?(this.errors.push("זמן משוער גבוה מדי (מקסימום 9999 דקות)"),!1):!0}validateDescription(e){return!e||e.trim().length<3?(this.errors.push("תיאור המשימה חייב להכיל לפחות 3 תווים"),!1):e.trim().length>500?(this.errors.push("תיאור המשימה ארוך מדי (מקסימום 500 תווים)"),!1):!0}validateAll(e){return this.errors=[],this.validateClientCase(e.selectorValues),this.validateBranch(e.branch),this.validateDeadline(e.deadline),this.validateEstimatedTime(e.estimatedTime),this.validateDescription(e.description),{isValid:this.errors.length===0,errors:[...this.errors]}}showErrors(e,t=null){if(!(!e||e.length===0)){if(window.NotificationSystem){const s=e.join(`
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
`))}}clearErrors(e=null){if(this.errors=[],e){const t=e.querySelector(".validation-errors");t&&t.remove()}}markInvalid(e){e&&(e.classList.add("invalid"),e.style.borderColor="#ef4444",e.style.boxShadow="0 0 0 3px rgba(239, 68, 68, 0.1)")}markValid(e){e&&(e.classList.remove("invalid"),e.style.borderColor="",e.style.boxShadow="")}setupRealTimeValidation(e,t){!e||!t||(e.addEventListener("blur",()=>{t(e.value)?this.markValid(e):this.markInvalid(e)}),e.addEventListener("input",()=>{e.classList.contains("invalid")&&this.markValid(e)}))}}const te="addTaskDraft";class Pt{constructor(e="addTaskForm"){this.formId=e,this.form=null}init(){this.form=document.getElementById(this.formId),this.form||console.warn(`⚠️ Form #${this.formId} not found`)}fillDefaults(e={}){if(!this.form){console.error("❌ Form not initialized");return}if(!e.deadline){const t=new Date;t.setDate(t.getDate()+1),t.setHours(17,0,0,0);const s=this.form.querySelector("#taskDeadline");if(s){const n=t.toISOString().slice(0,16);s.value=n}}if(!e.estimatedTime){const t=this.form.querySelector("#taskEstimatedTime");t&&(t.value="60")}if(e.branch){const t=this.form.querySelector("#taskBranch");t&&(t.value=e.branch)}}clear(){var s,n;if(!this.form){console.error("❌ Form not initialized");return}this.form.reset(),window.ClientCaseSelectorsManager&&((n=(s=window.ClientCaseSelectorsManager).clearBudget)==null||n.call(s));const e=this.form.querySelector("#taskDescriptionSelector");if(e&&window.SmartComboSelector){const o=e._smartComboInstance;o!=null&&o.clear&&o.clear()}this.form.querySelectorAll('input[type="hidden"]').forEach(o=>o.value=""),console.log("✅ Form cleared")}saveDraft(){try{const t={...this.getFormData(),savedAt:new Date().toISOString()};return localStorage.setItem(te,JSON.stringify(t)),console.log("✅ Draft saved"),!0}catch(e){return console.error("❌ Failed to save draft:",e),!1}}loadDraft(){try{const e=localStorage.getItem(te);if(!e)return null;const t=JSON.parse(e),s=new Date(t.savedAt);return(new Date-s)/(1e3*60*60*24)>7?(console.log("⏰ Draft is too old, clearing..."),this.clearDraft(),null):(console.log("✅ Draft loaded"),t)}catch(e){return console.error("❌ Failed to load draft:",e),null}}clearDraft(){try{localStorage.removeItem(te),console.log("✅ Draft cleared")}catch(e){console.error("❌ Failed to clear draft:",e)}}fillWithDraft(e){if(!(!this.form||!e)){if(e.branch){const t=this.form.querySelector("#taskBranch");t&&(t.value=e.branch)}if(e.deadline){const t=this.form.querySelector("#taskDeadline");t&&(t.value=e.deadline)}if(e.estimatedTime){const t=this.form.querySelector("#taskEstimatedTime");t&&(t.value=e.estimatedTime)}if(e.description){const t=this.form.querySelector("#taskDescription");t&&(t.value=e.description)}console.log("✅ Form filled with draft data")}}getFormData(){var l,c,d,u,g,p;if(!this.form)return console.error("❌ Form not initialized"),{};const e=((c=(l=window.ClientCaseSelectorsManager)==null?void 0:l.getBudgetValues)==null?void 0:c.call(l))||{},t=((d=this.form.querySelector("#taskBranch"))==null?void 0:d.value)||"",s=((u=this.form.querySelector("#budgetDeadline"))==null?void 0:u.value)||"",n=((g=this.form.querySelector("#estimatedTime"))==null?void 0:g.value)||"";let o="";document.getElementById("taskDescriptionGuided")&&window._currentTaskDescriptionInput?o=window._currentTaskDescriptionInput.getValue():o=((p=this.form.querySelector("#budgetDescription"))==null?void 0:p.value)||"";const a="";return{...e,branch:t,deadline:s,estimatedTime:parseInt(n)||0,description:o,categoryId:a,categoryName:this.getCategoryName(a)}}getCategoryName(e){if(!e||!window.WorkCategories)return null;const t=window.WorkCategories.getCategoryById(e);return(t==null?void 0:t.name)||null}hasUnsavedChanges(){const e=this.getFormData();return!!(e.description||e.branch||e.estimatedTime||e.clientId)}async promptSaveDraft(){var t;return this.hasUnsavedChanges()?(t=window.NotificationSystem)!=null&&t.confirm?new Promise(s=>{window.NotificationSystem.confirm("יש לך שינויים לא שמורים. האם לשמור כטיוטה?",()=>{this.saveDraft(),s(!0)},()=>{s(!0)},{title:"שמירת טיוטה",confirmText:"כן, שמור",cancelText:"לא, המשך בלי לשמור"})}):(confirm("יש לך שינויים לא שמורים. האם לשמור כטיוטה?")&&this.saveDraft(),!0):!0}}function Ht(i,e){if(!i)throw new Error("Form data is required");if(!e)throw new Error("Current user is required");return{description:i.description||"",categoryId:i.categoryId||null,categoryName:i.categoryName||null,clientName:i.clientName||"",clientId:i.clientId||"",caseId:i.caseId||"",caseNumber:i.caseNumber||"",caseTitle:i.caseTitle||"",serviceId:i.serviceId||"",serviceName:i.serviceName||"",serviceType:i.serviceType||"",parentServiceId:i.parentServiceId||null,branch:i.branch||"",estimatedMinutes:parseInt(i.estimatedMinutes)||0,originalEstimate:parseInt(i.estimatedMinutes)||0,deadline:i.deadline||"",employee:e,status:"active",timeSpent:0,actualMinutes:0,timeEntries:[],createdAt:new Date,updatedAt:new Date}}function qt(i){const e=[];return(!i.description||i.description.trim().length<3)&&e.push("תיאור המשימה חייב להכיל לפחות 3 תווים"),i.clientId||e.push("חובה לבחור לקוח"),i.caseId||e.push("חובה לבחור תיק"),i.branch||e.push("חובה לבחור סניף מטפל"),(!i.estimatedMinutes||i.estimatedMinutes<1)&&e.push("זמן משוער חייב להיות לפחות 1 דקה"),i.deadline||e.push("חובה לבחור תאריך יעד"),i.employee||e.push("חסר מידע על העובד המבצע"),{isValid:e.length===0,errors:e}}class Ot{constructor(e,t={}){this.manager=e,this.options={onSuccess:t.onSuccess||null,onError:t.onError||null,onCancel:t.onCancel||null,enableDrafts:t.enableDrafts!==!1,...t},this.validator=new Ut,this.formManager=new Pt("addTaskForm"),this.overlay=null,this.isVisible=!1,this.clientCaseSelector=null,this.descriptionSelector=null,console.log("✅ AddTaskDialog instance created")}show(){if(console.log("🔍 AddTaskDialog.show() called"),this.isVisible){console.warn("⚠️ Dialog is already visible");return}try{console.log("🔍 Calling render()..."),this.render(),this.isVisible=!0,console.log("✅ Add Task Dialog shown successfully")}catch(e){throw console.error("❌ Error showing Add Task Dialog:",e),console.error("Stack trace:",e.stack),e}}async hide(){this.isVisible&&(this.options.enableDrafts&&this.formManager.hasUnsavedChanges()&&!await this.formManager.promptSaveDraft()||(this.overlay&&this.overlay.classList.add("hidden"),this.isVisible=!1,this.options.onCancel&&this.options.onCancel(),console.log("✅ Add Task Dialog hidden")))}render(){console.log("🔍 render() called");try{const e=this.buildHTML();console.log("✅ buildHTML() completed");const t=document.getElementById("budgetTab");if(!t)throw console.error("❌ budgetTab not found - element does not exist in DOM"),console.log("Available elements:",document.querySelectorAll('[id*="budget"]')),new Error("budgetTab element not found");console.log("✅ budgetTab found:",t);const s=document.createElement("div");if(s.innerHTML=e,this.overlay=s.firstElementChild,console.log("✅ overlay created:",this.overlay),t.insertBefore(this.overlay,t.firstChild),console.log("✅ overlay inserted into budgetTab"),this.overlay.classList.remove("hidden"),console.log("✅ hidden class removed"),this.formManager.init(),console.log("✅ form manager initialized"),this.setupEventListeners(),console.log("✅ event listeners setup"),setTimeout(()=>this.initializeSelectors(),100),console.log("✅ selectors initialization scheduled"),this.options.enableDrafts){const n=this.formManager.loadDraft();n?this.showDraftPrompt(n):this.formManager.fillDefaults()}else this.formManager.fillDefaults();console.log("✅ render() completed successfully")}catch(e){throw console.error("❌ Error in render():",e),console.error("Stack trace:",e.stack),e}}buildHTML(){return`
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
    `}setupEventListeners(){const e=document.getElementById("addTaskForm");e&&(e.addEventListener("submit",t=>{t.preventDefault(),this.handleSubmit()}),this.overlay&&this.overlay.addEventListener("click",t=>{t.target===this.overlay&&this.hide()}),document.addEventListener("keydown",this.handleEscapeKey.bind(this)),console.log("✅ Event listeners setup"))}handleEscapeKey(e){e.key==="Escape"&&this.isVisible&&this.hide()}async initializeSelectors(){try{await this.initClientCaseSelector(),await this.initDescriptionSelector(),console.log("✅ Selectors initialized")}catch(e){console.error("❌ Error initializing selectors:",e)}}async initClientCaseSelector(){if(!window.ClientCaseSelectorsManager){console.error("❌ ClientCaseSelectorsManager not available");return}if(document.getElementById("addTaskClientCaseSelector"))try{await window.ClientCaseSelectorsManager.initializeBudgetSelector(this.manager.clients,this.manager.currentUser),this.clientCaseSelector=window.ClientCaseSelectorsManager,console.log("✅ ClientCaseSelector initialized")}catch(t){console.error("❌ Error initializing ClientCaseSelector:",t)}}async initDescriptionSelector(){if(!window.GuidedTextInput){console.warn("⚠️ GuidedTextInput not available");return}if(document.getElementById("taskDescriptionGuided"))try{this.descriptionSelector=new window.GuidedTextInput("taskDescriptionGuided",{maxChars:50,placeholder:"תאר את המשימה בקצרה...",required:!0,showQuickSuggestions:!0,showRecentItems:!0}),window._currentTaskDescriptionInput=this.descriptionSelector,console.log("✅ GuidedTextInput initialized for task description")}catch(t){console.error("❌ Error initializing GuidedTextInput:",t)}}async handleSubmit(){try{console.log("📝 Processing form submission...");const e=this.formManager.getFormData();if(this.descriptionSelector&&this.descriptionSelector.validate){const r=this.descriptionSelector.validate();if(!r.valid){window.NotificationSystem&&window.NotificationSystem.show(r.error,"error");return}}const t=this.validator.validateAll({selectorValues:e,branch:e.branch,deadline:e.deadline,estimatedTime:e.estimatedTime,description:e.description});if(!t.isValid){const r=document.getElementById("taskFormErrors");this.validator.showErrors(t.errors,r);return}const s=Ht(e,this.manager.currentUser),n=qt(s);if(!n.isValid){const r=document.getElementById("taskFormErrors");this.validator.showErrors(n.errors,r);return}const o=document.getElementById("addTaskSubmitBtn");o&&(o.disabled=!0,o.innerHTML='<i class="fas fa-spinner fa-spin"></i> שומר...'),await this.saveTask(s)}catch(e){console.error("❌ Error submitting form:",e),window.NotificationSystem?window.NotificationSystem.show("שגיאה בשמירת המשימה: "+e.message,"error"):alert("שגיאה בשמירת המשימה: "+e.message);const t=document.getElementById("addTaskSubmitBtn");t&&(t.disabled=!1,t.innerHTML='<i class="fas fa-plus"></i> הוסף לתקצוב'),this.options.onError&&this.options.onError(e)}}async saveTask(e){var t;try{console.log("💾 Saving task with approval request...",e);const s={...e,status:"pending_approval",requestedMinutes:e.estimatedMinutes,approvedMinutes:null,approvalId:null};if(window.FirebaseService){const n=await window.FirebaseService.call("createBudgetTask",s,{retries:3,timeout:15e3});if(!n.success)throw new Error(n.error||"Failed to create task");const o=(t=n.data)==null?void 0:t.taskId;console.log("✅ Task created with pending_approval status:",o);try{const{taskApprovalService:r}=await V(async()=>{const{taskApprovalService:l}=await import("./task-approval-service-D3rkbQAY.js");return{taskApprovalService:l}},[]);window.firebaseDB&&this.manager.currentUser&&r.init(window.firebaseDB,this.manager.currentUser);const a=await r.createApprovalRequest(o,e,this.manager.currentUser.email||this.manager.currentUser,this.manager.currentUser.displayName||this.manager.currentUser.email||"משתמש");console.log("✅ Approval request created:",a),window.firebaseDB&&await window.firebaseDB.collection("budget_tasks").doc(o).update({approvalId:a})}catch(r){console.error("⚠️ Error creating approval request:",r)}window.EventBus&&window.EventBus.emit("task:created",{taskId:o||"unknown",clientId:e.clientId,clientName:e.clientName,employee:e.employee,status:"pending_approval"}),this.options.enableDrafts&&this.formManager.clearDraft(),this.descriptionSelector&&this.descriptionSelector.saveToRecent&&this.descriptionSelector.saveToRecent(),window.NotificationSystem&&window.NotificationSystem.show(`המשימה הועברה למנהל לאישור תקציב

תקציב מבוקש: ${e.estimatedMinutes} דקות

תקבל התראה באייקון המעטפה כשהמנהל יאשר`,"success",5e3),this.options.onSuccess&&this.options.onSuccess(e),this.hide()}else throw new Error("FirebaseService לא זמין")}catch(s){throw console.error("❌ Error saving task:",s),s}}showDraftPrompt(e){var t;if(!((t=window.NotificationSystem)!=null&&t.confirm)){this.formManager.fillWithDraft(e);return}window.NotificationSystem.confirm("נמצאה טיוטה שמורה. האם לטעון אותה?",()=>{this.formManager.fillWithDraft(e)},()=>{this.formManager.clearDraft(),this.formManager.fillDefaults()},{title:"טיוטה שמורה",confirmText:"כן, טען",cancelText:"לא תודה"})}cleanup(){document.removeEventListener("keydown",this.handleEscapeKey.bind(this)),this.clientCaseSelector=null,this.descriptionSelector=null,console.log("✅ AddTaskDialog cleaned up")}}function zt(i,e={}){if(console.log("🚀 Initializing Add Task System v2.0..."),!i)throw new Error("❌ Manager is required for Add Task System");const t=new Ot(i,e);return typeof window<"u"&&(window.AddTaskSystem={dialog:t,show:()=>t.show(),hide:()=>t.hide(),version:"2.0.0"}),console.log("✅ Add Task System v2.0 initialized"),t}class Vt{constructor(){this.announcements=[],this.currentIndex=0,this.isPaused=!1,this.isVisible=!1,this.autoplayInterval=null,this.scrollAnimationDuration=240,this.container=null,this.textElement=null,this.dotsContainer=null,this.unsubscribe=null,this.db=null,this.user=null,this.userRole=null,console.log("📢 SystemAnnouncementTicker initialized")}async init(e,t){if(console.log("🚀 Initializing SystemAnnouncementTicker..."),!e||!t){console.error("❌ Missing user or db in ticker init");return}if(this.user=e,this.db=t,this.isDismissed()){console.log("ℹ️ Ticker was dismissed by user");return}await this.fetchUserRole(),this.render(),this.listenToAnnouncements(),console.log("✅ SystemAnnouncementTicker ready")}isDismissed(){if(localStorage.getItem("system_ticker_dismissed")!=="true")return!1;const t=localStorage.getItem("system_ticker_dismissed_at");if(!t)return!1;const s=parseInt(t);return(Date.now()-s)/(1e3*60*60)>24?(localStorage.removeItem("system_ticker_dismissed"),localStorage.removeItem("system_ticker_dismissed_at"),!1):!0}async fetchUserRole(){try{if(console.log("👤 Fetching user role from Firestore..."),!this.user||!this.user.email){console.warn("⚠️ No user email available"),this.userRole=null;return}const e=await this.db.collection("employees").doc(this.user.email).get();if(!e.exists){console.warn(`⚠️ User document not found: ${this.user.email}`),this.userRole=null;return}const t=e.data();this.userRole=t.role||"employee",console.log(`✅ User role fetched: ${this.userRole} (email: ${this.user.email})`)}catch(e){console.error("❌ Error fetching user role:",e),this.userRole=null}}shouldShowToUser(e){return!e||e==="all"?(console.log(`✅ shouldShowToUser: targetAudience='${e}' → showing to all users`),!0):this.userRole?e==="admins"&&this.userRole==="admin"?(console.log("✅ shouldShowToUser: targetAudience='admins', userRole='admin' → SHOW"),!0):e==="employees"&&this.userRole==="employee"?(console.log("✅ shouldShowToUser: targetAudience='employees', userRole='employee' → SHOW"),!0):e==="employees"&&this.userRole==="admin"?(console.log("✅ shouldShowToUser: targetAudience='employees', userRole='admin' → SHOW (admins see employee announcements)"),!0):(console.log(`❌ shouldShowToUser: targetAudience='${e}', userRole='${this.userRole}' → HIDE`),!1):(console.warn(`⚠️ shouldShowToUser: userRole not available → showing by default (targetAudience='${e}')`),!0)}listenToAnnouncements(){console.log("👂 Setting up Firestore listener..."),this.unsubscribe=this.db.collection("system_announcements").where("active","==",!0).onSnapshot(e=>{console.log(`📊 Received ${e.size} announcements from Firestore`);const t=new Date;this.announcements=e.docs.map(s=>{var o,r;const n=s.data();return{id:s.id,title:n.title||"",message:n.message||"",type:n.type||"info",priority:n.priority||3,targetAudience:n.targetAudience||"all",startDate:(o=n.startDate)==null?void 0:o.toDate(),endDate:(r=n.endDate)==null?void 0:r.toDate(),displaySettings:n.displaySettings||{}}}).filter(s=>s.displaySettings.showInHeader?s.startDate&&s.startDate>t?(console.log(`🚫 Announcement ${s.id} filtered out: not started yet`),!1):s.endDate&&s.endDate<t?(console.log(`🚫 Announcement ${s.id} filtered out: expired`),!1):this.shouldShowToUser(s.targetAudience)?!0:(console.log(`🚫 Announcement ${s.id} filtered out: targetAudience '${s.targetAudience}' doesn't match user role '${this.userRole}'`),!1):(console.log(`🚫 Announcement ${s.id} filtered out: showInHeader = false`),!1)).sort((s,n)=>n.priority!==s.priority?n.priority-s.priority:(n.startDate||0)-(s.startDate||0)),console.log(`✅ ${this.announcements.length} active announcements to display`),this.announcements.length>0?(this.container||this.render(),this.show(),this.currentIndex=0,this.updateDisplay(),this.startAutoplay()):this.hide()},e=>{console.error("❌ Error listening to announcements:",e)})}render(){const e=document.getElementById("systemAnnouncementTicker");e&&e.remove(),document.body.insertAdjacentHTML("afterbegin",`
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
    `),this.container=document.getElementById("systemAnnouncementTicker"),this.textElement=document.getElementById("tickerText"),this.dotsContainer=document.getElementById("tickerDots"),this.setupEventListeners(),console.log("✅ Ticker DOM created")}setupEventListeners(){if(!this.container)return;this.container.addEventListener("mouseenter",()=>{this.isPaused=!0,this.pauseAnimation(),console.log("⏸️ Ticker paused (hover)")}),this.container.addEventListener("mouseleave",()=>{this.isPaused=!1,this.resumeAnimation(),console.log("▶️ Ticker resumed")});const e=document.getElementById("tickerClose");e&&e.addEventListener("click",()=>{this.dismiss()}),this.dotsContainer&&this.dotsContainer.addEventListener("click",t=>{if(t.target.classList.contains("ticker-dot")){const s=parseInt(t.target.dataset.index);this.goToAnnouncement(s)}})}updateDisplay(){if(this.announcements.length===0)return;const e=this.announcements[this.currentIndex];if(this.textElement){const t=e.message;let s=1;if(e.displayStyle&&e.displayStyle.mode==="manual")s=e.displayStyle.repeatCount||1,console.log(`📊 Manual repeat mode: ${s}x`);else{const o=t.length;o<=40?(s=5,console.log(`📊 Auto mode: Short message (${o} chars) → 5 repeats`)):o<=100?(s=3,console.log(`📊 Auto mode: Medium message (${o} chars) → 3 repeats`)):(s=1,console.log(`📊 Auto mode: Long message (${o} chars) → 1 time`))}let n="";for(let o=0;o<s;o++)n+=`<span class="ticker-item">${t}</span>`;this.textElement.innerHTML=n}this.updateIcon(e.type),this.updateColor(e.type),this.updateDots(),this.restartScrollAnimation()}updateIcon(e){document.getElementById("tickerIcon")}updateColor(e){this.container&&(this.container.classList.remove("ticker-info","ticker-success","ticker-warning","ticker-error"),this.container.classList.add(`ticker-${e}`))}updateDots(){if(this.dotsContainer){if(this.announcements.length<=1){this.dotsContainer.style.display="none";return}this.dotsContainer.style.display="flex",this.dotsContainer.innerHTML=this.announcements.map((e,t)=>`<span class="ticker-dot ${t===this.currentIndex?"active":""}" data-index="${t}"></span>`).join("")}}restartScrollAnimation(){this.textElement&&(this.textElement.style.animation="none",this.textElement.offsetWidth,this.textElement.style.animation="ticker-scroll-loop 60s linear infinite",console.log("🔄 Animation restarted - continuous loop mode"))}pauseAnimation(){this.textElement&&(this.textElement.style.animationPlayState="paused")}resumeAnimation(){this.textElement&&(this.textElement.style.animationPlayState="running")}startAutoplay(){if(this.stopAutoplay(),this.announcements.length<=1){console.log("🔄 Single announcement - no rotation needed");return}this.autoplayInterval=setInterval(()=>{this.isPaused||this.nextAnnouncement()},6e4),console.log("🔄 Autoplay started (60s interval)")}stopAutoplay(){this.autoplayInterval&&(clearInterval(this.autoplayInterval),this.autoplayInterval=null)}nextAnnouncement(){this.announcements.length!==0&&(this.currentIndex=(this.currentIndex+1)%this.announcements.length,this.updateDisplay(),console.log(`➡️ Next announcement (${this.currentIndex+1}/${this.announcements.length})`))}goToAnnouncement(e){e<0||e>=this.announcements.length||(this.currentIndex=e,this.updateDisplay(),this.startAutoplay(),console.log(`🎯 Jumped to announcement ${e+1}`))}show(){this.isVisible||this.container&&(this.container.style.display="flex",document.body.classList.add("ticker-active"),this.isVisible=!0,console.log("✅ Ticker shown"))}hide(){this.isVisible&&(this.container&&(this.container.style.display="none",document.body.classList.remove("ticker-active"),this.isVisible=!1,console.log("ℹ️ Ticker hidden")),this.stopAutoplay())}dismiss(){console.log("👋 User dismissed ticker"),localStorage.setItem("system_ticker_dismissed","true"),localStorage.setItem("system_ticker_dismissed_at",Date.now().toString()),this.hide()}cleanup(){console.log("🧹 Cleaning up ticker..."),this.stopAutoplay(),this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.container&&(this.container.remove(),this.container=null),document.body.classList.remove("ticker-active"),console.log("✅ Ticker cleaned up")}}const Wt={status:{פעיל:{padding:"5px 10px",fontSize:"10px",fontWeight:"500",borderRadius:"16px",background:"#f0f9ff",color:"#0369a1",border:"0.5px solid #bae6fd"},pending_approval:{padding:"5px 10px",fontSize:"10px",fontWeight:"500",borderRadius:"16px",background:"#f0f9ff",color:"#0369a1",border:"0.5px solid #bae6fd",icon:"🔒",displayText:""},הושלם:{padding:"5px 10px",fontSize:"10px",fontWeight:"500",borderRadius:"16px",background:"#ecfdf5",color:"#047857",border:"0.5px solid #a7f3d0",icon:"✓"}}};function jt(i,e={}){if(!i||typeof i!="string")return i||"";const t=Wt.status[i];if(!t)return`<span style="color: #6b7280;">${N(i)}</span>`;const s={fontWeight:t.fontWeight||"500",color:t.color||"#6b7280",display:"inline-block",padding:t.padding,fontSize:t.fontSize,borderRadius:t.borderRadius,background:t.background||t.gradient,border:t.border||"none",boxShadow:"none",...e},n=Object.entries(s).map(([a,l])=>`${a.replace(/([A-Z])/g,"-$1").toLowerCase()}: ${l}`).join("; "),o=t.icon?`${t.icon} `:"",r=t.displayText||i;return`
    <span style="${n}">
      ${o}${N(r)}
    </span>
  `}function N(i){if(!i)return"";const e=document.createElement("div");return e.textContent=i,e.innerHTML}function J(i,e,t,s=""){if(!i&&!e)return"";`${Date.now()}${Math.random().toString(36).substr(2,9)}`;const n=t==="legal_procedure"?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>';return`
    <div class="combined-info-badge" onclick="event.stopPropagation(); window.TimesheetConstants.showCombinedInfoPopup('${N(i)}', '${N(e)}', '${t}', '${N(s)}')">
      ${i?'<i class="fas fa-folder"></i>':""}
      ${e?n:""}
    </div>
  `}function Gt(i,e,t,s=""){let n="";t==="legal_procedure"&&s&&(n={stage_a:"א'",stage_b:"ב'",stage_c:"ג'"}[s]||""),console.log("🎯 showCombinedInfoPopup called with:",{caseNumber:i,serviceName:e,serviceType:t,serviceId:s,mappedStage:n});const o=document.querySelector(".info-popup");o&&o.remove();const r=t==="legal_procedure"?'<i class="fas fa-balance-scale"></i>':'<i class="fas fa-briefcase"></i>',a=t==="legal_procedure"?"הליך משפטי":"שירות",l=`
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
            ">${N(i)}</strong>
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
            ">${N(e)}</strong>
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
            ">שלב ${N(n)}</strong>
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
  `;document.body.insertAdjacentHTML("beforeend",l),setTimeout(()=>{const d=document.querySelector(".info-popup");if(d){d.style.opacity="1";const u=d.querySelector(".info-popup-content");u&&(u.style.transform="scale(1)")}},10);const c=document.querySelector(".info-popup");c&&c.addEventListener("click",d=>{d.target===c&&je()})}function je(){const i=document.querySelector(".info-popup");if(i){i.style.opacity="0";const e=i.querySelector(".info-popup-content");e&&(e.style.transform="scale(0.95)"),setTimeout(()=>i.remove(),200)}}typeof window<"u"&&(window.TimesheetConstants={showCombinedInfoPopup:Gt,closeInfoPopup:je});const j={isMobile:!window.matchMedia("(hover: hover)").matches};function me(i){return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1}function Kt(i,e){if(!i||!e||i.classList.contains("has-description-tooltip")||!me(i))return;i.classList.add("is-truncated");const t=document.createElement("i");t.className="fas fa-info-circle description-info-icon",t.setAttribute("title","לחץ לצפייה במלל המלא"),t.setAttribute("data-full-text",e),j.isMobile&&(t.classList.add("mobile-only"),t.addEventListener("click",o=>{o.stopPropagation(),Z(e,i)}));const s=i.parentElement,n=s.querySelector(".combined-info-badge");n?s.insertBefore(t,n):s.appendChild(t),i.classList.add("has-description-tooltip")}function Yt(i){const e=document.createElement("div");e.className="description-tooltip";const t=document.createElement("div");return t.className="description-tooltip-content",t.textContent=i,e.appendChild(t),e}function Qt(i,e){if(!i||!e||i.querySelector(".description-tooltip"))return;const t=Yt(e);i.appendChild(t)}let $=null;function Z(i,e=null){$&&O();const t=document.createElement("div");t.className="description-popover-overlay",t.addEventListener("click",l=>{l.target===t&&O()});const s=document.createElement("div");s.className="description-popover";const n=document.createElement("div");n.className="description-popover-header";const o=document.createElement("div");o.className="description-popover-title",o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const r=document.createElement("button");r.className="description-popover-close",r.innerHTML='<i class="fas fa-times"></i>',r.setAttribute("aria-label","סגור"),r.addEventListener("click",O),n.appendChild(o),n.appendChild(r);const a=document.createElement("div");a.className="description-popover-body",a.textContent=i,s.appendChild(n),s.appendChild(a),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("active")}),$=t,document.addEventListener("keydown",Ge)}function O(){$&&($.classList.remove("active"),setTimeout(()=>{$&&$.parentElement&&$.remove(),$=null},200),document.removeEventListener("keydown",Ge))}function Ge(i){i.key==="Escape"&&O()}function Jt(i=document){const e=i.querySelectorAll(".td-description, .timesheet-cell-action, .task-description-cell");console.log("🔵 Description Tooltips: Found",e.length,"description cells"),e.forEach(t=>{const s=t.querySelector(".table-description-with-icons");if(!s)return;const n=s.querySelector("span");if(!n)return;const o=n.textContent.trim();if(!o)return;const r=me(n);console.log("🔍 Checking truncation:",{text:o.substring(0,30)+"...",isTruncated:r,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),r&&(console.log("✅ Adding info icon for:",o.substring(0,30)+"..."),Kt(n,o),j.isMobile||Qt(t,o),j.isMobile&&(t.style.cursor="pointer",t.addEventListener("click",a=>{a.target.closest(".combined-info-badge, .action-btn, button")||(a.stopPropagation(),Z(o,t))})))})}function Zt(i){if(!i)return;const e=i.textContent.trim();if(!e||i.querySelector(".card-description-info-icon")||!me(i))return;const t=document.createElement("span");t.className="linear-card-title-text",t.textContent=e,i.textContent="",i.appendChild(t);const s=document.createElement("i");if(s.className="fas fa-info-circle card-description-info-icon",s.setAttribute("title","לחץ לצפייה בתיאור המלא"),s.addEventListener("click",n=>{n.stopPropagation(),Z(e,i)}),i.appendChild(s),!j.isMobile){const n=document.createElement("div");n.className="card-description-tooltip";const o=document.createElement("div");o.className="card-description-tooltip-content",o.textContent=e,n.appendChild(o),i.appendChild(n)}}function Xt(i=document){i.querySelectorAll(".linear-card-title").forEach(t=>{Zt(t)})}function G(i=document){Jt(i),Xt(i)}function Ke(i=document){i.querySelectorAll(".description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".card-description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".card-description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".has-description-tooltip").forEach(e=>{e.classList.remove("has-description-tooltip","is-truncated")}),i.querySelectorAll(".linear-card-title").forEach(e=>{const t=e.querySelector(".linear-card-title-text");t&&(e.textContent=t.textContent)}),requestAnimationFrame(()=>{setTimeout(()=>{console.log("⏰ Running truncation check after render..."),G(i)},50)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{G()}):G();let be;window.addEventListener("resize",()=>{clearTimeout(be),be=setTimeout(()=>{Ke()},300)});window.DescriptionTooltips={init:G,refresh:Ke,showPopover:Z,closePopover:O};async function Ye(i,e="active",t=50){var s;try{const n=window.firebaseDB;if(!n)throw new Error("Firebase לא מחובר");let o=n.collection("budget_tasks").where("employee","==",i),r,a=!1;try{e==="active"?o=o.where("status","!=","הושלם"):e==="completed"&&(o=o.where("status","==","הושלם").orderBy("completedAt","desc")),o=o.limit(t),r=await o.get()}catch(u){u.code!=="failed-precondition"&&!((s=u.message)!=null&&s.includes("index"))&&console.warn("⚠️ Unexpected error, using fallback:",u.message),a=!0;try{o=n.collection("budget_tasks").where("employee","==",i).limit(100),r=await o.get()}catch(g){console.error("Fallback also failed, loading basic query:",g),o=n.collection("budget_tasks").where("employee","==",i),r=await o.get()}}const l=[];r.forEach(u=>{const g=u.data(),p={...window.DatesModule.convertTimestampFields(g,["createdAt","updatedAt","completedAt","deadline"]),firebaseDocId:u.id};p.id||(p.id=u.id),l.push(p)});let c=l;a&&(e==="active"?c=l.filter(u=>u.status!=="הושלם"):e==="completed"&&(c=l.filter(u=>u.status==="הושלם").sort((u,g)=>{const p=u.completedAt?new Date(u.completedAt):new Date(0);return(g.completedAt?new Date(g.completedAt):new Date(0))-p})),c=c.slice(0,t));let d=a?c:l;return e==="active"?d=d.filter(u=>u.status!=="הושלם"):e==="completed"&&(d=d.filter(u=>u.status==="הושלם")),console.log(`✅ Loaded ${d.length} tasks (filter: ${e}, fallback: ${a})`),d}catch(n){throw console.error("Firebase error:",n),new Error("שגיאה בטעינת משימות: "+n.message)}}const _=async(i,e={})=>{try{return(await firebase.functions().httpsCallable(i)(e)).data}catch(t){throw console.error(`Error calling function ${i}:`,t),t.code==="unauthenticated"?new Error("נדרשת התחברות למערכת"):t.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו"):t.code==="invalid-argument"?new Error(t.message||"נתונים לא תקינים"):t.code==="not-found"?new Error("הפריט לא נמצא"):new Error(t.message||"שגיאה בביצוע הפעולה")}};function ei(){try{if(!window.firebaseDB)throw console.error("❌ Firebase Database לא זמין"),new Error("Firebase Database לא מחובר");return!0}catch(i){return console.error("❌ שגיאה באתחול Firebase:",i),!1}}async function he(){try{const i=window.firebaseDB;if(!i)throw new Error("Firebase לא מחובר");const e=await i.collection("clients").get(),t=[];return e.forEach(s=>{const n=s.data(),o=s.id;t.push({...n,id:o,firestoreId:o,legacyId:n.id,source:"clients",fullName:n.fullName||n.clientName,fileNumber:n.fileNumber||n.caseNumber,casesCount:1,activeCasesCount:n.status==="active"?1:0,cases:[],hasVirtualCase:!1,type:n.type||n.procedureType||"hours"})}),Logger.log(`✅ טעינה הושלמה: ${e.size} לקוחות/תיקים | ${t.length} רשומות סה"כ`),t}catch(i){throw console.error("Firebase error:",i),new Error("שגיאה בטעינת לקוחות: "+i.message)}}async function K(i){try{const e=window.firebaseDB;if(!e)throw new Error("Firebase לא מחובר");const t=await e.collection("timesheet_entries").where("employee","==",i).limit(50).get(),s=[];return t.forEach(n=>{const o=n.data(),r=window.DatesModule.convertTimestampFields(o,["createdAt","updatedAt"]);s.push({id:n.id,...r})}),s.sort((n,o)=>n.date?o.date?new Date(o.date)-new Date(n.date):-1:1),s}catch(e){throw console.error("Firebase error:",e),new Error("שגיאה בטעינת שעתון: "+e.message)}}async function Qe(i){var e,t;console.warn('⚠️ [DEPRECATED] saveBudgetTaskToFirebase is deprecated. Use FirebaseService.call("createBudgetTask") instead.');try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const s=await _("createBudgetTask",i);if(!s.success)throw new Error(s.message||"שגיאה בשמירת משימה");return s.taskId}catch(s){throw console.error("Firebase error:",s),(e=s.message)!=null&&e.includes("אין חיבור לאינטרנט")?s:s.code==="unavailable"||(t=s.message)!=null&&t.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):s.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):s}}async function Je(i){var e,t;console.warn('⚠️ [DEPRECATED] saveTimesheetToFirebase is deprecated. Use FirebaseService.call("createTimesheetEntry") instead.');try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const s=await _("createTimesheetEntry",i);if(!s.success)throw new Error(s.message||"שגיאה בשמירת שעתון");return s.entryId}catch(s){throw console.error("Firebase error:",s),(e=s.message)!=null&&e.includes("אין חיבור לאינטרנט")?s:s.code==="unavailable"||(t=s.message)!=null&&t.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):s.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):s}}async function Ze(i,e,t){var s,n,o;console.log("✅ [v2.0] Using Enterprise accuracy mode");try{if(!navigator.onLine)throw new Error("אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.");const r=await _("createTimesheetEntry_v2",{...i,expectedVersion:e,idempotencyKey:t});if(!r.success)throw new Error(r.message||"שגיאה בשמירת שעתון");return console.log(`✅ [v2.0] Timesheet saved: ${r.entryId}, Version: ${r.version}`),{entryId:r.entryId,version:r.version,entry:r.entry}}catch(r){throw console.error("❌ [v2.0] Firebase error:",r),r.code==="aborted"&&((s=r.message)!=null&&s.includes("CONFLICT"))?new Error(`המסמך שונה על ידי משתמש אחר. אנא רענן את הדף ונסה שוב.

הסיבה: גרסה לא תואמת - מישהו אחר עדכן את הלקוח בינתיים.`):(n=r.message)!=null&&n.includes("אין חיבור לאינטרנט")?r:r.code==="unavailable"||(o=r.message)!=null&&o.includes("network")?new Error("בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב."):r.code==="permission-denied"?new Error("אין לך הרשאה לבצע פעולה זו."):r}}async function Xe(i,e,t=""){console.warn('⚠️ [DEPRECATED] updateTimesheetEntryFirebase is deprecated. Use FirebaseService.call("updateTimesheetEntry") instead.');try{const s=await _("updateTimesheetEntry",{entryId:String(i),minutes:e,reason:t});if(!s.success)throw new Error(s.message||"שגיאה בעדכון שעתון");return s}catch(s){throw console.error("Firebase error:",s),s}}async function et(i,e){console.warn('⚠️ [DEPRECATED] addTimeToTaskFirebase is deprecated. Use FirebaseService.call("addTimeToTask") instead.');try{const t=await _("addTimeToTask",{taskId:String(i),minutes:parseInt(e.minutes),date:e.date,description:e.description});if(!t.success)throw new Error(t.message||"שגיאה בהוספת זמן למשימה");return t}catch(t){throw console.error("❌ שגיאה בהוספת זמן למשימה:",t),t}}async function tt(i,e=""){console.warn('⚠️ [DEPRECATED] completeTaskFirebase is deprecated. Use FirebaseService.call("completeTask") instead.');try{const t=await _("completeTask",{taskId:String(i),completionNotes:e});if(!t.success)throw new Error(t.message||"שגיאה בהשלמת משימה");return t}catch(t){throw console.error("❌ שגיאה בהשלמת משימה:",t),t}}async function it(i,e,t=""){console.warn('⚠️ [DEPRECATED] extendTaskDeadlineFirebase is deprecated. Use FirebaseService.call("extendTaskDeadline") instead.');try{const s=await _("extendTaskDeadline",{taskId:String(i),newDeadline:e,reason:t});if(!s.success)throw new Error(s.message||"שגיאה בהארכת תאריך יעד");return s}catch(s){throw console.error("❌ שגיאה בהארכת תאריך יעד:",s),s}}class R{static async execute(e){var f,v,w,T,E;const{loadingMessage:t,message:s,animationType:n="loading",action:o,successMessage:r,errorMessage:a="שגיאה בביצוע הפעולה",onSuccess:l=null,onError:c=null,onFinally:d=null,closePopupOnSuccess:u=!1,popupSelector:g=".popup-overlay",closeDelay:p=500,minLoadingDuration:b=200}=e,y=t||s||"מעבד...";if(typeof o!="function")return console.error("❌ ActionFlowManager: action must be a function"),{success:!1,error:new Error("Invalid action parameter")};let m=null,h=null;try{h=Date.now(),window.NotificationSystem?window.NotificationSystem.showLoading(y,{animationType:n}):(f=window.showSimpleLoading)==null||f.call(window,y),m=await o();const A=Date.now()-h,P=b-A;return P>0&&(Logger.log(`⏱️ Waiting ${P}ms to reach minimum loading duration...`),await new Promise(D=>setTimeout(D,P))),window.NotificationSystem?window.NotificationSystem.hideLoading():(v=window.hideSimpleLoading)==null||v.call(window),await new Promise(D=>setTimeout(D,100)),r&&(window.NotificationSystem?window.NotificationSystem.success(r,5e3):(w=window.showNotification)==null||w.call(window,r,"success")),l&&typeof l=="function"&&await l(m),u&&setTimeout(()=>{const D=document.querySelector(g);D&&D.remove()},p),{success:!0,data:m}}catch(A){console.error("❌ ActionFlowManager error:",A);const P=Date.now()-h,D=b-P;D>0&&(Logger.log(`⏱️ Waiting ${D}ms even on error...`),await new Promise(ee=>setTimeout(ee,D))),window.NotificationSystem?window.NotificationSystem.hideLoading():(T=window.hideSimpleLoading)==null||T.call(window),await new Promise(ee=>setTimeout(ee,100));const ye=`${a}: ${A.message||"שגיאה לא ידועה"}`;return window.NotificationSystem?window.NotificationSystem.error(ye,5e3):(E=window.showNotification)==null||E.call(window,ye,"error"),c&&typeof c=="function"&&await c(A),{success:!1,error:A}}finally{d&&typeof d=="function"&&await d()}}static async executeWithFormReset(e){const{formId:t,formContainerId:s,...n}=e,o=n.onSuccess;return this.execute({...n,onSuccess:async r=>{if(t){const a=document.getElementById(t);a&&a.reset()}if(s){const a=document.getElementById(s);a&&a.classList.add("hidden");const l=document.getElementById("smartPlusBtn");l&&l.classList.remove("active")}o&&await o(r)}})}}function fe(i){const e=document.getElementById("currentUserDisplay");e&&i&&(e.textContent=`${i} - משרד עו"ד גיא הרשקוביץ`)}function ti(i){const e=document.querySelector(".user-avatar");if(e&&i){e.setAttribute("title",`מחובר: ${i}`),e.setAttribute("data-user",i);const t=["linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)","linear-gradient(135deg, #10b981 0%, #059669 100%)","linear-gradient(135deg, #f59e0b 0%, #d97706 100%)","linear-gradient(135deg, #ef4444 0%, #dc2626 100%)","linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)","linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)","linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)","linear-gradient(135deg, #84cc16 0%, #65a30d 100%)"],s=i.charCodeAt(0)%t.length;e.style.background=t[s],e.style.transform="scale(1.05)",setTimeout(()=>{e.style.transform=""},300)}}function ge(){const i=document.getElementById("loginSection"),e=document.getElementById("forgotPasswordSection"),t=document.getElementById("welcomeScreen"),s=document.getElementById("appContent"),n=document.getElementById("minimalSidebar"),o=document.getElementById("interfaceElements"),r=document.getElementById("mainFooter"),a=document.getElementById("bubblesContainer");i&&i.classList.remove("hidden"),e&&e.classList.add("hidden"),t&&t.classList.add("hidden"),s&&s.classList.add("hidden"),n&&n.classList.add("hidden"),o&&o.classList.add("hidden"),r&&r.classList.add("hidden"),a&&a.classList.remove("hidden"),document.body.classList.remove("logged-in")}async function Te(){const i=document.getElementById("email").value,e=document.getElementById("password").value,t=document.getElementById("errorMessage");if(!i||!e){t&&(t.textContent="אנא מלא את כל השדות",t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3));return}try{window.isInWelcomeScreen=!0;const s=await firebase.auth().signInWithEmailAndPassword(i,e),n=s.user.email,o=s.user.uid,r=await window.firebaseDB.collection("employees").doc(n).get();if(!r.exists)throw new Error("משתמש לא נמצא במערכת");const a=r.data();this.currentUid=o,this.currentUser=a.email,this.currentUsername=a.username||a.name,this.currentEmployee=a,fe(this.currentUsername),await this.showWelcomeScreen();try{await this.loadData(),this.activityLogger&&await this.activityLogger.logLogin();try{await window.firebaseDB.collection("employees").doc(this.currentUser).update({lastLogin:firebase.firestore.FieldValue.serverTimestamp(),loginCount:firebase.firestore.FieldValue.increment(1)}),Logger.log("✅ lastLogin updated successfully")}catch(l){console.warn("⚠️ Failed to update lastLogin:",l.message)}if(window.PresenceSystem)try{await Promise.race([window.PresenceSystem.connect(this.currentUid,this.currentUsername,this.currentUser),new Promise((l,c)=>setTimeout(()=>c(new Error("PresenceSystem timeout")),5e3))]),Logger.log("✅ PresenceSystem connected successfully")}catch(l){console.warn("⚠️ PresenceSystem failed (non-critical):",l.message)}}catch(l){this.showNotification("שגיאה בטעינת נתונים","error"),console.error("Error loading data:",l)}await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.initSecurityModules&&this.initSecurityModules(),this.showApp(),this.initAIChatSystem()}catch(s){console.error("Login error:",s),window.isInWelcomeScreen=!1;let n="אימייל או סיסמה שגויים";s.code==="auth/user-not-found"?n="משתמש לא נמצא":s.code==="auth/wrong-password"?n="סיסמה שגויה":s.code==="auth/invalid-email"?n="כתובת אימייל לא תקינה":s.code==="auth/user-disabled"&&(n="חשבון זה הושבת. צור קשר עם המנהל"),t&&(t.textContent=n,t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3))}}async function ii(){const i=document.getElementById("loginSection"),e=document.getElementById("welcomeScreen"),t=document.getElementById("welcomeTitle"),s=document.getElementById("lastLoginTime"),n=document.getElementById("bubblesContainer");i&&i.classList.add("hidden"),t&&(t.textContent=`ברוך הבא, ${this.currentUsername}`),e&&e.classList.remove("hidden"),n&&n.classList.remove("hidden"),this.welcomeScreenStartTime=Date.now();const o=document.getElementById("progressBar");if(o&&(o.style.width="0%"),s)try{const r=await window.firebaseDB.collection("employees").doc(this.currentUser).get();if(r.exists){const a=r.data();if(a.lastLogin&&a.lastLogin.toDate){const c=a.lastLogin.toDate().toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});s.textContent=c}else s.textContent="זו הכניסה הראשונה שלך"}else s.textContent="זו הכניסה הראשונה שלך"}catch(r){console.error("⚠️ Failed to load lastLogin from Firebase:",r),s.textContent="זו הכניסה הראשונה שלך"}}async function si(){}function ni(i,e=null){if(!window.isInWelcomeScreen)return;const t=document.getElementById("loaderText");if(t&&(t.textContent=i),e!==null){const s=document.getElementById("progressBar");s&&(s.style.width=`${Math.min(e,100)}%`)}}function oi(){const i=document.getElementById("loginSection"),e=document.getElementById("welcomeScreen"),t=document.getElementById("appContent"),s=document.getElementById("interfaceElements"),n=document.getElementById("minimalSidebar"),o=document.getElementById("mainFooter"),r=document.getElementById("bubblesContainer");i&&i.classList.add("hidden"),e&&e.classList.add("hidden"),t&&t.classList.remove("hidden"),s&&s.classList.remove("hidden"),n&&n.classList.remove("hidden"),o&&o.classList.remove("hidden"),r&&r.classList.add("hidden"),document.body.classList.add("logged-in");const a=document.getElementById("userInfo");a&&(a.innerHTML=`
      <span>שלום ${this.currentUsername}</span>
      <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
    `,a.classList.remove("hidden")),setTimeout(()=>{ti(this.currentUsername)},500),window.manager&&typeof window.manager.initTicker=="function"&&window.manager.initTicker()}function st(){if(window.NotificationSystem&&typeof window.NotificationSystem.confirm=="function"){console.log("✅ Using NotificationSystem.confirm"),window.NotificationSystem.confirm("האם אתה בטוח שברצונך לצאת? כל הנתונים שלא נשמרו יאבדו.",()=>window.confirmLogout(),null,{title:"יציאה מהמערכת",confirmText:"כן, צא מהמערכת",cancelText:"ביטול",type:"warning"});return}console.log("⚠️ Using Fallback popup (NotificationSystem not available)");const i=document.createElement("div");i.className="popup-overlay show",i.style.cssText="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);",i.innerHTML=`
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
  `,document.body.appendChild(i)}async function nt(){const i=document.getElementById("interfaceElements");if(i&&i.classList.add("hidden"),window.NotificationSystem){const t=window.NotificationSystem.info("מתנתק מהמערכת... להתראות",3e3).querySelector(".notification-icon i");t&&(t.className="fas fa-power-off")}else window.manager&&window.manager.showNotification("מתנתק מהמערכת... להתראות","info");window.PresenceSystem&&await window.PresenceSystem.disconnect(),window.CaseNumberGenerator&&window.CaseNumberGenerator.cleanup(),await firebase.auth().signOut(),setTimeout(()=>location.reload(),1500)}function ri(){const i=document.getElementById("loginSection"),e=document.getElementById("forgotPasswordSection"),t=document.getElementById("bubblesContainer");i&&i.classList.add("hidden"),e&&e.classList.remove("hidden"),t&&t.classList.remove("hidden");const s=document.getElementById("resetEmail");s&&(s.value="");const n=document.getElementById("resetErrorMessage"),o=document.getElementById("resetSuccessMessage");n&&n.classList.add("hidden"),o&&o.classList.add("hidden")}async function ai(i){var n,o;i.preventDefault();const e=(o=(n=document.getElementById("resetEmail"))==null?void 0:n.value)==null?void 0:o.trim(),t=document.getElementById("resetErrorMessage"),s=document.getElementById("resetSuccessMessage");if(!e){t&&(t.textContent="אנא הזן כתובת אימייל",t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),3e3));return}try{const r={url:window.location.origin+"/reset-password.html",handleCodeInApp:!1};await firebase.auth().sendPasswordResetEmail(e,r),s&&s.classList.remove("hidden"),t&&t.classList.add("hidden"),window.NotificationSystem&&window.NotificationSystem.success("📧 קישור לאיפוס סיסמה נשלח למייל שלך. בדוק את תיבת הדואר.",5e3),setTimeout(()=>{ge.call(this)},3e3)}catch(r){console.error("Password reset error:",r),console.error("Error code:",r.code),console.error("Error message:",r.message);let a="שגיאה בשליחת מייל לאיפוס סיסמה";r.code==="auth/user-not-found"?a="משתמש עם כתובת מייל זו לא נמצא במערכת":r.code==="auth/invalid-email"?a="כתובת אימייל לא תקינה":r.code==="auth/too-many-requests"?a="יותר מדי ניסיונות. נסה שוב מאוחר יותר":r.code==="auth/missing-continue-uri"||r.code==="auth/invalid-continue-uri"?a="שגיאת הגדרות Firebase - פנה למפתח":r.code==="auth/unauthorized-continue-uri"?a="שגיאת הרשאות Firebase - פנה למפתח":a=`שגיאה: ${r.code||"unknown"} - בדוק את ה-Console`,t&&(t.textContent=a,t.classList.remove("hidden"),setTimeout(()=>t.classList.add("hidden"),5e3)),s&&s.classList.add("hidden"),window.NotificationSystem&&window.NotificationSystem.error(a,5e3)}}function li(i){const e=document.querySelector(".password-input-section"),t=document.querySelector(".phone-input-section"),s=document.querySelector(".otp-input-section");e&&e.classList.remove("active"),t&&t.classList.remove("active"),s&&s.classList.remove("active"),document.querySelectorAll(".auth-method-btn").forEach(o=>{o.classList.remove("active")}),i==="password"?e&&e.classList.add("active"):i==="sms"&&t&&t.classList.add("active");const n=document.querySelector(`.auth-method-btn[data-method="${i}"]`);n&&n.classList.add("active"),loginMethods.switchMethod(i)}async function ci(){const i=document.getElementById("phoneNumber"),e=document.getElementById("smsErrorMessage");if(!i||!i.value){e&&(e.textContent="אנא הזן מספר טלפון",e.classList.remove("hidden"));return}try{const t=document.getElementById("sendOTPBtn");t&&(t.disabled=!0,t.classList.add("loading")),await loginMethods.methods.sms.handler.sendOTP(i.value);const s=document.querySelector(".phone-input-section"),n=document.querySelector(".otp-input-section");if(s&&s.classList.remove("active"),n){n.classList.add("active");const o=document.querySelector(".otp-phone-display");o&&(o.textContent=loginMethods.methods.sms.handler.constructor.formatForDisplay(i.value));const r=document.querySelector(".otp-input");r&&r.focus(),ui()}}catch(t){console.error("SMS login error:",t),e&&(e.textContent=t.message||"שגיאה בשליחת SMS",e.classList.remove("hidden"))}finally{const t=document.getElementById("sendOTPBtn");t&&(t.disabled=!1,t.classList.remove("loading"))}}async function di(){const i=document.querySelectorAll(".otp-input"),e=document.getElementById("otpErrorMessage");let t="";if(i.forEach(s=>{t+=s.value}),t.length!==6){e&&(e.textContent="אנא הזן קוד בן 6 ספרות",e.classList.remove("hidden"));return}try{const s=document.getElementById("verifyOTPBtn");s&&(s.disabled=!0,s.textContent="מאמת...");const n=await loginMethods.methods.sms.handler.verifyOTP(t);this.currentUser=n.employeeData.email,this.currentUsername=n.employeeData.username||n.employeeData.name,this.currentEmployee=n.employeeData,fe(this.currentUsername),await this.showWelcomeScreen(),await this.loadData(),this.initSecurityModules&&this.initSecurityModules(),await this.waitForWelcomeMinimumTime(),window.isInWelcomeScreen=!1,this.showApp()}catch(s){console.error("OTP verification error:",s),i.forEach(n=>{n.classList.add("error"),setTimeout(()=>n.classList.remove("error"),500)}),e&&(e.textContent=s.message||"קוד שגוי",e.classList.remove("hidden"))}finally{const s=document.getElementById("verifyOTPBtn");s&&(s.disabled=!1,s.textContent="אמת קוד")}}function ui(){let i=300;const e=document.querySelector(".otp-timer-countdown"),t=document.querySelector(".resend-otp-btn");t&&(t.disabled=!0);const s=setInterval(()=>{if(i--,e){const n=Math.floor(i/60),o=i%60;e.textContent=`${n}:${o.toString().padStart(2,"0")}`}i<=0&&(clearInterval(s),e&&(e.textContent="פג תוקף"),t&&(t.disabled=!1))},1e3);return s}async function mi(){try{if(window.aiChat){Logger.log("[AI Chat] Already initialized, skipping");return}if(!window.lazyLoader){console.error("[AI Chat] LazyLoader not available");return}Logger.log("[AI Chat] 🚀 Starting lazy load...");const i=performance.now(),e=[{src:"js/modules/ai-system/ai-config.js",options:{version:"2.0.0"}},{src:"js/modules/ai-system/ai-engine.js",options:{version:"2.0.0"}},{src:"js/modules/ai-system/ai-context-builder.js",options:{version:"2.0.0"}},{src:"js/modules/UserReplyModal.js",options:{version:"1.0.3-threads"}},{src:"js/config/message-categories.js",options:{version:"1.0.0"}},{src:"js/modules/notification-bell.js",options:{version:"20251210-fix"}},{src:"js/modules/ai-system/ThreadView.js",options:{version:"1.0.4-mark-as-read"}}];if(await window.lazyLoader.loadScripts(e),await window.lazyLoader.loadScript("js/modules/ai-system/ai-chat-ui.js",{version:"2.0.7-categories"}),window.AIChatUI&&!window.aiChat){window.aiChat=new window.AIChatUI;const t=(performance.now()-i).toFixed(0);Logger.log(`[AI Chat] ✅ Initialized successfully (${t}ms)`)}else console.warn("[AI Chat] ⚠️ AIChatUI class not available after loading");if(window.NotificationBellSystem)if(window.notificationBell||(window.notificationBell=new window.NotificationBellSystem,Logger.log("[NotificationBell] Instance created")),this.currentUser&&window.firebaseDB){const t={email:this.currentUser};window.notificationBell.startListeningToAdminMessages(t,window.firebaseDB),Logger.log(`[NotificationBell] ✅ Listening to admin messages for ${t.email}`)}else console.warn("[NotificationBell] ⚠️ Cannot start listening - missing user or DB",{currentUser:this.currentUser,firebaseDB:!!window.firebaseDB})}catch(i){console.error("[AI Chat] ❌ Failed to lazy load:",i)}}function hi(i){const e=document.getElementById("budgetFormContainer"),t=document.getElementById("timesheetFormContainer");e&&e.classList.add("hidden"),t&&t.classList.add("hidden");const s=document.getElementById("smartPlusBtn");if(s&&s.classList.remove("active"),document.querySelectorAll(".tab-button, .top-nav-btn").forEach(n=>{n.classList.remove("active")}),document.querySelectorAll(".tab-content").forEach(n=>{n.classList.remove("active")}),i==="budget"){const n=document.getElementById("budgetTab");n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="budget"], .top-nav-btn[onclick*="budget"]').forEach(o=>{o.classList.add("active")})}else if(i==="timesheet"){const n=document.getElementById("timesheetTab");if(n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="timesheet"], .top-nav-btn[onclick*="timesheet"]').forEach(r=>{r.classList.add("active")}),document.getElementById("actionDate")&&window.manager&&window.manager.timesheetCalendar){const r=new Date;window.manager.timesheetCalendar.setDate(r,!1)}}else if(i==="reports"){const n=document.getElementById("reportsTab");n&&n.classList.add("active"),document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(o=>{o.classList.add("active")}),s&&(s.style.display="none"),typeof manager<"u"&&manager.initReportsForm&&manager.initReportsForm()}i!=="reports"&&s&&(s.style.display="",s.style.visibility="visible",s.style.opacity="1"),window.currentActiveTab=i}function fi(){window.notificationBell&&window.notificationBell.toggleDropdown()}function gi(){const i=window.notificationSystem||new NotificationSystem;i.confirm("כל ההתראות יימחקו ולא ניתן יהיה לשחזר אותן.",()=>{window.notificationBell&&(window.notificationBell.clearAllNotifications(),i.show("כל ההתראות נמחקו בהצלחה","success"))},()=>{Logger.log("ביטול מחיקת התראות")},{title:"⚠️ מחיקת כל ההתראות",confirmText:"מחק הכל",cancelText:"ביטול",type:"warning"})}function pi(){const i=document.getElementById("smartPlusBtn"),e=document.querySelector(".tab-button.active");if(!e)return;let t,s;e.onclick&&e.onclick.toString().includes("budget")?(t=document.getElementById("budgetFormContainer"),s="budget"):e.onclick&&e.onclick.toString().includes("timesheet")&&(t=document.getElementById("timesheetFormContainer"),s="timesheet"),t&&(t.classList.contains("hidden")?(t.classList.remove("hidden"),i&&i.classList.add("active"),window.ClientCaseSelectorsManager&&(s==="budget"?(Logger.log("🎯 Opening budget form - initializing selectors..."),window.ClientCaseSelectorsManager.initializeBudget(),window.ClientCaseSelectorsManager.clearBudgetDescription(),window.ClientCaseSelectorsManager.initializeBudgetDescription()):s==="timesheet"&&(Logger.log("🎯 Opening timesheet form - initializing selector..."),window.ClientCaseSelectorsManager.initializeTimesheet())),setTimeout(()=>{const n=t.getBoundingClientRect();if(!(n.top>=0&&n.bottom<=window.innerHeight)){const a=t.getBoundingClientRect().top+window.pageYOffset+-80;window.scrollTo({top:a,behavior:"smooth"})}},100)):(t.classList.add("hidden"),i&&i.classList.remove("active")))}class wi{constructor(e){this.manager=e,this.blockedClients=new Set,this.criticalClients=new Set,this.blockedClientsData=[],this.criticalClientsData=[]}updateBlockedClients(){if(this.blockedClients.clear(),this.criticalClients.clear(),this.blockedClientsData=[],this.criticalClientsData=[],!(!this.manager.clients||!Array.isArray(this.manager.clients))){for(const e of this.manager.clients)e&&(e.isBlocked?(this.blockedClients.add(e.fullName),this.blockedClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining||0})):e.type==="hours"&&typeof e.hoursRemaining=="number"&&e.hoursRemaining<=5&&e.hoursRemaining>0&&(this.criticalClients.add(e.fullName),this.criticalClientsData.push({name:e.fullName,hoursRemaining:e.hoursRemaining})));this.updateNotificationBell()}}updateNotificationBell(){const e=new Date,t=new Date(e.getTime()+24*60*60*1e3),s=(this.manager.budgetTasks||[]).filter(n=>n&&n.status!=="הושלם"&&n.deadline&&n.description&&new Date(n.deadline)<=t);window.notificationBell&&window.notificationBell.updateFromSystem(this.blockedClientsData,this.criticalClientsData,s)}validateClientSelection(e,t="רישום"){return this.blockedClients.has(e)?(this.showBlockedClientDialog(e,t),!1):!0}showBlockedClientDialog(e,t){const s=document.createElement("div");s.className="popup-overlay";const n=document.createElement("div");n.className="client-name",n.textContent=e;const o=document.createElement("div");o.className="action-blocked",o.textContent=`לא ניתן לבצע ${t} עבור לקוח זה`,s.innerHTML=`
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
    `,document.body.appendChild(s),setTimeout(()=>s.classList.add("show"),10),setTimeout(()=>{document.body.contains(s)&&s.remove()},1e4)}}async function W(i){try{const e=window.firebaseDB;if(!e)throw new Error("Firebase לא מחובר");const t=await e.collection("clients").where("fullName","==",i).get();if(t.empty)throw new Error("לקוח לא נמצא");const s=t.docs[0].data(),n=await e.collection("timesheet_entries").where("clientName","==",i).get();let o=0;const r={};n.forEach(y=>{const m=y.data(),h=m.minutes||0,f=m.employee||m.lawyer||"לא ידוע";o+=h,r[f]||(r[f]=0),r[f]+=h});const a=s.totalHours||0,l=a*60,c=Math.max(0,l-o),d=c/60;let u="פעיל",g=!1,p=!1;return s.type==="hours"&&(c<=0?(u="חסום - נגמרו השעות",g=!0):d<=5&&(u="קריטי - מעט שעות",p=!0)),{clientName:i,clientData:s,totalHours:a,totalMinutesUsed:o,remainingHours:Math.round(d*100)/100,remainingMinutes:c,status:u,isBlocked:g,isCritical:p,entriesCount:n.size,entriesByLawyer:r,uniqueLawyers:Object.keys(r),lastCalculated:new Date}}catch(e){throw console.error("שגיאה בחישוב שעות:",e),e}}async function pe(i,e){try{const t=window.firebaseDB;if(!t)throw new Error("Firebase לא מחובר");const s=await t.collection("clients").where("fullName","==",i).get();if(s.empty)return console.warn(`⚠️ לקוח ${i} לא נמצא - לא ניתן לעדכן שעות`),{success:!1,message:"לקוח לא נמצא"};const n=s.docs[0];if(n.data().type!=="hours")return{success:!0,message:"לקוח פיקס - לא נדרש עדכון"};const r=await W(i);if(await n.ref.update({minutesRemaining:Math.max(0,r.remainingMinutes),hoursRemaining:Math.max(0,r.remainingHours),lastActivity:firebase.firestore.FieldValue.serverTimestamp(),lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),totalMinutesUsed:r.totalMinutesUsed,isBlocked:r.isBlocked,isCritical:r.isCritical}),window.manager&&window.manager.clients){const a=window.manager.clients.findIndex(l=>l.fullName===i);a!==-1&&(window.manager.clients[a].hoursRemaining=Math.max(0,r.remainingHours),window.manager.clients[a].minutesRemaining=Math.max(0,r.remainingMinutes),window.manager.clients[a].isBlocked=r.isBlocked,window.manager.clients[a].isCritical=r.isCritical,window.manager.clients[a].totalMinutesUsed=r.totalMinutesUsed,window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients())}return{success:!0,hoursData:r,newHoursRemaining:r.remainingHours,newMinutesRemaining:r.remainingMinutes,isBlocked:r.isBlocked,isCritical:r.isCritical}}catch(t){throw console.error("❌ שגיאה בעדכון שעות לקוח:",t),new Error("שגיאה בעדכון שעות: "+t.message)}}function yi(i){const e=document.getElementById("budgetForm");e&&e.reset()}function vi(i){const e=document.getElementById("timesheetForm");if(e&&e.reset(),i&&i.timesheetCalendar){const t=new Date;i.timesheetCalendar.setDate(t,!1)}}function bi(i,e){const t=i.timesheetEntries.find(o=>o.id&&o.id.toString()===e.toString()||o.entryId&&o.entryId.toString()===e.toString());if(!t){i.showNotification("רשומת שעתון לא נמצאה","error"),console.error("❌ רשומה לא נמצאה:",e);return}let s="";try{s=new Date(t.date).toISOString().split("T")[0]}catch{s=new Date().toISOString().split("T")[0]}const n=document.createElement("div");n.className="popup-overlay",n.innerHTML=`
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
            <p><strong>תאריך מקורי:</strong> ${B(t.date)}</p>
            <p><strong>לקוח מקורי:</strong> ${S(t.clientName)}</p>
            <p><strong>זמן מקורי:</strong> ${t.minutes} דקות</p>
            <p><strong>פעולה:</strong> ${S(t.action)}</p>
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
                max="99999"
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
                value="${S(t.clientName)}"
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
                value="${S(t.clientName)}"
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
  `,document.body.appendChild(n),setTimeout(()=>n.classList.add("show"),10),setTimeout(()=>{n.querySelectorAll("input, textarea").forEach(a=>{a.addEventListener("focus",function(){this.style.borderColor="#3b82f6",this.style.boxShadow="0 0 0 3px rgba(59, 130, 246, 0.1)"}),a.addEventListener("blur",function(){this.style.borderColor="#e1e5e9",this.style.boxShadow="none"})});const r=document.getElementById("editMinutes");r&&(r.select(),r.focus())},100)}function Ti(i,e){const t=document.getElementById("editClientSearchResults"),s=document.getElementById("editClientSelect");window.ClientSearch.searchClientsUpdateDOM(i.clients,e,{resultsContainer:t,hiddenInput:s},"manager.selectClientForEdit",{fileNumberColor:"#9ca3af"})}function Ei(i,e,t){const s=document.getElementById("editClientSearch"),n=document.getElementById("editClientSelect"),o=document.getElementById("editClientSearchResults");s&&n&&o&&(s.value=e,n.value=e,o.style.display="none",s.style.background="#ecfdf5",s.style.borderColor="#10b981",setTimeout(()=>{s.style.background="white",s.style.borderColor="#e1e5e9"},500))}async function H(i,e="active",t=50){var s;try{const n=window.firebaseDB;if(!n)throw new Error("Firebase לא מחובר");let o=n.collection("budget_tasks").where("employee","==",i),r,a=!1;try{e==="active"?o=o.where("status","!=","הושלם"):e==="completed"&&(o=o.where("status","==","הושלם").orderBy("completedAt","desc")),o=o.limit(t),r=await o.get()}catch(u){u.code!=="failed-precondition"&&!((s=u.message)!=null&&s.includes("index"))&&console.warn("⚠️ Unexpected error, using fallback:",u.message),a=!0;try{o=n.collection("budget_tasks").where("employee","==",i).limit(100),r=await o.get()}catch(g){console.error("Fallback also failed, loading basic query:",g),o=n.collection("budget_tasks").where("employee","==",i),r=await o.get()}}const l=[];r.forEach(u=>{const g=u.data(),p={...window.DatesModule.convertTimestampFields(g,["createdAt","updatedAt","completedAt","deadline"]),firebaseDocId:u.id};p.id||(p.id=u.id),l.push(p)});let c=l;a&&(e==="active"?c=l.filter(u=>u.status!=="הושלם"):e==="completed"&&(c=l.filter(u=>u.status==="הושלם").sort((u,g)=>{const p=u.completedAt?new Date(u.completedAt):new Date(0);return(g.completedAt?new Date(g.completedAt):new Date(0))-p})),c=c.slice(0,t));let d=a?c:l;return e==="active"?d=d.filter(u=>u.status!=="הושלם"):e==="completed"&&(d=d.filter(u=>u.status==="הושלם")),console.log(`✅ Loaded ${d.length} tasks (filter: ${e}, fallback: ${a})`),d}catch(n){throw console.error("Firebase error:",n),new Error("שגיאה בטעינת משימות: "+n.message)}}function Si(i,e,t){V(async()=>{const{startTasksListener:s}=await import("./real-time-listeners-BzLKVeci.js");return{startTasksListener:s}},[]).then(({startTasksListener:s})=>s(i,e,t)).catch(s=>{console.error("❌ Error importing real-time-listeners:",s),t&&t(s)})}function ot(i){if(!i)return{};let e=i.deadline;return i.deadline&&window.DatesModule&&(e=window.DatesModule.convertFirebaseTimestamp(i.deadline)),(!e||e instanceof Date&&isNaN(e.getTime()))&&(e=new Date),{id:i.id||Date.now(),clientName:i.clientName||"לקוח לא ידוע",description:i.taskDescription||i.description||"משימה ללא תיאור",taskDescription:i.taskDescription||i.description||"משימה ללא תיאור",estimatedHours:Number(i.estimatedHours)||0,actualHours:Number(i.actualHours)||0,estimatedMinutes:Number(i.estimatedMinutes)||(Number(i.estimatedHours)||0)*60,actualMinutes:Number(i.actualMinutes)||(Number(i.actualHours)||0)*60,deadline:e,status:i.status||"פעיל",branch:i.branch||"",fileNumber:i.fileNumber||"",history:i.history||[],createdAt:i.createdAt||null,updatedAt:i.updatedAt||null,caseId:i.caseId||null,caseTitle:i.caseTitle||null,caseNumber:i.caseNumber||null,serviceName:i.serviceName||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null}}function rt(i){return!i.estimatedMinutes||i.estimatedMinutes<=0?(i._warnedNoEstimate||(console.warn("⚠️ Task missing estimatedMinutes:",i.id),i._warnedNoEstimate=!0),0):Math.round((i.actualMinutes||0)/i.estimatedMinutes*100)}function Ci(i){return i>=100?"red":i>=85?"orange":"blue"}function Bi(i,e,t,s,n,o,r,a,l){if(!window.SVGRings)return"";const c=new Date,d=new Date(i.deadline),u=i.createdAt?new Date(i.createdAt):c,g=u<d?u:d,p=Math.max(1,(d-g)/(1e3*60*60*24)),b=(c-g)/(1e3*60*60*24),y=Math.max(0,Math.round(b/p*100)),m=l<0,h={progress:e,color:Ci(e),icon:"fas fa-clock",label:"תקציב זמן",value:`${t}ש / ${s}ש`,size:80,button:r?{text:o?"עדכן שוב":"עדכן תקציב",onclick:`event.stopPropagation(); manager.showAdjustBudgetDialog('${i.id}')`,icon:"fas fa-edit",cssClass:"budget-btn",show:!0}:null},f=i.deadlineExtensions&&i.deadlineExtensions.length>0;y>100&&console.log(`🔍 Task ${i.id.substring(0,8)}: deadlineProgress = ${y}%`);const v=window.SVGRings.createSVGRing(h),w=window.SVGRings.createDeadlineDisplay({deadline:d,daysRemaining:l,size:80,button:m?{text:f?"הארך שוב":"הארך יעד",onclick:`event.stopPropagation(); manager.showExtendDeadlineDialog('${i.id}')`,icon:"fas fa-calendar-plus",cssClass:"deadline-btn",show:!0}:null});let T=`
    <div class="svg-rings-dual-layout">
      ${v}
      ${w}
    </div>
  `;return o&&(T+=`<div class="budget-adjusted-note" style="text-align: center; margin-top: 12px; font-size: 11px; color: #3b82f6;"><i class="fas fa-info-circle"></i> תקציב עודכן ל-${s}ש</div>`),T}function Di(i,e={}){const{safeText:t,formatDate:s,formatShort:n}=e,o=ot(i),r=rt(o),a=o.originalEstimate||o.estimatedMinutes,l=o.estimatedMinutes!==a,c=o.actualMinutes>a,d=Math.max(0,o.actualMinutes-a),u=new Date,g=new Date(o.deadline),p=Math.ceil((g-u)/(1e3*60*60*24)),b=Math.round(o.actualMinutes/60*10)/10,y=Math.round(o.estimatedMinutes/60*10)/10,m=t?t(o.description):o.description,h=t?t(o.clientName):o.clientName,f=o.clientName.length>20?t?t(o.clientName.substring(0,20)+"..."):o.clientName.substring(0,20)+"...":h,v=o.status==="הושלם",w=o.status==="pending_approval",T=v?`
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  `:"",E=J(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||""),A=E?`
    <div class="linear-card-badges">
      ${E}
    </div>
  `:"";return`
    <div class="linear-minimal-card ${w?"pending-approval":""}" data-task-id="${o.id}">
      ${A}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${h}">
          ${m}
          ${T}
        </h3>

        <!-- 🎯 SVG RINGS -->
        ${!v&&window.SVGRings?Bi(o,r,b,y,a,l,c,d,p):""}
      </div>

      <!-- החלק התחתון - מחוץ ל-content -->
      <div class="linear-card-meta">
        <div class="linear-client-row">
          <span class="linear-client-label">לקוח:</span>
          <span class="linear-client-name" title="${h}">
            ${f}
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
  `}function Ii(i,e={}){const{safeText:t,formatDate:s,taskActionsManager:n}=e,o=ot(i),r=rt(o),a=o.status==="הושלם",l=jt(o.status),c=J(o.caseNumber,o.serviceName,o.serviceType,o.serviceId||""),d=window.SVGRings?window.SVGRings.createTableProgressBar({progress:r,actualMinutes:o.actualMinutes||0,estimatedMinutes:o.estimatedMinutes||1}):`${r}%`;let u;if(window.SVGRings){const b=new Date,y=new Date(o.deadline),m=o.createdAt?new Date(o.createdAt):b,h=Math.ceil((y-b)/(1e3*60*60*24)),f=m<y?m:y,v=Math.max(1,(y-f)/(1e3*60*60*24)),w=(b-f)/(1e3*60*60*24),T=Math.max(0,Math.round(w/v*100));u=window.SVGRings.createCompactDeadlineRing({daysRemaining:h,progress:T,size:52})}else u=s?s(o.deadline):o.deadline;const p=o.status==="pending_approval"?"pending-approval-row":"";return`
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
      <td style="color: #6b7280; font-size: 13px;">${window.DatesModule?window.DatesModule.getCreationDateTableCell(o):""}</td>
      <td>${l}</td>
      <td class="actions-column">
        ${n?n.createTableActionButtons(o,a):""}
      </td>
    </tr>
  `}function at(i="active"){return i==="completed"?`
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
  `}function ki(i,e={}){const{stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o,safeText:r}=e,a=document.getElementById("budgetContainer"),l=document.getElementById("budgetTableContainer");if(!i||i.length===0){a&&(a.innerHTML=at(s||"active"),a.classList.remove("hidden")),l&&l.classList.add("hidden");return}const c=i.map(p=>Di(p,e)).join(""),d=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||"active"):"",u=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:"",g=`
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
            <option value="recent" ${o==="recent"?"selected":""}>עדכון אחרון</option>
            <option value="name" ${o==="name"?"selected":""}>שם (א-ת)</option>
            <option value="deadline" ${o==="deadline"?"selected":""}>תאריך יעד</option>
            <option value="progress" ${o==="progress"?"selected":""}>התקדמות</option>
          </select>
        </div>
      </div>
      <div class="budget-cards-grid">
        ${c}
      </div>
      ${u}
    </div>
  `;a&&(a.innerHTML=g,a.classList.remove("hidden"),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(a)),l&&l.classList.add("hidden")}function Li(i,e={}){const{stats:t,currentTaskFilter:s,paginationStatus:n,currentBudgetSort:o}=e,r=window.StatisticsModule?window.StatisticsModule.createBudgetStatsBar(t,s||"active"):"",a=n!=null&&n.hasMore?`
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${n.filteredItems-n.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${n.displayedItems} מתוך ${n.filteredItems} רשומות
      </div>
    </div>
  `:"",l=!i||i.length===0?at(s||"active"):`
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
          ${i.map(u=>Ii(u,e)).join("")}
        </tbody>
      </table>
      ${a}
    </div>
  `,c=document.getElementById("budgetContainer"),d=document.getElementById("budgetTableContainer");d&&(d.innerHTML=l,d.classList.remove("hidden"),window.DescriptionTooltips&&window.DescriptionTooltips.refresh(d)),c&&c.classList.add("hidden")}function xi(i,e,t,s="recent"){const n=i.map(a=>Mi(a)).join(""),o=window.StatisticsModule.createTimesheetStatsBar(e);return`
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
  `}function Mi(i){if(!i||typeof i!="object")return console.error("Invalid entry provided to createTimesheetCard:",i),"";const e={id:i.id||i.entryId||Date.now(),clientName:i.clientName||"",action:i.action||"",minutes:Number(i.minutes)||0,date:i.date||new Date().toISOString(),fileNumber:i.fileNumber||"",caseNumber:i.caseNumber||"",serviceName:i.serviceName||"",notes:i.notes||"",createdAt:i.createdAt||null,serviceType:i.serviceType||null,parentServiceId:i.parentServiceId||null},t=Math.round(e.minutes/60*10)/10,s=safeText(e.clientName),n=safeText(e.action);safeText(e.fileNumber),safeText(e.notes);const o=window.DatesModule.formatDate,r=window.DatesModule.formatShort,a=J(e.caseNumber,e.serviceName,e.serviceType,e.serviceId||""),l=a?`
    <div class="linear-card-badges">
      ${a}
    </div>
  `:"";return`
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
  `}function Ai(i,e,t,s="recent"){if(!i||i.length===0)return $i();const n=i.map(a=>{if(!a||typeof a!="object")return console.warn("Invalid entry in renderTimesheetTable:",a),"";const l=J(a.caseNumber,a.serviceName,a.serviceType,a.serviceId||""),c=a.id||a.entryId||Date.now();return`
      <tr data-entry-id="${c}">
        <td class="timesheet-cell-date">${formatDate(a.date)}</td>
        <td class="timesheet-cell-action">
          <div class="table-description-with-icons">
            <span>${safeText(a.action||"")}</span>
            ${l}
          </div>
        </td>
        <td class="timesheet-cell-time">
          <span class="time-badge">${Number(a.minutes)||0} דק'</span>
        </td>
        <td class="timesheet-cell-client">${safeText(a.clientName||"")}</td>
        <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(a)}</td>
        <td>${safeText(a.notes||"—")}</td>
        <td class="actions-column">
          <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${c}')" title="ערוך שעתון">
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
  `}function $i(){return`
    <div class="empty-state">
      <i class="fas fa-clock"></i>
      <h4>אין רשומות שעתון</h4>
      <p>רשום את הפעולה הראשונה שלך</p>
    </div>
  `}function Ee(i){return i.reduce((e,t)=>e+(t.minutes||0),0)}function Fi(i,e,t){V(async()=>{const{startTimesheetListener:s}=await import("./real-time-listeners-BzLKVeci.js");return{startTimesheetListener:s}},[]).then(({startTimesheetListener:s})=>s(i,e,t)).catch(s=>{console.error("❌ Error importing real-time-listeners:",s),t&&t(s)})}function Ni(i,e){return!i||i.length===0||i.sort((t,s)=>{switch(e){case"recent":const n=new Date(t.lastUpdated||t.createdAt||0).getTime();return new Date(s.lastUpdated||s.createdAt||0).getTime()-n;case"name":const r=(t.clientName||"").trim(),a=(s.clientName||"").trim();return!r&&!a?0:r?a?r.localeCompare(a,"he"):-1:1;case"deadline":const l=new Date(t.deadline||"9999-12-31").getTime(),c=new Date(s.deadline||"9999-12-31").getTime();return l-c;case"progress":const d=t.estimatedMinutes>0?t.actualMinutes/t.estimatedMinutes*100:0;return(s.estimatedMinutes>0?s.actualMinutes/s.estimatedMinutes*100:0)-d;default:return 0}}),i}function _i(i,e){if(!i||i.length===0)return[];const t=new Date;if(e==="today"){const s=new Date(t.getFullYear(),t.getMonth(),t.getDate());return i.filter(n=>{if(!n.date)return!1;const o=new Date(n.date);return new Date(o.getFullYear(),o.getMonth(),o.getDate()).getTime()===s.getTime()})}if(e==="month"){const s=new Date;return s.setMonth(s.getMonth()-1),i.filter(n=>n.date?new Date(n.date)>=s:!0)}return[...i]}function Ri(i,e){return!i||i.length===0||i.sort((t,s)=>{switch(e){case"recent":const n=new Date(t.date||0).getTime();return new Date(s.date||0).getTime()-n;case"client":const r=(t.clientName||"").trim(),a=(s.clientName||"").trim();return!r&&!a?0:r?a?r.localeCompare(a,"he"):-1:1;case"hours":const l=t.minutes||0;return(s.minutes||0)-l;default:return 0}}),i}async function lt(){var i,e;try{const t=window.firebaseDB;if(!t){console.error("❌ Firebase לא מחובר");return}window.manager&&window.manager.clients&&window.manager.clients.forEach((o,r)=>{});const s=await t.collection("clients").get(),n=[];s.forEach((o,r)=>{const a=o.data();n.push({id:o.id,...a})});for(const o of n)if(o.type==="hours"){const r=await t.collection("timesheet_entries").where("clientName","==",o.fullName).get();let a=0;const l={},c=[];r.forEach(b=>{const y=b.data(),m=y.minutes||0,h=y.employee||y.lawyer||"לא ידוע";a+=m,l[h]||(l[h]=0),l[h]+=m,c.push({date:y.date,employee:h,minutes:m,action:y.action})}),c.forEach((b,y)=>{}),Object.entries(l).forEach(([b,y])=>{});const g=((o.totalHours||0)*60-a)/60,p=(e=(i=window.manager)==null?void 0:i.clients)==null?void 0:e.find(b=>b.fullName===o.fullName)}}catch(t){console.error("❌ שגיאה באבחון:",t)}}async function ct(){try{const i=window.firebaseDB;if(!i){console.error("❌ Firebase לא מחובר");return}const e=await i.collection("clients").get();for(const t of e.docs){const s=t.data();if(s.type==="hours"){const n=await W(s.fullName);if(await t.ref.update({hoursRemaining:n.remainingHours,minutesRemaining:n.remainingMinutes,isBlocked:n.isBlocked,isCritical:n.isCritical,lastUpdated:firebase.firestore.FieldValue.serverTimestamp(),fixedAt:firebase.firestore.FieldValue.serverTimestamp()}),window.manager&&window.manager.clients){const o=window.manager.clients.findIndex(r=>r.fullName===s.fullName);o!==-1&&(window.manager.clients[o].hoursRemaining=n.remainingHours,window.manager.clients[o].minutesRemaining=n.remainingMinutes,window.manager.clients[o].isBlocked=n.isBlocked,window.manager.clients[o].isCritical=n.isCritical)}}}window.manager&&window.manager.clientValidation&&window.manager.clientValidation.updateBlockedClients()}catch(i){console.error("❌ שגיאה בתיקון:",i)}}function dt(){!window.manager||!window.manager.clients||(window.manager.clients.length,window.manager.clients.forEach((i,e)=>{i.type==="fixed"||i.isBlocked||i.isCritical}))}typeof window<"u"&&(window.debugClientHoursMismatch=lt,window.fixClientHoursMismatch=ct,window.showClientStatusSummary=dt,window.calculateClientHoursAccurate=W,window.updateClientHoursImmediately=pe);const Ui=Object.freeze(Object.defineProperty({__proto__:null,debugClientHoursMismatch:lt,fixClientHoursMismatch:ct,showClientStatusSummary:dt},Symbol.toStringTag,{value:"Module"}));class ut{constructor(){var e,t;this.currentUser=null,this.currentUsername=null,this.currentEmployee=null,this.clients=[],this.budgetTasks=[],this.timesheetEntries=[],this.connectionStatus="unknown",this.addTaskDialog=null,this.currentTaskFilter=L.getStateValue("taskFilter"),this.currentTimesheetFilter=L.getStateValue("timesheetFilter"),this.currentBudgetView=L.getStateValue("budgetView"),this.currentTimesheetView=L.getStateValue("timesheetView"),this.filteredBudgetTasks=[],this.filteredTimesheetEntries=[],this.budgetSortField=null,this.budgetSortDirection="asc",this.timesheetSortField=null,this.timesheetSortDirection="asc",this.currentBudgetSort=L.getStateValue("budgetSort"),this.currentTimesheetSort=L.getStateValue("timesheetSort"),this.currentBudgetPage=1,this.currentTimesheetPage=1,this.budgetPagination=(e=window.PaginationModule)==null?void 0:e.create({pageSize:20}),this.timesheetPagination=(t=window.PaginationModule)==null?void 0:t.create({pageSize:20}),this.welcomeScreenStartTime=null,this.isTaskOperationInProgress=!1,this.isTimesheetOperationInProgress=!1,this.dataCache=new re({maxAge:5*60*1e3,staleAge:10*60*1e3,staleWhileRevalidate:!0,storage:"memory",debug:!1,onError:s=>{Logger.log("❌ [DataCache] Error:",s)}}),this.domCache=new $t,this.notificationBell=window.notificationBell,this.clientValidation=new wi(this),this.announcementTicker=new Vt,this.activityLogger=null,this.taskActionsManager=null,this.integrationManager=window.IntegrationManagerModule?window.IntegrationManagerModule.create():null,this.idleTimeout=null,this.sessionManager=null,Logger.log("✅ LawOfficeManager initialized")}waitForAuthReady(){return new Promise(e=>{const t=firebase.auth().onAuthStateChanged(s=>{t(),e(s)})})}async init(){Logger.log("🚀 Initializing Law Office System..."),this.setupEventListeners(),Logger.log("⏳ Waiting for Firebase Auth...");const e=await this.waitForAuthReady();if(e){Logger.log("✅ Found saved session for:",e.email),Logger.log("🔐 Showing login screen - manual login required (like banks)");const t=document.getElementById("email");t&&e.email&&(t.value=e.email)}this.showLogin(),this.setupNotificationBellListener(),Logger.log("✅ System initialized")}async handleAuthenticatedUser(e){try{if(window.isInWelcomeScreen)return;const t=await window.firebaseDB.collection("employees").doc(e.email).get();if(t.exists){const s=t.data();if(this.currentUser=s.email,this.currentUsername=s.username||s.name,this.currentEmployee=s,fe(this.currentUsername),console.log("🔍 [DEBUG] About to start NotificationBell listener..."),console.log("🔍 [DEBUG] this.notificationBell:",!!this.notificationBell),console.log("🔍 [DEBUG] window.firebaseDB:",!!window.firebaseDB),console.log("🔍 [DEBUG] user:",e),this.notificationBell&&window.firebaseDB){console.log("🔔 Starting NotificationBell listener for",e.email);try{this.notificationBell.startListeningToAdminMessages(e,window.firebaseDB),console.log("✅ NotificationBell listener started successfully"),console.log("✅ [DEBUG] Listener confirmed active:",!!this.notificationBell.messagesListener)}catch(n){console.error("❌ Failed to start NotificationBell listener:",n)}}else console.error("⚠️ CRITICAL: Cannot start NotificationBell listener!",{hasNotificationBell:!!this.notificationBell,hasFirebaseDB:!!window.firebaseDB,notificationBell:this.notificationBell,firebaseDB:window.firebaseDB});await this.loadData(),this.showApp(),this.initializeAddTaskSystem()}else await firebase.auth().signOut(),this.showLogin()}catch(t){console.error("❌ Error loading user profile:",t),this.showLogin()}}setupNotificationBellListener(){console.log("🔔 Setting up permanent NotificationBell listener..."),firebase.auth().onAuthStateChanged(e=>{if(e&&window.firebaseDB){if(console.log("🔔 Auth state changed - User logged in:",e.email),this.notificationBell){console.log("🔔 Starting NotificationBell listener...");try{this.notificationBell.startListeningToAdminMessages(e,window.firebaseDB),console.log("✅ NotificationBell listener started successfully"),console.log("✅ Listener active:",!!this.notificationBell.messagesListener)}catch(n){console.error("❌ Failed to start NotificationBell listener:",n)}}else console.log("ℹ️ NotificationBell not yet loaded - will auto-init when ready");const t=document.getElementById("interfaceElements"),s=t&&!t.classList.contains("hidden");if(s&&this.announcementTicker){console.log("📢 Starting System Announcement Ticker...");try{this.announcementTicker.init(e,window.firebaseDB),console.log("✅ System Announcement Ticker initialized successfully")}catch(n){console.error("❌ Failed to initialize System Announcement Ticker:",n)}}else s||console.log("ℹ️ User on login screen - ticker will init after login")}else e?console.warn("⚠️ Cannot start services - missing dependencies:",{hasUser:!!e,hasFirebaseDB:!!window.firebaseDB}):(console.log("🔔 Auth state changed - User logged out, cleaning up..."),this.notificationBell&&this.notificationBell.cleanup(),this.announcementTicker&&this.announcementTicker.cleanup())})}initTicker(){const e=firebase.auth().currentUser;if(e&&window.firebaseDB&&this.announcementTicker){console.log("📢 Initializing System Announcement Ticker from showApp()...");try{this.announcementTicker.init(e,window.firebaseDB),console.log("✅ System Announcement Ticker initialized successfully")}catch(t){console.error("❌ Failed to initialize System Announcement Ticker:",t)}}}setupEventListeners(){const e=document.getElementById("loginForm");e&&e.addEventListener("submit",async r=>{r.preventDefault(),await Te.call(this)});const t=document.getElementById("forgotPasswordForm");t&&t.addEventListener("submit",async r=>{await ai.call(this,r)});const s=document.getElementById("budgetForm");s&&s.addEventListener("submit",r=>{r.preventDefault(),this.addBudgetTask()});const n=document.getElementById("timesheetForm");n&&n.addEventListener("submit",r=>{r.preventDefault(),this.addTimesheetEntry()});const o=document.getElementById("budgetSearchBox");if(o){const r=Ve(a=>{this.searchBudgetTasks(a)},300);o.addEventListener("input",a=>{r(a.target.value)})}Logger.log("✅ Event listeners configured")}cleanup(){var e;this.refreshInterval&&clearInterval(this.refreshInterval),(e=this.notificationBell)!=null&&e.cleanup&&this.notificationBell.cleanup(),this.stopRealTimeListeners(),Logger.log("✅ Manager cleanup completed")}stopRealTimeListeners(){try{V(async()=>{const{stopAllListeners:e}=await import("./real-time-listeners-BzLKVeci.js");return{stopAllListeners:e}},[]).then(({stopAllListeners:e})=>{e(),Logger.log("✅ Real-time listeners stopped")}).catch(e=>{console.error("❌ Error stopping listeners:",e)})}catch(e){console.error("❌ Error stopping real-time listeners:",e)}}showLogin(){ge.call(this)}async handleLogin(){await Te.call(this)}showWelcomeScreen(){ii.call(this)}async waitForWelcomeMinimumTime(){await si.call(this)}updateLoaderText(e,t=null){ni.call(this,e,t)}showApp(){oi.call(this)}logout(){this.idleTimeout&&this.idleTimeout.stop(),st()}switchAuthMethod(e){li.call(this,e)}async handleSMSLogin(){await ci.call(this)}async verifyOTP(){await di.call(this)}async initAIChatSystem(){await mi.call(this)}initSecurityModules(){window.IdleTimeoutManager&&!this.idleTimeout?(this.idleTimeout=new window.IdleTimeoutManager({idleTimeout:10*60*1e3,warningTimeout:5*60*1e3,enabled:!0,onWarning:e=>{this.showIdleWarning(e)},onLogout:async()=>{Logger.log("🚪 [Security] Auto-logout triggered by idle timeout"),await this.confirmLogout()}}),this.idleTimeout.start(),Logger.log("✅ [Security] Idle Timeout Manager initialized (15 min total)")):window.IdleTimeoutManager?Logger.log("ℹ️ [Security] Idle Timeout Manager already initialized"):console.warn("⚠️ [Security] IdleTimeoutManager not loaded - auto-logout disabled")}showIdleWarning(e){const t=this.currentUsername||localStorage.getItem("userName")||"משתמש",s=Math.floor(e/60),n=e%60,o=`${s}:${n.toString().padStart(2,"0")}`,r=document.createElement("div");r.className="idle-overlay",r.id="idleWarningOverlay",r.innerHTML=`
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
    `,document.body.appendChild(r),this.setupIdleCountdownListener()}setupIdleCountdownListener(){this.idleCountdownListener&&window.removeEventListener("idle:countdown",this.idleCountdownListener),this.idleCountdownListener=t=>{const s=t.detail.remainingSeconds,n=Math.floor(s/60),o=s%60,r=n>0?`${n}:${o.toString().padStart(2,"0")}`:`${o} שניות`,a=document.getElementById("idleCountdownTimer");a&&(a.textContent=r)},window.addEventListener("idle:countdown",this.idleCountdownListener);const e=()=>{const t=document.getElementById("idleWarningOverlay");t&&t.remove(),window.removeEventListener("idle:warning-hide",e)};window.addEventListener("idle:warning-hide",e)}handleIdleStayLoggedIn(){this.idleTimeout&&this.idleTimeout.resetActivity();const e=document.getElementById("idleWarningOverlay");e&&e.remove()}async handleIdleLogout(){const e=document.getElementById("idleWarningOverlay");e&&e.remove(),this.idleTimeout&&this.idleTimeout.stop(),await this.confirmLogout()}async confirmLogout(){await nt.call(this)}handleUserActivity(){}handleCountdownUpdate(e){}async loadData(){var e,t;try{if(this.updateLoaderText("מתחבר...",10),ei(),this.updateLoaderText("מתחבר ל-Firebase...",20),window.CaseNumberGenerator)try{await window.CaseNumberGenerator.initialize(),this.updateLoaderText("מאתחל מערכת...",30)}catch(d){Logger.log("⚠️ CaseNumberGenerator initialization failed:",d)}this.updateLoaderText("טוען לקוחות...",40);const s=Promise.all([this.dataCache.get("clients",()=>he()),this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,()=>{var d;return((d=this.integrationManager)==null?void 0:d.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,50)}),this.dataCache.get(`timesheetEntries:${this.currentUser}`,()=>{var d;return((d=this.integrationManager)==null?void 0:d.loadTimesheet(this.currentUser))||K(this.currentUser)})]),n=[{delay:300,text:"טוען משימות...",progress:55},{delay:300,text:"טוען נתוני זמן...",progress:65}];let o=0;const r=setInterval(()=>{if(o<n.length){const d=n[o];this.updateLoaderText(d.text,d.progress),o++}},300),[a,l,c]=await s;if(clearInterval(r),this.updateLoaderText("עיבוד נתונים...",70),this.clients=a,this.budgetTasks=l,this.timesheetEntries=c,window.clients=a,window.cases=window.cases||[],window.budgetTasks=l,window.timesheetEntries=c,window.lawOfficeManager=this,window.CoreUtils=At,this.updateLoaderText("מכין ממשק...",85),window.TaskActionsModule&&!this.taskActionsManager&&(this.taskActionsManager=window.TaskActionsModule.create(),this.taskActionsManager.setManager(this),Logger.log("✅ TaskActionsManager initialized")),window.ActivityLoggerModule&&!this.activityLogger&&(this.activityLogger=window.ActivityLoggerModule.create(),Logger.log("✅ ActivityLogger initialized")),this.filterBudgetTasks(),this.filterTimesheetEntries(),this.syncToggleState(),await this.updateTaskCountBadges(),this.clientValidation&&this.clientValidation.updateBlockedClients(),await this.refreshAllClientCaseSelectors(),window.CasesModule&&typeof window.CasesModule.refreshCurrentCase=="function"&&await window.CasesModule.refreshCurrentCase(),this.notificationBell){const d=l.filter(p=>{if(p.status==="הושלם")return!1;const b=new Date(p.deadline),m=Math.ceil((b-new Date)/(1e3*60*60*24));return m<=3&&m>=0}),u=((e=this.clientValidation)==null?void 0:e.blockedClients)||[],g=((t=this.clientValidation)==null?void 0:t.criticalClients)||[];this.notificationBell.updateFromSystem(u,g,d)}this.startRealTimeListeners(),this.updateLoaderText("כמעט מוכן...",95),await new Promise(d=>setTimeout(d,200)),Logger.log(`✅ Data loaded: ${a.length} clients, ${l.length} tasks, ${c.length} entries`),this.updateLoaderText("הכל מוכן!",100),await new Promise(d=>setTimeout(d,300))}catch(s){throw console.error("❌ Error loading data:",s),this.showNotification("שגיאה בטעינת נתונים","error"),s}}startRealTimeListeners(){try{Logger.log("🔊 Starting real-time listeners..."),Si(this.currentUser,e=>{Logger.log(`📡 Tasks updated: ${e.length} tasks`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`),this.budgetTasks=e,window.budgetTasks=e,this.filterBudgetTasks(),this.renderBudgetView(),this.updateTaskCountBadges()},e=>{console.error("❌ Tasks listener error:",e)}),Fi(this.currentUser,e=>{Logger.log(`📡 Timesheet updated: ${e.length} entries`),this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=e,window.timesheetEntries=e,this.filterTimesheetEntries(),this.renderTimesheetView()},e=>{console.error("❌ Timesheet listener error:",e)}),Logger.log("✅ Real-time listeners started")}catch(e){console.error("❌ Error starting real-time listeners:",e)}}async refreshAllClientCaseSelectors(){const e=window.clientCaseSelectorInstances||{},t=Object.keys(e);if(t.length===0)return;Logger.log(`🔄 Refreshing ${t.length} client-case selector(s)...`);const s=t.map(n=>{const o=e[n];return o&&typeof o.refreshSelectedCase=="function"?o.refreshSelectedCase():Promise.resolve()});try{await Promise.all(s),Logger.log("✅ All client-case selectors refreshed")}catch(n){console.error("❌ Error refreshing client-case selectors:",n)}}async loadDataFromFirebase(){window.showSimpleLoading("טוען נתונים מחדש...");try{this.dataCache.clear(),Logger.log("🔄 Cache cleared - forcing fresh data from Firebase"),await this.loadData();const e=this.dataCache.getStats();Logger.log("📊 Cache stats:",e),this.showNotification("הנתונים עודכנו בהצלחה","success")}catch{this.showNotification("שגיאה בטעינת נתונים","error")}finally{window.hideSimpleLoading()}}initializeAddTaskSystem(){try{console.log("🚀 Initializing Add Task System v2.0..."),this.addTaskDialog=zt(this,{onSuccess:e=>{console.log("✅ Task created successfully:",e),this.filterBudgetTasks()},onError:e=>{console.error("❌ Error creating task:",e),this.showNotification("שגיאה בשמירת המשימה: "+e.message,"error")},onCancel:()=>{console.log("ℹ️ User cancelled task creation")},enableDrafts:!0}),console.log("✅ Add Task System v2.0 initialized")}catch(e){console.error("❌ Error initializing Add Task System:",e)}}async addBudgetTask(){var e,t,s,n,o,r;if(this.isTaskOperationInProgress){this.showNotification("אנא המתן לסיום הפעולה הקודמת","warning");return}this.isTaskOperationInProgress=!0;try{const a=(e=window.ClientCaseSelectorsManager)==null?void 0:e.getBudgetValues();if(!a){this.showNotification("חובה לבחור לקוח ותיק","error");return}const l=parseInt((t=document.getElementById("estimatedTime"))==null?void 0:t.value),c=(s=document.getElementById("budgetDeadline"))==null?void 0:s.value;let d="";const u=window._currentBudgetDescriptionInput;if(u){const m=u.validate();if(!m.valid){this.showNotification(m.error,"error");return}d=u.getValue()}else if(d=(o=(n=document.getElementById("budgetDescription"))==null?void 0:n.value)==null?void 0:o.trim(),!d||d.length<3){this.showNotification("חובה להזין תיאור משימה (לפחות 3 תווים)","error");return}const g=null,p=null;if(!l||l<1){this.showNotification("חובה להזין זמן משוער","error");return}if(!c){this.showNotification("חובה לבחור תאריך יעד","error");return}const b=(r=document.getElementById("budgetBranch"))==null?void 0:r.value;if(!b){this.showNotification("חובה לבחור סניף מטפל","error");return}const y=window.NotificationMessages.tasks;await R.execute({...y.loading.create(a.clientName),action:async()=>{var v;const m={description:d,categoryId:g,categoryName:p,clientName:a.clientName,clientId:a.clientId,caseId:a.caseId,caseNumber:a.caseNumber,caseTitle:a.caseTitle,serviceId:a.serviceId,serviceName:a.serviceName,serviceType:a.serviceType,parentServiceId:a.parentServiceId,branch:b,estimatedMinutes:l,originalEstimate:l,deadline:c,employee:this.currentUser,status:"pending_approval",requestedMinutes:l,approvedMinutes:null,timeSpent:0,timeEntries:[],createdAt:new Date};Logger.log("📝 Creating budget task with data:",m),console.log("🔍 FULL taskData:",JSON.stringify(m,null,2)),console.log("🔍 serviceType:",m.serviceType),console.log("🔍 parentServiceId:",m.parentServiceId),console.log("🔍 serviceId:",m.serviceId),Logger.log("  🚀 [v2.0] Using FirebaseService.call");const h=await window.FirebaseService.call("createBudgetTask",m,{retries:3,timeout:15e3});if(!h.success)throw new Error(h.error||"Failed to create budget task");const f=(v=h.data)==null?void 0:v.taskId;Logger.log("✅ Task created with pending_approval status:",f);try{const{taskApprovalService:w}=await V(async()=>{const{taskApprovalService:T}=await import("./task-approval-service-D3rkbQAY.js");return{taskApprovalService:T}},[]);w.init(window.firebaseDB,{email:this.currentUser}),await w.createApprovalRequest(f,m,this.currentUser,this.currentUser.split("@")[0]),Logger.log("✅ Approval request created for task:",f)}catch(w){console.error("❌ Error creating approval request:",w)}window.EventBus.emit("task:created",{taskId:f||"unknown",clientId:m.clientId,clientName:m.clientName,employee:m.employee,originalEstimate:m.estimatedMinutes,status:"pending_approval"}),Logger.log("  🚀 [v2.0] EventBus: task:created emitted"),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`),this.budgetTasks=await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`,()=>{var w;return((w=this.integrationManager)==null?void 0:w.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,50)}),this.filterBudgetTasks()},successMessage:null,errorMessage:y.error.createFailed,onSuccess:()=>{var h,f;if(window.NotificationSystem&&window.NotificationSystem.alert){const v=y.success.created(a.clientName,d,l);window.NotificationSystem.alert(v,()=>{console.log("✅ User acknowledged task creation")},{title:"✅ המשימה נשלחה בהצלחה",okText:"הבנתי",type:"success"})}u&&u.saveToRecent&&u.saveToRecent(),yi(this),(h=document.getElementById("budgetFormContainer"))==null||h.classList.add("hidden");const m=document.getElementById("smartPlusBtn");m&&m.classList.remove("active"),(f=window.ClientCaseSelectorsManager)==null||f.clearBudget()}})}finally{this.isTaskOperationInProgress=!1}}searchBudgetTasks(e){const t=e.toLowerCase().trim();if(!t){this.filterBudgetTasks();return}this.filteredBudgetTasks=this.budgetTasks.filter(s=>{var n,o,r,a,l,c,d;return((n=s.description)==null?void 0:n.toLowerCase().includes(t))||((o=s.taskDescription)==null?void 0:o.toLowerCase().includes(t))||((r=s.clientName)==null?void 0:r.toLowerCase().includes(t))||((a=s.caseNumber)==null?void 0:a.toLowerCase().includes(t))||((l=s.fileNumber)==null?void 0:l.toLowerCase().includes(t))||((c=s.serviceName)==null?void 0:c.toLowerCase().includes(t))||((d=s.caseTitle)==null?void 0:d.toLowerCase().includes(t))}),this.renderBudgetView()}async handleToggleSwitch(e){const t=e.checked?"completed":"active";await this.toggleTaskView(t)}async toggleTaskView(e){if(e!==this.currentTaskFilter){if(this.isTogglingView){console.warn("⚠️ Toggle already in progress, ignoring duplicate call");return}try{this.isTogglingView=!0,this.currentTaskFilter=e,L.setStateValue("taskFilter",e);const t=document.getElementById("activeFilterBtn"),s=document.getElementById("completedFilterBtn");t&&s&&(e==="active"?(t.classList.add("active"),s.classList.remove("active")):(t.classList.remove("active"),s.classList.add("active"))),this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${e}`);const n=await this.dataCache.get(`budgetTasks:${this.currentUser}:${e}`,()=>H(this.currentUser,e,50));if(this.currentTaskFilter!==e){console.warn("⚠️ View mode changed during load, discarding stale results");return}this.budgetTasks=n,this.filteredBudgetTasks=[...this.budgetTasks],this.updateTaskCountBadges(),this.renderBudgetView(),window.EventBus.emit("tasks:view-changed",{view:e,count:this.budgetTasks.length})}catch(t){console.error("Error toggling task view:",t),this.showNotification("שגיאה בטעינת משימות","error")}finally{this.isTogglingView=!1}}}syncToggleState(){const e=document.getElementById("activeFilterBtn"),t=document.getElementById("completedFilterBtn");!e||!t||(this.currentTaskFilter==="completed"?(e.classList.remove("active"),t.classList.add("active")):(e.classList.add("active"),t.classList.remove("active")),Logger.log(`✅ Toggle state synced: ${this.currentTaskFilter}`))}async filterBudgetTasks(){this.currentTaskFilter==="completed"?this.filteredBudgetTasks=this.budgetTasks.filter(e=>e.status==="הושלם"):this.currentTaskFilter==="active"?this.filteredBudgetTasks=this.budgetTasks.filter(e=>e.status!=="הושלם"):this.filteredBudgetTasks=[...this.budgetTasks],this.renderBudgetView()}sortBudgetTasks(e){var s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentBudgetSort=t,L.setStateValue("budgetSort",t),this.filteredBudgetTasks=Ni(this.filteredBudgetTasks,t),this.renderBudgetView()}async updateTaskCountBadges(){try{const e=window.firebaseDB;if(!e){console.warn("⚠️ Firebase DB not available for count badges");return}const[t,s]=await Promise.all([e.collection("budget_tasks").where("employee","==",this.currentUser).where("status","!=","הושלם").get(),e.collection("budget_tasks").where("employee","==",this.currentUser).where("status","==","הושלם").get()]),n=t.size,o=s.size,r=document.getElementById("activeCountBadge");r&&(r.textContent=n,r.style.display=n>0?"inline-flex":"none");const a=document.getElementById("completedCountBadge");a&&(a.textContent=o,a.style.display=o>0?"inline-flex":"none"),Logger.log(`✅ Count badges updated: ${n} active, ${o} completed`)}catch(e){console.error("Error updating count badges:",e);const t=document.getElementById("activeCountBadge"),s=document.getElementById("completedCountBadge");t&&(t.style.display="none"),s&&(s.style.display="none")}}async renderBudgetView(){const t={stats:window.StatisticsModule?await window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks):null,safeText:S,formatDate:B,formatShort:oe,currentBudgetSort:this.currentBudgetSort,currentTaskFilter:this.currentTaskFilter,paginationStatus:null,taskActionsManager:this.taskActionsManager};this.currentBudgetView==="cards"?ki(this.filteredBudgetTasks,t):Li(this.filteredBudgetTasks,t)}switchBudgetView(e){L.setStateValue("budgetView",e),this.currentBudgetView=e,document.querySelectorAll(".view-tab").forEach(t=>{t.dataset.view===e?t.classList.add("active"):t.classList.remove("active")}),this.renderBudgetView()}async addTimesheetEntry(){var r,a,l,c,d,u;const e=(r=document.getElementById("actionDate"))==null?void 0:r.value,t=parseInt((a=document.getElementById("actionMinutes"))==null?void 0:a.value),s=(c=(l=document.getElementById("actionDescription"))==null?void 0:l.value)==null?void 0:c.trim(),n=(u=(d=document.getElementById("actionNotes"))==null?void 0:d.value)==null?void 0:u.trim();if(!e){this.showNotification("חובה לבחור תאריך","error");return}if(!t||t<1){this.showNotification("חובה להזין זמן בדקות","error");return}if(!s||s.length<3){this.showNotification("חובה להזין תיאור פעולה (לפחות 3 תווים)","error");return}const o=window.NotificationMessages.timesheet;await R.execute({...o.loading.createInternal(),action:async()=>{var b;const g={date:e,minutes:t,clientName:null,clientId:null,fileNumber:null,caseId:null,caseTitle:null,action:s,notes:n,employee:this.currentUser,isInternal:!0,createdAt:new Date};Logger.log("📝 Creating internal timesheet entry:",g),Logger.log("  🚀 [v2.0] Using FirebaseService.call for createTimesheetEntry");const p=await window.FirebaseService.call("createTimesheetEntry",g,{retries:3,timeout:15e3});if(!p.success)throw new Error(p.error||"שגיאה ברישום פעילות");this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`),this.timesheetEntries=await this.dataCache.get(`timesheetEntries:${this.currentUser}`,()=>{var y;return((y=this.integrationManager)==null?void 0:y.loadTimesheet(this.currentUser))||K(this.currentUser)}),this.filterTimesheetEntries(),window.EventBus.emit("timesheet:entry-created",{entryId:((b=p.data)==null?void 0:b.entryId)||"unknown",date:e,minutes:t,action:s,notes:n,employee:this.currentUser,isInternal:!0}),Logger.log("  🚀 [v2.0] EventBus: timesheet:entry-created emitted")},successMessage:o.success.internalCreated(t),errorMessage:o.error.createFailed,onSuccess:()=>{var p;vi(this),(p=document.getElementById("timesheetFormContainer"))==null||p.classList.add("hidden");const g=document.getElementById("smartPlusBtn");g&&g.classList.remove("active")}})}filterTimesheetEntries(){const e=document.getElementById("timesheetFilter");e&&(this.currentTimesheetFilter=e.value);const t=this.currentTimesheetFilter;this.filteredTimesheetEntries=_i(this.timesheetEntries,t),this.renderTimesheetView()}sortTimesheetEntries(e){var s;const t=((s=e==null?void 0:e.target)==null?void 0:s.value)||e;this.currentTimesheetSort=t,this.filteredTimesheetEntries=Ri(this.filteredTimesheetEntries,t),this.renderTimesheetView()}renderTimesheetView(){const e=window.StatisticsModule?window.StatisticsModule.calculateTimesheetStatistics(this.timesheetEntries):{totalMinutes:Ee(this.filteredTimesheetEntries),totalHours:Math.round(Ee(this.filteredTimesheetEntries)/60*10)/10,totalEntries:this.filteredTimesheetEntries.length},t={currentPage:this.currentTimesheetPage,totalPages:Math.ceil(this.filteredTimesheetEntries.length/20),displayedItems:this.filteredTimesheetEntries.length,filteredItems:this.filteredTimesheetEntries.length},s=document.querySelector("#timesheetTab > div:last-child");if(!s){console.error("❌ Timesheet parent container not found");return}let n;this.currentTimesheetView==="cards"?n=xi(this.filteredTimesheetEntries,e,t,this.currentTimesheetSort):n=Ai(this.filteredTimesheetEntries,e,t,this.currentTimesheetSort),s.innerHTML=n,window.DescriptionTooltips&&window.DescriptionTooltips.refresh(s)}switchTimesheetView(e){this.currentTimesheetView=e,document.querySelectorAll("#timesheetTab .view-tab").forEach(t=>{t.dataset.view===e?t.classList.add("active"):t.classList.remove("active")}),this.renderTimesheetView()}showEditTimesheetDialog(e){bi(this,e)}searchClientsForEdit(e){Ti(this,e)}selectClientForEdit(e,t){Ei(this,e)}expandTaskCard(e,t){t.stopPropagation();const s=this.filteredBudgetTasks.find(n=>n.id===e);s&&this.showExpandedCard(s)}showExpandedCard(e){let t=0;e.estimatedMinutes&&e.estimatedMinutes>0&&(t=Math.round((e.actualMinutes||0)/e.estimatedMinutes*100));const s=e.status==="הושלם",n=`
      <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
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
                <span>${q(new Date(e.deadline))}</span>
              </div>
            </div>
            ${this.taskActionsManager?this.taskActionsManager.createCardActionButtons(e,s):""}
          </div>
        </div>
      </div>
    `;document.body.insertAdjacentHTML("beforeend",n),setTimeout(()=>{const o=document.querySelector(".linear-expanded-overlay");o&&o.classList.add("active")},10)}closeExpandedCard(){const e=document.querySelector(".linear-expanded-overlay");e&&(e.classList.remove("active"),setTimeout(()=>e.remove(),300))}showAdvancedTimeDialog(e){if(!window.DialogsModule){this.showNotification("מודול דיאלוגים לא נטען","error");return}window.DialogsModule.showAdvancedTimeDialog(e,this)}showTaskHistory(e){var o;const t=this.budgetTasks.find(r=>r.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}const s=document.createElement("div");s.className="popup-overlay";let n="";((o=t.history)==null?void 0:o.length)>0?n=t.history.map(r=>`
        <div class="history-entry">
          <div class="history-header">
            <span class="history-date">${B(r.date)}</span>
            <span class="history-minutes">${r.minutes} דקות</span>
          </div>
          <div class="history-description">${S(r.description||"")}</div>
          <div class="history-timestamp">נוסף ב: ${S(r.timestamp||"")}</div>
        </div>
      `).join(""):n='<div style="text-align: center; color: #6b7280; padding: 40px;">אין היסטוריה עדיין</div>',s.innerHTML=`
      <div class="popup" style="max-width: 600px;">
        <div class="popup-header">
          <i class="fas fa-history"></i>
          היסטוריית זמנים - ${S(t.clientName||"")}
        </div>
        <div class="popup-content">
          <div class="task-summary">
            <h4>${S(t.description||"")}</h4>
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
    `,document.body.appendChild(s),setTimeout(()=>s.classList.add("show"),10)}showExtendDeadlineDialog(e){const t=this.budgetTasks.find(h=>h.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}const s=document.createElement("div");s.className="popup-overlay",s.id="extendDeadlineOverlay";let n=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(t.deadline):new Date(t.deadline);(!n||isNaN(n.getTime()))&&(n=new Date,console.warn("⚠️ task.deadline is invalid, using current date",t.deadline));const o=new Date(n);o.setDate(o.getDate()+7);const r=o.toISOString().split("T")[0],a=n.toISOString().split("T")[0],l=this._buildExtensionsHistoryHTML(t);s.innerHTML=`
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
            <div style="color: #dc2626; font-weight: bold;">${q(n)}</div>
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
              value="${r}"
              min="${a}"
              required
            >

            <!-- ✅ NEW: Days difference display -->
            <div id="daysDifferenceDisplay" style="display: none; margin-top: 8px; padding: 10px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-right: 3px solid #3b82f6; border-radius: 6px; font-size: 13px; color: #1e40af;">
              <i class="fas fa-calendar-check" style="color: #3b82f6;"></i>
              <strong>הארכה של: <span id="daysCount">0</span> ימים</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                מ-<span id="oldDateDisplay">${B(n)}</span>
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
    `,document.body.appendChild(s);const c=document.getElementById("newDeadlineDate"),d=document.getElementById("dateValidationError"),u=s.querySelector(".popup-btn-confirm"),g=document.getElementById("daysDifferenceDisplay"),p=document.getElementById("daysCount"),b=document.getElementById("newDateDisplay"),y=h=>{if(!h){g.style.display="none";return}const f=new Date(h),v=new Date(a),w=f-v,T=Math.ceil(w/(1e3*60*60*24));T>0?(p.textContent=T,b.textContent=B(f),g.style.display="block"):g.style.display="none"},m=s.querySelectorAll(".quick-action-btn");m.forEach(h=>{h.addEventListener("click",f=>{f.preventDefault();const v=parseInt(h.dataset.days),w=new Date(n);w.setDate(w.getDate()+v);const T=w.toISOString().split("T")[0];c.value=T,c.dispatchEvent(new Event("change")),m.forEach(E=>E.classList.remove("selected")),h.classList.add("selected")})}),c.addEventListener("change",()=>{const h=new Date(c.value),f=new Date(a);m.forEach(v=>v.classList.remove("selected")),h<=f?(d.style.display="block",c.style.borderColor="#dc2626",u.disabled=!0,u.style.opacity="0.5",u.style.cursor="not-allowed",g.style.display="none"):(d.style.display="none",c.style.borderColor="",u.disabled=!1,u.style.opacity="1",u.style.cursor="pointer",y(c.value))}),y(c.value),setTimeout(()=>s.classList.add("show"),10)}_buildExtensionsHistoryHTML(e){if(!e.deadlineExtensions||e.deadlineExtensions.length===0)return"";const t=e.deadlineExtensions.map(s=>{const n=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.oldDeadline):new Date(s.oldDeadline),o=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.newDeadline):new Date(s.newDeadline),r=window.DatesModule?window.DatesModule.convertFirebaseTimestamp(s.extendedAt):new Date(s.extendedAt);return`
          <div class="extension-history-item">
            <div class="extension-header">
              <span class="extension-date">
                <i class="fas fa-calendar-alt"></i>
                ${B(r)}
              </span>
              <span class="extension-user">
                <i class="fas fa-user"></i>
                ${s.extendedBy||"לא ידוע"}
              </span>
            </div>
            <div class="extension-details">
              <div class="extension-dates">
                <span class="old-date">${B(n)}</span>
                <i class="fas fa-arrow-left"></i>
                <span class="new-date">${B(o)}</span>
              </div>
              <div class="extension-reason">${s.reason||"ללא סיבה"}</div>
            </div>
          </div>
        `}).reverse().join("");return`
      <div class="extensions-history-section">
        <div class="extensions-history-header">
          <i class="fas fa-history"></i>
          היסטוריית הארכות (${e.deadlineExtensions.length})
        </div>
        <div class="extensions-history-list">
          ${t}
        </div>
      </div>
    `}async submitDeadlineExtension(e){var o,r,a;const t=(o=document.getElementById("newDeadlineDate"))==null?void 0:o.value,s=(a=(r=document.getElementById("extensionReason"))==null?void 0:r.value)==null?void 0:a.trim();if(!t||!s){this.showNotification("אנא מלא את כל השדות","error");return}const n=window.NotificationMessages.tasks;await R.execute({...n.loading.extendDeadline(),action:async()=>{Logger.log("  🚀 [v2.0] Using FirebaseService.call for extendTaskDeadline");const l=await window.FirebaseService.call("extendTaskDeadline",{taskId:e,newDeadline:t,reason:s},{retries:3,timeout:1e4});if(!l.success)throw new Error(l.error||"שגיאה בהארכת יעד");await this.loadData(),this.filterBudgetTasks();const c=this.budgetTasks.find(d=>d.id===e);window.EventBus.emit("task:deadline-extended",{taskId:e,oldDeadline:(c==null?void 0:c.deadline)||t,newDeadline:t,reason:s,extendedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:deadline-extended emitted")},successMessage:n.success.deadlineExtended(t),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500})}async completeTask(e){const t=this.budgetTasks.find(s=>s.id===e);if(!t){this.showNotification("המשימה לא נמצאה","error");return}if(!window.DialogsModule){this.showNotification("מודול דיאלוגים לא נטען","error");return}window.TaskCompletionValidation?window.TaskCompletionValidation.initiateTaskCompletion(t,this):window.DialogsModule.showTaskCompletionModal(t,this)}async submitTimeEntry(e){var p,b,y,m;const t=this.budgetTasks.find(h=>h.id===e);if(!t)return;const s=(p=document.getElementById("workDate"))==null?void 0:p.value,n=parseInt((b=document.getElementById("workMinutes"))==null?void 0:b.value),o=document.getElementById("workDate"),r=document.getElementById("workMinutes"),a=window._currentGuidedInput;o==null||o.classList.remove("error"),r==null||r.classList.remove("error");const l=document.querySelector(".guided-textarea");l==null||l.classList.remove("error");const c=document.querySelector(".popup-overlay.show .popup");c&&c.querySelectorAll(".error-message").forEach(h=>h.remove());let d=!1;if(!s){d=!0,o==null||o.classList.add("error");const h=document.createElement("span");h.className="error-message",h.textContent="נא לבחור תאריך",o==null||o.parentElement.appendChild(h)}if(!n||n<=0){d=!0,r==null||r.classList.add("error");const h=document.createElement("span");h.className="error-message",h.textContent="נא להזין מספר דקות תקין",r==null||r.parentElement.appendChild(h)}let u="";if(a)if(a.validate().valid){u=a.getValue();const f=document.querySelector(".guided-textarea");f&&f.classList.remove("error")}else{d=!0;const f=document.querySelector(".guided-textarea");f&&f.classList.add("error");const v=document.querySelector(".guided-input-wrapper");if(v&&!v.querySelector(".error-message")){const w=document.createElement("span");w.className="error-message",w.textContent="נא למלא תיאור",v.appendChild(w)}}else if(u=(m=(y=document.getElementById("workDescription"))==null?void 0:y.value)==null?void 0:m.trim(),!u){d=!0;const h=document.getElementById("workDescription");h==null||h.classList.add("error");const f=document.createElement("span");f.className="error-message",f.textContent="נא להזין תיאור",h==null||h.parentElement.appendChild(f)}if(d){this.showNotification("נא למלא את כל השדות הנדרשים","error");return}a&&a.saveToRecent();const g=window.NotificationMessages.tasks;await R.execute({...g.loading.addTime(),action:async()=>{Logger.log("  🚀 [v2.0] Using FirebaseService.call for addTimeToTask");const h=await window.FirebaseService.call("addTimeToTask",{taskId:e,minutes:n,description:u,date:s},{retries:3,timeout:15e3});if(!h.success)throw new Error(h.error||"שגיאה בהוספת זמן");await this.loadData(),this.filterBudgetTasks(),window.EventBus.emit("task:time-added",{taskId:e,clientId:t.clientId,clientName:t.clientName,minutes:n,description:u,date:s,addedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:time-added emitted")},successMessage:g.success.timeAdded(n),errorMessage:g.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:()=>{this.closeExpandedCard()}})}async submitTaskCompletion(e){var r,a;const t=this.budgetTasks.find(l=>l.id===e);if(!t)return;const s=(a=(r=document.getElementById("completionNotes"))==null?void 0:r.value)==null?void 0:a.trim(),n=window._taskCompletionMetadata||{},o=window.NotificationMessages.tasks;await R.execute({...o.loading.complete(),action:async()=>{var c;Logger.log("  🚀 [v2.0] Using FirebaseService.call for completeTask");const l=await window.FirebaseService.call("completeTask",{taskId:e,completionNotes:s,gapReason:n.gapReason||null,gapNotes:n.gapNotes||null},{retries:3,timeout:15e3});if(delete window._taskCompletionMetadata,!l.success)throw new Error(l.error||"שגיאה בסיום משימה");this.budgetTasks=await(((c=this.integrationManager)==null?void 0:c.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,50)),this.filterBudgetTasks(),window.EventBus.emit("task:completed",{taskId:e,clientId:t.clientId,clientName:t.clientName,completionNotes:s,completedBy:this.currentUser,estimatedMinutes:t.estimatedMinutes,actualMinutes:t.totalMinutesSpent||0}),Logger.log("  🚀 [v2.0] EventBus: task:completed emitted")},successMessage:null,errorMessage:o.error.completeFailed,closePopupOnSuccess:!0,closeDelay:500,onSuccess:async()=>{this.closeExpandedCard(),await this.toggleTaskView("completed"),this.showNotification(o.success.completed(t.clientName),"success")}})}async submitBudgetAdjustment(e){var o,r,a;const t=parseInt((o=document.getElementById("newBudgetMinutes"))==null?void 0:o.value),s=(a=(r=document.getElementById("adjustReason"))==null?void 0:r.value)==null?void 0:a.trim();if(!t||t<=0){this.showNotification("אנא הזן תקציב תקין","error");return}const n=window.NotificationMessages.tasks;await R.execute({...n.loading.updateBudget(),action:async()=>{var d;Logger.log("  🚀 [v2.0] Using FirebaseService.call for adjustTaskBudget");const l=await window.FirebaseService.call("adjustTaskBudget",{taskId:e,newEstimate:t,reason:s},{retries:3,timeout:1e4});if(!l.success)throw new Error(l.error||"שגיאה בעדכון תקציב");this.budgetTasks=await(((d=this.integrationManager)==null?void 0:d.loadBudgetTasks(this.currentUser,this.currentTaskFilter))||H(this.currentUser,this.currentTaskFilter,50)),this.filterBudgetTasks();const c=this.budgetTasks.find(u=>u.id===e);window.EventBus.emit("task:budget-adjusted",{taskId:e,oldEstimate:(c==null?void 0:c.estimatedMinutes)||0,newEstimate:t,reason:s,adjustedBy:this.currentUser}),Logger.log("  🚀 [v2.0] EventBus: task:budget-adjusted emitted")},successMessage:n.success.budgetUpdated(Math.round(t/60*10)/10),errorMessage:n.error.updateFailed,closePopupOnSuccess:!0,closeDelay:500})}showAdjustBudgetDialog(e){window.DialogsModule&&window.DialogsModule.showAdjustBudgetDialog?window.DialogsModule.showAdjustBudgetDialog(e,this):console.error("DialogsModule not loaded")}showNotification(e,t="info"){window.NotificationSystem?window.NotificationSystem.show(e,t,3e3):console.warn("⚠️ Notification system not loaded:",e)}safeText(e){return S(e)}formatDate(e){return B(e)}formatDateTime(e){return q(e)}}const I=new ut;window.manager=I;window.addEventListener("beforeunload",()=>{console.log("🧹 Page unloading - cleaning up resources"),I.cleanup()});window.addEventListener("pagehide",()=>{console.log("🧹 Page hiding - cleaning up resources"),I.cleanup()});window.notificationBell=I.notificationBell;window.switchTab=hi;window.toggleNotifications=fi;window.clearAllNotifications=gi;window.openSmartForm=pi;window.logout=st;window.confirmLogout=nt;window.showLogin=ge;window.showForgotPassword=ri;window.safeText=S;window.toggleTimesheetClientSelector=function(i){const e=document.getElementById("timesheetClientCaseSelector");e&&(i?e.style.display="none":e.style.display="")};window.formatDate=B;window.formatDateTime=q;window.formatShort=oe;window._firebase_loadClientsFromFirebase_ORIGINAL=he;window._firebase_loadTimesheetFromFirebase_ORIGINAL=K;window._firebase_loadBudgetTasksFromFirebase_ORIGINAL=Ye;window._firebase_saveTimesheetToFirebase_ORIGINAL=Je;window._firebase_saveTimesheetToFirebase_v2_ORIGINAL=Ze;window._firebase_saveBudgetTaskToFirebase_ORIGINAL=Qe;window._firebase_updateTimesheetEntryFirebase_ORIGINAL=Xe;window._firebase_calculateClientHoursByCaseNumber_ORIGINAL=void 0;window._firebase_updateClientHoursImmediatelyByCaseNumber_ORIGINAL=void 0;window._firebase_calculateClientHoursAccurate_ORIGINAL=W;window._firebase_updateClientHoursImmediately_ORIGINAL=pe;window._firebase_addTimeToTaskFirebase_ORIGINAL=et;window._firebase_completeTaskFirebase_ORIGINAL=tt;window._firebase_extendTaskDeadlineFirebase_ORIGINAL=it;window.loadClientsFromFirebase=he;window.loadTimesheetFromFirebase=K;window.loadBudgetTasksFromFirebase=Ye;window.saveTimesheetToFirebase=Je;window.saveTimesheetToFirebase_v2=Ze;window.saveBudgetTaskToFirebase=Qe;window.updateTimesheetEntryFirebase=Xe;window.calculateClientHoursByCaseNumber=void 0;window.updateClientHoursImmediatelyByCaseNumber=void 0;window.updateClientHoursImmediately=pe;window.calculateClientHoursAccurate=W;window.addTimeToTaskFirebase=et;window.completeTaskFirebase=tt;window.extendTaskDeadlineFirebase=it;(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")&&(window.debug=Ui,Logger.log("🐛 Debug tools enabled"));window.manager=I;window.LawOfficeManager=ut;window.getCacheStats=()=>{const i=I.dataCache.getStats();return console.log("📊 Data Cache Statistics:"),console.log("━".repeat(50)),console.log(`✅ Cache Hits: ${i.hits}`),console.log(`❌ Cache Misses: ${i.misses}`),console.log(`🔄 Background Revalidations: ${i.revalidations}`),console.log(`⚠️  Errors: ${i.errors}`),console.log(`📦 Cache Size: ${i.size} entries`),console.log(`📈 Hit Rate: ${i.hitRate}%`),console.log("━".repeat(50)),i};window.clearCache=()=>{const i=I.dataCache.clear();return console.log(`🗑️  Cache cleared: ${i} entries removed`),i};window.invalidateCache=i=>{const e=I.dataCache.invalidate(i);return console.log(e?`✅ Cache invalidated: ${i}`:`⚠️  Key not found: ${i}`),e};function Se(){if(!window.EventBus){console.warn("⚠️ EventBus not available - skipping UI listeners");return}window.EventBus.on("system:data-loaded",i=>{Logger.log("👂 [UI] system:data-loaded received - hiding spinner"),window.hideSimpleLoading()}),window.EventBus.on("system:error",i=>{Logger.log("👂 [UI] system:error received:",i.message)}),Logger.log("✅ UI EventBus listeners initialized (v2.0)")}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Se(),I.init()}):(Se(),I.init());Logger.log("🎉 Law Office System v5.0.0 - Fully Modular - Ready");const Y={isMobile:!window.matchMedia("(hover: hover)").matches};function we(i){return i?i.scrollWidth>i.offsetWidth||i.scrollHeight>i.offsetHeight:!1}function Pi(i,e){if(!i||!e||i.classList.contains("has-description-tooltip")||!we(i))return;i.classList.add("is-truncated");const t=document.createElement("i");t.className="fas fa-info-circle description-info-icon",t.setAttribute("title","לחץ לצפייה במלל המלא"),t.setAttribute("data-full-text",e),Y.isMobile&&(t.classList.add("mobile-only"),t.addEventListener("click",o=>{o.stopPropagation(),X(e,i)}));const s=i.parentElement,n=s.querySelector(".combined-info-badge");n?s.insertBefore(t,n):s.appendChild(t),i.classList.add("has-description-tooltip")}function Hi(i){const e=document.createElement("div");e.className="description-tooltip";const t=document.createElement("div");return t.className="description-tooltip-content",t.textContent=i,e.appendChild(t),e}function qi(i,e){if(!i||!e||i.querySelector(".description-tooltip"))return;const t=Hi(e);i.appendChild(t)}let F=null;function X(i,e=null){F&&z();const t=document.createElement("div");t.className="description-popover-overlay",t.addEventListener("click",l=>{l.target===t&&z()});const s=document.createElement("div");s.className="description-popover";const n=document.createElement("div");n.className="description-popover-header";const o=document.createElement("div");o.className="description-popover-title",o.innerHTML='<i class="fas fa-align-right"></i> תיאור מלא';const r=document.createElement("button");r.className="description-popover-close",r.innerHTML='<i class="fas fa-times"></i>',r.setAttribute("aria-label","סגור"),r.addEventListener("click",z),n.appendChild(o),n.appendChild(r);const a=document.createElement("div");a.className="description-popover-body",a.textContent=i,s.appendChild(n),s.appendChild(a),t.appendChild(s),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("active")}),F=t,document.addEventListener("keydown",mt)}function z(){F&&(F.classList.remove("active"),setTimeout(()=>{F&&F.parentElement&&F.remove(),F=null},200),document.removeEventListener("keydown",mt))}function mt(i){i.key==="Escape"&&z()}function Oi(i=document){const e=i.querySelectorAll(".td-description, .timesheet-cell-action, .task-description-cell");console.log("🔵 Description Tooltips: Found",e.length,"description cells"),e.forEach(t=>{const s=t.querySelector(".table-description-with-icons");if(!s)return;const n=s.querySelector("span");if(!n)return;const o=n.textContent.trim();if(!o)return;const r=we(n);console.log("🔍 Checking truncation:",{text:o.substring(0,30)+"...",isTruncated:r,scrollHeight:n.scrollHeight,offsetHeight:n.offsetHeight,scrollWidth:n.scrollWidth,offsetWidth:n.offsetWidth}),r&&(console.log("✅ Adding info icon for:",o.substring(0,30)+"..."),Pi(n,o),Y.isMobile||qi(t,o),Y.isMobile&&(t.style.cursor="pointer",t.addEventListener("click",a=>{a.target.closest(".combined-info-badge, .action-btn, button")||(a.stopPropagation(),X(o,t))})))})}function zi(i){if(!i)return;const e=i.textContent.trim();if(!e||i.querySelector(".card-description-info-icon")||!we(i))return;const t=document.createElement("span");t.className="linear-card-title-text",t.textContent=e,i.textContent="",i.appendChild(t);const s=document.createElement("i");if(s.className="fas fa-info-circle card-description-info-icon",s.setAttribute("title","לחץ לצפייה בתיאור המלא"),s.addEventListener("click",n=>{n.stopPropagation(),X(e,i)}),i.appendChild(s),!Y.isMobile){const n=document.createElement("div");n.className="card-description-tooltip";const o=document.createElement("div");o.className="card-description-tooltip-content",o.textContent=e,n.appendChild(o),i.appendChild(n)}}function Vi(i=document){i.querySelectorAll(".linear-card-title").forEach(t=>{zi(t)})}function Q(i=document){Oi(i),Vi(i)}function ht(i=document){i.querySelectorAll(".description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".card-description-tooltip").forEach(e=>e.remove()),i.querySelectorAll(".card-description-info-icon").forEach(e=>e.remove()),i.querySelectorAll(".has-description-tooltip").forEach(e=>{e.classList.remove("has-description-tooltip","is-truncated")}),i.querySelectorAll(".linear-card-title").forEach(e=>{const t=e.querySelector(".linear-card-title-text");t&&(e.textContent=t.textContent)}),requestAnimationFrame(()=>{setTimeout(()=>{console.log("⏰ Running truncation check after render..."),Q(i)},50)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Q()}):Q();let Ce;window.addEventListener("resize",()=>{clearTimeout(Ce),Ce=setTimeout(()=>{ht()},300)});window.DescriptionTooltips={init:Q,refresh:ht,showPopover:X,closePopover:z};(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")&&setTimeout(()=>{window.EventBus&&(window.EventBus.setDebugMode(!0),console.log("🎉 EventBus loaded and debug mode enabled!")),window.FirebaseService&&(window.FirebaseService.setDebugMode(!0),console.log("🎉 FirebaseService loaded and debug mode enabled!"))},1e3)});export default Wi();

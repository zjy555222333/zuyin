/* 足印 · 创编命题、段落任务与创编本。本地规则，不调用生成接口。 */
(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.document)root.ZuyinStudioCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 var AXES=['space','time','energy','image'];
 var LABEL={space:'空间',time:'时间',energy:'动力',image:'意象'};
 var STYLES={folk:'民族舞',modern:'现代舞',general:'自由语境'};
 var MODES={origin:'从零起一段',develop:'发展已有动作',duet:'双人关系'};
 var POOL={
  space:['只用一条对角线，给动作留出远近变化','把动作放在一平方米里，试一次方向改变','先背向观众，在某个停顿里改变朝向','沿一段弧线前进，再走回起点','从舞台深处来到前方，留一个未完成的方向','只在前半场活动，让另一半保持留白','保持起点不变，试着打开三个不同方向','把同一条路线，分别走成靠近与远离'],
  time:['同一小句重复三次，每次改变一次停顿','用很长的时间完成一个小动作','先静止数到八，再让动作继续','让动作在一个瞬间停住，再缓慢接回','把同一句动作做成均匀与忽快忽慢两版','结尾比开头慢一倍','让一段动作提前结束，把余下时间留给凝视','选择一处停顿，让它比动作更清楚'],
  energy:['轻，但不断','重，却缓慢','像被水推着向前','从一处很小的启动，带出一个完整动作','一直收着，只在最后一刻放开','在同一句动作里，尝试柔和与清晰的交替','像握住又松开一件东西','把力量留在动作的转折处'],
  image:['像在收拾一个不愿结束的房间','像一次还没说出口的告别','像在暗处辨认一条熟悉的路','像被风推开，又慢慢落下的纸','像终于决定转身，又停了一下','像把一件很重的东西轻轻放下','像隔着一段距离，认出一个人','像把远处的一声呼唤留在身后']
 };
 var DUO_SPACE=['两人走同一条线，但不同时进入','保持一段距离，让朝向而非接触连接两人','一人留在原处，另一人改变双方的远近','交换彼此站过的位置，再回望一次','让两条路线短暂交会，然后各自延伸','从不同方向走向同一个停顿'];
 var RELATIONS=['A 发起一个动作，B 晚两拍回答','两人做同一句动作，但选择不同的结束方向','A 不断靠近，B 只用朝向回应','把同一个动作在两人之间交接三次','一人重复，另一人只改变其中一个细节','先各自完成一句，再找到一个共同的停顿'];
 function txt(v,n){return typeof v==='string'?v.slice(0,n||600).trim():'';}
 function uid(){return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);}
 function context(value){value=value||{};return {style:Object.hasOwn(STYLES,value.style)?value.style:'general',mode:Object.hasOwn(MODES,value.mode)?value.mode:'origin',seconds:Number(value.seconds)===60?60:30};}
 function locks(value){var result={};AXES.forEach(function(k){result[k]=!!(value&&value[k]);});return result;}
 function axes(value){var result={};AXES.forEach(function(k){result[k]=txt(value&&value[k]);});return result;}
 function pick(pool,previous,rng){var choices=pool.filter(function(v){return v!==previous;});if(!choices.length)return previous||'';var n=Number((rng||Math.random)());if(!Number.isFinite(n))n=0;return choices[Math.min(choices.length-1,Math.max(0,Math.floor(n*choices.length)))];}
 function draw(current,kept,frame,rng){
  var a=axes(current&&current.axes),l=locks(kept),c=context(frame),changed=false;
  AXES.forEach(function(k){if(l[k]&&a[k])return;var next=pick(k==='space'&&c.mode==='duet'?DUO_SPACE:POOL[k],a[k],rng);if(next!==a[k])changed=true;a[k]=next;});
  var relation=txt(current&&current.relation);if(c.mode==='duet'&&!relation)relation=pick(RELATIONS,'',rng);
  return Object.assign({},current||{},{axes:a,locks:l,context:c,relation:relation,changed:changed});
 }
 function reroll(current,key,kept,frame,rng){
  var a=axes(current&&current.axes),c=context(frame),l=locks(kept);
  if(!AXES.includes(key)||l[key])return Object.assign({},current||{},{axes:a,changed:false});
  a[key]=pick(key==='space'&&c.mode==='duet'?DUO_SPACE:POOL[key],a[key],rng);
  return Object.assign({},current||{},{axes:a,locks:l,context:c,changed:true});
 }
 function buildPlan(value){
  value=value||{};var c=context(value.context),a=axes(value.axes),seed=txt(value.seed,240),theme=txt(value.theme,160)||a.image||'一个让你想动起来的画面';
  var cuts=c.seconds===60?[0,16,40,60]:[0,8,20,30],texts,titles;
  var source=seed?'从「'+seed+'」出发':c.style==='folk'?'选一小句你熟悉的舞种语汇，保留它的动律特征':'选一个你熟悉的动作，或从日常动作里找到一个起点';
  if(c.mode==='duet'){
   titles=['发起','回应','汇合'];texts=['A '+source+'，先给出一句动作；B 观察它最清楚的节奏或方向。','试试「'+(value.relation||RELATIONS[0])+'」。空间条件可以参考「'+(a.space||'远近变化')+'」。','各自保留一个细节，在同一个停顿相遇。以「'+(a.energy||'你们选定的力度')+'」收束，留一个可以继续的关系。'];
  }else if(c.mode==='develop'){
   titles=['保留母题','只改一个条件','选一版连起来'];texts=[source+'，先完整做一遍，记住最想留下的一个细节。','把原句重复一次，只改方向、节奏或幅度中的一项。可以借用「'+(a.space||'一条新路线')+'」或「'+(a.time||'一个新停顿')+'」。','挑选更贴近「'+theme+'」的一版，接回原来的起点。用「'+(a.energy||'你想要的动力')+'」处理结尾。'];
  }else{
   titles=['找到起点','发展一句','留一个结束'];texts=[source+'，围绕「'+theme+'」做出一句可以重复的动作。','保留起点，试试「'+(a.space||'一个方向变化')+'」。节奏参考「'+(a.time||'一处停顿')+'」；一次只改一个条件。','用「'+(a.energy||'你想要的动力')+'」收住动作，回望开头，选一个最值得留下的细节。'];
  }
  return titles.map(function(title,i){return {title:title,text:texts[i],start:cuts[i],end:cuts[i+1]};});
 }
 function normalizeProject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  var a=axes(value.axes||value),title=txt(value.title,80),theme=txt(value.theme,160),seed=txt(value.seed,240),notes=txt(value.notes,4000);
  if(!title&&!theme&&!seed&&!notes&&!AXES.some(function(k){return a[k];}))return null;
  return {id:txt(value.id,80)||uid(),title:title||theme||'未命名的命题',theme:theme,seed:seed,notes:notes,axes:a,locks:locks(value.locks),context:context(value.context),relation:txt(value.relation,240),createdAt:Number.isFinite(Number(value.createdAt))&&Number(value.createdAt)>0?Number(value.createdAt):0,updatedAt:Number.isFinite(Number(value.updatedAt))&&Number(value.updatedAt)>0?Number(value.updatedAt):0,parentId:txt(value.parentId,80),origin:['legacy','version','import'].includes(value.origin)?value.origin:''};
 }
 function canonical(value){var p=normalizeProject(value);return p?JSON.stringify({title:p.title,theme:p.theme,seed:p.seed,notes:p.notes,axes:p.axes,locks:p.locks,context:p.context,relation:p.relation}):'';}
 function hash(value){var n=2166136261;for(var i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);return (n>>>0).toString(36);}
 function prepareSave(previous,value,version,now){var p=normalizeProject(value);if(!p)return null;now=now||Date.now();p.id=previous&&!version?previous.id:uid();p.createdAt=previous&&!version?previous.createdAt:now;p.updatedAt=now;p.parentId=version&&previous?previous.id:(previous?previous.parentId:'');p.origin=version?'version':previous?previous.origin:'';return p;}
 function legacyItem(value,index){var p=normalizeProject(Object.assign({},value,{createdAt:0,updatedAt:0,origin:'legacy',context:{style:'general',mode:'origin',seconds:30}}));if(p){p.id='legacy-'+index+'-'+hash(canonical(p));if(!txt(value.title))p.title='旧版命题 '+(index+1);}return p;}
 function planImport(current,incoming){
  var next=current.map(normalizeProject).filter(Boolean),ids=new Map(next.map(function(p){return [p.id,p];}));var added=0,same=0,changed=0;
  incoming.map(normalizeProject).filter(Boolean).forEach(function(p){
   var existing=ids.get(p.id),sign=canonical(p);
   if(existing&&canonical(existing)===sign){same++;return;}
   if(existing){
    if(next.some(function(item){return item.origin==='import'&&item.parentId===p.id&&canonical(item)===sign;})){same++;return;}
    p.parentId=p.id;p.id=uid();p.origin='import';changed++;
   }else added++;
   next.push(p);ids.set(p.id,p);
  });
  return {items:next,added:added,same:same,changed:changed};
 }
 function formatText(value){var p=normalizeProject(value);if(!p)return '';var plan=buildPlan(p);return ['足印 · 创编手记',p.title,STYLES[p.context.style]+' · '+MODES[p.context.mode]+' · '+p.context.seconds+' 秒小段',p.theme?'切入点：'+p.theme:'',p.seed?'保留的动作 / 语汇：'+p.seed:'','',...AXES.map(function(k){return LABEL[k]+'：'+(p.axes[k]||'未抽取');}),p.context.mode==='duet'?'双人关系：'+p.relation:'','','试编路线',...plan.map(function(s){return s.start+'–'+s.end+' 秒 · '+s.title+'：'+s.text;}),'','试编笔记',p.notes||'尚未补充'].filter(function(line){return line!==false;}).join('\n');}
 function createStore(storage){
  var KEY='zuyin.studio.v1',OLD='zuyin.cards.v1',DRAFT='zuyin.studio.draft.v1',MAX=200;
  function st(){return typeof storage==='function'?storage():storage;}
  function parse(raw){var d=JSON.parse(raw);if(!d||d.v!==1||!Array.isArray(d.items))throw new Error('format');var items=d.items.map(normalizeProject).filter(Boolean);return {items:items,invalid:d.items.length-items.length};}
  function commit(items,token){try{var s=st(),raw=s.getItem(KEY);if(raw!==token)return {ok:false,reason:'conflict'};if(items.length>MAX)return {ok:false,reason:'capacity'};var list=items.map(normalizeProject).filter(Boolean);if(list.length!==items.length||new Set(list.map(function(p){return p.id;})).size!==list.length)return {ok:false,reason:'format'};
    if(raw){var old;try{old=parse(raw);}catch(ignore){return {ok:false,reason:'corrupt'};}if(old.invalid)s.setItem('zuyin.studio.backup.before-edit',raw);}
    var text=JSON.stringify({v:1,savedAt:Date.now(),items:list});s.setItem(KEY,text);return s.getItem(KEY)===text?{ok:true,items:list,token:text}:{ok:false,reason:'verify'};
   }catch(error){return {ok:false,reason:error.name||'unavailable'};}}
  function load(){try{var s=st(),raw=s.getItem(KEY);if(raw){try{return Object.assign({status:'ok',token:raw},parse(raw));}catch(ignore){return {status:'corrupt',items:[],token:raw};}}
    var legacy=s.getItem(OLD);if(!legacy)return {status:'empty',items:[],token:null};var arr;try{arr=JSON.parse(legacy);if(!Array.isArray(arr))throw new Error('format');}catch(ignore){return {status:'corrupt',items:[],token:null};}
    var items=arr.map(legacyItem).filter(Boolean);try{s.setItem('zuyin.cards.backup.v1',legacy);if(s.getItem('zuyin.cards.backup.v1')!==legacy)throw new Error('backup');}catch(error){return {status:'migrate-failed',items:items,token:null};}
    var r=commit(items,null);return {status:r.ok?'migrated':'migrate-failed',items:items,token:r.ok?r.token:null};
   }catch(error){return {status:'unavailable',items:[],token:null};}}
  function parseDraft(raw){var d=JSON.parse(raw),p=d&&d.v===1&&normalizeProject(d.project);if(!p)throw new Error('format');return {project:p,activeId:txt(d.activeId,80),base:txt(d.base,16000)};}
  function backupDraft(s,raw){
   if(raw==null)return;
   try{parseDraft(raw);return;}catch(ignore){}
   s.setItem('zuyin.studio.draft.backup',raw);
   if(s.getItem('zuyin.studio.draft.backup')!==raw)throw new Error('backup');
  }
  function readDraft(){try{var s=st(),raw=s.getItem(DRAFT),backupAvailable=s.getItem('zuyin.studio.draft.backup')!=null;if(raw==null)return {value:null,token:null,backupAvailable:backupAvailable};try{return {value:parseDraft(raw),token:raw,backupAvailable:backupAvailable};}catch(ignore){return {value:null,token:raw,reason:'corrupt',backupAvailable:backupAvailable};}}catch(error){return {value:null,token:null,reason:error.name||'unavailable'};}}
  function saveDraft(value,token){try{var s=st(),raw=s.getItem(DRAFT);if(raw!==token)return {ok:false,reason:'conflict'};var p=normalizeProject(value.project);if(!p)return {ok:false,reason:'empty'};backupDraft(s,raw);
    var text=JSON.stringify({v:1,project:p,activeId:txt(value.activeId,80),base:txt(value.base,16000)});s.setItem(DRAFT,text);return s.getItem(DRAFT)===text?{ok:true,token:text}:{ok:false,reason:'verify'};
   }catch(error){return {ok:false,reason:error.name||'unavailable'};}}
  function clearDraft(token){try{var s=st(),raw=s.getItem(DRAFT);if(raw!==token)return {ok:false,reason:'conflict'};backupDraft(s,raw);s.removeItem(DRAFT);return {ok:s.getItem(DRAFT)==null};}catch(error){return {ok:false,reason:error.name||'unavailable'};}}
  function readImport(text){try{var d=JSON.parse(text),source;if(Array.isArray(d))source=d.map(legacyItem);else{if(!d||d.app!=='zuyin-studio'||d.v!==1||!Array.isArray(d.items))return {ok:false,reason:'format'};source=d.items.map(normalizeProject);}var items=source.filter(Boolean);return {ok:true,items:items,invalid:source.length-items.length};}catch(ignore){return {ok:false,reason:'format'};}}
  return {KEY:KEY,DRAFT:DRAFT,MAX:MAX,load:load,commit:commit,readDraft:readDraft,saveDraft:saveDraft,clearDraft:clearDraft,readImport:readImport,exportData:function(items){return JSON.stringify({app:'zuyin-studio',v:1,exportedAt:new Date().toISOString(),items:items},null,2);},raw:function(){try{return JSON.stringify({book:st().getItem(KEY),legacy:st().getItem(OLD),draft:st().getItem(DRAFT),draftBackup:st().getItem('zuyin.studio.draft.backup')},null,2);}catch(ignore){return '';}}};
 }
 return {AXES:AXES,LABEL:LABEL,STYLES:STYLES,MODES:MODES,context:context,draw:draw,reroll:reroll,buildPlan:buildPlan,normalizeProject:normalizeProject,canonical:canonical,prepareSave:prepareSave,planImport:planImport,formatText:formatText,createStore:createStore,relation:function(previous,rng){return pick(RELATIONS,previous,rng);}};
});

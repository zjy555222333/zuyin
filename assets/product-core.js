/* 足印 · 产品化规则：检索、七日回看、持久草稿与恢复预览。 */
(function(root,factory){
  'use strict';
  var core=factory(typeof module==='object'&&module.exports?require('./daily-core'):root.ZuyinCore);
  if(typeof module==='object'&&module.exports)module.exports=core;
  if(root&&root.document)root.ZuyinProductCore=core;
})(typeof window!=='undefined'?window:globalThis,function(C){
  'use strict';
  function text(v,max){return typeof v==='string'?v.slice(0,max||600):'';}
  function normalized(items){return items.map(C.normalize).filter(Boolean);}
  function weekDays(now,items){
    var end=new Date(now||Date.now()),result=[];
    end.setHours(12,0,0,0);var list=normalized(items||[]);
    for(var i=6;i>=0;i--){var date=new Date(end);date.setDate(date.getDate()-i);var key=C.dateKey(date);
      var matches=list.filter(function(item){return item.date===key;});
      result.push({date:key,label:(date.getMonth()+1)+'月'+date.getDate()+'日',day:date.getDate(),weekday:'日一二三四五六'[date.getDay()],today:i===0,count:matches.length,practices:matches.filter(function(item){return item.kind!=='rest';}).length,rests:matches.filter(function(item){return item.kind==='rest';}).length});
    }return result;
  }
  function searchRecords(items,options){
    options=options||{};
    var tokens=text(options.query,120).toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return C.sortRecords(normalized(items)).filter(function(item){
      if(options.date&&item.date!==options.date)return false;
      if(options.site&&options.site!=='all'&&item.site!==options.site)return false;
      if(options.side&&options.side!=='all'&&(!item.site||item.side!==options.side))return false;
      var corpus=[item.training,item.feeling,C.locationLabel(item),C.CONDITION[item.condition],C.COURSE[item.course]||'',item.date].join(' ').toLocaleLowerCase();
      return tokens.every(function(token){return corpus.indexOf(token)!==-1;});
    });
  }
  function draftValues(value){
    value=value&&typeof value==='object'?value:{};
    var site=Object.hasOwn(C.SITE,value.site)?value.site:'';
    var course=Object.hasOwn(C.COURSE,value.course)||value.course==='rest'?value.course:'';
    return {kind:value.kind==='rest'?'rest':'practice',course:course,condition:Object.hasOwn(C.CONDITION,value.condition)?value.condition:'',
      date:C.validDate(value.date)?value.date:'',training:text(value.training),feeling:text(value.feeling),site:site,
      side:site&&Object.hasOwn(C.SIDE,value.side)?value.side:(site?'unknown':''),level:Number.isInteger(Number(value.level))&&Number(value.level)>=0&&Number(value.level)<=5?Number(value.level):0,
      duration:typeof value.duration==='string'?value.duration.slice(0,8):(Number.isFinite(value.duration)?String(value.duration):'')};
  }
  function createDraftRepository(storage){
    var PREFIX='zuyin.draft.v4.';
    function store(){return typeof storage==='function'?storage():storage;}
    function decode(raw,key){
      var data=JSON.parse(raw);if(!data||data.v!==1||!data.values||typeof data.values!=='object')return null;
      return {id:key.slice(PREFIX.length),token:raw,value:{v:1,mode:data.mode==='edit'&&typeof data.recordId==='string'&&data.recordId?'edit':'create',recordId:text(data.recordId,80),savedAt:Number(data.savedAt)||0,values:draftValues(data.values),base:data.base&&data.base.id===data.recordId?C.normalize(data.base):null,suspended:data.suspended?draftValues(data.suspended):null}};
    }
    function readAll(){
      try{var s=store(),items=[],invalid=0;
        for(var i=0;i<s.length;i++){var key=s.key(i);if(!key||!key.startsWith(PREFIX))continue;
          try{var raw=s.getItem(key),item=decode(raw,key);if(item)items.push(item);else invalid++;}catch(ignore){invalid++;}
        }
        items.sort(function(a,b){return b.value.savedAt-a.value.savedAt||b.id.localeCompare(a.id);});return {ok:true,items:items,invalid:invalid};
      }catch(error){return {ok:false,items:[],reason:error.name||'unavailable'};}
    }
    function write(id,draft,now){
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return {ok:false,reason:'id'};
      try{var value={v:1,mode:draft.mode==='edit'&&draft.recordId?'edit':'create',recordId:text(draft.recordId,80),savedAt:now||Date.now(),values:draftValues(draft.values),base:draft.base&&draft.base.id===draft.recordId?C.normalize(draft.base):null,suspended:draft.suspended?draftValues(draft.suspended):null};
        var raw=JSON.stringify(value),s=store();s.setItem(PREFIX+id,raw);
        return s.getItem(PREFIX+id)===raw?{ok:true,value:value,token:raw}:{ok:false,reason:'verify'};
      }catch(error){return {ok:false,reason:error.name||'unavailable'};}
    }
    function clear(id,token){
      try{var s=store(),key=PREFIX+id,current=s.getItem(key);
        if(current==null)return {ok:true};
        if(token!=null&&current!==token)return {ok:false,reason:'changed'};
        s.removeItem(key);return {ok:s.getItem(key)==null};
      }catch(error){return {ok:false,reason:error.name||'unavailable'};}
    }
    return {PREFIX:PREFIX,write:write,clear:clear,readAll:readAll,latest:function(){return readAll().items[0]||null;}};
  }
  // 仅用于本机备份变更提示，非安全校验或文件保存凭据。
  function fingerprint(items){
    var source=JSON.stringify(normalized(items).sort(function(a,b){return a.id.localeCompare(b.id);}));
    var a=2166136261,b=2246822519;
    for(var i=0;i<source.length;i++){a=Math.imul(a^source.charCodeAt(i),16777619);b=Math.imul(b^source.charCodeAt(i),3266489917);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
  }
  function prepareRestore(current,incoming){
    var locals=new Map(normalized(current).map(function(item){return [item.id,item];}));
    var plan={base:fingerprint(current),additions:[],identical:[],conflicts:[]},seen=new Set();
    normalized(incoming).forEach(function(item){
      if(seen.has(item.id))return;seen.add(item.id);
      if(!locals.has(item.id)){plan.additions.push(item);return;}
      var local=locals.get(item.id);
      if(fingerprint([local])===fingerprint([item]))plan.identical.push(item.id);
      else plan.conflicts.push({id:item.id,local:local,incoming:item});
    });return plan;
  }
  function applyRestore(current,plan,replaceIds,max){
    if(fingerprint(current)!==plan.base)return {ok:false,reason:'stale'};
    var chosen=new Set(replaceIds||[]),updates=plan.conflicts.filter(function(pair){return chosen.has(pair.id);}).map(function(pair){return pair.incoming;});
    var replaced=new Set(updates.map(function(item){return item.id;}));
    var next=normalized(current).filter(function(item){return !replaced.has(item.id);}).concat(plan.additions,updates);
    if(next.length>(max||2000))return {ok:false,reason:'capacity',count:next.length};
    return {ok:true,items:C.sortRecords(next),added:plan.additions.length,replaced:updates.length};
  }
  return {weekDays:weekDays,searchRecords:searchRecords,draftValues:draftValues,createDraftRepository:createDraftRepository,fingerprint:fingerprint,prepareRestore:prepareRestore,applyRestore:applyRestore};
});

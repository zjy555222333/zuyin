/* 足印 · 让真实记录可以继续、找到和带走。 */
(function(){
 'use strict';
 var C=window.ZuyinCore,P=window.ZuyinProductCore,UI=window.ZuyinUI;
 var $=function(s){return document.querySelector(s);},$$=function(s){return Array.from(document.querySelectorAll(s));};
 var detailId='',detailFocus=null,lastItems=[],initialized=false;
 var BACKUP_KEY='zuyin.backup.request.v1';
 function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function setText(id,text){var el=$('#'+id);if(el&&el.textContent!==text)el.textContent=text;}
 function home(items){
  var today=C.dateKey(Date.now()),current=items.filter(function(item){return item.date===today;}),draft=UI.getDraftState();
  $('#welcomeSteps').hidden=items.length>0||draft.pending;
  $('#draftBanner').hidden=!draft.pending;
  $('#askDiscardDraft').hidden=!draft.pending;
  setText('draftBannerTitle',draft.conflict?'这份修改需要先核对':draft.mode==='edit'?'有一笔修改还没保存':'还有一笔记录没写完');
  setText('homePrimaryLabel',draft.pending?'继续未完成的记录':current.length?'再记一笔今天':'记下今天的练习');
  setText('todayStatus',current.length?'今天已留下 '+current.length+' 条记录。想补充时，还可以再来一笔。':'今天还没有记录。一次练习，或一次休息，都可以留下。');
  document.body.classList.toggle('has-record-history',items.length>0);
  if(!draft.pending)$('#draftDiscardConfirm').hidden=true;
 }
 function filters(){
  var f=UI.getFilters(),list=UI.filterRecords(lastItems),parts=[];
  if(f.date)parts.push(f.date);else parts.push(f.range==='7'?'近7天':'全部时间');
  if(f.query)parts.push('“'+f.query+'”');if(f.site!=='all')parts.push(C.SITE[f.site]||'');if(f.side!=='all')parts.push(C.SIDE[f.side]||'');
  setText('activeRecordFilters',parts.filter(Boolean).join(' · ')+' · '+list.length+' 条记录');
 }
 function backup(items){
  var meta=null;try{meta=JSON.parse(localStorage.getItem(BACKUP_KEY)||'null');}catch(ignore){}
  if(meta&&typeof meta.fingerprint==='string'&&Number.isFinite(Number(meta.ts))&&Number(meta.ts)>0){
   var changed=P.fingerprint(items)!==meta.fingerprint;
   setText('backupStatus',changed?'上次发起备份后，记录有变化':'已发起过备份下载');
   setText('backupStatusDetail',new Date(meta.ts).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · '+meta.count+' 条已保存记录。草稿不包含在备份里，请确认 JSON 文件已保存。');
  }else{setText('backupStatus','暂无可读取的备份记录');setText('backupStatusDetail','下载一份 JSON 备份，可在更换设备时恢复。记录仍只在当前浏览器。');}
  $('#backupBtn').disabled=!items.length;
 }
 function refresh(){
  if(!initialized)return;
  lastItems=window.ZuyinStore.load().items;home(lastItems);filters();backup(lastItems);
  var week=P.weekDays(Date.now(),lastItems),stats=C.stats(lastItems);
  $('#weekStrip').innerHTML=week.map(function(day){
   return '<button type="button" class="week-day'+(day.today?' is-today':'')+(day.count?' has-note':'')+'" data-day="'+day.date+'" aria-label="'+day.label+'，周'+day.weekday+'，'+day.count+'条记录"><span class="week-day__label">'+(day.today?'今天':'周'+day.weekday)+'</span><strong>'+day.day+'</strong><span class="week-day__dot" aria-hidden="true"></span><small>'+ (day.count?day.count+' 条':'留白') +'</small></button>';
  }).join('');
  setText('weekReviewSummary',stats.days+' 天有记录 · '+stats.practices+' 条练习 · '+stats.rests+' 条休息');
  if(detailId)renderDetail(detailId);
 }
 function inert(value){
  $$('#main,#nav,.bottom-nav,#bodySubnav,#moreBack,.daily-footer').forEach(function(el){el.inert=value;});
 }
 function renderDetail(id){
  var item=window.ZuyinStore.load().items.find(function(row){return row.id===id;});
  $('#detailEdit').disabled=!item;
  if(!item){setText('recordDetailTitle','这笔记录不在这里');$('#recordDetailBody').innerHTML='<div class="detail-empty"><span>∅</span><h3>找不到这条记录</h3><p>它可能已被删除，或保存在另一个浏览器中。可以返回记录列表继续查找。</p></div>';return;}
  setText('recordDetailTitle',item.kind==='rest'?'一次休息，也值得记下':'这次练习的记录');
  var rows=[['记录日期',item.date],['练习内容',item.training],['身体状态',C.CONDITION[item.condition]],['主要部位',C.locationLabel(item)||'未记录'],['填写时长',item.duration?item.duration+' 分钟':'未填写'],['自述强度',item.level?item.level+' / 5':'未填写']];
  $('#recordDetailBody').innerHTML='<p class="detail-date">'+esc(item.date)+' <span>'+(item.kind==='rest'?'休息日':'练习手记')+'</span></p><dl class="detail-facts">'+rows.map(function(row){return '<div><dt>'+row[0]+'</dt><dd>'+esc(row[1])+'</dd></div>';}).join('')+'</dl><section class="detail-feeling"><h3>当时的感受</h3><p>'+esc(item.feeling||'这一次没有补充文字。')+'</p></section>'+(item.follow?'<section class="detail-follow"><p>'+esc(C.dateKey(item.follow.ts))+' · 回访自述</p><strong>'+C.FOLLOW[item.follow.v]+'</strong><span>和原记录放在一起回看，不作为恢复结论。</span></section>':'<p class="detail-note">记录的是当时的自己；想补充细节，可以继续修改。</p>');
 }
 function openDetail(id){
  if(detailId===id&&!$('#recordDetailDialog').hidden){renderDetail(id);return;}
  detailFocus=document.activeElement;detailId=id;renderDetail(id);
  $('#recordDetailDialog').hidden=false;document.body.classList.add('detail-open');inert(true);
  $('.record-detail-panel').focus({preventScroll:true});
 }
 function closeDetail(){
  if($('#recordDetailDialog').hidden)return;
  $('#recordDetailDialog').hidden=true;document.body.classList.remove('detail-open');inert(false);detailId='';
  var target=detailFocus&&!detailFocus.closest('[hidden]')?detailFocus:$('#log h1');
  if(target){target.tabIndex=target.tabIndex<0?-1:target.tabIndex;target.focus({preventScroll:true});}
 }
 function allRecords(){UI.setFilters({range:'all',site:'all',side:'all',query:'',date:''});}
 function init(){
  if(initialized)return;initialized=true;
  $('#recordDay').max=C.dateKey(Date.now());
  $('#recordSearch').addEventListener('input',function(){UI.setFilters({query:this.value});});
  $('#recordDay').addEventListener('change',function(){UI.setFilters({date:this.value,range:'all'});});
  $('#clearRecordFilters').addEventListener('click',allRecords);
  document.addEventListener('click',function(event){
   var day=event.target.closest('[data-day]');if(day){UI.setFilters({date:day.dataset.day,range:'all',query:'',site:'all',side:'all'});window.ZuyinNavigate('#log');}
   var open=event.target.closest('[data-open-entry]');if(open&&open.tagName!=='A'){event.preventDefault();window.ZuyinNavigate('#entry/'+encodeURIComponent(open.dataset.openEntry));}
   if(event.target.closest('[data-clear-record-filters]'))allRecords();
   if(event.target.closest('[data-detail-close]'))window.ZuyinNavigate('#log',{replaceHistory:true});
   if(event.target.closest('#askDiscardDraft')){
    $('#draftDiscardConfirm').hidden=false;$('#draftDiscardConfirm p').textContent=UI.getDraftState().mode==='edit'?'放弃这次未保存的修改？已保存记录和之前的新记录草稿会保留。':'放弃当前未保存的内容？已经保存的记录不会删除。';
   }
   if(event.target.closest('#cancelDiscardDraft'))$('#draftDiscardConfirm').hidden=true;
   if(event.target.closest('#confirmDiscardDraft')){window.ZuyinJournal.reset();$('#draftDiscardConfirm').hidden=true;}
  });
  $('#detailEdit').addEventListener('click',function(){var id=detailId;window.ZuyinNavigate('#log',{replaceHistory:true});window.ZuyinJournal.edit(id);});
  document.addEventListener('zuyin:navigate',function(event){
   if(event.detail.recordId)openDetail(event.detail.recordId);else closeDetail();
   var guide=$('#guide');if(guide&&guide.classList.contains('is-open')){var closer=guide.querySelector('[data-gclose]');if(closer)closer.click();}
  });
  document.addEventListener('zuyin:refresh',refresh);document.addEventListener('zuyin:entries-rendered',filters);
  document.addEventListener('zuyin:draft',function(){home(lastItems);});
  document.addEventListener('zuyin:backup-requested',function(event){
   var items=event.detail.items;
   try{localStorage.setItem(BACKUP_KEY,JSON.stringify({ts:Date.now(),count:items.length,fingerprint:P.fingerprint(items)}));backup(items);}
   catch(ignore){setText('backupStatus','备份下载已发起，时间未能记住');setText('backupStatusDetail','请直接确认下载文件；记录仍保存在本机。');}
  });
  window.addEventListener('storage',function(event){if(event.key===window.ZuyinStore.KEY||event.key===BACKUP_KEY)refresh();});
  document.addEventListener('keydown',function(event){
   if($('#recordDetailDialog').hidden)return;
   if(event.key==='Escape'){event.preventDefault();window.ZuyinNavigate('#log',{replaceHistory:true});return;}
   if(event.key!=='Tab')return;
   var focusable=$$('#recordDetailDialog button:not([disabled]),#recordDetailDialog a[href]').filter(function(el){return !el.closest('[hidden]');});
   if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('.record-detail-panel'))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  refresh();window.ZuyinJournal.reload();
  if(location.hash.indexOf('#entry/')===0){try{openDetail(decodeURIComponent(location.hash.slice(7)));}catch(ignore){openDetail(location.hash.slice(7));}}
 }
 window.ZuyinProduct={openRecord:function(id){window.ZuyinNavigate('#entry/'+encodeURIComponent(id));},refresh:refresh};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* 足印 · 灵感台工作区：四道题保留、试编、笔记与创编版本。 */
(function(){
 'use strict';
 var S=window.ZuyinStudioCore,store=S.createStore(function(){return window.localStorage;});
 var $=function(s){return document.querySelector(s);},$$=function(s){return Array.from(document.querySelectorAll(s));};
 var project={axes:{},locks:{},context:{style:'folk',mode:'origin',seconds:30},relation:''};
 var activeId='',base='',dirty=false,book={items:[],token:null},draftToken=null,pendingAction=null,pendingImport=null,initialized=false,draftIssue=false;
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function text(id,value){var el=$('#'+id);if(el&&el.textContent!==value)el.textContent=value;}
 function hint(value,error){text('sparkHint',value);$('#sparkHint').dataset.tone=error?'error':'ok';}
 function frame(){return {style:$('#studioStyle').value,mode:project.context.mode||'origin',seconds:Number($('#studioSeconds').value)};}
 function read(){return Object.assign({},project,{title:$('#studioTitle').value,theme:$('#studioTheme').value,seed:$('#studioSeed').value,notes:$('#studioNotes').value,context:frame()});}
 function hasIdea(){return !!S.normalizeProject(read());}
 function download(name,value,type){var url=URL.createObjectURL(new Blob([value],{type:type||'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
 function cache(){
  if(!initialized)return;
  if(!hasIdea()){var gone=store.clearDraft(draftToken);if(gone.ok)draftToken=null;dirty=false;text('studioWorkspaceStatus',gone.ok?'':'当前输入已清空，另一页的暂存仍保留。');return;}
  var r=store.saveDraft({project:read(),activeId:activeId,base:base},draftToken);
  if(r.ok){draftToken=r.token;text('studioWorkspaceStatus','当前稿已暂存到本机；想收进创编本时，点击保存。');}
  else text('studioWorkspaceStatus',r.reason==='conflict'?'另一页更新了暂存稿，本页内容仍在。可以先复制文字，或保存到创编本。':'暂存失败，当前内容仍在页面；请复制文字或保存后再关闭。');
 }
 function apply(value,id,signature){
  project=value?Object.assign({},value,{axes:Object.assign({},value.axes),locks:Object.assign({},value.locks),context:S.context(value.context)}):{axes:{},locks:{},context:frame(),relation:''};
  activeId=id||'';base=signature||'';
  $('#studioTitle').value=value&&value.title||'';$('#studioTheme').value=value&&value.theme||'';$('#studioSeed').value=value&&value.seed||'';$('#studioNotes').value=value&&value.notes||'';
  $('#studioStyle').value=project.context.style;$('#studioSeconds').value=String(project.context.seconds);
  dirty=false;$('#studioTextFallback').hidden=true;render();
 }
 function render(){
  project=read();var c=project.context,ready=hasIdea();
  $$('[data-studio-mode]').forEach(function(button){var on=button.dataset.studioMode===c.mode;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',String(on));});
  var guidance=c.style==='folk'?'从你熟悉的舞种语汇和动律出发，保留想留下的特征，再试一次变化。':c.style==='modern'?'可以从一个日常动作、一个停顿或一个身体意象开始。':'先保留一个自己的起点，再用条件帮助它发展。';
  if(c.mode==='develop')guidance+=' 有原句时，先保留它，一次只改变一个条件。';
  if(c.mode==='duet')guidance+=' 双人入口会把任务分成发起、回应与汇合。';
  text('studioModeHint',guidance);
  var ids={space:'sparkSpace',time:'sparkTime',energy:'sparkEnergy',image:'sparkImage'};
  S.AXES.forEach(function(key){
   var value=project.axes[key]||'',kept=!!project.locks[key],card=$('[data-studio-axis="'+key+'"]'),lock=$('[data-lock="'+key+'"]');
   text(ids[key],value||'—');card.classList.toggle('is-kept',kept);lock.disabled=!value;lock.setAttribute('aria-pressed',String(kept));lock.setAttribute('aria-label',(kept?'解除保留':'保留')+S.LABEL[key]+'条件');lock.querySelector('span').textContent=kept?'已保留':'保留';
   $('[data-reroll="'+key+'"]').disabled=!value||kept;
  });
  $('#studioRelationWrap').hidden=c.mode!=='duet';text('studioRelation',project.relation||'先抽一组条件，再试一种关系。');$('#studioRelationNext').disabled=!ready;
  text('studioPlanTitle','把它试成 '+c.seconds+' 秒');
  $('#studioPlan').innerHTML=ready?S.buildPlan(project).map(function(step,i){return '<li><span class="studio-plan__time">'+step.start+'–'+step.end+' 秒</span><div><h3><span>0'+(i+1)+'</span>'+step.title+'</h3><p>'+esc(step.text)+'</p></div></li>';}).join(''):'<li class="studio-plan-empty">抽一组条件，或写下切入点，就能从这里开始。</li>';
  $('#sparkSave').disabled=!ready||!!activeId&&!dirty;$('#studioFork').disabled=!ready||!activeId;$('#studioCopy').disabled=!ready;$('#studioTextDownload').disabled=!ready;
  text('sparkSave',activeId?'保存这次修改 ↗':'存入创编本 ↗');text('studioActiveProject',activeId?(dirty?'正在修改已存的一页':'已打开创编本中的一页'):'新的想法，先留在这里');
 }
 function renderBook(){
  var q=$('#studioSearch').value.trim().toLocaleLowerCase(),items=book.items.slice().sort(function(a,b){return b.updatedAt-a.updatedAt;}).filter(function(p){return !q||[p.title,p.theme,p.seed,p.notes,S.STYLES[p.context.style],S.MODES[p.context.mode]].join(' ').toLocaleLowerCase().includes(q);});
  text('sparkCount',String(book.items.length));$('#sparkEmpty').hidden=!!items.length;
  text('sparkEmpty',book.items.length?'没有找到这一页。换个关键词试试。':'还没有收藏。从一个条件、一句笔记开始；试过的想法，下次还可以继续。');
  $('#studioBackup').disabled=!book.items.length;
  $('#sparkList').innerHTML=items.map(function(p){
   var date=p.updatedAt?new Date(p.updatedAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}):'旧版收藏';
   return '<li class="studio-project"><div class="studio-project__meta"><span>'+esc(S.STYLES[p.context.style])+' · '+esc(S.MODES[p.context.mode])+'</span><span>'+esc(date)+(p.parentId?' · 版本':'')+'</span></div><h3><button type="button" data-studio-open="'+esc(p.id)+'">'+esc(p.title)+' <span aria-hidden="true">↗</span></button></h3><p class="studio-project__preview">'+esc(p.notes||p.theme||p.axes.image||p.seed||'一份可以继续发展的命题')+'</p><div class="studio-project__bottom"><span>'+p.context.seconds+' 秒小段'+(p.origin==='legacy'?' · 原收藏保留':'')+'</span><button type="button" data-studio-delete="'+esc(p.id)+'">删除</button></div></li>';
  }).join('');
 }
 function renderDataIssue(){$('#studioDataIssue').hidden=!draftIssue&&!['corrupt','unavailable','migrate-failed'].includes(book.status);}
 function refreshBook(){book=store.load();renderDataIssue();renderBook();}
 function save(version){
  var raw=read();if(!S.normalizeProject(raw)){hint('先抽一道题，或留下一句自己的想法。',true);return false;}
  var latest=store.load();if(latest.status==='corrupt'||latest.status==='unavailable'){hint('创编本暂时无法写入。当前内容保留，可以先复制文字。',true);return false;}
  var previous=latest.items.find(function(p){return p.id===activeId;}),missing=!!activeId&&!previous,conflict=previous&&base!==S.canonical(previous),fork=!!version||!!conflict;
  var saved=S.prepareSave(previous,raw,fork),items=latest.items.filter(function(p){return fork||!previous||p.id!==previous.id;});
  if(previous&&!fork&&S.canonical(previous)===S.canonical(saved)){dirty=false;render();hint('这一页已经是最新的。');return true;}
  items.unshift(saved);var result=store.commit(items,latest.token);
  if(!result.ok){hint(result.reason==='capacity'?'创编本已达到 '+store.MAX+' 页，请先导出并整理；本次没有保存。':result.reason==='conflict'?'另一页刚修改了本子，当前稿仍保留。请再试一次保存。':'保存失败，当前内容仍在，请先复制文字。',true);refreshBook();return false;}
  var cleared=store.clearDraft(draftToken);if(cleared.ok)draftToken=null;
  apply(saved,saved.id,S.canonical(saved));refreshBook();
  text('studioWorkspaceStatus',cleared.ok?'这一页已收进创编本。':'这一页已保存；另一页的暂存稿仍保留。');
  hint(conflict?'原项目在别处有变化，已把本次修改另存一版，双方都保留。':missing?'原条目已不在本子里，当前稿已另存为新的一页。':version?'已另存一版，原来的发展保留着。':'已保存到创编本。');return true;
 }
 function draw(key){
  project=read();var next=key?S.reroll(project,key,project.locks,frame()):S.draw(project,project.locks,frame());
  if(!next.changed){hint('四个条件都已保留。解开一项，再试一次变化。');return;}
  project=next;dirty=true;$('#studioTextFallback').hidden=true;render();cache();hint(key?'只换了'+S.LABEL[key]+'，其余内容保留。':'给自己一点时间试一版，喜欢的条件可以先保留。');
 }
 function clearWorkspace(){var c=frame();store.clearDraft(draftToken);draftToken=null;apply(null,'','');project.context=c;$('#studioStyle').value=c.style;$('#studioSeconds').value=String(c.seconds);render();text('studioWorkspaceStatus','新的一页，从自己的想法开始。');hint('可以先抽四道题，也可以先写一句话。');}
 function openProject(id){var latest=store.load(),p=latest.items.find(function(item){return item.id===id;});if(!p){hint('这一页已经不在本子里。当前稿保留。',true);refreshBook();return;}store.clearDraft(draftToken);draftToken=null;book=latest;apply(p,p.id,S.canonical(p));renderBook();text('studioWorkspaceStatus','已打开这一页，想法可以继续补充。');hint('换题会保留标题和笔记；保存会更新这一页，也可以另存一版。');}
 function decide(type,id){
  if(type==='open'&&(!dirty||!hasIdea())){openProject(id);return;}
  if(type==='new'&&(!dirty||!hasIdea())){clearWorkspace();return;}
  pendingAction={type:type,id:id};$('#studioDecision').hidden=false;$('#studioDecisionSave').hidden=type==='delete';
  text('studioDecisionText',type==='delete'?'删除这份已保存的创编？确认后仍可用短暂出现的撤销按钮恢复。':'当前稿还有未保存的修改。可以先保存，再继续；也可以明确放弃这些修改。');
  text('studioDecisionConfirm',type==='delete'?'确认删除':type==='new'?'放弃修改，新开一页':'放弃修改并打开');
  $('#studioDecision').scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 function deleteProject(id){
  if(id===activeId&&dirty){hint('这一页有未保存修改，请先保存或新开一页，再删除。',true);return;}
  var latest=store.load(),removed=latest.items.find(function(p){return p.id===id;});if(!removed)return;
  var result=store.commit(latest.items.filter(function(p){return p.id!==id;}),latest.token);
  if(!result.ok){hint('删除没有保存成功，原项目仍保留。',true);return;}
  if(activeId===id)clearWorkspace();refreshBook();hint('已删除。需要时可以撤销。');
  if(window.ZuyinJournal)window.ZuyinJournal.notify('已删除一页创编','撤销',function(){var current=store.load();if(current.items.some(function(p){return p.id===removed.id;}))return;var restore=store.commit([removed].concat(current.items),current.token);refreshBook();hint(restore.ok?'已恢复这一页。':'未能恢复，请保留当前页面后重试。',!restore.ok);},8000);
 }
 function perform(){var action=pendingAction;pendingAction=null;$('#studioDecision').hidden=true;if(!action)return;if(action.type==='open')openProject(action.id);if(action.type==='new')clearWorkspace();if(action.type==='delete')deleteProject(action.id);}
 function previewImport(source,notice){
  var latest=store.load(),plan=S.planImport(latest.items,source.items);pendingImport={source:source,plan:plan,token:latest.token};$('#studioImportPreview').hidden=false;
  text('studioImportDetail',(notice||'')+'新增 '+plan.added+' 页 · 已有版本 '+plan.same+' 页 · 差异另存 '+plan.changed+' 页。已有内容不会被覆盖。'+(source.invalid?'有 '+source.invalid+' 条格式不完整已跳过。':''));$('#studioImportConfirm').disabled=!plan.added&&!plan.changed;
 }
 function init(){
  if(initialized)return;initialized=true;refreshBook();
  var workspace=store.readDraft();draftToken=workspace.token;draftIssue=!!workspace.reason||!!workspace.backupAvailable;renderDataIssue();
  if(workspace.value){var d=workspace.value,current=book.items.find(function(p){return p.id===d.activeId;});apply(d.project,current?d.activeId:'',d.base||'');dirty=!current||S.canonical(d.project)!==S.canonical(current);render();text('studioWorkspaceStatus',dirty?'上次未完成的创编草稿已恢复。':'已打开上次保留的一页。');}
  else{apply(null,'','');if(workspace.reason)text('studioWorkspaceStatus','暂存稿无法读取，原始数据仍保留；可以先导出原始数据。');}
  $('#sparkDraw').addEventListener('click',function(){draw();});$('#studioDrawAgain').addEventListener('click',function(){draw();});
  ['studioTitle','studioTheme','studioSeed','studioNotes'].forEach(function(id){$('#'+id).addEventListener('input',function(){project=read();dirty=true;render();cache();});});
  ['studioStyle','studioSeconds'].forEach(function(id){$('#'+id).addEventListener('change',function(){project=read();dirty=true;render();cache();});});
  document.addEventListener('click',function(event){
   var lock=event.target.closest('[data-lock]');if(lock){var key=lock.dataset.lock;project.locks[key]=!project.locks[key];dirty=true;render();cache();}
   var reroll=event.target.closest('[data-reroll]');if(reroll)draw(reroll.dataset.reroll);
   var mode=event.target.closest('[data-studio-mode]');if(mode){project.context.mode=mode.dataset.studioMode;dirty=true;render();cache();}
   var opener=event.target.closest('[data-studio-open]');if(opener)decide('open',opener.dataset.studioOpen);
   var del=event.target.closest('[data-studio-delete]');if(del)decide('delete',del.dataset.studioDelete);
  });
  $('#studioRelationNext').addEventListener('click',function(){project.relation=S.relation(project.relation);dirty=true;render();cache();});
  $('#sparkSave').addEventListener('click',function(){save(false);});$('#studioFork').addEventListener('click',function(){save(true);});
  $('#studioNew').addEventListener('click',function(){decide('new');});
  $('#studioDecisionCancel').addEventListener('click',function(){pendingAction=null;$('#studioDecision').hidden=true;});
  $('#studioDecisionConfirm').addEventListener('click',perform);$('#studioDecisionSave').addEventListener('click',function(){if(save(false))perform();});
  $('#studioSearch').addEventListener('input',renderBook);
  $('#studioCopy').addEventListener('click',async function(){var value=S.formatText(read());try{if(!navigator.clipboard)throw new Error('manual');await navigator.clipboard.writeText(value);hint('试编路线和笔记已复制，可以带去排练。');}catch(ignore){$('#studioTextFallback').hidden=false;$('#studioTextFallback').value=value;$('#studioTextFallback').select();hint('文字已展开并选中，可以手动复制。');}});
  $('#studioTextDownload').addEventListener('click',function(){download('足印-试编手记-'+Date.now()+'.txt',S.formatText(read()));hint('已发起文字下载。');});
  $('#studioBackup').addEventListener('click',function(){var latest=store.load();if(!latest.items.length)return;download('足印-创编本-'+Date.now()+'.json',store.exportData(latest.items),'application/json;charset=utf-8');hint('已发起创编本下载，请确认 JSON 文件已保存。');});
  $('#studioRawBackup').addEventListener('click',function(){download('足印-创编原始数据-'+Date.now()+'.txt',store.raw());});
  $('#studioImport').addEventListener('click',function(){$('#studioImportFile').click();});
  $('#studioImportFile').addEventListener('change',function(){var file=this.files&&this.files[0];if(!file)return;if(file.size>10*1024*1024){hint('文件超过 10 MB，请确认是足印创编本的备份。',true);this.value='';return;}var reader=new FileReader();reader.onload=function(){var source=store.readImport(String(reader.result||''));if(!source.ok||!source.items.length){hint('无法读取创编本。请选择创编本导出的 JSON，训练记录备份不是这一本。',true);return;}previewImport(source);};reader.onerror=function(){hint('文件读取失败，原本子没有改动。',true);};reader.readAsText(file);this.value='';});
  $('#studioImportCancel').addEventListener('click',function(){pendingImport=null;$('#studioImportPreview').hidden=true;});
  $('#studioImportConfirm').addEventListener('click',function(){if(!pendingImport)return;var latest=store.load();if(latest.token!==pendingImport.token){previewImport(pendingImport.source,'本子在预览后发生变化，请重新核对。');return;}var result=store.commit(pendingImport.plan.items,latest.token);if(!result.ok){hint(result.reason==='capacity'?'导入后会超过 '+store.MAX+' 页，本次没有写入。':'恢复失败，原来的本子保留。',true);return;}hint('创编本已恢复：新增 '+pendingImport.plan.added+' 页，差异另存 '+pendingImport.plan.changed+' 页。');pendingImport=null;$('#studioImportPreview').hidden=true;refreshBook();});
  window.addEventListener('storage',function(event){if(event.key===store.KEY){refreshBook();hint('另一页更新了创编本，当前稿保留；保存时会核对版本。');}if(event.key===store.DRAFT)text('studioWorkspaceStatus','另一页更新了暂存稿，本页内容保留，可以保存到创编本。');});
  window.addEventListener('pagehide',function(){if(dirty)cache();});render();
 }
 window.ZuyinStudio={currentText:function(){return S.formatText(read());},save:function(version){return save(!!version);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

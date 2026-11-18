/* 足印 · 今天、快捷记录、回看与本地数据。所有内容留在当前浏览器。 */
(function () {
  'use strict';
  var C = window.ZuyinCore, P = window.ZuyinProductCore;
  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  var form, initialized = false, summaryLastFocus = null, summaryGenerated = false, summaryStale = false;
  var suspendedDraft = null;
  var DRAFT_KEY = 'zuyin.draft.v3';
  var draftRepo = P.createDraftRepository(function () { return window.localStorage; });
  var pageDraftId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  var originDraft = draftRepo.latest(), draftToken = null, restoringBoot = false;
  var draftState = { pending: false, saved: false, mode: 'create', message: '' };
  var legacyDraftActive = false, editBase = null, editConflict = false;
  var requestedHash = location.hash, recoveryRoute = '';
  var filters = { range: '7', site: 'all', side: 'all', query: '', date: '' };
  var routes = { top: 'today', log: 'records', map: 'body', load: 'body', lex: 'body', triage: 'body', my: 'more', breath: 'more', spark: 'more', voices: 'more' };
  var currentRoute = 'top';
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  function notify(text) { if (window.ZuyinJournal) window.ZuyinJournal.notify(text, '', null, 3400); }
  function setPressed(group, key, value) {
    $$(group + ' [data-' + key + ']').forEach(function (button) {
      var on = button.dataset[key] === value;
      button.classList.toggle('is-on', on); button.setAttribute('aria-pressed', String(on));
    });
  }
  function resetBodyFields() {
    $$('#partPicker button, #levelPicker button').forEach(function (button) {
      button.classList.remove('is-on'); button.setAttribute('aria-pressed', 'false');
    });
    form.dataset.side = ''; setPressed('#sidePicker', 'side', '');
  }
  function selectCondition(value, keepBody) {
    form.dataset.condition = value || '';
    setPressed('#conditionPicker', 'condition', value);
    $('#locationFields').hidden = value !== 'discomfort' && value !== 'unknown';
    $('#intensityField').hidden = value !== 'discomfort' && value !== 'unknown';
    $('#legacyCondition').hidden = value !== 'unknown';
    if (!keepBody && value !== 'discomfort' && value !== 'unknown') resetBodyFields();
  }
  function readForm() {
    var part = $('#partPicker .is-on'), level = $('#levelPicker .is-on');
    return {
      kind: form.dataset.course === 'rest' ? 'rest' : 'practice',
      course: form.dataset.course || '', condition: form.dataset.condition || '',
      date: $('#recordDate').value, training: $('#training').value.trim(), feeling: $('#feeling').value.trim(),
      site: part ? part.dataset.partPick : '', side: form.dataset.side || 'unknown',
      level: level ? Number(level.dataset.level) : 0, duration: $('#duration').value
    };
  }
  function hasDraft() {
    return !!(form.dataset.course || form.dataset.condition || $('#training').value.trim() || $('#feeling').value.trim() ||
      $('#duration').value || form.dataset.dateTouched === 'true');
  }
  function paintDraftState(pending, saved, message) {
    draftState = { pending: pending, saved: saved, mode: form && form.dataset.editing ? 'edit' : 'create', conflict: editConflict, message: message || '' };
    if ($('#draftStatus')) { if ($('#draftStatus').textContent !== (message || '')) $('#draftStatus').textContent = message || ''; $('#draftStatus').dataset.state = pending && !saved ? 'failed' : 'saved'; }
    document.dispatchEvent(new CustomEvent('zuyin:draft', { detail: draftState }));
  }
  function keepDraft() {
    if (!form || restoringBoot) return;
    var pending = !!form.dataset.editing || hasDraft();
    if (!pending) {
      var removed = draftRepo.clear(pageDraftId, draftToken);
      if (removed.ok) draftToken = null;
      if (legacyDraftActive) { try { sessionStorage.removeItem(DRAFT_KEY); legacyDraftActive = false; } catch (ignore) {} }
      paintDraftState(false, false, removed.ok ? '' : '已清空当前输入，但旧草稿未能从设备清理；请在下次打开时核对。'); return;
    }
    var result = draftRepo.write(pageDraftId, { mode: form.dataset.editing ? 'edit' : 'create', recordId: form.dataset.editing || '', values: readForm(), base: editBase, suspended: suspendedDraft });
    if (result.ok) {
      draftToken = result.token;
      if (originDraft && originDraft.id !== pageDraftId) { draftRepo.clear(originDraft.id, originDraft.token); originDraft = null; }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (ignore) {}
    }
    paintDraftState(true, result.ok, result.ok ? (editConflict ? '草稿已暂存；原记录有变化，核对后再保存。' : '草稿已在此设备暂存，关闭后仍可继续。') : '草稿暂存失败，文字仍在当前页面；请保存记录后再关闭。');
  }
  function applyValues(item, editing) {
    form.dataset.course = item.kind === 'rest' ? 'rest' : (item.course || '');
    form.dataset.editing = editing ? item.id : '';
    form.dataset.dateTouched = item.date && item.date !== C.dateKey(Date.now()) ? 'true' : '';
    setPressed('#coursePicker', 'course', form.dataset.course);
    selectCondition(item.condition || (editing ? 'unknown' : ''), true);
    $('#recordDate').value = item.date || C.dateKey(item.ts || Date.now());
    $('#training').value = item.training || '';
    $('#feeling').value = item.feeling || '';
    $('#duration').value = item.duration || '';
    resetBodyFields();
    var part = item.site && $('#partPicker [data-part-pick="' + item.site + '"]');
    if (part) { part.classList.add('is-on'); part.setAttribute('aria-pressed', 'true'); }
    var level = item.level && $('#levelPicker [data-level="' + Number(item.level) + '"]');
    if (level) { level.classList.add('is-on'); level.setAttribute('aria-pressed', 'true'); }
    form.dataset.side = item.side || (item.site ? 'unknown' : '');
    setPressed('#sidePicker', 'side', form.dataset.side);
    $('#recordDetails').open = !!editing || !!item.training || !!item.feeling || !!item.duration;
    $('#formTitle').textContent = editing ? '修改这笔记录' : '今天的一笔';
  }
  function resetForm(initial) {
    clearPendingDecisions();
    editBase = null; editConflict = false;
    if ($('#draftEditConflict')) $('#draftEditConflict').hidden = true;
    form.querySelector('[type=submit]').disabled = false;
    form.dataset.course = ''; form.dataset.condition = ''; form.dataset.side = ''; form.dataset.editing = ''; form.dataset.dateTouched = '';
    setPressed('#coursePicker', 'course', ''); selectCondition(''); resetBodyFields();
    $('#recordDate').value = C.dateKey(Date.now()); $('#recordDate').max = C.dateKey(Date.now());
    $('#recordDetails').open = false; $('#legacyCondition').hidden = true;
    $('#formTitle').textContent = '今天的一笔'; $('#savedNext').hidden = true;
    var cleared = draftRepo.clear(pageDraftId, draftToken); draftToken = null;
    paintDraftState(false, false, cleared.ok ? '' : '之前的暂存草稿未能清理，请在下次打开时核对。');
    if (!initial) { try { sessionStorage.removeItem(DRAFT_KEY); legacyDraftActive = false; } catch (ignore) {} }
  }
  function draftDescription() {
    var value = readForm();
    var item = C.normalize(Object.assign({}, value, { id: 'draft-preview', ts: Date.now(), training: value.training || C.COURSE[value.course] || (value.kind === 'rest' ? '休息日' : '未填写练习') }));
    return item ? C.communicationSummary([item]) : '草稿尚未填写完整。';
  }
  function showEditConflict(current) {
    editConflict = true;
    $('#draftEditConflict').hidden = false;
    $('#draftSavedPreview').textContent = current ? C.communicationSummary([current]) : '原记录已经不在当前列表。';
    $('#draftVersionPreview').textContent = draftDescription();
    $('#useDraftVersion').disabled = !current;
    form.querySelector('[type=submit]').disabled = true;
    keepDraft();
  }
  function canSaveEdit() {
    if (!form.dataset.editing) return true;
    var current = window.ZuyinStore.load().items.filter(function (item) { return item.id === form.dataset.editing; })[0];
    if (!editConflict && editBase && current && P.fingerprint([current]) === P.fingerprint([editBase])) return true;
    showEditConflict(current);
    return false;
  }
  function filterRecords(items) {
    var list = filters.date || filters.range === 'all' ? items : C.weekRecords(items);
    return P.searchRecords(list, filters);
  }
  function setFilters(next) {
    Object.assign(filters, next || {});
    [['recordRange','range'],['recordSite','site'],['recordSide','side'],['recordSearch','query'],['recordDay','date']].forEach(function (pair) { if ($('#'+pair[0])) $('#'+pair[0]).value = filters[pair[1]] || ''; });
    emit('zuyin:filter');
  }
  function refresh() {
    if (!initialized) return;
    var items = window.ZuyinStore.load().items, stats = C.stats(items);
    [['todayDays', stats.days], ['todayPractice', stats.practices], ['todayRest', stats.rests],
      ['recordWeekDays', stats.days], ['recordWeekPractice', stats.practices], ['recordWeekRest', stats.rests], ['myCount', items.length]]
      .forEach(function (pair) { if ($('#' + pair[0])) $('#' + pair[0]).textContent = pair[1]; });
    var date = new Date();
    $('#homeDate').textContent = (date.getMonth() + 1) + '月' + date.getDate() + '日 · 周' + '日一二三四五六'[date.getDay()];
    var recent = C.sortRecords(items).slice(0, 2);
    $('#recentNotes').innerHTML = recent.length ? recent.map(function (item) {
      return '<a class="recent-note" data-open-entry="' + esc(item.id) + '" href="#entry/' + encodeURIComponent(item.id) + '"><span class="recent-note__date">' + esc(item.date.slice(5).replace('-', '.')) + '</span><span><strong>' + esc(item.training) + '</strong><small>' + esc(C.locationLabel(item) || C.CONDITION[item.condition]) + '</small></span><span aria-hidden="true">↗</span></a>';
    }).join('') : '<div class="recent-empty"><span class="recent-empty__mark">＋</span><p>练习本还是空白的。<br><span>从今天的一次练习，或一次休息开始。</span></p></div>';
    if (window.ZuyinJournal) window.ZuyinJournal.refreshHome();
    emit('zuyin:refresh');
  }
  function showRoute(raw, options) {
    options = options || {};
    var rawHash = String(raw || '#top');
    var id = rawHash.replace(/^#/, ''), entryId = '';
    if (id.indexOf('entry/') === 0) { try { entryId = decodeURIComponent(id.slice(6)); } catch (ignore) { entryId = id.slice(6); } id = 'log'; }
    if (id === 'visit') id = 'triage';
    if (id === 'evidence') id = 'lex';
    if (!Object.hasOwn(routes, id)) id = 'top';
    var view = routes[id];
    if (window.ZuyinJournal) window.ZuyinJournal.closePart();
    if ($('#summaryDialog') && !$('#summaryDialog').hidden) closeSummary();
    $$('main > section[data-view]').forEach(function (panel) { panel.hidden = panel.id !== id; });
    document.body.dataset.appView = view;
    $('#bodySubnav').hidden = view !== 'body';
    $('#moreBack').hidden = view !== 'more' || id === 'my';
    $$('.main-nav a, .bottom-nav a').forEach(function (link) {
      var targetView = routes[link.dataset.route];
      var on = targetView === view;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    $$('#bodySubnav a').forEach(function (link) {
      var on = link.hash === '#' + id; link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    var changed = currentRoute !== id;
    currentRoute = id;
    var targetHash = entryId ? '#entry/' + encodeURIComponent(entryId) : '#' + id;
    if (!restoringBoot && !options.fromHistory && location.hash !== targetHash) history[options.replaceHistory ? 'replaceState' : 'pushState'](null, '', targetHash);
    if (!options.noScroll && changed) window.scrollTo({ top: 0, behavior: 'auto' });
    emit('zuyin:navigate', { route: id, recordId: entryId });
    if (changed && !options.initial && !entryId) {
      var heading = $('#' + id + ' h1, #' + id + ' h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  window.ZuyinNavigate = showRoute;
  window.ZuyinUI = { readForm: readForm, filterRecords: filterRecords, refresh: refresh, setFilters: setFilters, getFilters: function () { return Object.assign({}, filters); }, getDraftState: function () { return Object.assign({}, draftState); }, canSaveEdit: canSaveEdit };

  function clearSummaryPreview(message) {
    summaryGenerated = false; summaryStale = false;
    $('#summaryGenerate').textContent = '生成预览';
    $('#summaryText').value = '';
    $('#summaryStatus').textContent = message || '';
    updateSummaryActions();
  }
  function updateSummaryActions() {
    var empty = !$('#summaryText').value.trim() || summaryStale;
    ['summaryCopy', 'summaryDownload', 'summaryPrint'].forEach(function (id) { $('#' + id).disabled = empty; });
  }
  function setSummaryInert(active) {
    $('#main').inert = active; $('#nav').inert = active; $('.bottom-nav').inert = active;
  }
  function openSummary() {
    summaryLastFocus = document.activeElement;
    var items = filterRecords(window.ZuyinStore.load().items);
    $('#summaryChoices').innerHTML = items.length ? items.map(function (item) {
      return '<label class="summary-choice"><input type="checkbox" value="' + esc(item.id) + '"><span><strong>' + esc(item.date + ' · ' + item.training) + '</strong><small>' + esc(C.locationLabel(item) || C.CONDITION[item.condition]) + '</small></span></label>';
    }).join('') : '<p class="field-hint">当前筛选下没有记录。可以关闭后切换到「全部记录」。</p>';
    $('#summaryGenerate').disabled = !items.length;
    clearSummaryPreview();
    $('#summaryDialog').hidden = false; document.body.classList.add('summary-open'); setSummaryInert(true);
    $('.summary-panel').focus();
  }
  function closeSummary() {
    $('#summaryDialog').hidden = true; document.body.classList.remove('summary-open'); setSummaryInert(false);
    if (summaryLastFocus) summaryLastFocus.focus({ preventScroll: true });
  }
  function generateSummary() {
    var chosen = new Set($$('#summaryChoices input:checked').map(function (input) { return input.value; }));
    if (!chosen.size) { $('#summaryStatus').textContent = '先选一条你想带上的记录。'; return; }
    var items = window.ZuyinStore.load().items.filter(function (item) { return chosen.has(item.id); });
    $('#summaryText').value = C.communicationSummary(items); summaryGenerated = true; summaryStale = false;
    $('#summaryGenerate').textContent = '重新生成预览';
    $('#summaryStatus').textContent = '已整理 ' + items.length + ' 条记录。读一遍，可以直接修改下面的文字。';
    updateSummaryActions();
  }
  function downloadText(name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var link = document.createElement('a'); link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function clearPendingDecisions() {
    $$('#draftMerge, #triageDraftDecision').forEach(function (panel) { panel.onclick = null; panel.remove(); });
  }
  function showMerge(kind, value, onApply) {
    clearPendingDecisions();
    var panel = $('#draftMerge');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'draftMerge'; panel.className = 'draft-merge';
      $('#recordDetails').before(panel);
    }
    var current = kind === 'moves' ? $('#training') : $('#feeling');
    panel.innerHTML = '<p>已有内容保留着。要把刚才选择的' + (kind === 'moves' ? '动作' : '感受') + '补进去吗？</p><p class="field-hint">' + esc(value) + '</p><div><button type="button" data-merge="append">追加</button><button type="button" data-merge="replace">替换</button><button type="button" data-merge="keep">保留原文</button></div>';
    panel.hidden = false;
    panel.onclick = function (event) {
      var button = event.target.closest('[data-merge]'); if (!button) return;
      if (button.dataset.merge === 'append') current.value = current.value.trim() + '；' + value;
      if (button.dataset.merge === 'replace') current.value = value;
      if (button.dataset.merge !== 'keep' && onApply) onApply(button.dataset.merge);
      clearPendingDecisions(); $('#recordDetails').open = true; keepDraft();
    };
  }
  function applyTriage(detail) {
    clearPendingDecisions();
    selectCondition('discomfort', true); resetBodyFields();
    $$('#partPicker button').forEach(function (button) {
      var on = button.dataset.partPick === detail.site;
      button.classList.toggle('is-on', on); button.setAttribute('aria-pressed', String(on));
    });
    form.dataset.side = 'unknown'; setPressed('#sidePicker', 'side', 'unknown');
    $('#feeling').value = detail.feeling; $('#recordDetails').open = true; keepDraft();
  }
  function init() {
    if (initialized) return;
    form = $('#logForm'); initialized = true;
    // Existing handlers keep their element references after moving local-data tools.
    var tools = $('.log-tools'), restore = $('#restorePanel');
    if (tools) $('#localDataTools').appendChild(tools);
    if (restore) $('#localDataTools').appendChild(restore);
    resetForm(true);

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        var hash = link.getAttribute('href');
        if (routes[hash.slice(1)] || hash === '#visit' || hash === '#evidence' || hash.indexOf('#entry/') === 0) { event.preventDefault(); showRoute(hash); }
      }
      var course = event.target.closest('[data-course]');
      if (course) { form.dataset.course = course.dataset.course; setPressed('#coursePicker', 'course', course.dataset.course); keepDraft(); }
      var condition = event.target.closest('[data-condition]');
      if (condition) { selectCondition(condition.dataset.condition); keepDraft(); }
      var side = event.target.closest('[data-side]');
      if (side) { form.dataset.side = side.dataset.side; setPressed('#sidePicker', 'side', side.dataset.side); keepDraft(); }
      if (event.target.closest('#quickRest')) {
        showRoute('#log');
        if (form.dataset.editing || hasDraft()) { notify('练习本里还有未保存内容；保存或取消后，再选择「今天休息」。'); return; }
        form.dataset.course = 'rest'; setPressed('#coursePicker', 'course', 'rest'); keepDraft();
        $('#conditionPicker button').focus({ preventScroll: true });
      }
      if (event.target.closest('[data-summary-close]')) closeSummary();
    });
    form.addEventListener('input', keepDraft);
    form.addEventListener('change', function (event) {
      if (event.target.id === 'recordDate') form.dataset.dateTouched = 'true';
      keepDraft();
    });
    // The legacy part/level picker listener runs earlier and updates its class first.
    form.addEventListener('click', function () { setTimeout(keepDraft, 0); });
    document.addEventListener('zuyin:before-edit', function () {
      if (!form.dataset.editing && hasDraft()) suspendedDraft = readForm();
      clearPendingDecisions();
    });
    document.addEventListener('zuyin:form-reset', function () {
      var restore = suspendedDraft; suspendedDraft = null;
      resetForm();
      if (restore) { applyValues(restore, false); keepDraft(); }
    });
    document.addEventListener('zuyin:edit', function (event) { editBase = C.normalize(event.detail); editConflict = false; $('#draftEditConflict').hidden = true; form.querySelector('[type=submit]').disabled = false; applyValues(event.detail, true); keepDraft(); });
    document.addEventListener('zuyin:reuse', function (event) {
      if (hasDraft()) {
        showMerge('moves', event.detail.training, function (action) {
          form.dataset.course = action === 'append' ? 'other' : (event.detail.course || '');
          setPressed('#coursePicker', 'course', form.dataset.course);
        });
        return;
      }
      $('#training').value = event.detail.training || '';
      $('#feeling').value = '';
      form.dataset.course = event.detail.course || ''; form.dataset.side = '';
      setPressed('#coursePicker', 'course', form.dataset.course); selectCondition(''); resetBodyFields();
      $('#duration').value = event.detail.duration || ''; $('#recordDetails').open = true; keepDraft();
    });
    document.addEventListener('zuyin:triage', function (event) {
      var detail = event.detail;
      if (form.dataset.editing) { notify('正在编辑旧记录。请先保存或取消，再带入新的不适。'); return; }
      if (!hasDraft()) { applyTriage(detail); return; }
      clearPendingDecisions();
      var panel = document.createElement('div'); panel.id = 'triageDraftDecision'; panel.className = 'draft-merge';
      panel.innerHTML = '<p>练习本里有草稿。要带入刚才整理的不适吗？</p><p class="field-hint">' + esc(C.SITE[detail.site] + ' · ' + detail.feeling) + '<br>确认后替换部位和感受，侧别与强度重新填写。练习内容保留。</p><button type="button" data-triage="accept">替换部位与感受</button><button type="button" data-triage="keep">保留当前草稿</button>';
      $('#recordDetails').before(panel);
      panel.onclick = function (click) {
        var button = click.target.closest('[data-triage]'); if (!button) return;
        if (button.dataset.triage === 'accept') applyTriage(detail); else clearPendingDecisions();
      };
    });
    document.addEventListener('zuyin:merge-moves', function (event) { showMerge('moves', '今天练了：' + event.detail); });
    document.addEventListener('zuyin:saved', function (event) {
      $('#savedNext').hidden = false;
      $('#savedNext').innerHTML = '已记下 ' + esc(event.detail.date) + ' 的' + (event.detail.kind === 'rest' ? '休息' : '练习') + '。<button type="button" class="text-button" id="supplementLast">补充细节</button>';
      $('#supplementLast').onclick = function () { window.ZuyinJournal.edit(event.detail.id); };
      refresh();
    });
    ['recordRange', 'recordSite', 'recordSide'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        filters.range = $('#recordRange').value; filters.site = $('#recordSite').value; filters.side = $('#recordSide').value;
        emit('zuyin:filter');
      });
    });
    $('#useDraftVersion').addEventListener('click', function () {
      var current = window.ZuyinStore.load().items.filter(function (item) { return item.id === form.dataset.editing; })[0];
      if (!current) { showEditConflict(null); return; }
      editBase = C.normalize(current); editConflict = false;
      $('#draftEditConflict').hidden = true; form.querySelector('[type=submit]').disabled = false;
      $('#formError').textContent = ''; $('#formError').classList.remove('is-on');
      window.ZuyinJournal.reload(); keepDraft();
    });
    $('#keepSavedVersion').addEventListener('click', function () { window.ZuyinJournal.reset(); });
    $('#openSummary').addEventListener('click', openSummary);
    $('#summaryGenerate').addEventListener('click', generateSummary);
    $('#summaryChoices').addEventListener('change', function () {
      if (summaryGenerated || $('#summaryText').value.trim()) {
        summaryStale = true;
        $('#summaryStatus').textContent = '选择已改变，原文字仍保留。请按新选择重新生成，再复制或保存；重新生成会替换下面的文字。';
        $('#summaryGenerate').textContent = '按新选择重新生成';
        updateSummaryActions();
      }
    });
    $('#summaryText').addEventListener('input', updateSummaryActions);
    $('#summaryCopy').addEventListener('click', async function () {
      try {
        if (!navigator.clipboard) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText($('#summaryText').value);
        $('#summaryStatus').textContent = '摘要已复制。';
      } catch (error) { $('#summaryText').select(); $('#summaryStatus').textContent = '文字已选中，请手动复制。'; }
    });
    $('#summaryDownload').addEventListener('click', function () { downloadText('足印-沟通摘要-' + C.dateKey(Date.now()) + '.txt', $('#summaryText').value); });
    $('#summaryPrint').addEventListener('click', function () {
      var paper = document.createElement('pre'); paper.id = 'summaryPrintContent'; paper.textContent = $('#summaryText').value;
      document.body.appendChild(paper); document.body.classList.add('is-summary-print');
      var clean = function () { document.body.classList.remove('is-summary-print'); paper.remove(); };
      window.addEventListener('afterprint', clean, { once: true }); window.print();
    });
    document.addEventListener('keydown', function (event) {
      if ($('#summaryDialog').hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeSummary(); return; }
      if (event.key !== 'Tab') return;
      var focusable = $$('#summaryDialog button:not([disabled]), #summaryDialog input, #summaryDialog textarea');
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('.summary-panel'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener('zuyin:logs', refresh);
    window.addEventListener('popstate', function () { showRoute(location.hash, { fromHistory: true }); });
    window.addEventListener('hashchange', function () { showRoute(location.hash, { fromHistory: true }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    setInterval(function () {
      refresh(); $('#recordDate').max = C.dateKey(Date.now());
      if (!hasDraft() && !form.dataset.editing) $('#recordDate').value = C.dateKey(Date.now());
    }, 60000);
    if (originDraft || bootDraft) {
      restoringBoot = true;
      try {
        var recovery = originDraft ? originDraft.value : { mode: 'create', values: P.draftValues(JSON.parse(bootDraft)), suspended: null };
        legacyDraftActive = !originDraft && !!bootDraft;
        var recordExists = recovery.mode === 'edit' && window.ZuyinStore.load().items.some(function (item) { return item.id === recovery.recordId; });
        if (recordExists) window.ZuyinJournal.edit(recovery.recordId);
        suspendedDraft = recovery.suspended;
        applyValues(Object.assign({}, recovery.values, { id: recovery.recordId }), !!recordExists);
        if (recordExists) {
          recoveryRoute = '#log';
          editBase = recovery.base || null;
          var latest = window.ZuyinStore.load().items.filter(function (item) { return item.id === recovery.recordId; })[0];
          if (!editBase || P.fingerprint([latest]) !== P.fingerprint([editBase])) {
            restoringBoot = false; showEditConflict(latest); restoringBoot = true;
          }
        }
        if (recovery.mode === 'edit' && !recordExists) notify('原记录已不存在，修改内容保留为待确认草稿；保存会新建一笔。');
        else notify('已恢复上次未完成的' + (recordExists ? '修改。' : '记录。'));
      } catch (ignore) { notify('有一份草稿无法读取，原始暂存内容仍保留。'); }
      restoringBoot = false; keepDraft();
    }
    window.addEventListener('pagehide', keepDraft);
    refresh(); window.ZuyinJournal.reload(); showRoute(requestedHash.indexOf('#entry/') === 0 ? requestedHash : (recoveryRoute || requestedHash || '#top'), { initial: true, replaceHistory: true });
  }
  var bootDraft = null;
  try { bootDraft = sessionStorage.getItem(DRAFT_KEY); } catch (ignore) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

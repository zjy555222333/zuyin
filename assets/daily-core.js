/* 足印 · 日常记录的数据规则。浏览器与离线测试共用，不包含 DOM 或网络。 */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root && root.document) {
    root.ZuyinCore = core;
    root.ZuyinStore = core.createStore(function () { return root.localStorage; });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var SITE = { waist: '腰', hip: '胯', knee: '膝', ankle: '踝', instep: '脚背' };
  var SIDE = { left: '左侧', right: '右侧', both: '双侧', unknown: '侧别未记录' };
  var COURSE = { basic: '基训', flex: '软开', tech: '技巧', rep: '剧目 / 排练', other: '其他练习' };
  var CONDITION = { clear: '没有不适', tired: '有些疲劳', discomfort: '有不适', unknown: '状态未记录' };
  var FOLLOW = { lighter: '轻一些', same: '差不多', worse: '更明显' };
  var DAY = 86400000;
  function str(value, limit) { return typeof value === 'string' ? value.trim().slice(0, limit || 600) : ''; }
  function dateKey(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (!isFinite(date.getTime())) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var p = value.split('-').map(Number);
    return dateKey(new Date(p[0], p[1] - 1, p[2], 12)) === value;
  }
  function dayNumber(key) {
    if (!validDate(key)) return NaN;
    var p = key.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) / DAY;
  }
  function normalize(input) {
    if (!input || typeof input !== 'object') return null;
    var kind = input.kind === 'rest' ? 'rest' : 'practice';
    var training = str(input.training) || (kind === 'rest' ? '休息日' : '');
    if (!training) return null;
    var ts = Number(input.ts);
    if (!isFinite(ts) || ts <= 0) ts = Date.now();
    var site = Object.hasOwn(SITE, input.site) ? input.site : '';
    var side = site ? (Object.hasOwn(SIDE, input.side) ? input.side : 'unknown') : '';
    var condition = Object.hasOwn(CONDITION, input.condition) ? input.condition : 'unknown';
    var level = Number(input.level);
    if (!Number.isFinite(level) || level < 0 || level > 5) level = 0;
    // 明确没有不适与疲劳时，不继承另一次记录的疼痛位置或强度。
    if (condition === 'clear' || condition === 'tired') { site = ''; side = ''; level = 0; }
    var follow = null;
    if (input.follow && Object.hasOwn(FOLLOW, input.follow.v)) {
      var followTs = Number(input.follow.ts);
      if (Number.isFinite(followTs) && followTs > 0) follow = { v: input.follow.v, ts: followTs };
    }
    var duration = Number(input.duration);
    return {
      id: str(input.id, 80) || ('z' + ts.toString(36) + Math.random().toString(36).slice(2, 9)),
      ts: ts,
      date: validDate(input.date) ? input.date : dateKey(ts),
      kind: kind,
      course: Object.hasOwn(COURSE, input.course) ? input.course : '',
      condition: condition,
      training: training,
      feeling: str(input.feeling),
      site: site,
      side: side,
      level: Math.round(level),
      duration: Number.isFinite(duration) && duration > 0 && duration <= 1440 ? Math.round(duration) : null,
      follow: follow
    };
  }
  function buildRecord(input, previous, now) {
    now = now || Date.now();
    var date = input.date || dateKey(now);
    if (!validDate(date)) return { ok: false, field: 'recordDate', error: '请选择有效的练习日期。' };
    if (date > dateKey(now)) return { ok: false, field: 'recordDate', error: '练习日期不能晚于今天。' };
    var kind = input.kind === 'rest' ? 'rest' : 'practice';
    var course = Object.hasOwn(COURSE, input.course) ? input.course : '';
    var training = kind === 'rest' ? '休息日' : (str(input.training) || COURSE[course] || '');
    if (!training) return { ok: false, field: 'coursePicker', error: '选一项今天的练习，也可以补充自己的内容。' };
    var condition = input.condition || (previous ? (previous.condition || 'unknown') : '');
    if (!Object.hasOwn(CONDITION, condition) || (condition === 'unknown' && !previous)) {
      return { ok: false, field: 'conditionPicker', error: '选一下此刻的身体状态。' };
    }
    if (condition === 'discomfort' && !Object.hasOwn(SITE, input.site)) {
      return { ok: false, field: 'partPicker', error: '标出这次主要记录的部位。' };
    }
    if (input.duration !== '' && input.duration != null &&
        (!Number.isInteger(Number(input.duration)) || Number(input.duration) < 1 || Number(input.duration) > 1440)) {
      return { ok: false, field: 'duration', error: '时长请填写 1 到 1440 之间的整数分钟，或留空。' };
    }
    var stamp = previous ? previous.ts : now;
    // 实际日期单独保存，ts 只保留录入先后，补记不会伪造具体发生时刻。
    var item = normalize({
      id: previous && previous.id, ts: stamp, date: date, kind: kind, course: course,
      condition: condition, training: training, feeling: input.feeling,
      site: input.site, side: input.side, level: input.level, duration: input.duration,
      follow: previous && previous.follow
    });
    if (previous && (item.site !== previous.site || item.side !== (previous.side || (previous.site ? 'unknown' : '')) ||
        item.date !== (previous.date || dateKey(previous.ts)) || item.condition === 'clear' || item.condition === 'tired')) item.follow = null;
    return { ok: true, item: item };
  }
  function sortRecords(items) {
    return items.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.ts - a.ts; });
  }
  function followCandidates(items, now) {
    var today = dayNumber(dateKey(now || Date.now()));
    return sortRecords(items.map(normalize).filter(Boolean)).filter(function (item) {
      var age = today - dayNumber(item.date);
      return age >= 1 && age <= 3 && !!item.site &&
        (item.condition === 'discomfort' || item.condition === 'unknown');
    });
  }
  function weekRecords(items, now) {
    var today = dayNumber(dateKey(now || Date.now()));
    return sortRecords(items.map(normalize).filter(Boolean)).filter(function (item) {
      var age = today - dayNumber(item.date); return age >= 0 && age < 7;
    });
  }
  function stats(items, now) {
    var week = weekRecords(items, now);
    return { days: new Set(week.map(function (item) { return item.date; })).size,
      practices: week.filter(function (item) { return item.kind === 'practice'; }).length,
      rests: week.filter(function (item) { return item.kind === 'rest'; }).length };
  }
  function locationLabel(item) {
    if (!SITE[item.site]) return '';
    if (item.side === 'left') return '左' + SITE[item.site];
    if (item.side === 'right') return '右' + SITE[item.site];
    if (item.side === 'both') return '双侧' + SITE[item.site];
    return SITE[item.site] + ' · 侧别未记录';
  }
  function communicationSummary(items) {
    if (!items.length) return '';
    var lines = ['足印 · 我的练习与身体记录', '以下由本人记录整理，用于沟通，不是诊断或复训结论。', ''];
    sortRecords(items.map(normalize).filter(Boolean)).forEach(function (item) {
      lines.push(item.date + ' · ' + (item.kind === 'rest' ? '休息' : '练习记录'));
      lines.push('内容：' + item.training);
      lines.push('状态：' + CONDITION[item.condition]);
      lines.push('部位：' + (locationLabel(item) || '未记录'));
      if (item.duration) lines.push('记录时长：' + item.duration + ' 分钟');
      if (item.level) lines.push('自述不适强度：' + item.level + ' / 5');
      lines.push('原始感受：' + (item.feeling || '未填写'));
      if (item.follow) lines.push(dateKey(item.follow.ts) + ' 回访自述：' + FOLLOW[item.follow.v]);
      lines.push('');
    });
    lines.push('未填写的信息保持未知；以上条数不代表实际训练总次数或负荷。');
    return lines.join('\n');
  }
  function createStore(storage) {
    var KEY = 'zuyin.logs.v3', VER = 3, MAX = 2000, lastError = '';
    function getStorage() { return typeof storage === 'function' ? storage() : storage; }
    function parse(raw) {
      var data = JSON.parse(raw);
      var source = Array.isArray(data) ? data : data && data.items;
      if (!Array.isArray(source)) throw new Error('shape');
      var items = [], invalid = 0, ids = new Set();
      source.forEach(function (input) {
        var item = normalize(input);
        if (!item || ids.has(item.id)) { invalid++; return; }
        ids.add(item.id); items.push(item);
      });
      items = sortRecords(items);
      return { items: items.slice(0, MAX), invalid: invalid, dropped: Math.max(0, items.length - MAX) };
    }
    function save(items) {
      try {
        var parsed = parse(JSON.stringify(items));
        var text = JSON.stringify({ v: VER, savedAt: Date.now(), items: parsed.items });
        var store = getStorage();
        var original = store.getItem(KEY);
        if (original) {
          try { parse(original); }
          catch (error) {
            // 若旧内容损坏，确保原始字符串确实可恢复后才能写入新记录。
            var backupKey = 'zuyin.logs.corrupt.' + Date.now();
            store.setItem(backupKey, original);
            if (store.getItem(backupKey) !== original) return { ok: false, reason: 'backup' };
          }
        }
        store.setItem(KEY, text);
        if (store.getItem(KEY) !== text) return { ok: false, reason: 'verify' };
        return { ok: true, count: parsed.items.length, trimmed: parsed.dropped };
      } catch (error) { lastError = error.name || error.message; return { ok: false, reason: lastError }; }
    }
    function load() {
      var store, raw;
      try { store = getStorage(); raw = store.getItem(KEY); }
      catch (error) { lastError = error.name || error.message; return { status: 'unavailable', items: [], error: lastError }; }
      if (raw) {
        try { return Object.assign({ status: 'ok' }, parse(raw)); }
        catch (error) {
          var backedUp = false;
          try { store.setItem('zuyin.logs.corrupt.' + Date.now(), raw); backedUp = true; } catch (ignore) {}
          return { status: 'corrupt', items: [], backedUp: backedUp, error: 'parse' };
        }
      }
      for (var i = 2; i >= 1; i--) {
        var oldKey = 'zuyin.logs.v' + i;
        var legacy;
        try { legacy = store.getItem(oldKey); }
        catch (error) { return { status: 'unavailable', items: [], error: error.name }; }
        if (!legacy) continue;
        var result;
        try { result = parse(legacy); }
        catch (error) { return { status: 'corrupt', items: [], backedUp: false, error: 'legacy' }; }
        try { store.setItem('zuyin.logs.backup.v' + i, legacy); }
        catch (error) { return Object.assign(result, { status: 'migrate-failed', error: error.name }); }
        var saved = save(result.items);
        return Object.assign(result, { status: saved.ok ? 'migrated' : 'migrate-failed', error: saved.reason });
      }
      return { status: 'empty', items: [], invalid: 0, dropped: 0 };
    }
    function readImport(text) {
      try { return Object.assign({ ok: true }, parse(text)); }
      catch (error) { return { ok: false, reason: 'format' }; }
    }
    return { KEY: KEY, VER: VER, MAX: MAX, load: load, save: save, normalize: normalize,
      readImport: readImport,
      exportData: function (items) { return JSON.stringify({ app: 'zuyin', v: VER, exportedAt: new Date().toISOString(), items: items }, null, 2); },
      lastError: function () { return lastError; } };
  }
  return { SITE: SITE, SIDE: SIDE, COURSE: COURSE, CONDITION: CONDITION, FOLLOW: FOLLOW,
    normalize: normalize, buildRecord: buildRecord, dateKey: dateKey, validDate: validDate,
    sortRecords: sortRecords, weekRecords: weekRecords, followCandidates: followCandidates,
    stats: stats, locationLabel: locationLabel, communicationSummary: communicationSummary, createStore: createStore };
});

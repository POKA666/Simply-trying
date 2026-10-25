/* 小账本 · 数据层
 * 纯本地存储（localStorage），无网络请求。
 * 同时支持浏览器全局 XZB 与 Node 的 module.exports，便于测试。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XZB = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'xiaozhangben.v1';
  var SCHEMA_VERSION = 1;

  var DEFAULT_CATEGORIES = {
    expense: ['餐饮', '交通', '购物', '日用', '房租', '娱乐', '医疗', '学习', '人情', '其他'],
    income: ['工资', '奖金', '兼职', '理财', '红包', '其他']
  };

  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ---------- 日期工具（全部使用本地时区） ---------- */

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key == null ? '' : key));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  function todayKey(now) {
    return dateKey(now || new Date());
  }

  function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  /* 一周从周一开始 */
  function startOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function weekKeyOf(date) {
    return dateKey(startOfWeek(date));
  }

  function monthKeyOf(date) {
    return dateKey(date).slice(0, 7);
  }

  function round2(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  /* ---------- 展示用格式化 ---------- */

  function formatMoney(n) {
    var v = round2(n);
    var s = Math.abs(v).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    return (v < 0 ? '-' : '') + '¥' + s;
  }

  function formatDayLabel(key) {
    var d = parseKey(key);
    if (!d) return key;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAYS[d.getDay()];
  }

  function formatWeekLabel(weekStartKey) {
    var s = parseKey(weekStartKey);
    if (!s) return weekStartKey;
    var e = addDays(s, 6);
    return (s.getMonth() + 1) + '/' + s.getDate() + '–' + (e.getMonth() + 1) + '/' + e.getDate();
  }

  function formatMonthTitle(monthKey) {
    var p = String(monthKey).split('-');
    return (+p[0]) + '年' + (+p[1]) + '月';
  }

  /* ---------- 汇总 ---------- */

  function sumEntries(list) {
    var out = { income: 0, expense: 0, balance: 0, count: 0 };
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type === 'income') out.income += e.amount;
      else out.expense += e.amount;
      out.count++;
    }
    out.income = round2(out.income);
    out.expense = round2(out.expense);
    out.balance = round2(out.income - out.expense);
    return out;
  }

  function entriesOnDay(list, key) {
    return list.filter(function (e) { return e.date === key; });
  }

  function entriesInWeek(list, weekStartKey) {
    var start = parseKey(weekStartKey);
    if (!start) return [];
    var endKey = dateKey(addDays(start, 6));
    var startKey = weekStartKey;
    return list.filter(function (e) {
      return e.date >= startKey && e.date <= endKey;
    });
  }

  function entriesInMonth(list, monthKey) {
    return list.filter(function (e) { return e.date.slice(0, 7) === monthKey; });
  }

  function groupTotals(list, keyFn) {
    var map = new Map();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var key = keyFn(e);
      var bucket = map.get(key);
      if (!bucket) {
        bucket = { key: key, income: 0, expense: 0, balance: 0, count: 0, entries: [] };
        map.set(key, bucket);
      }
      if (e.type === 'income') bucket.income += e.amount;
      else bucket.expense += e.amount;
      bucket.count++;
      bucket.entries.push(e);
    }
    var arr = Array.from(map.values());
    arr.forEach(function (b) {
      b.income = round2(b.income);
      b.expense = round2(b.expense);
      b.balance = round2(b.income - b.expense);
    });
    arr.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });
    return arr;
  }

  function dailyTotals(list) { return groupTotals(list, function (e) { return e.date; }); }
  function weeklyTotals(list) { return groupTotals(list, function (e) { return weekKeyOf(parseKey(e.date)); }); }
  function monthlyTotals(list) { return groupTotals(list, function (e) { return e.date.slice(0, 7); }); }

  function categoryTotals(list, type) {
    var map = new Map();
    var total = 0;
    list.forEach(function (e) {
      if (e.type !== type) return;
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
      total += e.amount;
    });
    var arr = Array.from(map.entries()).map(function (pair) {
      return {
        category: pair[0],
        amount: round2(pair[1]),
        share: total > 0 ? pair[1] / total : 0
      };
    });
    arr.sort(function (a, b) { return b.amount - a.amount; });
    return arr;
  }

  /* ---------- 周期列表（升序，含最近 n 个周期） ---------- */

  function listDays(n, endKey) {
    var end = parseKey(endKey) || new Date();
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(dateKey(addDays(end, -i)));
    return out;
  }

  function listWeeks(n, endWeekStartKey) {
    var end = parseKey(endWeekStartKey) || startOfWeek(new Date());
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(dateKey(addDays(end, -7 * i)));
    return out;
  }

  function listMonths(n, endMonthKey) {
    var parts = String(endMonthKey).split('-');
    var y = +parts[0];
    var m = +parts[1] - 1;
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(y, m - i, 1);
      out.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1));
    }
    return out;
  }

  /* ---------- 实体规范化 ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalizeEntry(raw) {
    raw = raw || {};
    var type = raw.type === 'income' ? 'income' : 'expense';
    var amount = round2(Math.abs(Number(raw.amount) || 0));
    var name = String(raw.name == null ? '' : raw.name).trim().slice(0, 40);
    var category = String(raw.category == null ? '' : raw.category).trim().slice(0, 12) || '其他';
    var date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : todayKey();
    var note = String(raw.note == null ? '' : raw.note).trim().slice(0, 80);
    var createdAt = Number(raw.createdAt) || Date.now();
    return {
      id: raw.id ? String(raw.id) : uid(),
      type: type,
      amount: amount,
      name: name,
      category: category,
      date: date,
      note: note,
      createdAt: createdAt,
      updatedAt: Number(raw.updatedAt) || createdAt
    };
  }

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      entries: [],
      categories: {
        expense: DEFAULT_CATEGORIES.expense.slice(),
        income: DEFAULT_CATEGORIES.income.slice()
      },
      meta: { lastExportAt: null }
    };
  }

  function cleanCategoryList(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).map(function (c) {
      return String(c == null ? '' : c).trim().slice(0, 12);
    }).filter(function (c) {
      if (!c || seen[c]) return false;
      seen[c] = true;
      return true;
    });
  }

  function hydrate(raw) {
    var state = emptyState();
    if (!raw || typeof raw !== 'object') return state;

    if (Array.isArray(raw.entries)) {
      state.entries = raw.entries.map(normalizeEntry);
    }
    if (raw.categories && typeof raw.categories === 'object') {
      ['expense', 'income'].forEach(function (type) {
        var cleaned = cleanCategoryList(raw.categories[type]);
        if (cleaned.length) state.categories[type] = cleaned;
      });
    }
    if (raw.meta && typeof raw.meta === 'object') {
      state.meta.lastExportAt = typeof raw.meta.lastExportAt === 'number' ? raw.meta.lastExportAt : null;
    }
    return state;
  }

  function sortEntries(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      return a.id < b.id ? 1 : -1;
    });
  }

  /* ---------- 存储层 ---------- */

  function createStore(options) {
    options = options || {};
    var storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var state = emptyState();
    var loadError = null;

    function hydrateFromStorage() {
      if (!storage) return;
      var text = null;
      try {
        text = storage.getItem(STORAGE_KEY);
      } catch (err) {
        loadError = err;
        return;
      }
      if (!text) return;
      try {
        state = hydrate(JSON.parse(text));
      } catch (err) {
        loadError = err;
      }
    }

    function persist() {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (err) {
        loadError = err;
        return false;
      }
    }

    hydrateFromStorage();

    return {
      loadError: function () { return loadError; },

      getEntries: function () {
        return sortEntries(state.entries);
      },

      getEntry: function (id) {
        for (var i = 0; i < state.entries.length; i++) {
          if (state.entries[i].id === id) return state.entries[i];
        }
        return null;
      },

      addEntry: function (data) {
        var entry = normalizeEntry(data);
        state.entries.push(entry);
        persist();
        return entry;
      },

      updateEntry: function (id, patch) {
        for (var i = 0; i < state.entries.length; i++) {
          var current = state.entries[i];
          if (current.id !== id) continue;
          var merged = Object.assign({}, current, patch, {
            id: current.id,
            createdAt: current.createdAt,
            updatedAt: Date.now()
          });
          state.entries[i] = normalizeEntry(merged);
          persist();
          return state.entries[i];
        }
        return null;
      },

      deleteEntry: function (id) {
        var before = state.entries.length;
        state.entries = state.entries.filter(function (e) { return e.id !== id; });
        if (state.entries.length !== before) {
          persist();
          return true;
        }
        return false;
      },

      getCategories: function () {
        return {
          expense: state.categories.expense.slice(),
          income: state.categories.income.slice()
        };
      },

      addCategory: function (type, name) {
        if (type !== 'expense' && type !== 'income') return false;
        var cleaned = String(name == null ? '' : name).trim().slice(0, 12);
        if (!cleaned) return false;
        if (state.categories[type].indexOf(cleaned) >= 0) return false;
        state.categories[type].push(cleaned);
        persist();
        return true;
      },

      removeCategory: function (type, name) {
        if (type !== 'expense' && type !== 'income') return false;
        if (state.categories[type].length <= 1) return false;
        var next = state.categories[type].filter(function (c) { return c !== name; });
        if (next.length === state.categories[type].length) return false;
        state.categories[type] = next;
        persist();
        return true;
      },

      exportData: function () {
        return JSON.parse(JSON.stringify({
          app: 'xiaozhangben',
          version: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          entries: sortEntries(state.entries),
          categories: state.categories,
          meta: state.meta
        }));
      },

      importData: function (text) {
        var parsed;
        try {
          parsed = JSON.parse(String(text));
        } catch (err) {
          throw new Error('这不是有效的备份文件');
        }
        var list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.entries) ? parsed.entries : null);
        if (!list) throw new Error('文件里没有找到账目数据');
        state = hydrate(parsed);
        persist();
        return state.entries.length;
      },

      clearAll: function () {
        state = emptyState();
        persist();
      },

      markExported: function () {
        state.meta.lastExportAt = Date.now();
        persist();
      },

      getMeta: function () {
        return { lastExportAt: state.meta.lastExportAt };
      },

      rawState: function () {
        return state;
      }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    WEEKDAYS: WEEKDAYS,
    pad2: pad2,
    dateKey: dateKey,
    parseKey: parseKey,
    todayKey: todayKey,
    addDays: addDays,
    startOfWeek: startOfWeek,
    weekKeyOf: weekKeyOf,
    monthKeyOf: monthKeyOf,
    round2: round2,
    formatMoney: formatMoney,
    formatDayLabel: formatDayLabel,
    formatWeekLabel: formatWeekLabel,
    formatMonthTitle: formatMonthTitle,
    sumEntries: sumEntries,
    entriesOnDay: entriesOnDay,
    entriesInWeek: entriesInWeek,
    entriesInMonth: entriesInMonth,
    dailyTotals: dailyTotals,
    weeklyTotals: weeklyTotals,
    monthlyTotals: monthlyTotals,
    categoryTotals: categoryTotals,
    listDays: listDays,
    listWeeks: listWeeks,
    listMonths: listMonths,
    normalizeEntry: normalizeEntry,
    createStore: createStore
  };
});

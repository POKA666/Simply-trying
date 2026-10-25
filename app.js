/* 小账本 · 界面层 */
(function () {
  'use strict';

  var X = window.XZB;
  if (!X) {
    document.body.textContent = '脚本加载失败，请刷新页面。';
    return;
  }

  var store = X.createStore();

  var view = document.getElementById('view');
  var fab = document.getElementById('fab');
  var backdrop = document.getElementById('sheetBackdrop');
  var sheet = document.getElementById('sheet');
  var form = document.getElementById('entryForm');
  var amountInput = document.getElementById('amountInput');
  var nameInput = document.getElementById('nameInput');
  var noteInput = document.getElementById('noteInput');
  var dateInput = document.getElementById('dateInput');
  var categoryChips = document.getElementById('categoryChips');
  var addCatBtn = document.getElementById('addCatBtn');
  var addCatRow = document.getElementById('addCatRow');
  var addCatInput = document.getElementById('addCatInput');
  var deleteBtn = document.getElementById('deleteEntry');
  var saveBtn = document.getElementById('saveBtn');
  var sheetTitle = document.getElementById('sheetTitle');
  var formError = document.getElementById('formError');
  var toastEl = document.getElementById('toast');
  var importFile = document.getElementById('importFile');
  var closeTimer = null;
  var toastTimer = null;

  var S = {
    tab: 'list',
    month: X.monthKeyOf(new Date()),
    statsMode: 'day',
    expanded: null,
    editingId: null,
    type: 'expense',
    category: '餐饮'
  };

  /* ---------------- 工具 ---------------- */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return X.formatMoney(n);
  }

  function signedMoney(type, amount) {
    return (type === 'income' ? '+' : '-') + money(amount);
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-open');
    }, 2200);
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function todayStamp() {
    return X.todayKey().replace(/-/g, '');
  }

  function monthTitle(monthKey) {
    return X.formatMonthTitle(monthKey);
  }

  /* ---------------- 视图：记账 ---------------- */

  function monthBar() {
    var isCurrent = S.month === X.monthKeyOf(new Date());
    return '' +
      '<div class="month-bar">' +
        '<button type="button" class="icon-btn" data-action="prev-month" aria-label="上个月">‹</button>' +
        '<div class="month-label">' + monthTitle(S.month) + '</div>' +
        '<button type="button" class="icon-btn" data-action="next-month" aria-label="下个月">›</button>' +
        (isCurrent ? '' : '<button type="button" class="link-btn" data-action="this-month">回本月</button>') +
      '</div>';
  }

  function overviewCard(sum) {
    return '' +
      '<section class="overview">' +
        '<div class="ov-top"><span>本月结余</span></div>' +
        '<div class="ov-balance">' + money(sum.balance) + '</div>' +
        '<div class="ov-meta">' +
          '<span class="ov-chip">收入 <b>' + money(sum.income) + '</b></span>' +
          '<span class="ov-chip">支出 <b>' + money(sum.expense) + '</b></span>' +
          '<span class="ov-chip">共 <b>' + sum.count + '</b> 笔</span>' +
        '</div>' +
      '</section>';
  }

  function entryRow(e) {
    var name = e.name || e.category;
    return '' +
      '<button type="button" class="entry" data-action="edit-entry" data-id="' + esc(e.id) + '">' +
        '<span class="entry-ico ' + e.type + '" aria-hidden="true">' + (e.type === 'income' ? '收' : '支') + '</span>' +
        '<span class="entry-main">' +
          '<span class="entry-name">' + esc(name) + '</span>' +
          '<span class="entry-sub">' +
            '<span class="entry-cat">' + esc(e.category) + '</span>' +
            (e.note ? '<span class="entry-note">' + esc(e.note) + '</span>' : '') +
          '</span>' +
        '</span>' +
        '<span class="entry-amt ' + e.type + '">' + signedMoney(e.type, e.amount) + '</span>' +
      '</button>';
  }

  function dayCard(group) {
    var bits = [];
    if (group.income > 0) bits.push('收 ' + money(group.income));
    if (group.expense > 0) bits.push('支 ' + money(group.expense));
    return '' +
      '<section class="card day-card">' +
        '<div class="day-head">' +
          '<span class="day-date">' + X.formatDayLabel(group.key) + '</span>' +
          '<span class="day-sum">' + bits.join(' · ') + '</span>' +
        '</div>' +
        '<div class="rows">' + group.entries.map(entryRow).join('') + '</div>' +
      '</section>';
  }

  function emptyCard() {
    return '' +
      '<section class="card empty-card">' +
        '<div class="empty-mark" aria-hidden="true">¥</div>' +
        '<h2>这个月还没有账</h2>' +
        '<p>点右下角的「＋」，记下第一笔收支。之后每天、每周、每月的统计都会自动出来。</p>' +
        '<button type="button" class="btn primary" data-action="new-entry">记第一笔</button>' +
      '</section>';
  }

  function listView() {
    var entries = store.getEntries();
    var monthEntries = X.entriesInMonth(entries, S.month);
    var sum = X.sumEntries(monthEntries);
    var groups = X.dailyTotals(monthEntries);

    var html = monthBar() + overviewCard(sum);
    if (!groups.length) {
      html += emptyCard();
    } else {
      html += groups.map(dayCard).join('');
      html += '<p class="foot-note">点任意一笔，可以改名、改金额、改分类或删除。</p>';
    }
    return html;
  }

  /* ---------------- 视图：统计 ---------------- */

  function statsConfig() {
    var now = new Date();
    if (S.statsMode === 'week') {
      var weekStart = X.weekKeyOf(now);
      return {
        mode: 'week',
        periods: X.listWeeks(8, weekStart),
        chartKeys: X.listWeeks(6, weekStart),
        filter: X.entriesInWeek,
        curKey: weekStart,
        heroLabel: '本周 · ' + X.formatWeekLabel(weekStart),
        chartTitle: '近 6 周收支',
        catTitle: '本周支出分类',
        listTitle: '每周明细',
        periodLabel: function (k) { return X.formatWeekLabel(k) + ' 那周'; },
        chartLabel: function (k) {
          var d = X.parseKey(k);
          return d ? (d.getMonth() + 1) + '/' + d.getDate() : k;
        }
      };
    }
    if (S.statsMode === 'month') {
      var monthKey = X.monthKeyOf(now);
      return {
        mode: 'month',
        periods: X.listMonths(12, monthKey),
        chartKeys: X.listMonths(6, monthKey),
        filter: X.entriesInMonth,
        curKey: monthKey,
        heroLabel: '本月 · ' + monthTitle(monthKey),
        chartTitle: '近 6 个月收支',
        catTitle: '本月支出分类',
        listTitle: '每月明细',
        periodLabel: function (k) { return monthTitle(k); },
        chartLabel: function (k) { return (+String(k).split('-')[1]) + '月'; }
      };
    }
    var today = X.todayKey(now);
    return {
      mode: 'day',
      periods: X.listDays(14, today),
      chartKeys: X.listDays(7, today),
      filter: X.entriesOnDay,
      curKey: today,
      heroLabel: '今天 · ' + X.formatDayLabel(today),
      chartTitle: '近 7 天收支',
      catTitle: '今天的支出分类',
      listTitle: '每日明细',
      periodLabel: function (k) { return X.formatDayLabel(k); },
      chartLabel: function (k) { return String(+String(k).slice(8)); }
    };
  }

  function chartHTML(cfg, entries) {
    var sums = cfg.chartKeys.map(function (k) {
      return X.sumEntries(cfg.filter(entries, k));
    });
    var max = 1;
    sums.forEach(function (s) { max = Math.max(max, s.income, s.expense); });

    var cols = cfg.chartKeys.map(function (k, i) {
      var s = sums[i];
      var ih = s.income > 0 ? Math.max(3, Math.round((s.income / max) * 100)) : 0;
      var eh = s.expense > 0 ? Math.max(3, Math.round((s.expense / max) * 100)) : 0;
      return '' +
        '<div class="chart-col">' +
          '<div class="chart-bars">' +
            '<div class="bar income" style="height:' + ih + '%"></div>' +
            '<div class="bar expense" style="height:' + eh + '%"></div>' +
          '</div>' +
          '<div class="chart-label">' + cfg.chartLabel(k) + '</div>' +
        '</div>';
    }).join('');

    return '<div class="chart">' + cols + '</div>' +
      '<div class="legend"><span><i class="dot income"></i>收入</span><span><i class="dot expense"></i>支出</span></div>';
  }

  function catHTML(cfg, entries) {
    var list = cfg.filter(entries, cfg.curKey);
    var rows = [];

    ['expense', 'income'].forEach(function (type) {
      var cats = X.categoryTotals(list, type);
      if (!cats.length) return;
      var label = type === 'expense' ? '支出' : '收入';
      var total = cats.reduce(function (sum, c) { return sum + c.amount; }, 0);
      rows.push('<div class="cat-group"><div class="cat-group-title">' + label + ' · 共 ' + money(total) + '</div>');
      cats.slice(0, 6).forEach(function (c) {
        rows.push('' +
          '<div class="cat-row">' +
            '<div class="cat-row-top"><span>' + esc(c.category) + '</span><span>' + money(c.amount) + '</span></div>' +
            '<div class="cat-track"><div class="cat-fill ' + type + '" style="width:' + Math.max(2, Math.round(c.share * 100)) + '%"></div></div>' +
          '</div>');
      });
      rows.push('</div>');
    });

    if (!rows.length) {
      return '<p class="muted-note">这个周期还没有账，记一笔之后这里会显示分类占比。</p>';
    }
    return rows.join('');
  }

  function periodRow(cfg, entries, key) {
    var list = cfg.filter(entries, key);
    var sum = X.sumEntries(list);
    var open = S.expanded === key;
    var detail = '';
    if (open) {
      detail = '<div class="period-detail">' + (list.length
        ? list.map(entryRow).join('')
        : '<p class="muted-note">这个周期还没有记录。</p>') + '</div>';
    }
    return '' +
      '<div class="period">' +
        '<button type="button" class="period-row' + (open ? ' is-open' : '') + '" data-action="toggle-period" data-key="' + esc(key) + '">' +
          '<span class="period-main">' +
            '<span class="period-name">' + cfg.periodLabel(key) + '</span>' +
            '<span class="period-sub">收 ' + money(sum.income) + ' · 支 ' + money(sum.expense) + ' · ' + sum.count + ' 笔</span>' +
          '</span>' +
          '<span class="period-balance ' + (sum.balance >= 0 ? 'income' : 'expense') + '">' + money(sum.balance) + '</span>' +
          '<span class="chev" aria-hidden="true">' + (open ? '⌃' : '⌄') + '</span>' +
        '</button>' +
        detail +
      '</div>';
  }

  function statsView() {
    var entries = store.getEntries();
    var cfg = statsConfig();
    var curList = cfg.filter(entries, cfg.curKey);
    var curSum = X.sumEntries(curList);

    var html = '' +
      '<div class="seg big" role="tablist" aria-label="统计周期">' +
        modeBtn('day', '每日') + modeBtn('week', '每周') + modeBtn('month', '每月') +
      '</div>' +
      '<section class="card hero">' +
        '<div class="hero-label">' + cfg.heroLabel + '</div>' +
        '<div class="hero-balance">' + money(curSum.balance) + '</div>' +
        '<div class="hero-meta">' +
          '<div><span>收入</span><strong class="income">' + money(curSum.income) + '</strong></div>' +
          '<div><span>支出</span><strong class="expense">' + money(curSum.expense) + '</strong></div>' +
          '<div><span>笔数</span><strong>' + curSum.count + '</strong></div>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-title">' + cfg.chartTitle + '</div>' +
        chartHTML(cfg, entries) +
      '</section>' +
      '<section class="card">' +
        '<div class="card-title">' + cfg.catTitle + '</div>' +
        catHTML(cfg, entries) +
      '</section>' +
      '<section class="card">' +
        '<div class="card-title">' + cfg.listTitle + '</div>' +
        '<div class="periods">' + cfg.periods.slice().reverse().map(function (k) {
          return periodRow(cfg, entries, k);
        }).join('') + '</div>' +
      '</section>';

    return html;
  }

  function modeBtn(mode, label) {
    return '<button type="button" class="seg-btn' + (S.statsMode === mode ? ' is-active' : '') +
      '" data-action="stats-mode" data-mode="' + mode + '">' + label + '</button>';
  }

  /* ---------------- 视图：设置 ---------------- */

  function categoryChipsSettings(type) {
    var cats = store.getCategories()[type];
    var label = type === 'expense' ? '支出分类' : '收入分类';
    return '' +
      '<div class="cat-manage">' +
        '<div class="cat-manage-head">' + label + '</div>' +
        '<div class="chips">' + cats.map(function (c) {
          return '<span class="chip static">' + esc(c) +
            '<button type="button" class="chip-x" data-action="remove-category" data-type="' + type +
            '" data-category="' + esc(c) + '" aria-label="删除分类 ' + esc(c) + '">×</button></span>';
        }).join('') + '</div>' +
        '<div class="inline-add">' +
          '<input class="text-input" id="newCat-' + type + '" type="text" maxlength="12" placeholder="新增一个分类">' +
          '<button type="button" class="btn small ghost" data-action="add-setting-category" data-type="' + type + '">添加</button>' +
        '</div>' +
      '</div>';
  }

  function settingsView() {
    var meta = store.getMeta();
    var entries = store.getEntries();
    var sizeKb = Math.max(1, Math.round(JSON.stringify(store.rawState()).length / 1024));
    var lastExport = meta.lastExportAt
      ? new Date(meta.lastExportAt).toLocaleString('zh-CN', { hour12: false })
      : '还没有导出过';

    return '' +
      '<section class="card">' +
        '<div class="card-title">备份与恢复</div>' +
        '<p class="card-text">账目只存在这个浏览器里。换手机、换浏览器或清理缓存之前，先导出一份备份文件，存到微信收藏或网盘。</p>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn primary" data-action="export-json">导出备份文件</button>' +
          '<button type="button" class="btn ghost" data-action="export-csv">导出 Excel（CSV）</button>' +
          '<button type="button" class="btn ghost" data-action="trigger-import">导入备份</button>' +
        '</div>' +
        '<p class="muted-note">上次导出：' + esc(lastExport) + '</p>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-title">分类管理</div>' +
        categoryChipsSettings('expense') +
        categoryChipsSettings('income') +
        '<p class="muted-note">删除分类不会影响已经记好的账，只是以后不再出现在选项里。</p>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-title">数据</div>' +
        '<div class="data-line"><span>已记录</span><b>' + entries.length + ' 笔</b></div>' +
        '<div class="data-line"><span>占用空间</span><b>约 ' + sizeKb + ' KB</b></div>' +
        '<div class="data-line"><span>存储位置</span><b>本机浏览器</b></div>' +
        '<button type="button" class="btn ghost danger block" data-action="clear-data">清空所有账目</button>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-title">关于</div>' +
        '<p class="card-text">小账本 v1 · 不联网、不注册、不上传。支持每日、每周、每月统计。手机端可以「添加到主屏幕」，像 App 一样打开。</p>' +
        '<p class="muted-note">如果换设备后看不到账，是因为数据没有跟着走——用「导出备份 / 导入备份」搬过去即可。</p>' +
      '</section>';
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      var active = btn.dataset.tab === S.tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (S.tab === 'stats') view.innerHTML = statsView();
    else if (S.tab === 'settings') view.innerHTML = settingsView();
    else view.innerHTML = listView();

    fab.hidden = S.tab === 'settings';

    view.classList.remove('is-fresh');
    void view.offsetWidth;
    view.classList.add('is-fresh');
  }

  function switchTab(tab) {
    if (tab !== 'list' && tab !== 'stats' && tab !== 'settings') return;
    S.tab = tab;
    S.expanded = null;
    try { history.replaceState(null, '', '#' + tab); } catch (err) { /* file:// 下可能不允许 */ }
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- 记账弹层 ---------------- */

  function renderTypeSeg() {
    document.querySelectorAll('#typeSeg .seg-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.type === S.type);
    });
  }

  function renderCategoryChips() {
    var cats = store.getCategories()[S.type];
    categoryChips.innerHTML = cats.map(function (c) {
      var active = c === S.category ? ' is-active' : '';
      return '<button type="button" class="chip' + active + '" data-action="pick-category" data-category="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }

  function clearFormError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function openSheet(entry) {
    clearTimeout(closeTimer);
    S.editingId = entry ? entry.id : null;
    S.type = entry ? entry.type : 'expense';
    var cats = store.getCategories()[S.type];
    S.category = entry && cats.indexOf(entry.category) >= 0 ? entry.category : cats[0];

    sheetTitle.textContent = entry ? '编辑这笔账' : '记一笔';
    amountInput.value = entry ? String(entry.amount) : '';
    nameInput.value = entry ? entry.name : '';
    noteInput.value = entry ? entry.note : '';
    dateInput.value = entry ? entry.date : X.todayKey();
    deleteBtn.hidden = !entry;
    saveBtn.textContent = entry ? '保存修改' : '保存';
    clearFormError();
    renderTypeSeg();
    renderCategoryChips();
    hideAddCat();

    backdrop.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(function () {
      backdrop.classList.add('is-open');
    });
    setTimeout(function () { amountInput.focus(); }, 80);
  }

  function closeSheet() {
    S.editingId = null;
    backdrop.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      backdrop.hidden = true;
    }, 200);
  }

  function showAddCat() {
    addCatRow.hidden = false;
    addCatInput.value = '';
    addCatBtn.hidden = true;
    addCatInput.focus();
  }

  function hideAddCat() {
    addCatRow.hidden = true;
    addCatInput.value = '';
    addCatBtn.hidden = false;
  }

  function commitNewCategory() {
    var name = addCatInput.value.trim();
    if (!name) {
      addCatInput.focus();
      return;
    }
    if (store.addCategory(S.type, name)) {
      S.category = name;
      renderCategoryChips();
      hideAddCat();
      toast('已添加分类「' + name + '」');
    } else {
      toast('这个分类已经存在了');
    }
  }

  function saveCurrentEntry() {
    var amount = parseFloat(String(amountInput.value).replace(/,/g, '.').replace(/[^\d.]/g, ''));
    if (!isFinite(amount) || amount <= 0) {
      showFormError('请先填一个大于 0 的金额');
      amountInput.focus();
      return;
    }
    var wasEditing = Boolean(S.editingId);
    var payload = {
      type: S.type,
      amount: amount,
      name: nameInput.value.trim() || S.category,
      category: S.category,
      date: dateInput.value || X.todayKey(),
      note: noteInput.value.trim()
    };

    if (wasEditing) {
      store.updateEntry(S.editingId, payload);
    } else {
      store.addEntry(payload);
    }
    S.month = payload.date.slice(0, 7);
    closeSheet();
    render();
    toast(wasEditing ? '已更新这笔账' : '记下了 ' + money(amount));
  }

  function deleteCurrentEntry() {
    if (!S.editingId) return;
    var entry = store.getEntry(S.editingId);
    if (!entry) return;
    if (!window.confirm('删除「' + (entry.name || entry.category) + '」这笔账？删除后不能恢复。')) return;
    store.deleteEntry(entry.id);
    closeSheet();
    render();
    toast('已删除');
  }

  /* ---------------- 备份 ---------------- */

  function exportJson() {
    var data = store.exportData();
    store.markExported();
    download('小账本备份-' + todayStamp() + '.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    toast('备份文件已导出');
    if (S.tab === 'settings') render();
  }

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    var rows = [['日期', '类型', '名称', '分类', '金额', '备注']];
    store.getEntries().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
      rows.push([
        e.date,
        e.type === 'income' ? '收入' : '支出',
        e.name,
        e.category,
        e.amount.toFixed(2),
        e.note
      ]);
    });
    var csv = '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    store.markExported();
    download('小账本账单-' + todayStamp() + '.csv', csv, 'text/csv;charset=utf-8');
    toast('CSV 已导出');
    if (S.tab === 'settings') render();
  }

  function triggerImport() {
    var count = store.getEntries().length;
    if (count > 0) {
      var ok = window.confirm('导入会用备份文件里的账目替换当前的 ' + count + ' 笔记录。建议先导出一份当前数据。继续吗？');
      if (!ok) return;
    }
    importFile.value = '';
    importFile.click();
  }

  importFile.addEventListener('change', function () {
    var file = importFile.files && importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var count = store.importData(String(reader.result || ''));
        S.month = X.monthKeyOf(new Date());
        render();
        toast('已导入 ' + count + ' 笔账');
      } catch (err) {
        toast('导入失败：' + (err && err.message ? err.message : '文件格式不对'));
      }
      importFile.value = '';
    };
    reader.onerror = function () {
      toast('读取文件失败，请再试一次');
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  function clearAllData() {
    var count = store.getEntries().length;
    if (!count) {
      toast('现在是空的，没有可清空的账目');
      return;
    }
    if (!window.confirm('确定清空全部 ' + count + ' 笔账吗？这个操作不能撤销。')) return;
    if (!window.confirm('再确认一次：清空后只能靠之前导出的备份恢复。真的要清空？')) return;
    store.clearAll();
    render();
    toast('已清空所有账目');
  }

  /* ---------------- 分类管理（设置页） ---------------- */

  function addSettingCategory(type, inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    if (store.addCategory(type, name)) {
      render();
      toast('已添加分类「' + name + '」');
    } else {
      toast('这个分类已经存在了');
    }
  }

  function removeSettingCategory(type, name) {
    var used = store.getEntries().filter(function (e) {
      return e.type === type && e.category === name;
    }).length;
    var message = used
      ? '删除分类「' + name + '」？已经有 ' + used + ' 笔账在使用它，这些账会保留，但分类选项里不再出现。'
      : '删除分类「' + name + '」？';
    if (!window.confirm(message)) return;
    if (store.removeCategory(type, name)) {
      render();
      toast('已删除分类');
    } else {
      toast('至少要保留一个分类');
    }
  }

  /* ---------------- 事件 ---------------- */

  document.addEventListener('click', function (ev) {
    var tabBtn = ev.target.closest('[data-tab]');
    if (tabBtn) {
      switchTab(tabBtn.dataset.tab);
      return;
    }

    var actionEl = ev.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.dataset.action;

    switch (action) {
      case 'new-entry':
        openSheet(null);
        break;
      case 'close-sheet':
        closeSheet();
        break;
      case 'edit-entry':
        var entry = store.getEntry(actionEl.dataset.id);
        if (entry) openSheet(entry);
        break;
      case 'delete-entry':
        deleteCurrentEntry();
        break;
      case 'set-type':
        S.type = actionEl.dataset.type === 'income' ? 'income' : 'expense';
        var cats = store.getCategories()[S.type];
        if (cats.indexOf(S.category) < 0) S.category = cats[0];
        renderTypeSeg();
        renderCategoryChips();
        break;
      case 'pick-category':
        S.category = actionEl.dataset.category;
        categoryChips.querySelectorAll('.chip').forEach(function (chip) {
          chip.classList.toggle('is-active', chip.dataset.category === S.category);
        });
        break;
      case 'add-category':
        showAddCat();
        break;
      case 'save-new-category':
        commitNewCategory();
        break;
      case 'cancel-add-category':
        hideAddCat();
        break;
      case 'prev-month':
        S.month = shiftMonth(S.month, -1);
        render();
        break;
      case 'next-month':
        S.month = shiftMonth(S.month, 1);
        render();
        break;
      case 'this-month':
        S.month = X.monthKeyOf(new Date());
        render();
        break;
      case 'stats-mode':
        S.statsMode = actionEl.dataset.mode;
        S.expanded = null;
        render();
        break;
      case 'toggle-period':
        S.expanded = S.expanded === actionEl.dataset.key ? null : actionEl.dataset.key;
        render();
        break;
      case 'export-json':
        exportJson();
        break;
      case 'export-csv':
        exportCsv();
        break;
      case 'trigger-import':
        triggerImport();
        break;
      case 'clear-data':
        clearAllData();
        break;
      case 'add-setting-category':
        addSettingCategory(actionEl.dataset.type, 'newCat-' + actionEl.dataset.type);
        break;
      case 'remove-category':
        removeSettingCategory(actionEl.dataset.type, actionEl.dataset.category);
        break;
      default:
        break;
    }
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    saveCurrentEntry();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !backdrop.hidden) {
      closeSheet();
      return;
    }
    if (ev.key === 'Enter' && document.activeElement === addCatInput) {
      ev.preventDefault();
      commitNewCategory();
      return;
    }
    if (ev.key === 'Enter' && document.activeElement && document.activeElement.id && document.activeElement.id.indexOf('newCat-') === 0) {
      ev.preventDefault();
      var type = document.activeElement.id.replace('newCat-', '');
      addSettingCategory(type, document.activeElement.id);
    }
  });

  backdrop.addEventListener('click', function (ev) {
    if (ev.target === backdrop) closeSheet();
  });

  amountInput.addEventListener('input', function () {
    var v = this.value.replace(/[^\d.]/g, '');
    var dot = v.indexOf('.');
    if (dot >= 0) {
      v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
      v = v.slice(0, dot + 3);
    }
    if (this.value !== v) this.value = v;
  });

  function shiftMonth(monthKey, delta) {
    var p = monthKey.split('-');
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + X.pad2(d.getMonth() + 1);
  }

  /* ---------------- 启动 ---------------- */

  if (store.loadError()) {
    toast('读取本地数据失败，可能是浏览器禁用了存储');
  }

  (function readHash() {
    var hash = String(location.hash || '').replace('#', '');
    if (hash === 'stats' || hash === 'settings') S.tab = hash;
  })();

  window.addEventListener('hashchange', function () {
    var hash = String(location.hash || '').replace('#', '');
    if (hash === 'list' || hash === 'stats' || hash === 'settings') switchTab(hash);
  });

  render();

  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();

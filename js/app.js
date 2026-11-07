/* =========================================================
 * app.js —— 界面渲染与交互
 * ========================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const $ = U.$, $$ = U.$$;

  const state = { toolId: null, files: [] };
  const TOOLS = global.CONVERTERS;
  const CATEGORY_ORDER = ['图片与视觉', '文档与办公', '数据与编码', '文本与效率', '开发者工具'];

  /* ---------- 主题 ---------- */
  const savedTheme = localStorage.getItem('ufc-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ufc-theme', next);
  });

  /* ---------- 导航 ---------- */
  function renderNav(filter) {
    const nav = $('#toolNav');
    nav.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();
    let shown = 0;
    CATEGORY_ORDER.forEach(cat => {
      const tools = TOOLS.filter(t => t.category === cat && (!kw ||
        (t.name + t.desc + (t.tags || []).join(' ') + cat).toLowerCase().includes(kw)));
      if (!tools.length) return;
      const h = document.createElement('div');
      h.className = 'nav-group'; h.textContent = cat;
      nav.appendChild(h);
      tools.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nav-item' + (t.id === state.toolId ? ' active' : '');
        b.dataset.id = t.id;
        b.innerHTML = `<span class="nav-emoji">${t.icon}</span><span>${U.escapeHtml(t.name)}</span>`;
        b.addEventListener('click', () => selectTool(t.id));
        nav.appendChild(b);
      });
      shown += tools.length;
    });
    if (!shown) nav.innerHTML = '<div class="empty-result">没有匹配的工具，换个关键词试试</div>';
    $('#toolCount').textContent = `共 ${TOOLS.length} 个工具 · 当前显示 ${shown} 个`;
  }
  $('#toolSearch').addEventListener('input', e => renderNav(e.target.value));

  const currentTool = () => TOOLS.find(t => t.id === state.toolId) || TOOLS[0];

  /* ---------- 选项 ---------- */
  function choicesOf(opt, tool, opts) {
    if (tool.id === 'unit-convert' && opt.key === 'unit') {
      const cat = (opts && opts.category) || 'length';
      if (cat === 'temperature') return ['°C', '°F', 'K', '°R'].map(v => [v, v + (v === '°C' ? ' 摄氏度' : v === '°F' ? ' 华氏度' : '')]);
      const list = (global.UNITS[cat] || global.UNITS.length).list.map(u => [u[0], u[0], u[1]]);
      const base = list.find(u => u[2] === 1) || list[0];
      return [['auto', '自动（' + base[0] + '）'], ...list];
    }
    return opt.choices || [];
  }
  function normalizeChoices(list) {
    return list.map(c => Array.isArray(c) ? [String(c[0]), String(c[1])] : [String(c), String(c)]);
  }
  function renderOptions(tool, preserve) {
    const grid = $('#optionsGrid');
    grid.innerHTML = '';
    const card = $('#optionsCard');
    card.hidden = !tool.options || !tool.options.length;
    if (card.hidden) return;
    const cur = preserve || {};
    tool.options.forEach(opt => {
      const wrap = document.createElement('div');
      wrap.className = 'opt' + (opt.type === 'checkbox' ? ' opt-check' : '');
      const label = document.createElement('label');
      label.textContent = opt.label;
      let input;
      if (opt.type === 'select') {
        input = document.createElement('select');
        normalizeChoices(choicesOf(opt, tool, cur)).forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l; input.appendChild(o);
        });
        const desired = cur[opt.key] !== undefined ? String(cur[opt.key]) : String(opt.default);
        input.value = desired;
        if (input.value !== desired) input.value = String(opt.default);
      } else if (opt.type === 'range') {
        const box = document.createElement('div'); box.className = 'opt-range';
        input = document.createElement('input'); input.type = 'range';
        input.min = opt.min ?? 0; input.max = opt.max ?? 100; input.step = opt.step ?? 1;
        input.value = cur[opt.key] !== undefined ? cur[opt.key] : opt.default;
        const outp = document.createElement('output');
        outp.textContent = input.value;
        input.addEventListener('input', () => { outp.textContent = input.value; onOptionChange(tool); });
        box.append(input, outp); wrap.append(label, box);
      } else if (opt.type === 'checkbox') {
        input = document.createElement('input'); input.type = 'checkbox';
        input.checked = cur[opt.key] !== undefined ? !!cur[opt.key] : !!opt.default;
        input.id = 'opt-' + opt.key;
        label.htmlFor = input.id;
        wrap.append(input, label);
      } else {
        input = document.createElement('input');
        input.type = opt.type === 'number' ? 'number' : opt.type === 'color' ? 'color' : 'text';
        if (opt.min !== undefined) input.min = opt.min;
        if (opt.max !== undefined) input.max = opt.max;
        if (opt.step !== undefined) input.step = opt.step;
        input.value = cur[opt.key] !== undefined ? cur[opt.key] : (opt.default ?? '');
      }
      input.dataset.key = opt.key;
      if (opt.type !== 'range' && opt.type !== 'checkbox') {
        wrap.append(label, input);
        if (opt.type === 'select') input.addEventListener('change', () => onOptionChange(tool));
      } else if (opt.type === 'checkbox') {
        input.addEventListener('change', () => onOptionChange(tool));
      }
      if (opt.hint) { const h = document.createElement('span'); h.className = 'opt-hint'; h.textContent = opt.hint; wrap.appendChild(h); }
      if (!wrap.contains(input)) wrap.appendChild(input);
      grid.appendChild(wrap);
    });
  }
  function onOptionChange(tool) {
    // 联动：单位换算的类别变化后刷新「输入单位」下拉
    if (tool.id !== 'unit-convert') return;
    const values = collectOptions();
    const cat = values.category;
    const valid = choicesOf({ key: 'unit' }, tool, values).map(c => c[0]);
    if (!valid.includes(String(values.unit))) values.unit = cat === 'temperature' ? '°C' : 'auto';
    renderOptions(tool, values);
  }
  function collectOptions() {
    const values = {};
    $$('#optionsGrid [data-key]').forEach(el => {
      values[el.dataset.key] = el.type === 'checkbox' ? el.checked :
        (el.type === 'number' || el.type === 'range') ? Number(el.value) : el.value;
    });
    return values;
  }

  /* ---------- 文件 ---------- */
  function renderFiles() {
    const box = $('#fileList');
    box.innerHTML = '';
    state.files.forEach((f, i) => {
      const row = document.createElement('div'); row.className = 'file-chip';
      row.innerHTML = `<span>📎</span><span class="fname">${U.escapeHtml(f.name)}</span><span class="fsize">${U.formatBytes(f.size)}</span><button type="button" title="移除">×</button>`;
      row.querySelector('button').addEventListener('click', e => {
        e.stopPropagation(); state.files.splice(i, 1); renderFiles();
      });
      box.appendChild(row);
    });
  }
  function addFiles(list) {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    const tool = currentTool();
    state.files = tool.multiple === false ? arr.slice(0, 1) : state.files.concat(arr);
    renderFiles();
    if (arr.length) U.toast(`已添加 ${arr.length} 个文件`, 'ok');
  }
  const dropZone = $('#dropZone'), fileInput = $('#fileInput');
  dropZone.addEventListener('click', e => { if (e.target.closest('.file-chip')) return; fileInput.click(); });
  fileInput.addEventListener('change', e => { addFiles(e.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  /* ---------- 输入区 ---------- */
  const textInput = $('#textInput');
  function updateTextMeta() {
    const s = textInput.value;
    $('#textMeta').textContent = `${Array.from(s).length} 字符 · ${new TextEncoder().encode(s).length} 字节 · ${s.split('\n').length} 行`;
  }
  textInput.addEventListener('input', updateTextMeta);
  $('#pasteBtn').addEventListener('click', async () => {
    try { textInput.value = await navigator.clipboard.readText(); updateTextMeta(); U.toast('已粘贴剪贴板内容', 'ok'); }
    catch (_) { U.toast('浏览器未授权读取剪贴板，请用 Ctrl+V 粘贴', 'err'); }
  });

  /* ---------- 工具切换 ---------- */
  function selectTool(id) {
    const tool = TOOLS.find(t => t.id === id);
    if (!tool) return;
    state.toolId = id;
    state.files = [];
    textInput.value = '';
    renderFiles(); updateTextMeta();
    $('#toolIcon').textContent = tool.icon;
    $('#toolCategory').textContent = tool.category;
    $('#toolName').textContent = tool.name;
    $('#toolDesc').textContent = tool.desc;
    $('#toolTags').innerHTML = (tool.tags || []).map(t => `<span>${U.escapeHtml(t)}</span>`).join('');

    const kind = tool.input || 'text';
    const hasFile = kind === 'file' || kind === 'both';
    const hasText = kind === 'text' || kind === 'both';
    $('.input-card').hidden = kind === 'none';
    dropZone.hidden = !hasFile;
    $('#textInputWrap').hidden = !hasText;
    fileInput.multiple = tool.multiple !== false;
    if (tool.accept) fileInput.accept = tool.accept;
    $('#acceptHint').textContent = tool.accept && tool.accept !== '*' ? `支持：${tool.accept}` : '支持任意文件，可一次选择多个';
    $('#inputHint').textContent = kind === 'both' ? '可上传文件，也可直接粘贴文本' :
      hasFile ? (tool.multiple === false ? '单文件转换' : '支持批量选择或拖入多个文件') : kind === 'none' ? '无需输入，直接点击生成' : '直接在文本框中输入或粘贴';
    textInput.placeholder = tool.placeholder || '在此粘贴或输入内容…';
    $('#runBtnText').textContent = ['qrcode', 'random-gen', 'timestamp', 'color-convert', 'unit-convert', 'text-stats', 'jwt-decode', 'hash'].includes(id) ? '生成 / 分析' : '开始转换';

    renderOptions(tool);
    $('#resultCard').hidden = true;
    $('#results').innerHTML = '';
    $('#runStatus').textContent = ''; $('#runStatus').className = 'run-status';
    $('#resultNote').hidden = true;
    renderNav($('#toolSearch').value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 结果渲染 ---------- */
  async function resultText(o) {
    if (o.text != null) return String(o.text);
    if (o.preview != null) return String(o.preview);
    try { return await o.blob.text(); } catch (_) { return ''; }
  }
  function resultCard(o, index) {
    const card = document.createElement('div');
    card.className = 'result-item';
    const head = document.createElement('div'); head.className = 'result-head';
    head.innerHTML = `<span>📄</span><span class="rname" title="${U.escapeHtml(o.filename)}">${U.escapeHtml(o.filename)}</span><span class="rmeta">${U.formatBytes(o.size || o.blob.size)} · ${o.mime || o.blob.type || ''}</span>`;
    const actions = document.createElement('div'); actions.className = 'result-actions';

    const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'mini-btn'; dl.textContent = '⬇ 下载';
    dl.addEventListener('click', () => { U.downloadBlob(o.blob, o.filename); U.toast('开始下载：' + o.filename, 'ok'); });
    actions.appendChild(dl);

    if (o.kind === 'text' || o.kind === 'html') {
      const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'mini-btn'; cp.textContent = '⧉ 复制';
      cp.addEventListener('click', async () => U.copyText(await resultText(o)));
      actions.appendChild(cp);
    }
    if (o.kind === 'html' || (o.kind === 'binary' && /pdf/i.test(o.mime || ''))) {
      const pv = document.createElement('button'); pv.type = 'button'; pv.className = 'mini-btn'; pv.textContent = '↗ 新窗口';
      pv.addEventListener('click', () => {
        const url = URL.createObjectURL(o.blob);
        const w = window.open(url, '_blank');
        if (!w) U.toast('浏览器拦截了新窗口，请改用下载按钮', 'err');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      });
      actions.appendChild(pv);
    }
    head.appendChild(actions); card.appendChild(head);

    const body = document.createElement('div'); body.className = 'result-body';
    if (o.kind === 'image') {
      const img = document.createElement('img');
      img.alt = o.filename;
      img.src = URL.createObjectURL(o.blob);
      body.appendChild(img);
    } else if (o.kind === 'html') {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', '');
      frame.setAttribute('title', 'HTML 安全预览');
      resultText(o).then(t => { frame.srcdoc = t; });
      body.appendChild(frame);
    } else if (o.kind === 'table') {
      body.innerHTML = o.preview || '';
    } else if (o.kind === 'binary') {
      const p = document.createElement('p');
      p.className = 'empty-result';
      p.textContent = /pdf/i.test(o.mime || '') ? 'PDF 文件已生成，点击「下载」保存，或「新窗口」在线预览。' : '二进制文件已生成，点击右上角「下载」保存到本地。';
      body.appendChild(p);
    } else {
      const pre = document.createElement('pre');
      resultText(o).then(t => { pre.textContent = t.length > 200000 ? t.slice(0, 200000) + '\n…（内容过长，已截断预览，下载文件为完整内容）' : t; });
      body.appendChild(pre);
    }
    card.appendChild(body);
    return card;
  }

  function renderResults(result) {
    global.__lastOutputs = result.outputs || [];
    const box = $('#results');
    box.innerHTML = '';
    const outputs = result.outputs || [];
    if (result.previewTable) {
      const card = document.createElement('div'); card.className = 'result-item';
      card.innerHTML = `<div class="result-head"><span>👀</span><span class="rname">数据预览（前 30 行）</span><span class="rmeta">只读</span></div>`;
      const body = document.createElement('div'); body.className = 'result-body'; body.innerHTML = result.previewTable;
      card.appendChild(body); box.appendChild(card);
    }
    outputs.forEach((o, i) => box.appendChild(resultCard(o, i)));
    if (!outputs.length && !result.previewTable) box.innerHTML = '<div class="empty-result">没有生成输出，请检查输入内容</div>';
    $('#resultCount').textContent = outputs.length ? `${outputs.length} 个文件` : '';
    $('#resultCard').hidden = false;
    const note = $('#resultNote');
    if (result.note) { note.textContent = result.note; note.hidden = false; } else note.hidden = true;
    $('#downloadAllBtn').hidden = outputs.length < 2;
  }

  /* ---------- 运行 ---------- */
  const runBtn = $('#runBtn'), runStatus = $('#runStatus');
  let statusTimer = null;
  async function runTool() {
    clearTimeout(statusTimer);
    const tool = currentTool();
    const opts = collectOptions();
    const ctx = {
      files: state.files.slice(),
      text: textInput.value,
      opts,
      async readText() {
        const t = textInput.value;
        if (t.trim()) return t;
        if (state.files.length) return state.files[0].text();
        throw new Error('请先输入文本或上传文件');
      },
      requireFiles() {
        if (!state.files.length) throw new Error('请先选择或拖入文件');
        return state.files;
      },
      setStatus(m) { runStatus.textContent = m; },
    };
    runBtn.disabled = true;
    runStatus.className = 'run-status';
    runStatus.textContent = '处理中…';
    try {
      const result = await tool.run(ctx);
      renderResults(result);
      runStatus.className = 'run-status ok';
      runStatus.textContent = '✓ 转换完成';
      U.toast('转换完成，结果已显示在下方', 'ok');
    } catch (err) {
      console.error(err);
      runStatus.className = 'run-status error';
      runStatus.textContent = '✗ ' + (err && err.message ? err.message : String(err));
      U.toast('转换失败：' + (err && err.message ? err.message : err), 'err');
    } finally {
      runBtn.disabled = false;
      statusTimer = setTimeout(() => { if (runStatus.textContent === '✓ 转换完成') runStatus.textContent = ''; }, 6000);
    }
  }
  runBtn.addEventListener('click', runTool);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!runBtn.disabled) runTool(); }
  });
  $('#clearBtn').addEventListener('click', () => {
    state.files = []; textInput.value = ''; renderFiles(); updateTextMeta();
    $('#resultCard').hidden = true; $('#results').innerHTML = '';
    runStatus.textContent = ''; runStatus.className = 'run-status';
    U.toast('已清空输入与结果');
  });
  $('#downloadAllBtn').addEventListener('click', async () => {
    const outputs = (global.__lastOutputs) || [];
    if (outputs.length < 2) return;
    try {
      const JSZip = U.lib('JSZip');
      const zip = new JSZip();
      outputs.forEach((o, i) => zip.file(`${String(i + 1).padStart(2, '0')}-${o.filename}`, o.blob));
      U.toast('正在打包全部结果…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      U.downloadBlob(blob, `converter-results-${U.stamp()}.zip`);
      U.toast(`已打包 ${outputs.length} 个文件`, 'ok');
    } catch (e) {
      outputs.forEach(o => U.downloadBlob(o.blob, o.filename));
      U.toast('已逐个下载（打包组件不可用）');
    }
  });
  /* ---------- 启动 ---------- */
  function checkLibs() {
    const missing = ['XLSX', 'jsyaml', 'marked', 'TurndownService', 'jspdf', 'mammoth', 'JSZip', 'QRCode']
      .filter(n => !global[n]);
    if (missing.length) {
      console.warn('部分在线组件未加载：', missing);
      setTimeout(() => U.toast(`有 ${missing.length} 个可选组件未加载，相关功能可能不可用（检查网络后刷新）`, 'err'), 1200);
    }
  }
  renderNav('');
  selectTool(TOOLS[0].id);
  checkLibs();
})(window);

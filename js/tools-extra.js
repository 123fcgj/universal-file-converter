/* =========================================================
 * tools-extra.js —— 文本处理、统计与开发者小工具
 * ========================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const registerTool = global.registerTool;
  const sel = (key, label, choices, def, hint) => ({ key, label, type: 'select', choices, default: def, hint });
  const num = (key, label, def, min, max, step) => ({ key, label, type: 'number', default: def, min, max, step });
  const range = (key, label, def, min, max, step) => ({ key, label, type: 'range', default: def, min, max, step });
  const check = (key, label, def) => ({ key, label, type: 'checkbox', default: def });
  const text = (key, label, def, hint) => ({ key, label, type: 'text', default: def, hint });

  /* ========== 22. 文本处理工具箱 ========== */
  const TRANSFORMS = {
    upper: s => s.toUpperCase(),
    lower: s => s.toLowerCase(),
    capline: s => s.split('\n').map(l => l ? l[0].toUpperCase() + l.slice(1) : l).join('\n'),
    title: s => s.replace(/\b\w/g, c => c.toUpperCase()),
    camel: s => s.split('\n').map(l => l.trim().split(/[\s_\-.]+/).filter(Boolean).map((w, i) => i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('')).join('\n'),
    snake: s => s.split('\n').map(l => l.trim().replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s\-.]+/g, '_').toLowerCase()).join('\n'),
    kebab: s => s.split('\n').map(l => l.trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_.]+/g, '-').toLowerCase()).join('\n'),
    trim: s => s.split('\n').map(l => l.trim()).join('\n'),
    noempty: s => s.split('\n').filter(l => l.trim()).join('\n'),
    dedupe: s => [...new Set(s.split('\n'))].join('\n'),
    sort: s => s.split('\n').filter(l => l.trim()).sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n'),
    rsort: s => s.split('\n').filter(l => l.trim()).sort((a, b) => b.localeCompare(a, 'zh-CN')).join('\n'),
    shuf: s => { const a = s.split('\n').filter(l => l.trim()); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join('\n'); },
    reverse: s => s.split('\n').reverse().join('\n'),
    reverseline: s => s.split('\n').map(l => Array.from(l).reverse().join('')).join('\n'),
    lf: s => s.replace(/\r\n?/g, '\n'),
    crlf: s => s.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'),
    half: s => s.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' '),
    full: s => s.replace(/[\x21-\x7E]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)).replace(/ /g, '\u3000'),
    trimall: s => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
    uniquechars: s => [...new Set(Array.from(s))].join(''),
    removehtml: s => U.stripHtml(s),
    removecomments: s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/#[^\n]*/g, ''),
  };

  registerTool({
    id: 'text-transform', name: '文本处理工具箱', icon: '✍️', category: '文本与效率',
    desc: '大小写、驼峰 / 蛇形命名、去重排序、全半角、行尾格式等 20+ 种常用文本批处理。',
    tags: ['大小写', '去重', '驼峰', '批处理'],
    input: 'text', placeholder: '粘贴需要处理的文本，每行一条记录…',
    options: [sel('action', '操作', [
      ['upper', '全部大写'], ['lower', '全部小写'], ['capline', '每行首字母大写'], ['title', '每个单词首字母大写'],
      ['camel', '转驼峰 camelCase'], ['snake', '转蛇形 snake_case'], ['kebab', '转短横线 kebab-case'],
      ['trim', '去除每行首尾空格'], ['noempty', '删除空行'], ['dedupe', '去重行（保序）'],
      ['sort', '行排序（升序）'], ['rsort', '行排序（降序）'], ['shuf', '随机打乱行'],
      ['reverse', '反转行顺序'], ['reverseline', '反转每行字符'],
      ['lf', '行尾统一为 LF'], ['crlf', '行尾统一为 CRLF'],
      ['half', '全角 → 半角'], ['full', '半角 → 全角'],
      ['trimall', '压缩多余空格与空行'], ['uniquechars', '提取不重复字符'],
      ['removehtml', '去除 HTML 标签'], ['removecomments', '去除代码注释'],
    ], 'dedupe')],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw) throw new Error('请输入文本');
      const fn = TRANSFORMS[ctx.opts.action] || (s => s);
      const result = fn(raw);
      return { outputs: [U.textOut(`text-${ctx.opts.action}-${U.stamp()}.txt`, result, 'text')], note: `输入 ${raw.length} 字符 → 输出 ${result.length} 字符。` };
    },
  });

  /* ========== 23. 文本统计 ========== */
  registerTool({
    id: 'text-stats', name: '文本统计与词频', icon: '📈', category: '文本与效率',
    desc: '统计字符、中文、单词、行数、字节与阅读时长，并列出高频词 Top 15。',
    tags: ['字数统计', '词频', '分析'],
    input: 'text', placeholder: '粘贴需要统计的文本…',
    options: [check('freq', '输出词频 Top 15', true), num('wpm', '阅读速度（字/分钟）', 300, 50, 1000, 50)],
    async run(ctx) {
      const s = await ctx.readText();
      if (!s) throw new Error('请输入文本');
      const chars = Array.from(s).length;
      const noSpace = Array.from(s.replace(/\s/g, '')).length;
      const chinese = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
      const words = (s.match(/[A-Za-z0-9_'-]+/g) || []).length;
      const lines = s.split(/\r\n|\r|\n/).length;
      const paragraphs = s.split(/\n\s*\n/).filter(p => p.trim()).length;
      const bytes = new TextEncoder().encode(s).length;
      const minutes = noSpace / (Number(ctx.opts.wpm) || 300);
      const rows = [
        ['字符总数（含空格）', chars], ['字符数（不含空白）', noSpace], ['中文字数', chinese],
        ['英文单词数', words], ['行数', lines], ['段落数', paragraphs],
        ['UTF-8 字节数', bytes + ' B (' + U.formatBytes(bytes) + ')'],
        ['预计阅读时长', minutes < 1 ? '不足 1 分钟' : minutes.toFixed(1) + ' 分钟'],
        ['数字个数', (s.match(/\d/g) || []).length], ['标点符号', (s.match(/[，。！？；：、,.!?;:]/g) || []).length],
      ];
      let report = '📊 文本统计报告\n' + '─'.repeat(34) + '\n' +
        rows.map(r => `${r[0].padEnd(20, ' ')} ${r[1]}`).join('\n');
      if (ctx.opts.freq) {
        const freq = new Map();
        (s.match(/[\u4e00-\u9fa5]|[A-Za-z][A-Za-z'-]*/g) || []).forEach(w => {
          w = w.length > 1 ? w.toLowerCase() : w;
          freq.set(w, (freq.get(w) || 0) + 1);
        });
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        report += '\n\n🔤 高频词 Top 15\n' + '─'.repeat(34) + '\n' +
          top.map(([w, n], i) => `${String(i + 1).padStart(2)}. ${w.padEnd(14, ' ')} ${n} 次`).join('\n');
      }
      return { outputs: [U.textOut(`text-stats-${U.stamp()}.txt`, report, 'text')] };
    },
  });

  /* ========== 24. 颜色格式转换 ========== */
  function parseColor(input) {
    const s = String(input).trim().toLowerCase();
    let m, r, g, b, a = 1;
    if ((m = /^#?([0-9a-f]{3})$/.exec(s))) { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
    else if ((m = /^#?([0-9a-f]{6})$/.exec(s))) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
    else if ((m = /^#?([0-9a-f]{8})$/.exec(s))) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); a = parseInt(m[1].slice(6, 8), 16) / 255; }
    else if ((m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(s))) {
      r = +m[1]; g = +m[2]; b = +m[3]; if (m[4]) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    } else if ((m = /^hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(s))) {
      const h = +m[1] / 360, sat = +m[2] / 100, li = +m[3] / 100;
      const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
      if (sat === 0) { r = g = b = li * 255; } else {
        const q = li < .5 ? li * (1 + sat) : li + sat - li * sat, p = 2 * li - q;
        r = hue2rgb(p, q, h + 1 / 3) * 255; g = hue2rgb(p, q, h) * 255; b = hue2rgb(p, q, h - 1 / 3) * 255;
      }
      if (m[4]) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    } else {
      const probe = document.createElement('span');
      probe.style.color = ''; probe.style.display = 'none';
      probe.style.color = s;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();
      const mm = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(computed);
      if (!mm || computed === 'rgb(0, 0, 0)' && s !== 'black') throw new Error('无法识别颜色：' + input + '（试试 #5566f5 / rgb(85,102,245) / hsl(232,89%,65%)）');
      r = +mm[1]; g = +mm[2]; b = +mm[3]; a = mm[4] ? +mm[4] : 1;
    }
    return { r: Math.round(Math.min(255, Math.max(0, r))), g: Math.round(Math.min(255, Math.max(0, g))), b: Math.round(Math.min(255, Math.max(0, b))), a: Math.min(1, Math.max(0, a)) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  registerTool({
    id: 'color-convert', name: '颜色格式转换', icon: '🎨', category: '开发者工具',
    desc: 'HEX / RGB / HSL / CMYK / CSS 变量互转，支持颜色名，附带实时色块预览。',
    tags: ['HEX', 'RGB', 'HSL', 'CMYK'],
    input: 'text', placeholder: '#5566f5 或 rgb(85,102,245) 或 hsl(232,89%,65%) 或 rebeccapurple',
    options: [check('cssvar', '额外输出 CSS 变量片段', true)],
    async run(ctx) {
      const c = parseColor((await ctx.readText()).trim());
      const hex = '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      const hsl = rgbToHsl(c.r, c.g, c.b);
      const rr = c.r / 255, gg = c.g / 255, bb = c.b / 255, k = 1 - Math.max(rr, gg, bb);
      const cmyk = k === 1 ? [0, 0, 0, 100] : [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k];
      const lines = [
        `HEX      ${hex}`, `HEX 8位  ${hex}${Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase()}`,
        `RGB      rgb(${c.r}, ${c.g}, ${c.b})`, `RGBA     rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(3)})`,
        `HSL      hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, `HSLA     hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${+c.a.toFixed(3)})`,
        `CMYK     ${cmyk.map(v => Math.round(v * 100)).join('%, ')}%`,
        `INT      ${(c.r << 16) | (c.g << 8) | c.b}`,
      ];
      if (ctx.opts.cssvar) lines.push('', `:root {`, `  --color-primary: ${hex.toLowerCase()};`, `  --color-primary-rgb: ${c.r}, ${c.g}, ${c.b};`, `}`);
      const preview = U.htmlDocument('颜色预览', `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:28px 0"><div style="width:130px;height:130px;border-radius:20px;background:${hex};box-shadow:0 8px 24px rgba(0,0,0,.15);border:1px solid #e4e8f3"></div><div><h2 style="margin:0 0 6px">${hex}</h2><p style="margin:0;color:#5c6680">rgb(${c.r}, ${c.g}, ${c.b}) · hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)</p></div></div><div style="display:flex;height:44px;border-radius:10px;overflow:hidden">${[0, .2, .4, .6, .8, 1].map(o => `<div style="flex:1;background:rgba(${c.r},${c.g},${c.b},${o})"></div>`).join('')}</div>`);
      return {
        outputs: [U.textOut(`color-${hex.slice(1)}.txt`, lines.join('\n'), 'text'),
          U.textOut(`color-${hex.slice(1)}-preview.html`, preview, 'html')],
      };
    },
  });

  /* ========== 25. 进制转换 ========== */
  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
  function fromBase(str, base) {
    let n = 0n;
    for (const ch of str.toLowerCase()) {
      const d = DIGITS.indexOf(ch);
      if (d < 0 || d >= base) throw new Error(`字符 "${ch}" 不属于 ${base} 进制`);
      n = n * BigInt(base) + BigInt(d);
    }
    return n;
  }
  function toBase(n, base) {
    if (n === 0n) return '0';
    const neg = n < 0n; if (neg) n = -n;
    let s = '';
    while (n > 0n) { s = DIGITS[Number(n % BigInt(base))] + s; n /= BigInt(base); }
    return (neg ? '-' : '') + s;
  }
  registerTool({
    id: 'number-base', name: '进制转换（支持大数）', icon: '🔢', category: '开发者工具',
    desc: '2 / 8 / 10 / 16 / 32 / 36 进制互转，使用 BigInt 支持任意大整数，可批量逐行转换。',
    tags: ['二进制', '十六进制', 'BigInt'],
    input: 'text', placeholder: '每行输入一个数值，例如：\n255\nFF\n1010',
    options: [sel('from', '原进制', [['2', '2 二进制'], ['8', '8 八进制'], ['10', '10 十进制'], ['16', '16 十六进制'], ['32', '32 进制'], ['36', '36 进制']], '10'),
      sel('to', '目标进制', [['2', '2 二进制'], ['8', '8 八进制'], ['10', '10 十进制'], ['16', '16 十六进制'], ['32', '32 进制'], ['36', '36 进制']], '16'),
      check('group', '每 4 位空格分组', true)],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw.trim()) throw new Error('请输入数值');
      const from = Number(ctx.opts.from), to = Number(ctx.opts.to);
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
        const clean = l.replace(/^0[xXbBoO]/, '').replace(/[_\s]/g, '');
        try {
          let s = toBase(fromBase(clean.startsWith('-') ? clean.slice(1) : clean, from), to);
          if (clean.startsWith('-')) s = '-' + s;
          if (to === 16) s = s.toUpperCase();
          if (ctx.opts.group && to !== 10) s = s.replace(/\B(?=(\w{4})+(?!\w))/g, ' ');
          return `${l}  →  ${s}`;
        } catch (e) { return `${l}  →  ⚠ ${e.message}`; }
      });
      return { outputs: [U.textOut(`base${from}to${to}-${U.stamp()}.txt`, lines.join('\n'), 'text')], note: `${from} 进制 → ${to} 进制，共 ${lines.length} 行。` };
    },
  });

  /* ========== 26. 时间戳转换 ========== */
  registerTool({
    id: 'timestamp', name: 'Unix 时间戳转换', icon: '⏰', category: '开发者工具',
    desc: '时间戳与日期时间互转，自动识别秒 / 毫秒，支持批量、UTC 与本地时区。',
    tags: ['Unix', '时间戳', '时区'],
    input: 'text', placeholder: '留空则显示当前时间；也可每行一个时间戳或日期，如：\n1700000000\n2024-01-01 08:00:00',
    options: [sel('direction', '方向', [['auto', '自动识别'], ['ts2date', '时间戳 → 日期'], ['date2ts', '日期 → 时间戳']], 'auto'),
      sel('unit', '时间戳单位', [['auto', '自动（10 位=秒 / 13 位=毫秒）'], ['s', '秒'], ['ms', '毫秒']], 'auto'),
      check('utc', '使用 UTC 时区', false)],
    async run(ctx) {
      const raw = (await ctx.readText()).trim();
      const inputs = raw ? raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [String(Date.now())];
      const fmt = d => {
        const p = n => String(n).padStart(2, '0');
        const date = ctx.opts.utc
          ? `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`
          : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        return date;
      };
      const lines = inputs.map(s => {
        const isNum = /^-?\d+(\.\d+)?$/.test(s);
        const mode = ctx.opts.direction === 'auto' ? (isNum ? 'ts2date' : 'date2ts') : ctx.opts.direction;
        if (mode === 'date2ts') {
          const d = new Date(s.replace(/-/g, '/'));
          if (isNaN(d.getTime())) return `${s}  →  ⚠ 无法识别日期，请使用 YYYY-MM-DD HH:mm:ss 格式`;
          return `${s}  →  秒 ${Math.floor(d.getTime() / 1000)}  |  毫秒 ${d.getTime()}  |  ${fmt(d)}`;
        }
        if (!isNum) return `${s}  →  ⚠ 不是有效时间戳`;
        let n = Number(s);
        const unit = ctx.opts.unit === 'auto' ? (Math.abs(n) < 1e11 ? 's' : 'ms') : ctx.opts.unit;
        if (unit === 's') n *= 1000;
        const d = new Date(n);
        if (isNaN(d.getTime())) return `${s}  →  ⚠ 超出日期范围`;
        return `${s}  →  ${fmt(d)}  |  秒 ${Math.floor(d.getTime() / 1000)}  |  毫秒 ${d.getTime()}`;
      });
      const header = `当前时间：${fmt(new Date())}  |  Unix 秒 ${Math.floor(Date.now() / 1000)}  |  毫秒 ${Date.now()}\n${'─'.repeat(50)}\n`;
      return { outputs: [U.textOut(`timestamp-${U.stamp()}.txt`, header + lines.join('\n') + '\n', 'text')] };
    },
  });

  /* ========== 27. 随机生成 ========== */
  function randomChars(length, charset) {
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => charset[b % charset.length]).join('');
  }
  function uuidv4() {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  registerTool({
    id: 'random-gen', name: 'UUID / 随机密码生成', icon: '🎲', category: '开发者工具',
    desc: '使用浏览器加密级随机源生成 UUID v4、强密码、随机字符串与十六进制串。',
    tags: ['UUID', '密码', '随机'],
    input: 'none', options: [
      sel('type', '生成类型', [['uuid', 'UUID v4'], ['password', '强密码'], ['string', '随机字符串'], ['hex', '随机十六进制'], ['number', '随机数字'], ['nanoid', 'NanoID 风格 ID']], 'uuid'),
      range('count', '生成数量', 5, 1, 100, 1),
      range('length', '长度（UUID 除外）', 16, 4, 128, 1),
      check('upper', '包含大写字母', true), check('lower', '包含小写字母', true),
      check('digits', '包含数字', true), check('symbols', '包含符号 !@#$…', true),
    ],
    async run(ctx) {
      const count = Number(ctx.opts.count) || 5, len = Math.min(128, Number(ctx.opts.length) || 16);
      let charset = (ctx.opts.upper ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : '') + (ctx.opts.lower ? 'abcdefghijkmnopqrstuvwxyz' : '') +
        (ctx.opts.digits ? '23456789' : '') + (ctx.opts.symbols ? '!@#$%^&*()-_=+' : '');
      if (!charset) charset = 'abcdefghijkmnopqrstuvwxyz23456789';
      const gen = () => {
        switch (ctx.opts.type) {
          case 'uuid': return uuidv4();
          case 'hex': return randomChars(len, '0123456789abcdef');
          case 'number': return randomChars(len, '0123456789');
          case 'nanoid': return randomChars(len, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-');
          case 'password': {
            let s = '';
            const groups = [];
            if (ctx.opts.upper) groups.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
            if (ctx.opts.lower) groups.push('abcdefghijkmnopqrstuvwxyz');
            if (ctx.opts.digits) groups.push('23456789');
            if (ctx.opts.symbols) groups.push('!@#$%^&*()-_=+');
            if (!groups.length) groups.push(charset);
            s += groups.map(g => g[crypto.getRandomValues(new Uint32Array(1))[0] % g.length]).join('');
            s += randomChars(Math.max(0, len - s.length), groups.join(''));
            return Array.from(s).sort(() => crypto.getRandomValues(new Uint32Array(1))[0] % 2 ? 1 : -1).join('');
          }
          default: return randomChars(len, charset);
        }
      };
      const lines = Array.from({ length: count }, gen);
      return { outputs: [U.textOut(`${ctx.opts.type}-${U.stamp()}.txt`, lines.join('\n') + '\n', 'text')], note: `已生成 ${count} 条，使用 crypto.getRandomValues 加密级随机源。` };
    },
  });

  /* ========== 28. JWT 解码 ========== */
  registerTool({
    id: 'jwt-decode', name: 'JWT 解码分析', icon: '🔑', category: '开发者工具',
    desc: '解析 JWT 的 Header 与 Payload，展示签发 / 过期时间与剩余有效期（仅解码，不校验签名）。',
    tags: ['JWT', 'Token', '调试'],
    input: 'text', placeholder: '粘贴 eyJhbGciOi... 形式的 JWT Token',
    options: [],
    async run(ctx) {
      const token = (await ctx.readText()).trim().replace(/^Bearer\s+/i, '');
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('JWT 格式不正确，应包含用 . 分隔的三段');
      const decode = s => JSON.parse(U.b64decode(s.replace(/-/g, '+').replace(/_/g, '/')));
      let header, payload;
      try { header = decode(parts[0]); payload = decode(parts[1]); }
      catch (e) { throw new Error('JWT 内容解析失败：' + e.message); }
      const timeInfo = n => n ? `${new Date(n * 1000).toLocaleString('zh-CN')}（${n}）` : '未设置';
      const now = Math.floor(Date.now() / 1000);
      const status = payload.exp ? (payload.exp < now ? '⚠ 已过期' : `✓ 有效，剩余 ${payload.exp - now} 秒`) : '未设置过期时间';
      const report = [
        '🔑 JWT 解码结果', '─'.repeat(40),
        '【Header 头部】', JSON.stringify(header, null, 2), '',
        '【Payload 载荷】', JSON.stringify(payload, null, 2), '',
        '【时间信息】', `iat 签发时间：${timeInfo(payload.iat)}`, `nbf 生效时间：${timeInfo(payload.nbf)}`,
        `exp 过期时间：${timeInfo(payload.exp)}`, `当前状态：${status}`, '',
        '【声明字段】', Object.keys(payload).join(', ') || '（无）', '',
        '【说明】仅做 Base64URL 解码，不会验证签名，请勿据此判断 Token 是否可信。',
      ].join('\n');
      return { outputs: [U.textOut(`jwt-decoded-${U.stamp()}.txt`, report, 'text')], note: '签名部分未解码（需要密钥验证），本工具仅用于调试查看。' };
    },
  });

  /* ========== 29. 单位换算 ========== */
  const UNITS = global.UNITS = {
    length: { name: '长度', base: 'm', list: [['nm', 1e-9], ['μm', 1e-6], ['mm', 0.001], ['cm', 0.01], ['m', 1], ['km', 1000], ['in', 0.0254], ['ft', 0.3048], ['yd', 0.9144], ['mi', 1609.344], ['海里', 1852], ['里', 500], ['丈', 3.3333], ['尺', 0.3333]] },
    mass: { name: '质量', base: 'kg', list: [['mg', 1e-6], ['g', 0.001], ['kg', 1], ['t', 1000], ['oz', 0.0283495], ['lb', 0.453592], ['斤', 0.5], ['两', 0.05], ['克拉', 0.0002]] },
    area: { name: '面积', base: 'm²', list: [['mm²', 1e-6], ['cm²', 1e-4], ['m²', 1], ['km²', 1e6], ['公顷', 10000], ['亩', 666.667], ['ft²', 0.092903], ['acre 英亩', 4046.86]] },
    volume: { name: '体积', base: 'L', list: [['mL', 0.001], ['L', 1], ['m³', 1000], ['cm³', 0.001], ['gal 美制', 3.78541], ['qt', 0.946353], ['pt', 0.473176], ['fl oz', 0.0295735]] },
    data: { name: '数据存储', base: 'B', list: [['bit', 0.125], ['B', 1], ['KB', 1024], ['MB', 1048576], ['GB', 1073741824], ['TB', 1099511627776], ['KiB', 1024], ['MiB', 1048576], ['GiB', 1073741824]] },
    time: { name: '时间', base: 's', list: [['ms', 0.001], ['s', 1], ['min', 60], ['h', 3600], ['天', 86400], ['周', 604800], ['月(30天)', 2592000], ['年(365天)', 31536000]] },
    speed: { name: '速度', base: 'm/s', list: [['m/s', 1], ['km/h', 1 / 3.6], ['mph', 0.44704], ['kn 节', 0.514444], ['ft/s', 0.3048], ['马赫(340m/s)', 340]] },
    temperature: { name: '温度', base: '°C', list: [] },
  };
  registerTool({
    id: 'unit-convert', name: '单位换算', icon: '📐', category: '开发者工具',
    desc: '一次查看长度、质量、面积、存储、时间、速度、温度在全部常用单位下的换算结果。',
    tags: ['单位', '换算', '计量'],
    input: 'text', placeholder: '输入数值，例如 100 或 3.14',
    options: [sel('category', '类别', Object.keys(UNITS).map(k => [k, UNITS[k].name]), 'length'),
      sel('unit', '输入单位', [['auto', '自动（按类别首单位）']], 'auto'),
      range('precision', '小数位', 6, 0, 12, 1)],
    async run(ctx) {
      const raw = (await ctx.readText()).trim();
      const value = Number(raw.replace(/,/g, ''));
      if (!isFinite(value)) throw new Error('请输入有效数值');
      const cat = UNITS[ctx.opts.category];
      const p = Number(ctx.opts.precision) || 0;
      const fmt = n => {
        if (n === 0) return '0';
        const abs = Math.abs(n);
        if (abs >= 1e12 || abs < 1e-6) return n.toExponential(Math.min(p, 8));
        return Number(n.toFixed(p)).toString();
      };
      let lines;
      if (ctx.opts.category === 'temperature') {
        const C = ctx.opts.unit === '°F' ? (value - 32) * 5 / 9 : ctx.opts.unit === 'K' ? value - 273.15 : ctx.opts.unit === '°R' ? (value - 491.67) * 5 / 9 : value;
        lines = [`${fmt(value)} ${ctx.opts.unit} 等于：`, `  ${fmt(C)} °C 摄氏度`, `  ${fmt(C * 9 / 5 + 32)} °F 华氏度`, `  ${fmt(C + 273.15)} K 开尔文`, `  ${fmt((C + 273.15) * 9 / 5)} °R 兰氏度`];
      } else {
        const unitName = ctx.opts.unit === 'auto' ? (cat.list.find(u => u[1] === 1) || cat.list[0])[0] : ctx.opts.unit;
        const def = cat.list.find(u => u[0] === unitName);
        if (!def) throw new Error('未知单位，请重新选择');
        const baseValue = value * def[1];
        lines = [`${fmt(value)} ${unitName} 等于：`, ...cat.list.map(([n, f]) => `  ${fmt(baseValue / f)} ${n}`)];
      }
      return { outputs: [U.textOut(`unit-${ctx.opts.category}-${U.stamp()}.txt`, lines.join('\n') + '\n', 'text')], note: `${cat.name}换算，结果保留最多 ${p} 位小数。` };
    },
  });

})(window);

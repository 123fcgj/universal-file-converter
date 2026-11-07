/* =========================================================
 * converters.js —— 图片 / 文档 / 数据 类转换器注册表
 * 每个工具: { id, name, icon, category, desc, tags, input,
 *             accept, multiple, placeholder, options, run }
 * run(ctx) 返回 { outputs: [...], note? }
 * ctx = { files, text, opts, readText(), requireFiles(), setStatus() }
 * ========================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  global.CONVERTERS = [];
  const registerTool = (t) => global.CONVERTERS.push(t);
  global.registerTool = registerTool;

  const sel = (key, label, choices, def, hint) => ({ key, label, type: 'select', choices, default: def, hint });
  const num = (key, label, def, min, max, step, hint) => ({ key, label, type: 'number', default: def, min, max, step, hint });
  const range = (key, label, def, min, max, step, hint) => ({ key, label, type: 'range', default: def, min, max, step, hint });
  const check = (key, label, def, hint) => ({ key, label, type: 'checkbox', default: def, hint });
  const text = (key, label, def, hint) => ({ key, label, type: 'text', default: def, hint });

  /* ---------- 图片公共处理 ---------- */
  async function imageToCanvas(file, opts) {
    const img = await U.loadImage(file);
    let w = img.naturalWidth || img.width || 800;
    let h = img.naturalHeight || img.height || 600;
    const ow = Number(opts.width) || 0, oh = Number(opts.height) || 0;
    if (ow > 0 || oh > 0) {
      if (opts.mode === 'stretch') { w = ow || w; h = oh || h; }
      else {
        let scale = 1;
        if (ow > 0 && oh > 0) scale = Math.min(ow / w, oh / h);
        else if (ow > 0) scale = ow / w;
        else scale = oh / h;
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (opts.bg !== 'transparent' && opts.format !== 'png') { ctx.fillStyle = opts.bg || '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }
  async function canvasToOutput(canvas, format, quality) {
    if (format === 'bmp') return U.encodeBMP(canvas);
    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
    return U.canvasToBlob(canvas, mimeMap[format] || 'image/png', quality / 100);
  }

  /* ========== 1. 图片格式转换 ========== */
  registerTool({
    id: 'image-convert', name: '图片格式转换', icon: '🖼️', category: '图片与视觉',
    desc: 'PNG / JPG / WebP / BMP / GIF / SVG 互转，支持批量、等比缩放、画质调节与透明背景填充。',
    tags: ['PNG', 'JPG', 'WebP', 'BMP', '批量'],
    input: 'file', accept: 'image/*,.svg,.bmp,.webp', multiple: true,
    options: [
      sel('format', '输出格式', [['png', 'PNG（无损 / 透明）'], ['jpeg', 'JPG（体积小）'], ['webp', 'WebP（现代压缩）'], ['bmp', 'BMP（无压缩）']], 'png'),
      range('quality', '画质（JPG / WebP）', 90, 10, 100, 5),
      sel('mode', '缩放方式', [['ratio', '保持比例'], ['stretch', '拉伸到指定尺寸']], 'ratio'),
      num('width', '宽度 px（0 = 自适应）', 0, 0, 10000),
      num('height', '高度 px（0 = 自适应）', 0, 0, 10000),
      { key: 'bg', label: '透明背景填充色', type: 'color', default: '#ffffff', hint: 'PNG 输出保留透明' },
    ],
    async run(ctx) {
      const files = ctx.requireFiles();
      const outputs = [];
      for (let i = 0; i < files.length; i++) {
        ctx.setStatus(`正在处理 ${i + 1} / ${files.length}：${U.baseName(files[i].name)}`);
        const canvas = await imageToCanvas(files[i], ctx.opts);
        const blob = await canvasToOutput(canvas, ctx.opts.format, Number(ctx.opts.quality) || 90);
        const ext = ctx.opts.format === 'jpeg' ? 'jpg' : ctx.opts.format;
        outputs.push(U.out(U.replaceExt(files[i].name, ext), blob, { kind: 'image', mime: blob.type }));
      }
      return { outputs, note: `共转换 ${outputs.length} 张图片，尺寸与画质按选项处理。GIF 动图仅取第一帧。` };
    },
  });

  /* ========== 2. 图片合并为 PDF ========== */
  registerTool({
    id: 'images-to-pdf', name: '图片合并为 PDF', icon: '📑', category: '图片与视觉',
    desc: '把多张图片按顺序合并成一个 PDF，支持 A4 排版或按图片比例自适应页面。',
    tags: ['PDF', '多图合并', '扫描件'],
    input: 'file', accept: 'image/*', multiple: true,
    options: [
      sel('page', '页面尺寸', [['a4', 'A4 标准页面'], ['fit', '匹配图片比例']], 'a4'),
      sel('orientation', '方向', [['portrait', '纵向'], ['landscape', '横向']], 'portrait'),
      range('margin', '页边距 px', 40, 0, 120, 10),
    ],
    async run(ctx) {
      const files = ctx.requireFiles();
      const jsPDF = U.lib('jsPDF');
      const images = [];
      for (const f of files) images.push(await U.loadImage(f));
      const margin = Number(ctx.opts.margin) || 0;
      let blob;
      if (ctx.opts.page === 'fit') {
        let pdf = null;
        for (const img of images) {
          const w = img.naturalWidth || 800, h = img.naturalHeight || 600;
          const pw = 595, ph = Math.round(pw * h / w);
          if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [pw, ph], orientation: ph > pw ? 'portrait' : 'landscape', compress: true });
          else pdf.addPage([pw, ph], ph > pw ? 'portrait' : 'landscape');
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
          pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
        }
        blob = new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
      } else {
        const landscape = ctx.opts.orientation === 'landscape';
        const W = landscape ? 1123 : 794, H = landscape ? 794 : 1123;
        const canvases = images.map(img => {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
          const iw = img.naturalWidth || 800, ih = img.naturalHeight || 600;
          const aw = W - margin * 2, ah = H - margin * 2;
          const scale = Math.min(aw / iw, ah / ih);
          const dw = iw * scale, dh = ih * scale;
          cx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
          return c;
        });
        blob = U.makePdf(canvases, ctx.opts.orientation);
      }
      return { outputs: [U.out(`图片合集-${U.stamp()}.pdf`, blob, { kind: 'binary' })], note: `已将 ${images.length} 张图片合并为 1 个 PDF。` };
    },
  });

  /* ========== 3. 图片转 Base64 ========== */
  registerTool({
    id: 'image-to-base64', name: '图片转 Base64', icon: '🔤', category: '图片与视觉',
    desc: '把图片编码成 Base64、Data URL、HTML img 标签或 CSS 背景，方便内嵌到代码里。',
    tags: ['Base64', 'DataURL', '前端开发'],
    input: 'file', accept: 'image/*', multiple: false,
    options: [sel('form', '输出形式', [['dataurl', 'Data URL（可直接用于 src）'], ['base64', '纯 Base64 字符串'], ['html', 'HTML <img> 标签'], ['css', 'CSS background'], ['markdown', 'Markdown 图片语法']], 'dataurl')],
    async run(ctx) {
      const f = ctx.requireFiles()[0];
      const dataUrl = await U.readAsDataURL(f);
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const form = ctx.opts.form;
      let result;
      if (form === 'base64') result = b64;
      else if (form === 'html') result = `<img src="${dataUrl}" alt="${U.escapeHtml(U.stripExt(f.name))}" />`;
      else if (form === 'css') result = `background-image: url("${dataUrl}");`;
      else if (form === 'markdown') result = `![${U.stripExt(f.name)}](${dataUrl})`;
      else result = dataUrl;
      return { outputs: [U.textOut(`${U.stripExt(f.name)}-base64.txt`, result, 'text')], note: `原始大小 ${U.formatBytes(f.size)}，编码后文本约 ${U.formatBytes(result.length)}（Base64 通常增大约 33%）。` };
    },
  });

  /* ========== 4. Base64 转文件 ========== */
  registerTool({
    id: 'base64-to-file', name: 'Base64 转文件', icon: '📦', category: '图片与视觉',
    desc: '把 Base64 或 Data URL 还原成原始文件，自动识别 PNG / JPG / PDF / ZIP 等常见类型。',
    tags: ['Base64', 'DataURL', '还原'],
    input: 'text', placeholder: '粘贴 Base64 字符串或 data:image/png;base64,…… 形式的 Data URL',
    options: [text('filename', '输出文件名（留空自动推断）', '')],
    async run(ctx) {
      const raw = (await ctx.readText()).trim();
      if (!raw) throw new Error('请输入 Base64 或 Data URL 内容');
      const parsed = U.parseDataURL(raw);
      let mime, b64;
      if (parsed) {
        mime = parsed.mime;
        b64 = parsed.base64 ? parsed.data : U.b64encode(decodeURIComponent(parsed.data));
      } else { mime = ''; b64 = raw; }
      const bytes = U.b64ToBytes(b64);
      if (!bytes.length) throw new Error('未解析到有效数据，请检查 Base64 内容');
      const head = U.bytesToB64(bytes.subarray(0, 12));
      let ext = 'bin';
      if (/^iVBOR/.test(head)) { ext = 'png'; mime = mime || 'image/png'; }
      else if (/^\/9j\//.test(head)) { ext = 'jpg'; mime = mime || 'image/jpeg'; }
      else if (/^R0lGOD/.test(head)) { ext = 'gif'; mime = mime || 'image/gif'; }
      else if (/^Qk0/.test(head)) { ext = 'bmp'; mime = mime || 'image/bmp'; }
      else if (/^UklGR/.test(head)) {
        const tag = new TextDecoder().decode(bytes.subarray(8, 12));
        ext = tag === 'WEBP' ? 'webp' : (tag === 'WAVE' ? 'wav' : 'bin');
        mime = mime || (ext === 'webp' ? 'image/webp' : ext === 'wav' ? 'audio/wav' : 'application/octet-stream');
      }
      else if (/^JVBERi0/.test(head)) { ext = 'pdf'; mime = mime || 'application/pdf'; }
      else if (/^UEsDB/.test(head)) { ext = 'zip'; mime = mime || 'application/zip'; }
      else if (/^PK/.test(new TextDecoder().decode(bytes.subarray(0, 2)))) { ext = 'zip'; mime = mime || 'application/zip'; }
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('png')) ext = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      else {
        const s = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 200));
        if (!s.includes('\uFFFD')) ext = 'txt';
      }
      const name = ctx.opts.filename.trim() ? ctx.opts.filename.trim() : `decoded-${U.stamp()}.${ext}`;
      const isText = ext === 'txt' || ext === 'svg' || mime.startsWith('text/');
      return {
        outputs: [U.out(name, bytes, { mime: mime || U.mimeOf(ext), kind: isText ? 'text' : (mime.startsWith('image/') ? 'image' : 'binary'),
          preview: isText ? new TextDecoder().decode(bytes) : undefined })],
        note: `已还原 ${U.formatBytes(bytes.length)}，识别类型：${mime || 'application/octet-stream'}。`,
      };
    },
  });

  /* ========== 5. 二维码生成 ========== */
  registerTool({
    id: 'qrcode', name: '二维码生成', icon: '🔳', category: '图片与视觉',
    desc: '把网址、文本、名片信息生成二维码 PNG，可调整尺寸、颜色与纠错级别。',
    tags: ['二维码', 'QR Code', 'PNG'],
    input: 'text', placeholder: '输入网址或任意文本，例如 https://example.com',
    options: [
      range('size', '尺寸 px', 320, 96, 1024, 16),
      sel('level', '纠错级别', [['L', 'L · 7%'], ['M', 'M · 15%'], ['Q', 'Q · 25%'], ['H', 'H · 30%']], 'M'),
      { key: 'dark', label: '前景色', type: 'color', default: '#1d2333' },
      { key: 'light', label: '背景色', type: 'color', default: '#ffffff' },
      range('padding', '静区留白 px', 16, 0, 64, 4),
    ],
    async run(ctx) {
      const QRCode = U.lib('QRCode');
      const content = (await ctx.readText()).trim();
      if (!content) throw new Error('请输入要生成二维码的内容');
      const size = Number(ctx.opts.size) || 320;
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:-99999px;top:0';
      document.body.appendChild(holder);
      try {
        new QRCode(holder, {
          text: content, width: size, height: size,
          colorDark: ctx.opts.dark, colorLight: ctx.opts.light,
          correctLevel: QRCode.CorrectLevel[ctx.opts.level] || QRCode.CorrectLevel.M,
        });
        await new Promise(r => setTimeout(r, 150));
        const src = holder.querySelector('canvas');
        if (!src) throw new Error('二维码绘制失败，请刷新页面重试');
        const pad = Number(ctx.opts.padding) || 0;
        const canvas = document.createElement('canvas');
        canvas.width = size + pad * 2; canvas.height = size + pad * 2;
        const cx = canvas.getContext('2d');
        cx.fillStyle = ctx.opts.light; cx.fillRect(0, 0, canvas.width, canvas.height);
        cx.drawImage(src, pad, pad, size, size);
        const blob = await U.canvasToBlob(canvas, 'image/png');
        return { outputs: [U.out(`qrcode-${U.stamp()}.png`, blob, { kind: 'image' })], note: `内容长度 ${content.length} 字符，纠错级别 ${ctx.opts.level}。` };
      } finally { holder.remove(); }
    },
  });

  /* ========== 6. 图片转字符画 ========== */
  registerTool({
    id: 'image-to-ascii', name: '图片转字符画', icon: '🎨', category: '图片与视觉',
    desc: '把图片转换成由字符组成的 ASCII / 灰度艺术画，可自定义宽度与字符集。',
    tags: ['ASCII', '字符画', '趣味'],
    input: 'file', accept: 'image/*', multiple: false,
    options: [
      range('cols', '字符宽度', 80, 20, 200, 10),
      sel('charset', '字符集', [['@%#*+=-:. ', '经典灰度 @%#*+=-:. '], ['█▓▒░ ', '方块 █▓▒░'], ['01 ', '二进制 01'], [' .:-=+*#%@', '反相 .:-=+*#%@']], '@%#*+=-:. '),
      check('invert', '反色', false),
    ],
    async run(ctx) {
      const f = ctx.requireFiles()[0];
      const img = await U.loadImage(f);
      const iw = img.naturalWidth || 400, ih = img.naturalHeight || 300;
      const cols = Number(ctx.opts.cols) || 80;
      const rows = Math.max(1, Math.round(cols * ih / iw * 0.5));
      const c = document.createElement('canvas'); c.width = cols; c.height = rows;
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cols, rows); cx.drawImage(img, 0, 0, cols, rows);
      const d = cx.getImageData(0, 0, cols, rows).data;
      const chars = ctx.opts.charset || '@%#*+=-:. ';
      const lines = [];
      for (let y = 0; y < rows; y++) {
        let line = '';
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const a = d[i + 3] / 255;
          const r = d[i] * a + 255 * (1 - a), g = d[i + 1] * a + 255 * (1 - a), b = d[i + 2] * a + 255 * (1 - a);
          let gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (ctx.opts.invert) gray = 1 - gray;
          line += chars[Math.min(chars.length - 1, Math.floor((1 - gray) * chars.length))];
        }
        lines.push(line.replace(/\s+$/, ''));
      }
      const result = lines.join('\n');
      return { outputs: [U.textOut(`${U.stripExt(f.name)}-ascii.txt`, result, 'text')], note: `生成 ${cols} × ${rows} 字符画，建议在等宽字体下查看。` };
    },
  });

  /* ========== 7. Markdown → HTML ========== */
  registerTool({
    id: 'md-to-html', name: 'Markdown 转 HTML', icon: '📝', category: '文档与办公',
    desc: '把 Markdown 渲染成排版精美的 HTML 页面，支持表格、代码块、任务列表与 GFM 语法。',
    tags: ['Markdown', 'HTML', '文档'],
    input: 'both', accept: '.md,.markdown,.txt', placeholder: '# 标题\n\n在这里粘贴 Markdown 文本…',
    options: [check('fragment', '只输出 HTML 片段（不含页面框架）', false), text('title', '页面标题', '文档')],
    async run(ctx) {
      const marked = U.lib('marked');
      const src = await ctx.readText();
      if (!src.trim()) throw new Error('请输入 Markdown 内容');
      const body = marked.parse(src, { gfm: true, breaks: false });
      const html = ctx.opts.fragment ? body : U.htmlDocument(ctx.opts.title || '文档', body);
      return { outputs: [U.textOut(`${ctx.opts.title || 'document'}.html`, html, 'html')], note: `已渲染 ${src.length} 字符；右侧为沙箱安全预览。` };
    },
  });

  /* ========== 8. HTML → Markdown ========== */
  registerTool({
    id: 'html-to-md', name: 'HTML 转 Markdown', icon: '🔃', category: '文档与办公',
    desc: '把 HTML 网页或片段反向转换成简洁的 Markdown，自动去除脚本与样式。',
    tags: ['HTML', 'Markdown', '反向转换'],
    input: 'both', accept: '.html,.htm,.txt', placeholder: '<h1>标题</h1>\n<p>粘贴 HTML 内容…</p>',
    options: [sel('heading', '标题风格', [['setext', 'Setext（=== / ---）'], ['atx', 'ATX（# ##）']], 'atx'), sel('bullet', '无序列表符号', [['-', '-'], ['*', '*'], ['+', '+']], '-')],
    async run(ctx) {
      const TurndownService = U.lib('TurndownService');
      const src = await ctx.readText();
      if (!src.trim()) throw new Error('请输入 HTML 内容');
      const td = new TurndownService({ headingStyle: ctx.opts.heading, bulletListMarker: ctx.opts.bullet, codeBlockStyle: 'fenced' });
      const md = td.turndown(src).trim() + '\n';
      return { outputs: [U.textOut(`converted-${U.stamp()}.md`, md, 'text')] };
    },
  });

  /* ========== 9. Word DOCX 转换 ========== */
  registerTool({
    id: 'docx-to-html', name: 'Word 转 HTML / TXT', icon: '📄', category: '文档与办公',
    desc: '提取 .docx 文档的正文与结构，输出 HTML、纯文本或 Markdown（保留标题、列表、表格与图片）。',
    tags: ['DOCX', 'Word', 'HTML', 'Markdown'],
    input: 'file', accept: '.docx', multiple: false,
    options: [sel('format', '输出格式', [['html', 'HTML 网页'], ['txt', '纯文本 TXT'], ['md', 'Markdown']], 'html')],
    async run(ctx) {
      const mammoth = U.lib('mammoth');
      const f = ctx.requireFiles()[0];
      const buf = await U.readAsArrayBuffer(f);
      const res = await mammoth.convertToHtml({ arrayBuffer: buf });
      const html = res.value || '';
      const warnings = (res.messages || []).slice(0, 3).map(m => m.message).join('；');
      let content, ext, kind;
      if (ctx.opts.format === 'txt') { content = U.stripHtml(html); ext = 'txt'; kind = 'text'; }
      else if (ctx.opts.format === 'md') {
        const TurndownService = U.lib('TurndownService');
        content = new TurndownService({ codeBlockStyle: 'fenced' }).turndown(html); ext = 'md'; kind = 'text';
      } else { content = U.htmlDocument(U.stripExt(f.name), html); ext = 'html'; kind = 'html'; }
      return { outputs: [U.textOut(U.replaceExt(f.name, ext), content, kind)], note: warnings ? `转换提示：${warnings}` : '文档解析完成，样式表已使用内置排版。' };
    },
  });

  /* ========== 10. 表格转换 ========== */
  registerTool({
    id: 'table-convert', name: 'Excel / CSV 表格转换', icon: '📊', category: '文档与办公',
    desc: 'XLSX / XLS / CSV / TSV 互转 JSON、HTML 表格、Markdown 表格与 Excel，支持指定工作表与表头。',
    tags: ['Excel', 'XLSX', 'CSV', 'JSON', 'Markdown'],
    input: 'both', accept: '.xlsx,.xls,.csv,.tsv,.ods,.txt', placeholder: '也可直接粘贴 CSV 内容，例如：\n姓名,年龄\n张三,18',
    options: [
      sel('format', '输出格式', [['csv', 'CSV'], ['json', 'JSON'], ['xlsx', 'Excel XLSX'], ['html', 'HTML 表格'], ['md', 'Markdown 表格'], ['tsv', 'TSV']], 'json'),
      num('sheet', '工作表序号（从 1 开始）', 1, 1, 100),
      check('header', '第一行为表头', true),
      sel('delimiter', 'CSV 分隔符', [[',', '逗号 ,'], [';', '分号 ;'], ['\t', '制表符 Tab'], ['|', '竖线 |']], ','),
    ],
    async run(ctx) {
      const XLSX = U.lib('XLSX');
      const files = ctx.files;
      const srcText = await ctx.readText().catch(() => '');
      let rows;
      const isSpreadsheet = files.length && /\.(xlsx|xls|ods|fods)$/i.test(files[0].name);
      if (isSpreadsheet) {
        const wb = XLSX.read(await U.readAsArrayBuffer(files[0]), { type: 'array' });
        const idx = Math.min(Math.max(1, Number(ctx.opts.sheet) || 1), wb.SheetNames.length) - 1;
        const ws = wb.Sheets[wb.SheetNames[idx]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      } else {
        const delim = ctx.opts.delimiter === '\\t' ? '\t' : ctx.opts.delimiter;
        rows = U.csvParse(srcText, delim);
      }
      if (!rows.length) throw new Error('没有解析到任何数据行');
      const fmt = ctx.opts.format;
      const header = !!ctx.opts.header;
      const delim = ctx.opts.delimiter === '\\t' ? '\t' : ctx.opts.delimiter;
      let content, ext, mime, kind = 'text';
      if (fmt === 'json') {
        const data = header
          ? rows.slice(1).map(r => Object.fromEntries(rows[0].map((h, i) => [String(h || `col${i + 1}`), r[i] === undefined ? '' : r[i]])))
          : rows;
        content = JSON.stringify(data, null, 2); ext = 'json';
      } else if (fmt === 'csv' || fmt === 'tsv') {
        content = U.csvStringify(rows, fmt === 'tsv' ? '\t' : delim); ext = fmt;
      } else if (fmt === 'xlsx') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
        content = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); ext = 'xlsx'; kind = 'binary';
      } else if (fmt === 'html' || fmt === 'md') {
        const esc = s => U.escapeHtml(s == null ? '' : s);
        if (fmt === 'md') {
          const head = header ? rows[0] : rows[0].map((_, i) => `列${i + 1}`);
          const body = header ? rows.slice(1) : rows.slice(0);
          const line = r => '| ' + (r || []).map(c => String(c == null ? '' : c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |';
          content = line(head) + '\n| ' + head.map(() => '---').join(' | ') + ' |\n' + body.map(line).join('\n') + '\n';
          ext = 'md';
        } else {
          const th = (header ? rows[0] : rows[0].map((_, i) => `列 ${i + 1}`)).map(c => `<th>${esc(c)}</th>`).join('');
          const body = (header ? rows.slice(1) : rows).map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
          content = U.htmlDocument('表格数据', `<h1>表格数据</h1>\n<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`);
          ext = 'html'; kind = 'html';
        }
      }
      const esc = U.escapeHtml;
      const previewRows = rows.slice(0, 30);
      const pv = '<table><thead><tr>' + previewRows[0].map((_, i) => `<th>${esc(header && rows[0] ? rows[0][i] : '列' + (i + 1))}</th>`).join('') + '</tr></thead><tbody>' +
        (header ? previewRows.slice(1) : previewRows).map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
      const base = files.length ? U.stripExt(files[0].name) : 'table';
      return {
        outputs: [U.out(`${base}.${ext}`, content, { mime: mime || U.mimeOf(ext), kind, preview: kind === 'text' ? undefined : pv })],
        note: `共 ${rows.length} 行 × ${rows.reduce((m, r) => Math.max(m, r.length), 0)} 列，预览仅显示前 30 行。`,
        previewTable: pv,
      };
    },
  });

  /* ========== 11. 文本 / HTML / MD 转 PDF ========== */
  registerTool({
    id: 'text-to-pdf', name: '文本转 PDF（中文友好）', icon: '📕', category: '文档与办公',
    desc: '把纯文本、HTML 或 Markdown 排成 A4 PDF。采用画布渲染，中文不会乱码，可调字号与行距。',
    tags: ['PDF', '中文', 'A4'],
    input: 'both', accept: '.txt,.md,.html,.htm,.log', placeholder: '在此粘贴或输入要转成 PDF 的内容…',
    options: [
      sel('source', '源格式', [['text', '纯文本'], ['html', 'HTML（去标签）'], ['md', 'Markdown（转纯文本）']], 'text'),
      range('fontSize', '字号 px', 15, 10, 26, 1),
      sel('lineSpacing', '行距', [['1.5', '紧凑 1.5'], ['1.75', '标准 1.75'], ['2', '宽松 2']], '1.75'),
      sel('orientation', '页面方向', [['portrait', '纵向'], ['landscape', '横向']], 'portrait'),
      text('title', '文件名', 'document'),
    ],
    async run(ctx) {
      U.lib('jsPDF');
      let content = await ctx.readText();
      if (!content.trim()) throw new Error('请输入要转换的内容');
      if (ctx.opts.source === 'html') content = U.stripHtml(content);
      else if (ctx.opts.source === 'md') content = U.stripHtml(U.lib('marked').parse(content));
      const pages = U.drawTextPages(content, {
        fontSize: Number(ctx.opts.fontSize) || 15,
        lineSpacing: Number(ctx.opts.lineSpacing) || 1.75,
        landscape: ctx.opts.orientation === 'landscape',
      });
      const blob = U.makePdf(pages, ctx.opts.orientation);
      return { outputs: [U.out(`${ctx.opts.title || 'document'}-${U.stamp()}.pdf`, blob, { kind: 'binary' })], note: `共生成 ${pages.length} 页 A4 ${ctx.opts.orientation === 'landscape' ? '横向' : '纵向'} PDF。` };
    },
  });

  /* ========== 12. ZIP 打包 ========== */
  registerTool({
    id: 'zip-pack', name: '文件打包为 ZIP', icon: '🗜️', category: '文档与办公',
    desc: '把多个文件打包成一个 ZIP 压缩包，可选择压缩级别，全部在本地完成。',
    tags: ['ZIP', '压缩', '批量'],
    input: 'file', accept: '*', multiple: true,
    options: [text('filename', '压缩包名称（留空自动生成）', ''), sel('level', '压缩级别', [['1', '最快'], ['6', '标准'], ['9', '最高压缩比']], '6')],
    async run(ctx) {
      const JSZip = U.lib('JSZip');
      const files = ctx.requireFiles();
      const zip = new JSZip();
      const used = {};
      files.forEach(f => {
        let name = U.safeName(f.name);
        if (used[name]) name = `${U.stripExt(name)}-${used[name]++}.${U.extName(name)}`;
        else used[name] = 1;
        zip.file(name, f);
      });
      ctx.setStatus('正在压缩…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: Number(ctx.opts.level) || 6 } },
        m => ctx.setStatus(`压缩中 ${m.percent.toFixed(0)}%`));
      const name = (ctx.opts.filename || '').trim() || `files-${U.stamp()}.zip`;
      return { outputs: [U.out(/\.zip$/i.test(name) ? name : name + '.zip', blob, { kind: 'binary' })], note: `已打包 ${files.length} 个文件，压缩后 ${U.formatBytes(blob.size)}。` };
    },
  });

  /* ========== 13. ZIP 解压 ========== */
  registerTool({
    id: 'zip-unpack', name: 'ZIP 解压提取', icon: '📂', category: '文档与办公',
    desc: '读取 ZIP 压缩包内容，列出文件清单并逐个提取下载（单次最多 100 个文件）。',
    tags: ['ZIP', '解压', '提取'],
    input: 'file', accept: '.zip', multiple: false,
    options: [],
    async run(ctx) {
      const JSZip = U.lib('JSZip');
      const f = ctx.requireFiles()[0];
      const zip = await JSZip.loadAsync(await U.readAsArrayBuffer(f));
      const entries = Object.values(zip.files).filter(e => !e.dir).slice(0, 100);
      if (!entries.length) throw new Error('压缩包内没有可提取的文件');
      const outputs = [];
      for (const e of entries) {
        const blob = await e.async('blob');
        const name = U.safeName(e.name);
        const isText = /\.(txt|md|json|csv|xml|html?|css|js|log|yaml|yml|svg)$/i.test(name);
        outputs.push(U.out(name, blob, { kind: isText ? 'text' : (blob.type.startsWith('image/') ? 'image' : 'binary'),
          preview: isText ? await e.async('string') : undefined }));
      }
      const list = entries.map(e => `${e.name}\t${U.formatBytes(e._data ? e._data.uncompressedSize || 0 : 0)}`).join('\n');
      return { outputs: [U.textOut(`${U.stripExt(f.name)}-文件清单.txt`, list, 'text'), ...outputs], note: `已提取 ${entries.length} 个文件（含 1 份文件清单）。` };
    },
  });

  /* ========== 14. JSON 工具 ========== */
  registerTool({
    id: 'json-tool', name: 'JSON 格式化 / 校验', icon: '🧩', category: '数据与编码',
    desc: 'JSON 美化、压缩、语法校验、按键排序、转义与反转义，支持大文件与深层结构。',
    tags: ['JSON', '格式化', '校验'],
    input: 'text', placeholder: '{"name": "示例", "items": [1, 2, 3]}',
    options: [
      sel('action', '操作', [['pretty', '格式化 / 美化'], ['minify', '压缩为一行'], ['validate', '仅校验并分析'], ['sort', '按键名排序'], ['escape', '转义为字符串字面量'], ['unescape', '字符串字面量还原']], 'pretty'),
      sel('indent', '缩进', [['2', '2 空格'], ['4', '4 空格'], ['tab', 'Tab']], '2'),
    ],
    async run(ctx) {
      const raw = (await ctx.readText()).trim();
      if (!raw) throw new Error('请输入 JSON 内容');
      const action = ctx.opts.action;
      let obj;
      try { obj = JSON.parse(raw); }
      catch (e) { throw new Error('JSON 语法错误：' + e.message); }
      if (action === 'unescape') {
        try { obj = JSON.parse(obj); } catch (e) { /* 保持原解析结果 */ }
      }
      const indent = ctx.opts.indent === 'tab' ? '\t' : Number(ctx.opts.indent);
      let result, name;
      if (action === 'minify') { result = JSON.stringify(obj); name = 'minified'; }
      else if (action === 'validate') {
        const info = { 合法: true, 类型: Array.isArray(obj) ? '数组' : typeof obj, 顶层键数: obj && typeof obj === 'object' ? Object.keys(obj).length : 0,
          数组长度: Array.isArray(obj) ? obj.length : '-', 字符数: raw.length };
        result = JSON.stringify(info, null, 2); name = 'report';
      } else if (action === 'sort') {
        const sortDeep = v => Array.isArray(v) ? v.map(sortDeep) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortDeep(v[k])])) : v);
        result = JSON.stringify(sortDeep(obj), null, indent); name = 'sorted';
      } else if (action === 'escape') { result = JSON.stringify(obj); result = JSON.stringify(result); name = 'escaped'; }
      else { result = JSON.stringify(obj, null, indent); name = 'pretty'; }
      return { outputs: [U.textOut(`json-${name}-${U.stamp()}.json`, result, 'text')], note: action === 'validate' ? '✓ 校验通过，报告见预览区。' : `输出 ${U.formatBytes(result.length)}。` };
    },
  });

  /* ========== 15. CSV ↔ JSON ========== */
  registerTool({
    id: 'csv-json', name: 'CSV ↔ JSON', icon: '🔄', category: '数据与编码',
    desc: 'CSV 与 JSON 双向转换，支持自定义分隔符、表头行与数组 / 对象两种 JSON 结构。',
    tags: ['CSV', 'JSON', '互转'],
    input: 'text', placeholder: 'name,age,city\n张三,18,北京',
    options: [
      sel('direction', '转换方向', [['c2j', 'CSV → JSON'], ['j2c', 'JSON → CSV']], 'c2j'),
      sel('delimiter', '分隔符', [[',', '逗号 ,'], [';', '分号 ;'], ['\t', 'Tab'], ['|', '竖线 |']], ','),
      check('header', 'CSV 第一行为表头', true),
    ],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw.trim()) throw new Error('请输入内容');
      const delim = ctx.opts.delimiter === '\\t' ? '\t' : ctx.opts.delimiter;
      let result, ext;
      if (ctx.opts.direction === 'c2j') {
        const rows = U.csvParse(raw, delim);
        if (!rows.length) throw new Error('未解析到数据');
        const data = ctx.opts.header
          ? rows.slice(1).map(r => Object.fromEntries(rows[0].map((h, i) => [String(h || `col${i + 1}`), r[i] ?? ''])))
          : rows;
        result = JSON.stringify(data, null, 2); ext = 'json';
      } else {
        let data;
        try { data = JSON.parse(raw); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
        if (!Array.isArray(data)) throw new Error('JSON 顶层必须是数组，例如 [{...}, {...}]');
        const keys = [...new Set(data.flatMap(o => o && typeof o === 'object' ? Object.keys(o) : []))];
        if (!keys.length) throw new Error('数组中没有可导出的对象字段');
        const rows = [keys, ...data.map(o => keys.map(k => o && o[k] != null ? (typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k]) : ''))];
        result = U.csvStringify(rows, delim); ext = 'csv';
      }
      return { outputs: [U.textOut(`converted-${U.stamp()}.${ext}`, result, 'text')] };
    },
  });

  /* ========== 16. JSON ↔ YAML ========== */
  registerTool({
    id: 'json-yaml', name: 'JSON ↔ YAML', icon: '🗂️', category: '数据与编码',
    desc: '配置文件常用格式互转，支持对象、数组、嵌套结构与多行字符串。',
    tags: ['YAML', 'JSON', '配置'],
    input: 'text', placeholder: '{"server": {"port": 8080, "hosts": ["a.com", "b.com"]}}',
    options: [sel('direction', '转换方向', [['j2y', 'JSON → YAML'], ['y2j', 'YAML → JSON']], 'j2y'), sel('indent', 'YAML 缩进', [['2', '2 空格'], ['4', '4 空格']], '2')],
    async run(ctx) {
      const yaml = U.lib('jsyaml');
      const raw = await ctx.readText();
      if (!raw.trim()) throw new Error('请输入内容');
      let result, ext;
      if (ctx.opts.direction === 'j2y') {
        let obj; try { obj = JSON.parse(raw); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
        result = yaml.dump(obj, { indent: Number(ctx.opts.indent) || 2, lineWidth: -1, noRefs: true, sortKeys: false }); ext = 'yaml';
      } else {
        let obj; try { obj = yaml.load(raw); } catch (e) { throw new Error('YAML 解析失败：' + e.message); }
        result = JSON.stringify(obj, null, 2); ext = 'json';
      }
      return { outputs: [U.textOut(`converted-${U.stamp()}.${ext}`, result, 'text')] };
    },
  });

  /* ========== 17. JSON ↔ XML ========== */
  registerTool({
    id: 'json-xml', name: 'JSON ↔ XML', icon: '🧾', category: '数据与编码',
    desc: 'JSON 与 XML 互转，保留属性（@ 前缀）、文本节点（#text）与重复元素数组。',
    tags: ['XML', 'JSON', '互转'],
    input: 'text', placeholder: '<root><item id="1">示例</item></root>',
    options: [sel('direction', '转换方向', [['x2j', 'XML → JSON'], ['j2x', 'JSON → XML']], 'x2j'), text('root', 'XML 根名（JSON→XML 时可留空）', 'root')],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw.trim()) throw new Error('请输入内容');
      let result, ext;
      if (ctx.opts.direction === 'x2j') { result = JSON.stringify(U.xmlToJson(raw), null, 2); ext = 'json'; }
      else {
        let obj; try { obj = JSON.parse(raw); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
        result = U.jsonToXml(obj, ctx.opts.root || ''); ext = 'xml';
      }
      return { outputs: [U.textOut(`converted-${U.stamp()}.${ext}`, result, 'text')], note: '属性以 @ 开头，纯文本节点以 #text 表示；复杂 XML 建议使用专业工具校验。' };
    },
  });

  /* ========== 18. Base64 文本编解码 ========== */
  registerTool({
    id: 'base64-text', name: '文本 Base64 编解码', icon: '🔐', category: '数据与编码',
    desc: 'UTF-8 安全的 Base64 编码 / 解码，中文不会乱码，支持 URL 安全变体与逐行批量处理。',
    tags: ['Base64', '编码', 'UTF-8'],
    input: 'text', placeholder: '输入要编码的文本，或粘贴 Base64 字符串进行解码',
    options: [sel('direction', '方向', [['encode', '编码 → Base64'], ['decode', '解码 → 文本']], 'encode'), check('urlsafe', 'URL 安全变体（- _）', false), check('lines', '逐行独立处理', false)],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw) throw new Error('请输入内容');
      const one = s => {
        if (ctx.opts.direction === 'decode') return U.b64decode(s.trim());
        let b = U.b64encode(s);
        if (ctx.opts.urlsafe) b = b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return b;
      };
      const result = ctx.opts.lines && ctx.opts.direction === 'encode'
        ? raw.replace(/\r\n/g, '\n').split('\n').map(one).join('\n')
        : one(raw);
      const ext = ctx.opts.direction === 'encode' ? 'txt' : 'txt';
      return { outputs: [U.textOut(`base64-${U.stamp()}.${ext}`, result, 'text')], note: ctx.opts.direction === 'decode' ? '按 UTF-8 解码，若原文是二进制请改用「Base64 转文件」。' : undefined };
    },
  });

  /* ========== 19. 转义与编码工具箱 ========== */
  registerTool({
    id: 'escape-tool', name: 'URL / HTML / Unicode 转义', icon: '✳️', category: '数据与编码',
    desc: 'URL 编码解码、HTML 实体转义、Unicode 转义与还原，前端开发常用。',
    tags: ['URL', 'HTML 实体', 'Unicode'],
    input: 'text', placeholder: '输入需要转义或还原的文本…',
    options: [sel('mode', '操作', [['urlenc', 'URL 编码'], ['urldec', 'URL 解码'], ['htmlenc', 'HTML 实体编码'], ['htmldec', 'HTML 实体解码'], ['unienc', 'Unicode 转义 \\uXXXX'], ['unidec', 'Unicode 还原']], 'urlenc')],
    async run(ctx) {
      const raw = await ctx.readText();
      if (!raw) throw new Error('请输入内容');
      let result;
      switch (ctx.opts.mode) {
        case 'urlenc': result = encodeURIComponent(raw); break;
        case 'urldec': try { result = decodeURIComponent(raw.trim()); } catch (e) { throw new Error('URL 解码失败：' + e.message); } break;
        case 'htmlenc': result = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); break;
        case 'htmldec': { const ta = document.createElement('textarea'); ta.innerHTML = raw; result = ta.value; break; }
        case 'unienc': result = Array.from(raw).map(c => c.codePointAt(0) > 127 ? (c.codePointAt(0) > 0xffff ? '\\u{' + c.codePointAt(0).toString(16) + '}' : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')) : c).join(''); break;
        case 'unidec': result = raw.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); break;
      }
      return { outputs: [U.textOut(`escaped-${U.stamp()}.txt`, result, 'text')] };
    },
  });

  /* ========== 20. 文件编码转换 ========== */
  registerTool({
    id: 'file-encoding', name: '文件编码转换（GBK→UTF-8）', icon: '🌐', category: '数据与编码',
    desc: '解决中文乱码：把 GBK / Big5 / Shift_JIS / UTF-16 等编码的文本文件转换为 UTF-8 或 UTF-16。',
    tags: ['GBK', 'UTF-8', '乱码', '编码'],
    input: 'file', accept: '.txt,.csv,.log,.md,.xml,.html,.json,.srt,.ass', multiple: true,
    options: [
      sel('from', '源编码', [['utf-8', 'UTF-8'], ['gbk', 'GBK / GB2312'], ['gb18030', 'GB18030'], ['big5', 'Big5 繁体'], ['shift_jis', 'Shift_JIS 日文'], ['euc-kr', 'EUC-KR 韩文'], ['utf-16le', 'UTF-16 LE'], ['utf-16be', 'UTF-16 BE'], ['windows-1252', 'Windows-1252'], ['iso-8859-1', 'ISO-8859-1']], 'gbk'),
      sel('to', '目标编码', [['utf-8', 'UTF-8'], ['utf-16le', 'UTF-16 LE'], ['utf-16be', 'UTF-16 BE']], 'utf-8'),
      check('bom', '写入 BOM 头', false),
    ],
    async run(ctx) {
      const files = ctx.requireFiles();
      const outputs = [];
      for (const f of files) {
        const buf = await U.readAsArrayBuffer(f);
        let text;
        try { text = new TextDecoder(ctx.opts.from, { fatal: false }).decode(buf); }
        catch (e) { throw new Error('浏览器不支持源编码 ' + ctx.opts.from); }
        text = text.replace(/^\uFEFF/, '');
        let bytes;
        if (ctx.opts.to === 'utf-8') {
          bytes = new TextEncoder().encode(text);
          if (ctx.opts.bom) { const b = new Uint8Array(bytes.length + 3); b.set([0xEF, 0xBB, 0xBF]); b.set(bytes, 3); bytes = b; }
        } else {
          const le = ctx.opts.to === 'utf-16le';
          const arr = [];
          if (ctx.opts.bom) arr.push(0xFF, 0xFE);
          for (let i = 0; i < text.length; i++) {
            const u = text.charCodeAt(i);
            arr.push(le ? (u & 0xff) : (u >> 8), le ? (u >> 8) : (u & 0xff));
          }
          bytes = new Uint8Array(arr);
        }
        outputs.push(U.out(U.replaceExt(f.name, 'txt'), bytes, { kind: 'text', mime: 'text/plain;charset=' + ctx.opts.to, preview: text.slice(0, 5000) }));
      }
      return { outputs, note: `${ctx.opts.from.toUpperCase()} → ${ctx.opts.to.toUpperCase()}${ctx.opts.bom ? '（含 BOM）' : ''}。转换结果预览为解码后的文本。` };
    },
  });

  /* ========== 21. 哈希校验 ========== */
  registerTool({
    id: 'hash', name: '文件 / 文本哈希校验', icon: '🔎', category: '数据与编码',
    desc: '计算 SHA-1 / SHA-256 / SHA-384 / SHA-512 摘要，用于校验文件完整性，支持批量文件。',
    tags: ['SHA-256', '校验和', 'MD5 替代'],
    input: 'both', accept: '*', placeholder: '也可直接粘贴文本计算哈希…',
    options: [sel('algo', '算法', [['SHA-256', 'SHA-256（推荐）'], ['SHA-1', 'SHA-1'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512']], 'SHA-256'), check('upper', '大写输出', false)],
    async run(ctx) {
      const algo = ctx.opts.algo;
      const lines = [];
      if (ctx.files.length) {
        for (const f of ctx.files) {
          ctx.setStatus(`计算中：${U.baseName(f.name)}`);
          const h = await U.hashBuffer(algo, await U.readAsArrayBuffer(f));
          lines.push(`${ctx.opts.upper ? h.toUpperCase() : h}  *${f.name}  (${U.formatBytes(f.size)})`);
        }
      } else {
        const t = await ctx.readText();
        if (!t) throw new Error('请上传文件或输入文本');
        const h = await U.hashBuffer(algo, new TextEncoder().encode(t));
        lines.push(`${ctx.opts.upper ? h.toUpperCase() : h}  *文本(${t.length} 字符)`);
      }
      return { outputs: [U.textOut(`checksum-${algo.replace('-', '').toLowerCase()}-${U.stamp()}.txt`, lines.join('\n') + '\n', 'text')], note: `算法 ${algo}，哈希在浏览器本地计算，文件不会上传。` };
    },
  });

})(window);

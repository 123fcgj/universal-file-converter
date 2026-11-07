/* =========================================================
 * utils.js —— 通用工具函数
 * 所有转换均在浏览器本地完成，不涉及任何网络上传。
 * ========================================================= */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1048576).toFixed(2) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function baseName(name) { return String(name || '').split(/[\\/]/).pop(); }
  function extName(name) { const m = /\.([^.\/\\]+)$/.exec(baseName(name)); return m ? m[1].toLowerCase() : ''; }
  function stripExt(name) { const b = baseName(name); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; }
  function replaceExt(name, ext) { return stripExt(name) + '.' + ext.replace(/^\./, ''); }
  function safeName(name) { return baseName(name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || 'output'; }
  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  const MIME = {
    txt: 'text/plain;charset=utf-8', json: 'application/json;charset=utf-8',
    csv: 'text/csv;charset=utf-8', tsv: 'text/tab-separated-values;charset=utf-8',
    html: 'text/html;charset=utf-8', md: 'text/markdown;charset=utf-8',
    xml: 'application/xml;charset=utf-8', yaml: 'text/yaml;charset=utf-8',
    yml: 'text/yaml;charset=utf-8', log: 'text/plain;charset=utf-8',
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif', svg: 'image/svg+xml',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', bin: 'application/octet-stream',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  function mimeOf(ext) { return MIME[String(ext).toLowerCase().replace(/^\./, '')] || 'application/octet-stream'; }

  function toBlob(data, mime) {
    if (data instanceof Blob) return data;
    if (data instanceof ArrayBuffer) return new Blob([data], { type: mime || 'application/octet-stream' });
    if (ArrayBuffer.isView(data)) return new Blob([data], { type: mime || 'application/octet-stream' });
    return new Blob([String(data == null ? '' : data)], { type: mime || 'text/plain;charset=utf-8' });
  }

  /** 统一输出对象 */
  function out(filename, data, opts) {
    opts = opts || {};
    const mime = opts.mime || mimeOf(extName(filename));
    const blob = toBlob(data, mime);
    return {
      filename: safeName(filename), blob, mime,
      size: blob.size,
      kind: opts.kind || (blob.type.startsWith('image/') ? 'image' : 'text'),
      preview: opts.preview,
      text: opts.text,
    };
  }
  function textOut(filename, text, kind, preview) {
    return out(filename, text, { kind: kind || 'text', preview: preview, text: String(text) });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = safeName(filename);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text));
      toast('已复制到剪贴板', 'ok');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = String(text); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制到剪贴板', 'ok'); }
      catch (_) { toast('复制失败，请手动选择文本', 'err'); }
      ta.remove();
    }
  }

  function toast(msg, type) {
    const box = $('#toastBox');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'translateX(14px)'; d.style.transition = '.25s'; }, 2600);
    setTimeout(() => d.remove(), 2950);
  }

  /** 检查可选的 CDN 组件是否可用 */
  function lib(name) {
    const map = {
      XLSX: () => global.XLSX,
      jsyaml: () => global.jsyaml,
      marked: () => global.marked,
      TurndownService: () => global.TurndownService,
      jsPDF: () => (global.jspdf && global.jspdf.jsPDF) || global.jsPDF,
      mammoth: () => global.mammoth,
      JSZip: () => global.JSZip,
      QRCode: () => global.QRCode,
    };
    const v = (map[name] || (() => global[name]))();
    if (!v) throw new Error(`组件 ${name} 未加载成功（可能网络不可用）。请刷新页面重试，或使用不依赖该组件的工具。`);
    return v;
  }

  const readAsArrayBuffer = (file) => file.arrayBuffer();
  const readAsText = (file, enc) => file.text().then(t => t);
  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(new Error('文件读取失败'));
      r.readAsDataURL(file);
    });
  }

  function loadImage(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('无法解析该图片，请确认文件是有效的图片格式')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((res, rej) => {
      canvas.toBlob(b => b ? res(b) : rej(new Error('图片导出失败')), type, quality);
    });
  }

  /** 24 位 BMP 编码（Canvas 原生不支持导出 BMP） */
  function encodeBMP(canvas) {
    const w = canvas.width, h = canvas.height;
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const rowSize = Math.ceil(w * 3 / 4) * 4;
    const buf = new ArrayBuffer(54 + rowSize * h);
    const v = new DataView(buf);
    const setStr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    setStr(0, 'BM');
    v.setUint32(2, buf.byteLength, true); v.setUint32(10, 54, true);
    v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true);
    v.setUint16(26, 1, true); v.setUint16(28, 24, true);
    v.setUint32(34, rowSize * h, true);
    for (let y = 0; y < h; y++) {
      const sy = h - 1 - y;
      for (let x = 0; x < w; x++) {
        const si = (sy * w + x) * 4, di = 54 + y * rowSize + x * 3;
        v.setUint8(di, data[si + 2]); v.setUint8(di + 1, data[si + 1]); v.setUint8(di + 2, data[si]);
      }
    }
    return new Blob([buf], { type: 'image/bmp' });
  }

  /** Base64（UTF-8 安全） */
  function b64encode(str) {
    const bytes = new TextEncoder().encode(String(str));
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function b64decode(str) {
    const s = atob(String(str).replace(/\s/g, ''));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function bytesToB64(bytes) {
    let s = ''; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function b64ToBytes(str) {
    const s = atob(String(str).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function parseDataURL(str) {
    const m = /^\s*data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(String(str).trim());
    if (!m) return null;
    return { mime: m[1] || 'application/octet-stream', base64: !!m[2], data: m[3] };
  }

  async function hashBuffer(algo, buffer) {
    const digest = await crypto.subtle.digest(algo, buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- CSV ---------- */
  function csvParse(text, delimiter) {
    delimiter = delimiter || ',';
    const rows = []; let row = [], field = '', quoted = false;
    const s = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quoted) {
        if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += c;
      } else if (c === '"' && field === '') quoted = true;
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }
  function csvStringify(rows, delimiter) {
    delimiter = delimiter || ',';
    return rows.map(row => row.map(cell => {
      const s = cell == null ? '' : String(cell);
      return /["\n\r]/.test(s) || s.includes(delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(delimiter)).join('\r\n') + '\r\n';
  }

  /* ---------- XML <-> JSON ---------- */
  function xmlToJson(xmlStr) {
    const doc = new DOMParser().parseFromString(String(xmlStr), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML 解析失败：请检查格式是否合法');
    function node(el) {
      const obj = {}, attrs = el.attributes || [];
      for (let i = 0; i < attrs.length; i++) obj['@' + attrs[i].name] = attrs[i].value;
      const kids = Array.from(el.childNodes).filter(n => n.nodeType === 1);
      let text = '';
      Array.from(el.childNodes).forEach(n => { if (n.nodeType === 3 || n.nodeType === 4) text += n.nodeValue; });
      text = text.trim();
      kids.forEach(k => {
        const key = k.nodeName, val = node(k);
        if (obj[key] === undefined) obj[key] = val;
        else if (Array.isArray(obj[key])) obj[key].push(val);
        else obj[key] = [obj[key], val];
      });
      if (text) { if (!kids.length && !Object.keys(obj).some(k => k.startsWith('@'))) return text; obj['#text'] = text; }
      if (!kids.length && !text && !Object.keys(obj).length) return '';
      return obj;
    }
    const root = doc.documentElement;
    const result = {}; result[root.nodeName] = node(root);
    return result;
  }
  function jsonToXml(value, rootName, indent) {
    indent = indent == null ? 0 : indent;
    const pad = '  '.repeat(indent);
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const validTag = s => /^[A-Za-z_][\w.\-:]*$/.test(s) ? s : 'item';
    function render(key, val, level) {
      const p = '  '.repeat(level), tag = validTag(key);
      if (val == null) return `${p}<${tag}/>`;
      if (Array.isArray(val)) return val.map(v => render(key, v, level)).join('\n');
      if (typeof val === 'object') {
        const attrs = [], children = [];
        Object.keys(val).forEach(k => {
          if (k.startsWith('@')) attrs.push(` ${k.slice(1)}="${esc(val[k])}"`);
          else if (k === '#text') children.push(esc(val[k]));
          else children.push(render(k, val[k], level + 1));
        });
        if (!children.length) return `${p}<${tag}${attrs.join('')}/>`;
        if (children.length === 1 && !children[0].includes('\n') && !attrs.length && typeof Object.values(val)[0] !== 'object')
          return `${p}<${tag}>${esc(Object.values(val)[0])}</${tag}>`;
        return `${p}<${tag}${attrs.join('')}>\n${children.join('\n')}\n${p}</${tag}>`;
      }
      return `${p}<${tag}>${esc(val)}</${tag}>`;
    }
    const body = rootName ? render(rootName, value, 0) : Object.keys(value).map(k => render(k, value[k], 0)).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
  }

  /* ---------- 文本 → PDF（Canvas 绘制，完美支持中文） ---------- */
  function wrapLine(ctx, line, maxWidth) {
    if (!line) return [''];
    const tokens = line.match(/[A-Za-z0-9_@.\-+/'#:]+|\s+|[^\s]/g) || [line];
    const result = []; let cur = '';
    tokens.forEach(tok => {
      const w = ctx.measureText(cur + tok).width;
      if (w > maxWidth && cur) { result.push(cur.replace(/\s+$/, '')); cur = tok.replace(/^\s+/, ''); }
      else cur += tok;
      while (ctx.measureText(cur).width > maxWidth && cur.length > 1) {
        let cut = cur.length - 1;
        while (cut > 1 && ctx.measureText(cur.slice(0, cut)).width > maxWidth) cut--;
        result.push(cur.slice(0, cut)); cur = cur.slice(cut);
      }
    });
    result.push(cur.replace(/\s+$/, ''));
    return result;
  }
  function drawTextPages(text, opts) {
    opts = opts || {};
    const landscape = !!opts.landscape;
    const W = landscape ? 1123 : 794, H = landscape ? 794 : 1123, margin = opts.margin || 58;
    const fontSize = opts.fontSize || 15, lineHeight = fontSize * (opts.lineSpacing || 1.75);
    const maxWidth = W - margin * 2;
    const lines = [];
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach(raw => {
      const probe = document.createElement('canvas').getContext('2d');
      probe.font = `${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`;
      wrapLine(probe, raw, maxWidth).forEach(l => lines.push(l));
    });
    const perPage = Math.max(1, Math.floor((H - margin * 2 - 24) / lineHeight));
    const pages = [];
    for (let i = 0; i < Math.max(1, Math.ceil(lines.length / perPage)); i++) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1d2333';
      ctx.font = `${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textBaseline = 'top';
      lines.slice(i * perPage, (i + 1) * perPage).forEach((l, j) => ctx.fillText(l, margin, margin + j * lineHeight));
      ctx.fillStyle = '#9aa3b8'; ctx.font = '11px sans-serif';
      ctx.fillText(`${i + 1} / ${Math.max(1, Math.ceil(lines.length / perPage))}`, W / 2 - 16, H - margin + 6);
      pages.push(c);
    }
    return pages;
  }
  function makePdf(canvases, orientation) {
    const jsPDF = lib('jsPDF');
    const pdf = new jsPDF({ orientation: orientation || 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    canvases.forEach((c, i) => {
      if (i) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph);
    });
    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
  }

  function htmlDocument(title, body, css) {
    return `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>\nbody{max-width:820px;margin:38px auto;padding:0 22px;font:16px/1.8 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#24292f}\nh1,h2,h3{line-height:1.35;margin:1.4em 0 .6em} h1{border-bottom:1px solid #eaeef2;padding-bottom:.3em}\ncode{background:#f3f5f9;padding:2px 6px;border-radius:5px;font-size:.9em}\npre{background:#f3f5f9;padding:14px;border-radius:9px;overflow:auto} pre code{background:none;padding:0}\nblockquote{border-left:4px solid #5566f5;margin:0;padding:2px 16px;color:#57606a;background:#f7f8ff}\ntable{border-collapse:collapse;width:100%} th,td{border:1px solid #d8dee4;padding:7px 12px} th{background:#f6f8fa}\nimg{max-width:100%} a{color:#5566f5}\n${css || ''}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>`;
  }

  function stripHtml(html) {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach(n => n.remove());
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  global.U = {
    $, $$, escapeHtml, formatBytes, baseName, extName, stripExt, replaceExt, safeName, stamp,
    MIME, mimeOf, toBlob, out, textOut, downloadBlob, copyText, toast, lib,
    readAsArrayBuffer, readAsText, readAsDataURL, loadImage, canvasToBlob, encodeBMP,
    b64encode, b64decode, bytesToB64, b64ToBytes, parseDataURL, hashBuffer,
    csvParse, csvStringify, xmlToJson, jsonToXml, drawTextPages, makePdf,
    htmlDocument, stripHtml,
  };
})(window);

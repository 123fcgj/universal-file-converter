# 万能文件转换器 · Universal File Converter

一个**纯前端、免上传**的在线文件格式转换工具箱，托管于 GitHub Pages。
所有文件都在你的浏览器本地处理，不会上传到任何服务器，也不需要登录。

🔗 在线地址：https://123fcgj.github.io/universal-file-converter/

## 功能一览（29 个工具）

### 🖼️ 图片与视觉
| 工具 | 说明 |
| --- | --- |
| 图片格式转换 | PNG / JPG / WebP / BMP / GIF / SVG 互转，批量、等比缩放、画质调节 |
| 图片合并为 PDF | 多图合成单个 PDF，A4 排版或匹配图片比例 |
| 图片转 Base64 | 输出 Base64、Data URL、HTML/CSS/Markdown 引用 |
| Base64 转文件 | 还原为原始文件，自动识别常见文件头 |
| 二维码生成 | 文本/网址生成二维码 PNG，可调颜色与纠错级别 |
| 图片转字符画 | 灰度 ASCII 艺术画，可自定义字符集 |

### 📄 文档与办公
| 工具 | 说明 |
| --- | --- |
| Markdown 转 HTML | GFM 支持，输出完整排版页面 |
| HTML 转 Markdown | 反向转换，自动去除脚本与样式 |
| Word 转 HTML / TXT | 解析 .docx，输出 HTML、纯文本或 Markdown |
| Excel / CSV 表格转换 | XLSX / XLS / CSV / TSV ↔ JSON / HTML / Markdown / XLSX |
| 文本转 PDF | 中文友好的 A4 PDF，画布渲染不乱码 |
| 文件打包为 ZIP | 多文件本地压缩 |
| ZIP 解压提取 | 列出并提取压缩包内文件 |

### 🧩 数据与编码
| 工具 | 说明 |
| --- | --- |
| JSON 格式化 / 校验 | 美化、压缩、校验、键排序、转义 |
| CSV ↔ JSON | 双向转换，自定义分隔符与表头 |
| JSON ↔ YAML | 配置文件互转 |
| JSON ↔ XML | 属性与文本节点保留 |
| 文本 Base64 编解码 | UTF-8 安全，支持 URL 安全变体 |
| URL / HTML / Unicode 转义 | 六类转义与还原 |
| 文件编码转换 | GBK / Big5 / Shift_JIS / UTF-16 → UTF-8（解决中文乱码） |
| 文件 / 文本哈希校验 | SHA-1 / 256 / 384 / 512 |

### ✍️ 文本与效率
| 工具 | 说明 |
| --- | --- |
| 文本处理工具箱 | 20+ 种批处理：大小写、命名风格、去重排序、全半角等 |
| 文本统计与词频 | 字数、行数、字节、阅读时长、高频词 |

### 🛠️ 开发者工具
| 工具 | 说明 |
| --- | --- |
| 颜色格式转换 | HEX / RGB / HSL / CMYK / CSS 变量 |
| 进制转换 | 2/8/10/16/32/36 进制，BigInt 支持大数 |
| Unix 时间戳转换 | 秒/毫秒、本地/UTC、批量 |
| UUID / 随机密码生成 | 加密级随机源 |
| JWT 解码分析 | Header / Payload / 过期状态 |
| 单位换算 | 长度、质量、面积、体积、存储、时间、速度、温度 |

## 特性

- **隐私优先**：零后端、零上传、零 Cookie 追踪；文件仅存在于浏览器内存中。
- **批量处理**：图片、编码转换、哈希等支持一次拖入多个文件。
- **即用即走**：拖拽或粘贴 → 设置选项 → 点击转换 → 下载，也可 `Ctrl/⌘ + Enter` 快速执行。
- **深浅主题**：自动记忆主题偏好，适配桌面与移动端。
- **安全预览**：HTML 预览放在无脚本权限的沙箱 iframe 中，防止恶意内容执行。

## 技术实现

纯静态 HTML + CSS + 原生 JavaScript，无构建步骤。核心转换（图片、JSON、CSV、Base64、编码、哈希等）完全离线可用；以下可选组件通过 CDN 按需加载，加载失败时对应工具会给出提示：

- [SheetJS](https://sheetjs.com/) — Excel / CSV 解析与生成
- [jsPDF](https://github.com/parallax/jsPDF) — PDF 生成
- [marked](https://marked.js.org/) / [Turndown](https://github.com/mixmark-io/turndown) — Markdown 互转
- [mammoth](https://github.com/mwilliamson/mammoth.js) — DOCX 解析
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML
- [JSZip](https://stuk.github.io/jszip/) — 压缩解压
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) — 二维码

## 本地运行

```bash
cd universal-file-converter
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

也可直接双击 `index.html`（部分浏览器对本地文件的剪贴板/拖拽有限制，建议用本地服务器）。

## 部署（GitHub Pages）

仓库 Settings → Pages → Build and deployment → Source 选择 `Deploy from a branch`，
Branch 选择 `main` / `root`，保存后约 1 分钟即可访问。

## 许可

MIT License.

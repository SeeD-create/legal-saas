// ===== 証拠スタンプツール =====
const StampTool = {
  subNumbers: [],
  files: [],

  init() {
    const dz = document.getElementById('stamp-dropzone');
    if (dz._bound) return;
    dz._bound = true;

    const fi = document.getElementById('stamp-fileInput');
    const cat = document.getElementById('stamp-category');
    const mainNum = document.getElementById('stamp-mainNumber');
    const btnAddSub = document.getElementById('stamp-btnAddSub');
    const btnProcess = document.getElementById('stamp-btnProcess');

    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); this.addFiles(e.dataTransfer.files); });
    fi.addEventListener('change', () => { this.addFiles(fi.files); fi.value = ''; });

    cat.addEventListener('change', () => this.updatePreview());
    mainNum.addEventListener('input', () => this.updatePreview());
    document.getElementById('stamp-position').addEventListener('change', () => this.updatePreview());
    document.getElementById('stamp-size').addEventListener('input', () => this.updatePreview());
    btnAddSub.addEventListener('click', () => this.addSubNumber());
    btnProcess.addEventListener('click', () => this.process());

    this.updateCategoryLabels();
    this.updatePreview();
  },

  getStampLabel(fileIndex) {
    const cat = document.getElementById('stamp-category').value;
    const num = parseInt(document.getElementById('stamp-mainNumber').value) || 1;
    const idx = fileIndex || 0;

    if (this.subNumbers.length > 0) {
      const lastSubVal = parseInt(this.subNumbers[this.subNumbers.length - 1].value) || 1;
      const subParts = this.subNumbers.map((s, si) => {
        if (si === this.subNumbers.length - 1) return lastSubVal + idx;
        return s.value || '1';
      });
      if (cat === '資料') return '資料' + num + 'の' + subParts.join('の');
      return cat + '第' + num + '号証の' + subParts.join('の');
    } else {
      const n = num + idx;
      if (cat === '資料') return '資料' + n;
      return cat + '第' + n + '号証';
    }
  },

  updateCategoryLabels() {
    const cat = document.getElementById('stamp-category').value;
    const pre = document.getElementById('stamp-labelPre');
    const post = document.getElementById('stamp-labelPost');
    if (cat === '資料') { pre.style.display = 'none'; post.style.display = 'none'; }
    else { pre.style.display = ''; post.style.display = ''; }
  },

  updatePreview() {
    document.getElementById('stamp-preview').textContent = this.getStampLabel(0);
    this.updateCategoryLabels();
    this.updateFileList();
    document.getElementById('stamp-btnProcess').disabled = this.files.length === 0;
  },

  addSubNumber() {
    const group = document.getElementById('stamp-subNumberGroup');
    const wrapper = document.createElement('span');
    wrapper.className = 'sub-number-group';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';

    const sep = document.createElement('span');
    sep.textContent = 'の';
    sep.style.fontWeight = '500';

    const input = document.createElement('input');
    input.type = 'number'; input.min = 1; input.max = 200; input.value = 1;
    input.className = 'form-input';
    input.style.width = '60px'; input.style.textAlign = 'center'; input.style.padding = '6px';
    input.addEventListener('input', () => this.updatePreview());

    const btnRm = document.createElement('button');
    btnRm.className = 'btn btn-danger btn-sm';
    btnRm.textContent = '\u00d7';
    btnRm.style.padding = '2px 8px'; btnRm.style.minWidth = '24px';
    const idx = this.subNumbers.length;
    btnRm.addEventListener('click', () => this.removeSubNumber(idx));

    wrapper.appendChild(sep);
    wrapper.appendChild(input);
    wrapper.appendChild(btnRm);
    group.appendChild(wrapper);
    this.subNumbers.push(input);
    this.updatePreview();
  },

  removeSubNumber(idx) {
    const group = document.getElementById('stamp-subNumberGroup');
    const wrappers = group.querySelectorAll('.sub-number-group');
    group.innerHTML = '';
    this.subNumbers = [];
    wrappers.forEach((w, i) => {
      if (i === idx) return;
      const input = w.querySelector('input');
      group.appendChild(w);
      this.subNumbers.push(input);
      const newIdx = this.subNumbers.length - 1;
      const btn = w.querySelector('button');
      btn.onclick = () => this.removeSubNumber(newIdx);
    });
    this.updatePreview();
  },

  addFiles(fileListInput) {
    for (const f of fileListInput) {
      const n = f.name.toLowerCase();
      if (n.endsWith('.pdf') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png')) {
        this.files.push({ file: f, status: 'ready' });
      }
    }
    this.updateFileList();
    document.getElementById('stamp-btnProcess').disabled = this.files.length === 0;
  },

  updateFileList() {
    const list = document.getElementById('stamp-fileList');
    const hint = document.getElementById('stamp-batchHint');
    list.innerHTML = '';

    if (this.files.length > 1) {
      hint.style.display = '';
      hint.textContent = this.subNumbers.length > 0
        ? '※ 複数ファイル: 枝番が自動で連番になります'
        : '※ 複数ファイル: 号証番号が自動で連番になります';
    } else {
      hint.style.display = 'none';
    }

    this.files.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      const statusCls = f.status === 'done' ? 'done' : f.status === 'processing' ? 'processing' : f.status === 'error' ? 'error' : '';
      const statusText = f.status === 'done' ? '\u2713' : f.status === 'processing' ? '...' : f.status === 'error' ? '\u2717' : '';
      div.innerHTML = `<span class="fname" style="flex:1">${f.file.name}</span><span style="color:#4a6cf7">\u2192</span><span class="file-output-name">${this.getStampLabel(i)}.pdf</span><span class="fsize ${statusCls}">${statusText}</span><button class="fremove" data-idx="${i}">\u00d7</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll('.fremove').forEach(b => {
      b.addEventListener('click', () => {
        this.files.splice(parseInt(b.dataset.idx), 1);
        this.updateFileList();
        document.getElementById('stamp-btnProcess').disabled = this.files.length === 0;
      });
    });
  },

  async createStampImageBytes(label, fontSize) {
    await document.fonts.ready;
    const scale = 3;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontStr = 'bold ' + (fontSize * scale) + 'px "Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Sans",sans-serif';
    ctx.font = fontStr;
    const metrics = ctx.measureText(label);
    const pad = 8 * scale, bw = 2 * scale;
    const w = Math.ceil(metrics.width) + pad * 2 + bw * 2;
    const h = Math.ceil(fontSize * scale * 1.25) + pad * 2 + bw * 2;
    canvas.width = w; canvas.height = h;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c0382b'; ctx.lineWidth = bw;
    ctx.strokeRect(bw / 2, bw / 2, w - bw, h - bw);
    ctx.fillStyle = '#c0382b'; ctx.font = fontStr;
    ctx.textBaseline = 'middle'; ctx.fillText(label, pad + bw, h / 2 + scale);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), displayWidth: w / scale, displayHeight: h / scale };
  },

  async createPdfFromImage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.create();
    const name = file.name.toLowerCase();
    let image = name.endsWith('.png') ? await pdfDoc.embedPng(arrayBuffer) : await pdfDoc.embedJpg(arrayBuffer);
    const imgW = image.width, imgH = image.height;
    const A4S = 595.28, A4L = 841.89;
    let pageW, pageH;
    if (imgW >= imgH) {
      pageW = A4L; pageH = A4L * (imgH / imgW);
      if (pageH > A4S * 1.2) { pageH = A4S; pageW = A4S * (imgW / imgH); }
    } else {
      pageH = A4L; pageW = A4L * (imgW / imgH);
      if (pageW > A4S * 1.2) { pageW = A4S; pageH = A4S * (imgH / imgW); }
    }
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
    return pdfDoc;
  },

  async process() {
    const btn = document.getElementById('stamp-btnProcess');
    btn.disabled = true; btn.textContent = '処理中...';
    const pos = document.getElementById('stamp-position').value;
    const fontSize = parseInt(document.getElementById('stamp-size').value) || 24;

    for (let i = 0; i < this.files.length; i++) {
      const label = this.getStampLabel(i);
      this.files[i].status = 'processing';
      this.updateFileList();
      try {
        const f = this.files[i].file;
        const isImg = /\.(jpg|jpeg|png)$/i.test(f.name);
        let pdfDoc = isImg ? await this.createPdfFromImage(f) : await PDFLib.PDFDocument.load(await f.arrayBuffer());
        const pages = pdfDoc.getPages();
        if (pages.length > 0) {
          const stamp = await this.createStampImageBytes(label, fontSize);
          const stampImg = await pdfDoc.embedPng(stamp.bytes);
          const { width, height } = pages[0].getSize();
          const m = 12;
          let x, y;
          switch (pos) {
            case 'top-right': x = width - stamp.displayWidth - m; y = height - stamp.displayHeight - m; break;
            case 'top-left': x = m; y = height - stamp.displayHeight - m; break;
            case 'bottom-right': x = width - stamp.displayWidth - m; y = m; break;
            case 'bottom-left': x = m; y = m; break;
          }
          pages[0].drawImage(stampImg, { x, y, width: stamp.displayWidth, height: stamp.displayHeight });
        }
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = this.getStampLabel(i) + '.pdf';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.files[i].status = 'done';
      } catch (err) {
        console.error(err); this.files[i].status = 'error';
      }
      this.updateFileList();
    }
    btn.textContent = 'スタンプを押して出力';
    btn.disabled = this.files.length === 0;
  }
};

Router.register('stamp', StampTool);

// ===== 証拠スタンプツール（プレビュー付き） =====
const StampTool = {
  subNumbers: [],
  files: [],
  // Preview workspace state
  pdfDocs: [],        // { file, pdfJsDoc?, imgEl?, pageCount, type:'pdf'|'image', pdfPageSizes:[] }
  stampPlacements: {}, // "fileIdx-pageIdx" -> { x, y } in PDF points (bottom-left origin)
  currentFileIdx: 0,
  currentPageIdx: 0,
  zoomLevel: 1.0,
  allPages: false,
  previewMode: false,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  currentCanvasWidth: 0,
  currentCanvasHeight: 0,
  currentPdfWidth: 0,
  currentPdfHeight: 0,

  init() {
    const dz = document.getElementById('stamp-dropzone');
    if (dz._bound) return;
    dz._bound = true;

    const fi = document.getElementById('stamp-fileInput');
    const btnProcess = document.getElementById('stamp-btnProcess');

    // Upload phase
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); this.addFiles(e.dataTransfer.files); });
    fi.addEventListener('change', () => { this.addFiles(fi.files); fi.value = ''; });
    btnProcess.addEventListener('click', () => this.enterPreview());

    // Workspace controls
    document.getElementById('stamp-ws-back').addEventListener('click', () => this.exitPreview());
    document.getElementById('stamp-ws-process').addEventListener('click', () => this.process());
    document.getElementById('stamp-ws-prevPage').addEventListener('click', () => this.prevPage());
    document.getElementById('stamp-ws-nextPage').addEventListener('click', () => this.nextPage());
    document.getElementById('stamp-ws-zoomIn').addEventListener('click', () => this.zoom(0.25));
    document.getElementById('stamp-ws-zoomOut').addEventListener('click', () => this.zoom(-0.25));
    document.getElementById('stamp-ws-allPages').addEventListener('change', e => { this.allPages = e.target.checked; });
    document.getElementById('stamp-ws-btnAddSub').addEventListener('click', () => this.addSubNumber());

    // Workspace settings → live update
    document.getElementById('stamp-ws-category').addEventListener('change', () => this.onSettingsChange());
    document.getElementById('stamp-ws-mainNumber').addEventListener('input', () => this.onSettingsChange());
    document.getElementById('stamp-ws-size').addEventListener('input', () => {
      if (this.previewMode) this.updateStampOverlayPosition();
    });
    document.getElementById('stamp-ws-position').addEventListener('change', () => {
      // Reset placements when position preset changes
      this.stampPlacements = {};
      if (this.previewMode) this.updateStampOverlayPosition();
    });

    // Canvas click to place stamp
    document.getElementById('stamp-ws-canvasWrap').addEventListener('click', e => this.handleCanvasClick(e));

    // Drag stamp
    const stampEl = document.getElementById('stamp-ws-stamp');
    stampEl.addEventListener('mousedown', e => this.startDrag(e));
    document.addEventListener('mousemove', e => this.onDrag(e));
    document.addEventListener('mouseup', () => this.endDrag());
  },

  // ===== Settings change handler =====
  onSettingsChange() {
    if (!this.previewMode) return;
    this.updateWorkspaceStamp();
    this.updateStampOverlayPosition();
    this.updatePreviewLabel();
  },

  // ===== Stamp label =====
  getStampLabel(fileIndex) {
    const cat = document.getElementById('stamp-ws-category').value;
    const num = parseInt(document.getElementById('stamp-ws-mainNumber').value) || 1;
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

  updatePreviewLabel() {
    const el = document.getElementById('stamp-ws-previewLabel');
    if (el) el.textContent = this.getStampLabel(this.currentFileIdx);
  },

  // ===== Sub-numbers (workspace) =====
  addSubNumber() {
    const group = document.getElementById('stamp-ws-subNumbers');
    const wrapper = document.createElement('div');
    wrapper.className = 'stamp-ws-sub-row';
    const sep = document.createElement('span'); sep.textContent = 'の'; sep.style.fontWeight = '500'; sep.style.fontSize = '13px';
    const input = document.createElement('input');
    input.type = 'number'; input.min = 1; input.max = 200; input.value = 1;
    input.className = 'form-input';
    input.addEventListener('input', () => this.onSettingsChange());
    const btnRm = document.createElement('button');
    btnRm.className = 'btn-rm'; btnRm.textContent = '\u00d7';
    const idx = this.subNumbers.length;
    btnRm.addEventListener('click', () => this.removeSubNumber(idx));
    wrapper.appendChild(sep); wrapper.appendChild(input); wrapper.appendChild(btnRm);
    group.appendChild(wrapper);
    this.subNumbers.push(input);
    this.onSettingsChange();
  },

  removeSubNumber(idx) {
    const group = document.getElementById('stamp-ws-subNumbers');
    const wrappers = group.querySelectorAll('.stamp-ws-sub-row');
    group.innerHTML = '';
    this.subNumbers = [];
    wrappers.forEach((w, i) => {
      if (i === idx) return;
      const input = w.querySelector('input');
      group.appendChild(w);
      this.subNumbers.push(input);
      const newIdx = this.subNumbers.length - 1;
      w.querySelector('.btn-rm').onclick = () => this.removeSubNumber(newIdx);
    });
    this.onSettingsChange();
  },

  // ===== File management =====
  addFiles(fileListInput) {
    for (const f of fileListInput) {
      const n = f.name.toLowerCase();
      if (n.endsWith('.pdf') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png'))
        this.files.push({ file: f, status: 'ready' });
    }
    this.updateFileList();
    document.getElementById('stamp-btnProcess').disabled = this.files.length === 0;
  },

  updateFileList() {
    const list = document.getElementById('stamp-fileList');
    list.innerHTML = '';
    this.files.forEach((f, i) => {
      const div = document.createElement('div'); div.className = 'file-item';
      const size = (f.file.size / 1024).toFixed(0);
      div.innerHTML = `<span class="fname" style="flex:1">${f.file.name}</span><span class="fsize">${size}KB</span><button class="fremove" data-idx="${i}">\u00d7</button>`;
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

  // ===== Image page size calculation =====
  calcImagePageSize(imgW, imgH) {
    const A4S = 595.28, A4L = 841.89;
    let pageW, pageH;
    if (imgW >= imgH) {
      pageW = A4L; pageH = A4L * (imgH / imgW);
      if (pageH > A4S * 1.2) { pageH = A4S; pageW = A4S * (imgW / imgH); }
    } else {
      pageH = A4L; pageW = A4L * (imgW / imgH);
      if (pageW > A4S * 1.2) { pageW = A4S; pageH = A4S * (imgH / imgW); }
    }
    return { pageW, pageH };
  },

  // ===== Preview Workspace =====
  async enterPreview() {
    if (this.files.length === 0) return;
    document.getElementById('stamp-config-phase').style.display = 'none';
    document.getElementById('stamp-workspace').style.display = '';
    this.previewMode = true;
    this.currentFileIdx = 0;
    this.currentPageIdx = 0;
    this.zoomLevel = 1.0;
    this.stampPlacements = {};

    // Load all files
    this.pdfDocs = [];
    for (let i = 0; i < this.files.length; i++) {
      const f = this.files[i].file;
      const isImg = /\.(jpg|jpeg|png)$/i.test(f.name);
      if (isImg) {
        const url = URL.createObjectURL(f);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const ps = this.calcImagePageSize(img.naturalWidth, img.naturalHeight);
        this.pdfDocs.push({ file: f, imgEl: img, objectUrl: url, pageCount: 1, type: 'image', pdfPageSizes: [{ w: ps.pageW, h: ps.pageH }] });
      } else {
        const ab = await f.arrayBuffer();
        const pdfJsDoc = await pdfjsLib.getDocument({ data: ab.slice(0) }).promise;
        const pageSizes = [];
        for (let p = 1; p <= pdfJsDoc.numPages; p++) {
          const page = await pdfJsDoc.getPage(p);
          const vp = page.getViewport({ scale: 1.0 });
          pageSizes.push({ w: vp.width, h: vp.height });
        }
        this.pdfDocs.push({ file: f, pdfJsDoc, pageCount: pdfJsDoc.numPages, type: 'pdf', pdfPageSizes: pageSizes });
      }
    }
    this.renderThumbnails();
    await this.renderMainPreview();
    this.updateWorkspaceFileInfo();
    this.updatePreviewLabel();
  },

  exitPreview() {
    document.getElementById('stamp-config-phase').style.display = '';
    document.getElementById('stamp-workspace').style.display = 'none';
    this.previewMode = false;
    // Cleanup
    for (const doc of this.pdfDocs) {
      if (doc.type === 'pdf' && doc.pdfJsDoc) doc.pdfJsDoc.destroy();
      if (doc.objectUrl) URL.revokeObjectURL(doc.objectUrl);
    }
    this.pdfDocs = [];
    this.stampPlacements = {};
    this.files.forEach(f => f.status = 'ready');
    this.updateFileList();
    document.getElementById('stamp-btnProcess').disabled = this.files.length === 0;
  },

  // ===== Thumbnails =====
  renderThumbnails() {
    const container = document.getElementById('stamp-ws-thumbs');
    container.innerHTML = '';
    const THUMB_W = 140;
    this.pdfDocs.forEach((doc, fi) => {
      const group = document.createElement('div');
      group.className = 'stamp-ws-thumb-group';
      const label = document.createElement('div');
      label.className = 'stamp-ws-thumb-label';
      label.textContent = doc.file.name;
      label.title = doc.file.name;
      group.appendChild(label);
      const subLabel = document.createElement('div');
      subLabel.className = 'stamp-ws-thumb-sub';
      subLabel.textContent = this.getStampLabel(fi);
      subLabel.dataset.fileIdx = fi;
      group.appendChild(subLabel);
      for (let pi = 0; pi < doc.pageCount; pi++) {
        const thumb = document.createElement('div');
        thumb.className = 'stamp-ws-thumb' + (fi === 0 && pi === 0 ? ' active' : '');
        thumb.dataset.fileIdx = fi;
        thumb.dataset.pageIdx = pi;
        const canvas = document.createElement('canvas');
        thumb.appendChild(canvas);
        thumb.addEventListener('click', () => {
          this.currentFileIdx = fi;
          this.currentPageIdx = pi;
          this.renderMainPreview();
          this.highlightThumb();
          this.updateWorkspaceFileInfo();
          this.updatePreviewLabel();
        });
        group.appendChild(thumb);
        this.renderThumbCanvas(doc, pi, canvas, THUMB_W);
      }
      container.appendChild(group);
    });
  },

  async renderThumbCanvas(doc, pageIdx, canvas, maxWidth) {
    if (doc.type === 'pdf') {
      const page = await doc.pdfJsDoc.getPage(pageIdx + 1);
      const vp0 = page.getViewport({ scale: 1.0 });
      const scale = maxWidth / vp0.width;
      const vp = page.getViewport({ scale });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } else {
      const img = doc.imgEl;
      const scale = maxWidth / img.naturalWidth;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  },

  highlightThumb() {
    document.querySelectorAll('.stamp-ws-thumb').forEach(t => {
      t.classList.toggle('active',
        parseInt(t.dataset.fileIdx) === this.currentFileIdx &&
        parseInt(t.dataset.pageIdx) === this.currentPageIdx);
    });
  },

  // ===== Main Preview =====
  async renderMainPreview() {
    const doc = this.pdfDocs[this.currentFileIdx];
    if (!doc) return;
    const canvas = document.getElementById('stamp-ws-canvas');
    const wrap = document.getElementById('stamp-ws-canvasWrap');
    const ctx = canvas.getContext('2d');

    const containerWidth = wrap.clientWidth - 40;
    let pdfW, pdfH;
    if (doc.type === 'pdf') {
      const page = await doc.pdfJsDoc.getPage(this.currentPageIdx + 1);
      const vp0 = page.getViewport({ scale: 1.0 });
      pdfW = vp0.width; pdfH = vp0.height;
      const baseScale = containerWidth / vp0.width;
      const scale = baseScale * this.zoomLevel;
      const vp = page.getViewport({ scale });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } else {
      const img = doc.imgEl;
      const ps = doc.pdfPageSizes[0];
      pdfW = ps.w; pdfH = ps.h;
      const baseScale = containerWidth / img.naturalWidth;
      const scale = baseScale * this.zoomLevel;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    this.currentCanvasWidth = canvas.width;
    this.currentCanvasHeight = canvas.height;
    this.currentPdfWidth = pdfW;
    this.currentPdfHeight = pdfH;

    // Update overlay size to match canvas
    const overlay = document.getElementById('stamp-ws-overlay');
    overlay.style.width = canvas.width + 'px';
    overlay.style.height = canvas.height + 'px';
    overlay.style.left = canvas.offsetLeft + 'px';
    overlay.style.top = canvas.offsetTop + 'px';

    this.updateStampOverlayPosition();
    this.updatePageNav();
    document.getElementById('stamp-ws-zoomLevel').textContent = Math.round(this.zoomLevel * 100) + '%';
  },

  updatePageNav() {
    const totalPages = this.pdfDocs.reduce((s, d) => s + d.pageCount, 0);
    let currentAbsolute = 0;
    for (let i = 0; i < this.currentFileIdx; i++) currentAbsolute += this.pdfDocs[i].pageCount;
    currentAbsolute += this.currentPageIdx + 1;
    document.getElementById('stamp-ws-pageInfo').textContent = `${currentAbsolute} / ${totalPages}`;
  },

  prevPage() {
    if (this.currentPageIdx > 0) {
      this.currentPageIdx--;
    } else if (this.currentFileIdx > 0) {
      this.currentFileIdx--;
      this.currentPageIdx = this.pdfDocs[this.currentFileIdx].pageCount - 1;
    } else return;
    this.renderMainPreview();
    this.highlightThumb();
    this.updateWorkspaceFileInfo();
    this.updatePreviewLabel();
  },

  nextPage() {
    const doc = this.pdfDocs[this.currentFileIdx];
    if (this.currentPageIdx < doc.pageCount - 1) {
      this.currentPageIdx++;
    } else if (this.currentFileIdx < this.pdfDocs.length - 1) {
      this.currentFileIdx++;
      this.currentPageIdx = 0;
    } else return;
    this.renderMainPreview();
    this.highlightThumb();
    this.updateWorkspaceFileInfo();
    this.updatePreviewLabel();
  },

  zoom(delta) {
    this.zoomLevel = Math.max(0.25, Math.min(3.0, this.zoomLevel + delta));
    this.renderMainPreview();
  },

  updateWorkspaceFileInfo() {
    const doc = this.pdfDocs[this.currentFileIdx];
    if (!doc) return;
    const el = document.getElementById('stamp-ws-fileInfo');
    el.innerHTML = `<div class="fi-name">${doc.file.name}</div>
      <div class="fi-meta">ページ ${this.currentPageIdx + 1} / ${doc.pageCount}</div>
      <div class="fi-meta">出力名: ${this.getStampLabel(this.currentFileIdx)}.pdf</div>`;
  },

  updateWorkspaceStamp() {
    const stampEl = document.getElementById('stamp-ws-stamp');
    stampEl.textContent = this.getStampLabel(this.currentFileIdx);
    // Update thumbnail labels
    document.querySelectorAll('.stamp-ws-thumb-sub').forEach(el => {
      el.textContent = this.getStampLabel(parseInt(el.dataset.fileIdx));
    });
    this.updateWorkspaceFileInfo();
  },

  // ===== Coordinate conversion =====
  pdfToCanvas(pdfX, pdfY) {
    const sx = this.currentCanvasWidth / this.currentPdfWidth;
    const sy = this.currentCanvasHeight / this.currentPdfHeight;
    return { x: pdfX * sx, y: (this.currentPdfHeight - pdfY) * sy };
  },

  canvasToPdf(cx, cy) {
    const sx = this.currentPdfWidth / this.currentCanvasWidth;
    const sy = this.currentPdfHeight / this.currentCanvasHeight;
    return { x: cx * sx, y: this.currentPdfHeight - (cy * sy) };
  },

  getDefaultPdfPosition(fileIdx, pageIdx) {
    const doc = this.pdfDocs[fileIdx];
    const ps = doc.pdfPageSizes[pageIdx] || doc.pdfPageSizes[0];
    const pos = document.getElementById('stamp-ws-position').value;
    const fontSize = parseInt(document.getElementById('stamp-ws-size').value) || 24;
    const label = this.getStampLabel(fileIdx);
    const estW = label.length * fontSize * 0.7 + 20;
    const estH = fontSize * 1.25 + 20;
    const m = 12;
    switch (pos) {
      case 'top-right': return { x: ps.w - estW - m, y: ps.h - m };
      case 'top-left': return { x: m, y: ps.h - m };
      case 'bottom-right': return { x: ps.w - estW - m, y: estH + m };
      case 'bottom-left': return { x: m, y: estH + m };
      default: return { x: ps.w - estW - m, y: ps.h - m };
    }
  },

  getStampPlacement(fileIdx, pageIdx) {
    const key = fileIdx + '-' + pageIdx;
    if (this.stampPlacements[key]) return this.stampPlacements[key];
    const key0 = fileIdx + '-0';
    if (pageIdx > 0 && this.stampPlacements[key0]) return this.stampPlacements[key0];
    return this.getDefaultPdfPosition(fileIdx, pageIdx);
  },

  updateStampOverlayPosition() {
    const stampEl = document.getElementById('stamp-ws-stamp');
    stampEl.textContent = this.getStampLabel(this.currentFileIdx);
    const fontSize = parseInt(document.getElementById('stamp-ws-size').value) || 24;
    const scaleFactor = this.currentCanvasWidth / this.currentPdfWidth;
    stampEl.style.fontSize = Math.max(8, fontSize * scaleFactor * 0.75) + 'px';

    const pos = this.getStampPlacement(this.currentFileIdx, this.currentPageIdx);
    const canvasPos = this.pdfToCanvas(pos.x, pos.y);
    stampEl.style.left = canvasPos.x + 'px';
    stampEl.style.top = canvasPos.y + 'px';
  },

  // ===== Click to place =====
  handleCanvasClick(e) {
    if (this.isDragging) return;
    const canvas = document.getElementById('stamp-ws-canvas');
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (cx < 0 || cy < 0 || cx > canvas.width || cy > canvas.height) return;

    const pdfPos = this.canvasToPdf(cx, cy);
    const key = this.currentFileIdx + '-' + this.currentPageIdx;
    this.stampPlacements[key] = pdfPos;
    this.updateStampOverlayPosition();
  },

  // ===== Drag to move =====
  startDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
    const stampEl = document.getElementById('stamp-ws-stamp');
    const overlay = document.getElementById('stamp-ws-overlay');
    const overlayRect = overlay.getBoundingClientRect();
    this.dragOffsetX = e.clientX - overlayRect.left - stampEl.offsetLeft;
    this.dragOffsetY = e.clientY - overlayRect.top - stampEl.offsetTop;
    stampEl.classList.add('dragging');
  },

  onDrag(e) {
    if (!this.isDragging) return;
    const stampEl = document.getElementById('stamp-ws-stamp');
    const overlay = document.getElementById('stamp-ws-overlay');
    const overlayRect = overlay.getBoundingClientRect();

    let newLeft = e.clientX - overlayRect.left - this.dragOffsetX;
    let newTop = e.clientY - overlayRect.top - this.dragOffsetY;

    newLeft = Math.max(0, Math.min(overlayRect.width - stampEl.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(overlayRect.height - stampEl.offsetHeight, newTop));

    stampEl.style.left = newLeft + 'px';
    stampEl.style.top = newTop + 'px';
  },

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    const stampEl = document.getElementById('stamp-ws-stamp');
    stampEl.classList.remove('dragging');

    const left = parseInt(stampEl.style.left) || 0;
    const top = parseInt(stampEl.style.top) || 0;
    const pdfPos = this.canvasToPdf(left, top);
    const key = this.currentFileIdx + '-' + this.currentPageIdx;
    this.stampPlacements[key] = pdfPos;

    setTimeout(() => { this.isDragging = false; }, 50);
  },

  // ===== Stamp image creation =====
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
    const ps = this.calcImagePageSize(image.width, image.height);
    const page = pdfDoc.addPage([ps.pageW, ps.pageH]);
    page.drawImage(image, { x: 0, y: 0, width: ps.pageW, height: ps.pageH });
    return pdfDoc;
  },

  // ===== Process =====
  async process() {
    const btn = document.getElementById('stamp-ws-process');
    btn.disabled = true; btn.textContent = '処理中...';
    const fontSize = parseInt(document.getElementById('stamp-ws-size').value) || 24;
    const pos = document.getElementById('stamp-ws-position').value;

    for (let i = 0; i < this.files.length; i++) {
      const label = this.getStampLabel(i);
      this.files[i].status = 'processing';
      try {
        const f = this.files[i].file;
        const isImg = /\.(jpg|jpeg|png)$/i.test(f.name);
        let pdfDoc = isImg ? await this.createPdfFromImage(f) : await PDFLib.PDFDocument.load(await f.arrayBuffer());
        const pages = pdfDoc.getPages();
        const stamp = await this.createStampImageBytes(label, fontSize);
        const stampImg = await pdfDoc.embedPng(stamp.bytes);

        const pagesToStamp = this.allPages ? pages.length : Math.min(1, pages.length);
        for (let pi = 0; pi < pagesToStamp; pi++) {
          const { width, height } = pages[pi].getSize();
          let x, y;

          const placement = this.stampPlacements[i + '-' + pi] || (pi > 0 ? this.stampPlacements[i + '-0'] : null);
          if (placement) {
            x = placement.x;
            y = placement.y - stamp.displayHeight;
          } else {
            const m = 12;
            switch (pos) {
              case 'top-right': x = width - stamp.displayWidth - m; y = height - stamp.displayHeight - m; break;
              case 'top-left': x = m; y = height - stamp.displayHeight - m; break;
              case 'bottom-right': x = width - stamp.displayWidth - m; y = m; break;
              case 'bottom-left': x = m; y = m; break;
            }
          }
          pages[pi].drawImage(stampImg, { x, y, width: stamp.displayWidth, height: stamp.displayHeight });
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
    }
    btn.textContent = 'スタンプを押して出力';
    btn.disabled = false;
  }
};

Router.register('stamp', StampTool);

// ===== 相手方書面分析 =====
const AnalysisTool = {
  files: [],
  rawResult: '',

  init() {
    const dz = document.getElementById('analysis-dropzone');
    const fi = document.getElementById('analysis-fileInput');
    const folder = document.getElementById('analysis-folderInput');
    const btnFolder = document.getElementById('analysis-btnFolder');

    if (dz._bound) return;
    dz._bound = true;

    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', async e => {
      e.preventDefault(); dz.classList.remove('dragover');
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entries = [];
        for (const item of items) {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) entries.push(entry);
        }
        if (entries.some(e => e.isDirectory)) {
          this.addFiles(await readEntriesRecursive(entries));
          return;
        }
      }
      this.addFiles(e.dataTransfer.files);
    });
    fi.addEventListener('change', () => { this.addFiles(fi.files); fi.value = ''; });
    btnFolder.addEventListener('click', e => { e.stopPropagation(); folder.click(); });
    folder.addEventListener('change', () => { this.addFiles(folder.files); folder.value = ''; });

    document.getElementById('analysis-btnGenerate').addEventListener('click', () => this.generate());
    document.getElementById('analysis-btnWord').addEventListener('click', () => {
      downloadWord(document.getElementById('analysis-resultContent').innerHTML, '書面分析');
    });
    document.getElementById('analysis-btnCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(this.rawResult).then(() => {
        const b = document.getElementById('analysis-btnCopy');
        b.textContent = 'コピーしました'; setTimeout(() => b.textContent = 'テキストをコピー', 2000);
      });
    });
  },

  addFiles(inputFiles) {
    for (const f of inputFiles) { if (isAcceptedFile(f)) this.files.push(f); }
    this.renderList();
  },

  renderList() {
    const list = document.getElementById('analysis-fileList');
    const stats = document.getElementById('analysis-fileStats');
    const btn = document.getElementById('analysis-btnGenerate');
    list.innerHTML = '';
    this.files.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `<span class="fname">${f.name}</span><span class="fsize">${formatSize(f.size)}</span><button class="fremove" data-idx="${i}">&times;</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll('.fremove').forEach(b => {
      b.addEventListener('click', () => { this.files.splice(parseInt(b.dataset.idx), 1); this.renderList(); });
    });
    const total = this.files.reduce((s, f) => s + f.size, 0);
    stats.textContent = this.files.length > 0 ? `${this.files.length}ファイル / ${formatSize(total)}` : '';
    btn.disabled = this.files.length === 0;
  },

  async generate() {
    const btn = document.getElementById('analysis-btnGenerate');
    const resultArea = document.getElementById('analysis-resultArea');
    const loading = document.getElementById('analysis-loading');
    const content = document.getElementById('analysis-resultContent');
    const errEl = document.getElementById('analysis-error');
    const actions = document.getElementById('analysis-resultActions');

    resultArea.style.display = '';
    loading.style.display = '';
    content.innerHTML = '';
    actions.style.display = 'none';
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = '分析中...';

    try {
      const parts = await buildFileParts(this.files);
      parts.push({ text: PROMPTS.analysis });
      loading.querySelector('.loading-text').textContent = `${this.files.length}ファイルを分析中...`;

      this.rawResult = await callWorkerStream(PROMPTS.system, parts, text => {
        loading.style.display = 'none';
        content.innerHTML = renderMarkdown(text);
      });
      loading.style.display = 'none';
      content.innerHTML = renderMarkdown(this.rawResult);
      actions.style.display = '';
    } catch (err) {
      loading.style.display = 'none';
      errEl.style.display = '';
      errEl.textContent = 'エラー: ' + err.message;
    }
    btn.disabled = false;
    btn.textContent = '分析開始';
  }
};

Router.register('analysis', AnalysisTool);

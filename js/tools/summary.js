// ===== 案件要約・時系列生成 =====
const SummaryTool = {
  files: [],
  rawResult: '',

  init() {
    const dz = document.getElementById('summary-dropzone');
    const fi = document.getElementById('summary-fileInput');
    const folder = document.getElementById('summary-folderInput');
    const btnFolder = document.getElementById('summary-btnFolder');
    const list = document.getElementById('summary-fileList');
    const stats = document.getElementById('summary-fileStats');
    const btn = document.getElementById('summary-btnGenerate');
    const resultArea = document.getElementById('summary-resultArea');
    const loading = document.getElementById('summary-loading');
    const content = document.getElementById('summary-resultContent');
    const errEl = document.getElementById('summary-error');
    const actions = document.getElementById('summary-resultActions');

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

    btn.addEventListener('click', () => this.generate());
    document.getElementById('summary-btnWord').addEventListener('click', () => {
      downloadWord(content.innerHTML, '案件要約書');
    });
    document.getElementById('summary-btnCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(this.rawResult).then(() => {
        const b = document.getElementById('summary-btnCopy');
        b.textContent = 'コピーしました'; setTimeout(() => b.textContent = 'テキストをコピー', 2000);
      });
    });
  },

  addFiles(inputFiles) {
    for (const f of inputFiles) { if (isAcceptedFile(f)) this.files.push(f); }
    this.renderList();
  },

  renderList() {
    const list = document.getElementById('summary-fileList');
    const stats = document.getElementById('summary-fileStats');
    const btn = document.getElementById('summary-btnGenerate');
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
    const btn = document.getElementById('summary-btnGenerate');
    const resultArea = document.getElementById('summary-resultArea');
    const loading = document.getElementById('summary-loading');
    const content = document.getElementById('summary-resultContent');
    const errEl = document.getElementById('summary-error');
    const actions = document.getElementById('summary-resultActions');

    resultArea.style.display = '';
    loading.style.display = '';
    content.innerHTML = '';
    actions.style.display = 'none';
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = '分析中...';

    try {
      const parts = await buildFileParts(this.files);
      parts.push({ text: PROMPTS.summaryAnalysis });
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
    btn.textContent = '要約を生成';
  }
};

Router.register('summary', SummaryTool);

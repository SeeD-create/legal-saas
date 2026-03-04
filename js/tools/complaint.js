// ===== 訴状・申立書テンプレート生成 =====
const ComplaintTool = {
  files: [],
  rawResult: '',

  init() {
    const dz = document.getElementById('complaint-dropzone');
    const fi = document.getElementById('complaint-fileInput');
    const folder = document.getElementById('complaint-folderInput');
    const btnFolder = document.getElementById('complaint-btnFolder');

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

    document.getElementById('complaint-btnGenerate').addEventListener('click', () => this.generate());
    document.getElementById('complaint-btnWord').addEventListener('click', () => {
      downloadWord(document.getElementById('complaint-resultContent').innerHTML, '訴状ドラフト');
    });
    document.getElementById('complaint-btnCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(this.rawResult).then(() => {
        const b = document.getElementById('complaint-btnCopy');
        b.textContent = 'コピーしました'; setTimeout(() => b.textContent = 'テキストをコピー', 2000);
      });
    });
  },

  addFiles(inputFiles) {
    for (const f of inputFiles) { if (isAcceptedFile(f)) this.files.push(f); }
    this.renderList();
  },

  renderList() {
    const list = document.getElementById('complaint-fileList');
    const stats = document.getElementById('complaint-fileStats');
    const btn = document.getElementById('complaint-btnGenerate');
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
    const btn = document.getElementById('complaint-btnGenerate');
    const resultArea = document.getElementById('complaint-resultArea');
    const loading = document.getElementById('complaint-loading');
    const content = document.getElementById('complaint-resultContent');
    const errEl = document.getElementById('complaint-error');
    const actions = document.getElementById('complaint-resultActions');
    const caseType = document.getElementById('complaint-caseType').value.trim();

    resultArea.style.display = '';
    loading.style.display = '';
    content.innerHTML = '';
    actions.style.display = 'none';
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const parts = await buildFileParts(this.files);
      let prompt = PROMPTS.complaint;
      if (caseType) prompt += `\n\n【案件の種類】\n${caseType}`;
      parts.push({ text: prompt });
      loading.querySelector('.loading-text').textContent = `訴状を生成中...`;

      this.rawResult = await callWorkerStream(PROMPTS.system, parts, text => {
        loading.style.display = 'none';
        content.innerHTML = renderMarkdown(text);
      }, 'complaint');
      loading.style.display = 'none';
      content.innerHTML = renderMarkdown(this.rawResult);
      actions.style.display = '';
    } catch (err) {
      loading.style.display = 'none';
      errEl.style.display = '';
      errEl.textContent = 'エラー: ' + err.message;
    }
    btn.disabled = false;
    btn.textContent = '訴状を生成';
  }
};

Router.register('complaint', ComplaintTool);

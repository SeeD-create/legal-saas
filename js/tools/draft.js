// ===== 準備書面ドラフト生成 =====
const DraftTool = {
  files: [],
  rawResult: '',

  init() {
    const dz = document.getElementById('draft-dropzone');
    const fi = document.getElementById('draft-fileInput');
    const folder = document.getElementById('draft-folderInput');
    const btnFolder = document.getElementById('draft-btnFolder');

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

    document.getElementById('draft-btnGenerate').addEventListener('click', () => this.generate());
    document.getElementById('draft-btnWord').addEventListener('click', () => {
      downloadWord(document.getElementById('draft-resultContent').innerHTML, '準備書面ドラフト');
    });
    document.getElementById('draft-btnCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(this.rawResult).then(() => {
        const b = document.getElementById('draft-btnCopy');
        b.textContent = 'コピーしました'; setTimeout(() => b.textContent = 'テキストをコピー', 2000);
      });
    });
  },

  addFiles(inputFiles) {
    for (const f of inputFiles) { if (isAcceptedFile(f)) this.files.push(f); }
    this.renderList();
  },

  renderList() {
    const list = document.getElementById('draft-fileList');
    const stats = document.getElementById('draft-fileStats');
    const btn = document.getElementById('draft-btnGenerate');
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
    const btn = document.getElementById('draft-btnGenerate');
    const resultArea = document.getElementById('draft-resultArea');
    const loading = document.getElementById('draft-loading');
    const content = document.getElementById('draft-resultContent');
    const errEl = document.getElementById('draft-error');
    const actions = document.getElementById('draft-resultActions');
    const purpose = document.getElementById('draft-purpose').value.trim();

    resultArea.style.display = '';
    loading.style.display = '';
    content.innerHTML = '';
    actions.style.display = 'none';
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const parts = await buildFileParts(this.files);
      let prompt = PROMPTS.draft;
      if (purpose) prompt += `\n\n【書面の目的・ポイント】\n${purpose}`;
      parts.push({ text: prompt });
      loading.querySelector('.loading-text').textContent = `準備書面を生成中...`;

      this.rawResult = await callWorkerStream(PROMPTS.system, parts, text => {
        loading.style.display = 'none';
        content.innerHTML = renderMarkdown(text);
      }, 'draft');
      loading.style.display = 'none';
      content.innerHTML = renderMarkdown(this.rawResult);
      actions.style.display = '';
    } catch (err) {
      loading.style.display = 'none';
      errEl.style.display = '';
      errEl.textContent = 'エラー: ' + err.message;
    }
    btn.disabled = false;
    btn.textContent = '準備書面を生成';
  }
};

Router.register('draft', DraftTool);

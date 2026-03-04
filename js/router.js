// ===== Hash-based SPA Router =====
const Router = {
  currentTool: null,
  tools: {},
  initialized: false,

  register(name, tool) {
    this.tools[name] = tool;
  },

  init() {
    if (this.initialized) { this.navigate(); return; }
    this.initialized = true;

    // Setup nav click handlers
    document.querySelectorAll('.nav-item[data-tool]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        if (el.classList.contains('locked')) return;
        location.hash = el.dataset.tool;
      });
    });

    window.addEventListener('hashchange', () => this.navigate());
    this.navigate();

    // Fetch usage data
    Usage.fetch().then(() => Usage.updateSidebarBadges());
  },

  navigate() {
    const hash = (location.hash || '#summary').slice(1);
    const toolName = hash || 'summary';

    // Update nav
    document.querySelectorAll('.nav-item[data-tool]').forEach(el => {
      el.classList.toggle('active', el.dataset.tool === toolName);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(el => {
      el.classList.toggle('active', el.id === 'page-' + toolName);
    });

    // Initialize tool if needed
    if (this.tools[toolName] && this.tools[toolName].init && this.currentTool !== toolName) {
      this.tools[toolName].init();
    }
    this.currentTool = toolName;
  }
};

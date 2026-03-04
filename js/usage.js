// ===== 利用回数管理 =====
const Usage = {
  data: null,

  async fetch() {
    const token = Auth.getToken();
    if (!token) return;
    try {
      const resp = await fetch(WORKER_URL + '/api/usage', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (resp.ok) this.data = await resp.json();
    } catch (e) {}
  },

  canUse(toolType) {
    if (!this.data) return true; // Allow if data not loaded yet
    const key = this.getUsageKey(toolType);
    const limit = this.data.limits[key];
    if (limit === undefined) return false;
    if (limit === -1) return true; // unlimited
    if (limit === 0) return false;
    return (this.data.usage[key] || 0) < limit;
  },

  getRemaining(toolType) {
    if (!this.data) return '---';
    const key = this.getUsageKey(toolType);
    const limit = this.data.limits[key];
    if (limit === -1) return '無制限';
    if (limit === 0) return '利用不可';
    const used = this.data.usage[key] || 0;
    return `${used} / ${limit}`;
  },

  getUsageKey(toolType) {
    const map = { summaryAnalysis: 'summary', analysis: 'analysis', draft: 'draft', complaint: 'complaint', precedent: 'precedent' };
    return map[toolType] || 'summary';
  },

  updateSidebarBadges() {
    if (!this.data) return;
    const badges = {
      'summary': 'summary',
      'analysis': 'analysis',
      'draft': 'draft',
      'complaint': 'complaint',
      'precedent': 'precedent'
    };
    for (const [tool, key] of Object.entries(badges)) {
      const el = document.querySelector(`.nav-item[data-tool="${tool}"] .usage-badge`);
      if (el) {
        const limit = this.data.limits[key];
        if (limit === 0) {
          el.textContent = '🔒';
          el.className = 'usage-badge locked';
        } else if (limit === -1) {
          el.textContent = '∞';
          el.className = 'usage-badge unlimited';
        } else {
          const used = this.data.usage[key] || 0;
          el.textContent = `${used}/${limit}`;
          el.className = 'usage-badge' + (used >= limit ? ' exhausted' : '');
        }
      }
    }
  }
};

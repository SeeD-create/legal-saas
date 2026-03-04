// ===== 損害計算ツール =====
const CalculatorTool = {
  init() {
    if (document.getElementById('calc-btnCalc')._bound) return;
    document.getElementById('calc-btnCalc')._bound = true;

    document.getElementById('calc-btnCalc').addEventListener('click', () => this.calculate());
    document.getElementById('calc-btnClear').addEventListener('click', () => this.clear());
  },

  calculate() {
    const principal = parseFloat(document.getElementById('calc-principal').value);
    const ratePercent = parseFloat(document.getElementById('calc-rate').value);
    const startDate = document.getElementById('calc-startDate').value;
    const endDate = document.getElementById('calc-endDate').value;

    if (!principal || !ratePercent || !startDate || !endDate) {
      alert('全ての項目を入力してください。');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      alert('終了日は開始日より後の日付を指定してください。');
      return;
    }

    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const rate = ratePercent / 100;

    // 日割り計算（年365日）
    const damage = Math.floor(principal * rate * days / 365);
    const total = principal + damage;

    const resultEl = document.getElementById('calc-result');
    resultEl.style.display = '';
    resultEl.innerHTML = `
      <div class="calc-result">
        <div style="font-size:13px;color:#555;margin-bottom:8px">遅延損害金</div>
        <div class="amount">&yen;${damage.toLocaleString()}</div>
        <div class="detail">元金 + 遅延損害金 = <strong>&yen;${total.toLocaleString()}</strong></div>
        <table class="calc-table" style="margin-top:16px">
          <tr><th>元金</th><td>&yen;${principal.toLocaleString()}</td></tr>
          <tr><th>利率</th><td>${ratePercent}%</td></tr>
          <tr><th>起算日</th><td>${this.formatDate(start)}</td></tr>
          <tr><th>終了日</th><td>${this.formatDate(end)}</td></tr>
          <tr><th>日数</th><td>${days}日</td></tr>
          <tr><th>計算式</th><td>${principal.toLocaleString()} &times; ${ratePercent}% &times; ${days}日 &divide; 365日</td></tr>
          <tr><th>遅延損害金</th><td><strong>&yen;${damage.toLocaleString()}</strong></td></tr>
          <tr><th>合計</th><td><strong>&yen;${total.toLocaleString()}</strong></td></tr>
        </table>
      </div>
    `;
  },

  formatDate(d) {
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  },

  clear() {
    document.getElementById('calc-principal').value = '';
    document.getElementById('calc-rate').value = '3';
    document.getElementById('calc-startDate').value = '';
    document.getElementById('calc-endDate').value = '';
    document.getElementById('calc-result').style.display = 'none';
  }
};

Router.register('calculator', CalculatorTool);

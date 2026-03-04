// ===== Markdown to HTML Renderer =====
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table>'; inTable = false; }
      html += '<h3>' + escapeAndBold(line.slice(4)) + '</h3>';
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table>'; inTable = false; }
      html += '<h2>' + escapeAndBold(line.slice(3)) + '</h2>';
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table>'; inTable = false; }
      html += '<h1>' + escapeAndBold(line.slice(2)) + '</h1>';
      continue;
    }

    if (line.trim().startsWith('|')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (/^\|[\s\-:]+\|/.test(line.trim()) && !/[a-zA-Z\u3000-\u9fff]/.test(line)) continue;
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
      if (!inTable) {
        html += '<table><thead><tr>';
        cells.forEach(c => { html += '<th>' + escapeAndBold(c) + '</th>'; });
        html += '</tr></thead><tbody>';
        inTable = true;
      } else {
        html += '<tr>';
        cells.forEach(c => { html += '<td>' + escapeAndBold(c) + '</td>'; });
        html += '</tr>';
      }
      continue;
    } else if (inTable) {
      html += '</tbody></table>';
      inTable = false;
    }

    if (/^[-*] /.test(line.trim())) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + escapeAndBold(line.trim().slice(2)) + '</li>';
      continue;
    } else if (inList && line.trim() === '') {
      html += '</ul>';
      inList = false;
      continue;
    }

    if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    html += '<p>' + escapeAndBold(line) + '</p>';
  }

  if (inList) html += '</ul>';
  if (inTable) html += '</tbody></table>';
  return html;
}

function escapeAndBold(text) {
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return text;
}

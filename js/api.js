// ===== Cloudflare Worker API Client =====
const WORKER_URL = 'https://case-summary-api.seed-legal.workers.dev';

// File helpers
function isAcceptedFile(f) {
  const n = f.name.toLowerCase();
  return n.endsWith('.pdf') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMimeType(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Recursive folder reading
function readEntriesRecursive(entries) {
  return new Promise(resolve => {
    const filePromises = [];
    let pending = 0;

    function processEntry(entry) {
      if (entry.isFile) {
        pending++;
        filePromises.push(new Promise(res => {
          entry.file(f => { pending--; res(f); });
        }));
      } else if (entry.isDirectory) {
        pending++;
        const reader = entry.createReader();
        readAllEntries(reader, childEntries => {
          for (const child of childEntries) processEntry(child);
          pending--;
          check();
        });
      }
    }

    function readAllEntries(reader, cb) {
      let all = [];
      function read() {
        reader.readEntries(results => {
          if (results.length === 0) { cb(all); return; }
          all = all.concat(Array.from(results));
          read();
        });
      }
      read();
    }

    function check() {
      if (pending === 0) resolve(Promise.all(filePromises));
    }

    for (const entry of entries) processEntry(entry);
    setTimeout(() => check(), 50);
  });
}

// Build file parts for Gemini API
async function buildFileParts(files) {
  const parts = [];
  for (const f of files) {
    const b64 = await fileToBase64(f);
    parts.push({ inline_data: { mime_type: getMimeType(f), data: b64 } });
    parts.push({ text: `[ファイル名: ${f.name}]` });
  }
  return parts;
}

// Streaming API call via Worker
async function callWorkerStream(systemPrompt, userParts, onChunk) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: userParts }],
    generationConfig: { maxOutputTokens: 16384, temperature: 0.1 }
  };

  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    let errText = '';
    try {
      const errJson = await resp.json();
      errText = errJson.error?.message || JSON.stringify(errJson);
    } catch { errText = `HTTP ${resp.status}`; }
    throw new Error(errText);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          fullText += text;
          onChunk(fullText);
        }
      } catch {}
    }
  }

  return fullText;
}

// Word download helper
function downloadWord(htmlBody, title) {
  const today = new Date().toLocaleDateString('ja-JP');
  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page{size:A4;margin:2cm}
body{font-family:"游ゴシック","Yu Gothic",sans-serif;font-size:10.5pt;line-height:1.8;color:#222}
h1{font-size:18pt;text-align:center;margin:0 0 12pt;color:#111}
h2{font-size:14pt;border-bottom:2pt solid #333;padding-bottom:3pt;margin:18pt 0 8pt;color:#111}
h3{font-size:12pt;margin:12pt 0 4pt;color:#222}
p{margin:4pt 0}ul{padding-left:20pt;margin:4pt 0}li{margin:2pt 0}
table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:9.5pt}
th,td{border:1pt solid #999;padding:4pt 8pt;vertical-align:top}
th{background-color:#f0f0f0;font-weight:bold}
.disclaimer{font-size:8pt;color:#999;margin-top:30pt;border-top:1pt solid #ccc;padding-top:6pt}
</style></head><body>
<h1>${title}</h1>
<p style="text-align:center;color:#666;font-size:9pt;margin-bottom:18pt">作成日: ${today}</p>
${htmlBody}
<div class="disclaimer">※本書はAIにより自動生成されたものです。内容の正確性については必ず原資料をご確認ください。</div>
</body></html>`;

  const blob = new Blob(['\ufeff' + doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = title + '_' + today.replace(/\//g, '') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

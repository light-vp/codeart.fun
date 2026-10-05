// Tiny dependency-free code editor: a transparent <textarea> over a
// syntax-highlighted <pre>, plus a gutter and a "current line" bar that the
// player moves as the program executes.

const KEYWORDS = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const BUILTINS = new Set('print len range enumerate zip sorted reversed min max sum abs int str float list dict set tuple bool map filter any all isinstance ord chr divmod round input open type super self'.split(' '));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightPython(code) {
  const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\w\s])|(\s+)/g;
  let out = '';
  let m;
  let prevWord = '';
  while ((m = re.exec(code))) {
    const [tok, comment, str, num, word, punct] = m;
    if (comment) out += `<span class="tk-com">${escapeHtml(comment)}</span>`;
    else if (str) out += `<span class="tk-str">${escapeHtml(str)}</span>`;
    else if (num) out += `<span class="tk-num">${num}</span>`;
    else if (word) {
      if (prevWord === 'def' || prevWord === 'class') out += `<span class="tk-def">${word}</span>`;
      else if (KEYWORDS.has(word)) out += `<span class="tk-kw">${word}</span>`;
      else if (BUILTINS.has(word)) out += `<span class="tk-bi">${word}</span>`;
      else out += word;
      prevWord = word;
      continue;
    } else if (punct) out += `<span class="tk-op">${escapeHtml(punct)}</span>`;
    else out += tok;
    if (!/^\s+$/.test(tok)) prevWord = '';
  }
  return out + '\n';
}

export class CodeEditor {
  constructor(root, { onChange } = {}) {
    this.root = root;
    root.classList.add('code-editor');
    root.innerHTML = `
      <div class="ce-gutter" aria-hidden="true"></div>
      <div class="ce-body">
        <div class="ce-line ce-line-run" hidden></div>
        <div class="ce-line ce-line-err" hidden></div>
        <pre class="ce-hl" aria-hidden="true"><code></code></pre>
        <textarea class="ce-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Python code editor"></textarea>
      </div>`;
    this.gutter = root.querySelector('.ce-gutter');
    this.body = root.querySelector('.ce-body');
    this.input = root.querySelector('.ce-input');
    this.hl = root.querySelector('.ce-hl code');
    this.runLine = root.querySelector('.ce-line-run');
    this.errLine = root.querySelector('.ce-line-err');
    this.onChange = onChange;

    this.input.addEventListener('input', () => { this.refresh(); this.onChange?.(this.value); });
    this.input.addEventListener('scroll', () => this.syncScroll());
    this.input.addEventListener('keydown', (e) => this.handleKey(e));
  }

  get value() { return this.input.value; }
  set value(v) { this.input.value = v; this.refresh(); }

  lineHeight() { return parseFloat(getComputedStyle(this.input).lineHeight) || 20; }

  refresh() {
    this.hl.innerHTML = highlightPython(this.input.value);
    const n = this.input.value.split('\n').length;
    if (this.gutter.childElementCount !== n) {
      this.gutter.innerHTML = Array.from({ length: n }, (_, i) => `<div>${i + 1}</div>`).join('');
    }
    this.syncScroll();
  }

  syncScroll() {
    const { scrollTop, scrollLeft } = this.input;
    this.hl.parentElement.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    this.gutter.style.transform = `translateY(${-scrollTop}px)`;
    this.positionMarker(this.runLine, this.runAt);
    this.positionMarker(this.errLine, this.errAt);
  }

  positionMarker(el, line) {
    if (!line) { el.hidden = true; return; }
    el.hidden = false;
    const lh = this.lineHeight();
    const pad = parseFloat(getComputedStyle(this.input).paddingTop) || 0;
    el.style.top = `${pad + (line - 1) * lh - this.input.scrollTop}px`;
    el.style.height = `${lh}px`;
  }

  setRunLine(line, { scroll = true } = {}) {
    this.runAt = line;
    this.positionMarker(this.runLine, line);
    [...this.gutter.children].forEach((d, i) => d.classList.toggle('active', i + 1 === line));
    if (line && scroll) {
      const lh = this.lineHeight();
      const y = (line - 1) * lh;
      const { scrollTop, clientHeight } = this.input;
      if (y < scrollTop || y > scrollTop + clientHeight - lh * 2) this.input.scrollTop = Math.max(0, y - clientHeight / 3);
    }
  }

  setErrorLine(line) { this.errAt = line; this.positionMarker(this.errLine, line); }

  handleKey(e) {
    const ta = this.input;
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); this.onRun?.(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = ta;
      if (s !== end && value.slice(s, end).includes('\n')) {
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const block = value.slice(lineStart, end);
        const next = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
        ta.setRangeText(next, lineStart, end, 'select');
      } else if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const strip = value.slice(lineStart, lineStart + 4).match(/^ */)[0].length;
        ta.setRangeText('', lineStart, lineStart + strip, 'end');
      } else {
        ta.setRangeText('    ', s, end, 'end');
      }
      this.refresh(); this.onChange?.(this.value);
    } else if (e.key === 'Enter') {
      const { selectionStart: s, value } = ta;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      let indent = line.match(/^\s*/)[0];
      if (/:\s*(#.*)?$/.test(line)) indent += '    ';
      e.preventDefault();
      ta.setRangeText('\n' + indent, s, ta.selectionEnd, 'end');
      this.refresh(); this.onChange?.(this.value);
    } else if (e.key === 'Backspace') {
      const { selectionStart: s, selectionEnd: end, value } = ta;
      if (s === end) {
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const before = value.slice(lineStart, s);
        if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0) {
          e.preventDefault();
          ta.setRangeText('', s - 4, s, 'end');
          this.refresh(); this.onChange?.(this.value);
        }
      }
    }
  }
}

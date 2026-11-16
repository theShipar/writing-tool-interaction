const editor = document.querySelector('#editor');
const toolbar = document.querySelector('.toolbar');
const formatButtons = [...document.querySelectorAll('[data-format]')];
const alignButtons = [...document.querySelectorAll('[data-align]')];
const indicator = document.querySelector('.alignment-indicator');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { bold: true, italic: false, underline: false, align: 'left' };
const storageKey = 'writing-tool-v1';
let dirty = true;
let animations = [];
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ text: editor.innerText, ...state })); } catch { /* Editing still works without storage. */ }
}
function words() {
  if (!dirty) return;
  const text = editor.innerText;
  const fragment = document.createDocumentFragment();
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) fragment.append(document.createTextNode(token));
    else { const span = document.createElement('span'); span.className = 'word'; span.textContent = token; fragment.append(span); }
  }
  editor.replaceChildren(fragment);
  dirty = false;
}
function render() {
  formatButtons.forEach((button, i) => {
    const active = state[button.dataset.format];
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('join-left', active && i > 0 && state[formatButtons[i - 1].dataset.format]);
    button.classList.toggle('join-right', active && i < 2 && state[formatButtons[i + 1].dataset.format]);
    editor.dataset[button.dataset.format] = String(active);
  });
  alignButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.align === state.align)));
  const index = alignButtons.findIndex(button => button.dataset.align === state.align);
  indicator.style.transform = `translateX(${index * alignButtons[0].offsetWidth}px)`;
  editor.style.textAlign = state.align;
}
function update(key, value) {
  // Measure each word before/after layout, then animate the difference.
  // This also allows a new click to interrupt a running transition smoothly.
  words();
  const spans = [...editor.querySelectorAll('.word')];
  const before = spans.map(span => span.getBoundingClientRect());
  animations.forEach(animation => animation.cancel());
  state[key] = value;
  render();
  const after = spans.map(span => span.getBoundingClientRect());
  animations = [];
  if (!reducedMotion.matches && key !== 'underline') spans.forEach((span, i) => {
    const x = before[i].left - after[i].left, y = before[i].top - after[i].top;
    if (Math.abs(x) + Math.abs(y) > .2) animations.push(span.animate([
      { transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }
    ], { duration: 440, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
  });
  document.querySelector('#status').textContent = key === 'align' ? `Text aligned ${value}` : `${key} ${value ? 'on' : 'off'}`;
  save();
}
toolbar.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.format) update(button.dataset.format, !state[button.dataset.format]);
  if (button.dataset.align) update('align', button.dataset.align);
});
toolbar.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...toolbar.querySelectorAll('button')];
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[index].focus();
});
editor.addEventListener('input', () => { dirty = true; save(); });
editor.addEventListener('blur', words);
document.addEventListener('keydown', event => {
  const key = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()];
  if (!(event.metaKey || event.ctrlKey) || event.altKey || !key) return;
  event.preventDefault();
  // Preserve native editing selection for keyboard-driven formatting.
  if (document.activeElement === editor) {
    state[key] = !state[key]; render(); save();
  } else update(key, !state[key]);
});
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved.text === 'string') {
    editor.textContent = saved.text;
    for (const key of ['bold', 'italic', 'underline']) if (typeof saved[key] === 'boolean') state[key] = saved[key];
    if (['left', 'center', 'right', 'justify'].includes(saved.align)) state.align = saved.align;
  }
} catch { /* Ignore unavailable storage or an invalid saved draft. */ }
words(); render();
window.addEventListener('resize', render);

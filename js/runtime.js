// Loads Pyodide (CPython compiled to WebAssembly) once, installs the tracer,
// and exposes trace() / test() helpers that return plain JS objects.

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let ready = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export function loadPython(onStatus = () => {}) {
  if (!ready) {
    ready = (async () => {
      onStatus('Downloading Python (first visit only)…');
      if (!window.loadPyodide) await loadScript(`${PYODIDE_URL}pyodide.js`);
      const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
      onStatus('Installing the tracer…');
      const src = await fetch(new URL('../py/tracer.py', import.meta.url)).then((r) => {
        if (!r.ok) throw new Error('Could not load tracer.py');
        return r.text();
      });
      py.runPython(src);
      onStatus('Python ready');
      return py;
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

function call(py, name, ...args) {
  const fn = py.globals.get(name);
  try { return JSON.parse(fn(...args)); } finally { fn.destroy(); }
}

export async function trace(source, maxSteps = 1500) {
  const py = await loadPython();
  return call(py, 'trace_program', source, maxSteps);
}

export async function test(source, spec) {
  const py = await loadPython();
  return call(py, 'run_tests', source, JSON.stringify(spec));
}

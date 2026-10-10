// The page's look: a design style crossed with a light/dark theme.
//
// Styles: "minimal" (css/base.css, the default) and "sketch" (the
// vaibhav.co.uk sketchbook, css/sketch/*.css). Each page lists the sketch
// sheets as <link data-look="sketch"> and the minimal-only ones as
// data-look="minimal"; an inline script in <head> applies the saved look
// before first paint, and this module switches it afterwards.
export const STYLES = ['minimal', 'sketch'];
const STYLE_NAMES = { minimal: 'minimal', sketch: 'sketchbook' };

const root = document.documentElement;
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } };
const saved = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
// until someone picks a theme, each style opens in its own: minimal is dark,
// the sketchbook is paper
const DEFAULT_THEME = { minimal: 'dark', sketch: 'light' };

export const currentStyle = () => (root.dataset.style === 'sketch' ? 'sketch' : 'minimal');
export const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
// the BlockScene palette for the current look (see THEMES in scene.js)
export const sceneTheme = () => `${currentStyle()}-${currentTheme()}`;

export function setStyle(style) {
  root.dataset.style = style;
  if (!saved('codeart-theme')) root.dataset.theme = DEFAULT_THEME[style];
  document.querySelectorAll('link[data-look]').forEach((link) => { link.disabled = link.dataset.look !== style; });
  save('codeart-style', style);
}

export function toggleTheme() {
  root.dataset.theme = currentTheme() === 'dark' ? 'light' : 'dark';
  save('codeart-theme', root.dataset.theme);
}

export function toggleStyle() {
  setStyle(STYLES[(STYLES.indexOf(currentStyle()) + 1) % STYLES.length]);
}

// Wire the theme and style buttons; onChange runs after either switches.
export function bindLookButtons({ themeBtn, styleBtn, onChange }) {
  const label = () => {
    const next = STYLES[(STYLES.indexOf(currentStyle()) + 1) % STYLES.length];
    styleBtn.title = `Design style: ${STYLE_NAMES[currentStyle()]}. Switch to ${STYLE_NAMES[next]}`;
    styleBtn.setAttribute('aria-label', styleBtn.title);
  };
  themeBtn.onclick = () => { toggleTheme(); onChange?.(); };
  styleBtn.onclick = () => {
    toggleStyle();
    label();
    onChange?.();
    // the new style's fonts start loading once it applies; redraw with them
    requestAnimationFrame(() => document.fonts?.ready.then(() => onChange?.()));
  };
  label();
}

(() => {
  const saved = localStorage.getItem('mt-v5-theme');
  const theme = saved === 'dark' || saved === 'light' ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    button.textContent = 'Mørk/Lys';
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('mt-v5-theme', next);
    });
  });
})();

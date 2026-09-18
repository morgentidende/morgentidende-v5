(() => {
  const saved = localStorage.getItem('mt-v5-theme');
  const theme = saved === 'dark' || saved === 'light'
    ? saved
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const render = () => { button.textContent = document.documentElement.dataset.theme === 'dark' ? 'Lys' : 'Mørk'; };
    render();
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('mt-v5-theme', next);
      render();
    });
  });
})();

(function() {
  const getTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
})();

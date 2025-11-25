// theme.js - toggle light/dark theme and persist in localStorage
(function(){
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const key = 'mi_biblioteca_theme';

  function setTheme(theme){
    // Accept 'light' or 'dark' explicitly
    if(theme === 'light' || theme === 'dark'){
      root.setAttribute('data-theme', theme);
      if(toggle) toggle.textContent = theme === 'light' ? '☀️' : '🌙';
      // Update Bootstrap navbar classes for correct contrast
      const navbar = document.getElementById('main-navbar');
      if(navbar){
        if(theme === 'light'){
          navbar.classList.remove('navbar-dark','bg-dark');
          navbar.classList.add('navbar-light','bg-light');
        } else {
          navbar.classList.remove('navbar-light','bg-light');
          navbar.classList.add('navbar-dark','bg-dark');
        }
      }
      // Update toggle button outline for visibility
      if(toggle){
        toggle.classList.remove('btn-outline-light','btn-outline-dark');
        toggle.classList.add(theme === 'light' ? 'btn-outline-dark' : 'btn-outline-light');
      }
    }
    try{ localStorage.setItem(key, theme); } catch(e){}
  }

  function init(){
    let saved = null;
    try{ saved = localStorage.getItem(key); } catch(e){}
    if(saved){ setTheme(saved); }
    else {
      // Respect system preference
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      setTheme(prefersLight ? 'light' : 'dark');
    }
  }

  if(toggle){
    toggle.addEventListener('click', (e)=>{
      const current = root.getAttribute('data-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }

  // Ensure initial DOM update if script loaded after DOMContentLoaded
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'complete') init();
  });

  document.addEventListener('DOMContentLoaded', init);
})();

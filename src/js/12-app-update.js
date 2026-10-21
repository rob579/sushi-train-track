/* ---- installable app: offline support and update prompt ---- */
function showUpdateBanner(){
  if (document.getElementById('update-banner')) return;
  const b = document.createElement('div');
  b.id = 'update-banner'; b.setAttribute('role', 'status');
  b.innerHTML = '<span>New version ready</span><button class="go" type="button">Reload</button><button class="x" type="button" aria-label="Dismiss">×</button>';
  b.querySelector('.go').onclick = () => location.reload();
  b.querySelector('.x').onclick = () => b.remove();
  document.body.appendChild(b);
}
if ('serviceWorker' in navigator) {
  // the service worker reports its version when it activates; if this page is older, offer a reload
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'sw-version' && e.data.version !== BUILD_ID) showUpdateBanner();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 60 * 60 * 1000);
    }).catch(() => {});
  });
}

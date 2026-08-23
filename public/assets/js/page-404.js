// سكربت صفحة /404 — أُخرج من HTML ليعمل مع CSP الصارم
document.getElementById('slug').textContent =
    'rviosstore.com' + decodeURIComponent(location.pathname);

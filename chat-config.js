(() => {
  const pagesOrigin = 'https://michael-wang-12.github.io';
  const chatOrigin = 'https://xiaomai-chat-michaelwrz12-3929.vercel.app';
  const webPage = location.protocol === 'https:' || location.protocol === 'http:';
  // Pages is static. The full web app serves both the page and /api/chat on its own host.
  const origin = location.origin === pagesOrigin ? chatOrigin : location.origin;
  window.XIAOMAI_CHAT_CONFIG = {endpoint: webPage ? new URL('/api/chat', origin).href : ''};
})();

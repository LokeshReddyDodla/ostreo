// Cloudflare Pages Function to handle API routes and SSR
// Static files are served automatically by Cloudflare Pages

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Let Cloudflare Pages serve static assets automatically
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.startsWith('/.vite/') ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/)) {
    return context.next();
  }
  
  // For API routes, try to use the server handler
  if (url.pathname.startsWith('/api/')) {
    try {
      const serverModule = await import('../build/server/index.js').catch(() => null);
      if (serverModule?.default?.fetch) {
        return serverModule.default.fetch(context.request, {
          env: context.env,
          ctx: context,
        });
      }
    } catch (error) {
      console.error('API route error:', error);
    }
  }
  
  // For all other routes, serve the prerendered static HTML
  // Cloudflare Pages will serve index.html for SPA routes
  return context.next();
}

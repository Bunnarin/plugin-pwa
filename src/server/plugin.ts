import { Plugin } from '@nocobase/server';

export class PluginPwaServer extends Plugin {
  async load() {
    // Use raw Node.js response to bypass Koa/NocoBase API response formatting
    this.app.use(async (ctx, next) => {
      // 1. SVG icon for PWA (valid at any declared size)
      if (ctx.path === '/api/pwa-icon.svg') {
        const settings = await ctx.db.getRepository('systemSettings')?.findOne();
        const title = (settings?.get('title') as string) || 'App';
        const initial = title.charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1677ff"/>
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
        font-family="sans-serif" font-size="280" font-weight="bold" fill="#fff">${initial}</text>
</svg>`;
        ctx.respond = false;
        ctx.res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        });
        ctx.res.end(svg);
        return;
      }

      // 2. Service worker with fetch handler (required for installability)
      if (ctx.path === '/api/sw.js') {
        const swScript = [
          "self.addEventListener('install', () => self.skipWaiting());",
          "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));",
          "self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));",
        ].join('\n');
        ctx.respond = false;
        ctx.res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Service-Worker-Allowed': '/',
          'Cache-Control': 'no-cache',
        });
        ctx.res.end(swScript);
        return;
      }

      // 3. Web App Manifest
      if (ctx.path === '/api/manifest.json') {
        const settings = await ctx.db.getRepository('systemSettings')?.findOne();
        const title = (settings?.get('title') as string) || 'NocoBase';
        const manifest = JSON.stringify({
          name: title,
          short_name: title,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1677ff',
          icons: [
            {
              src: '/api/pwa-icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/api/pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        });
        ctx.respond = false;
        ctx.res.writeHead(200, {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'no-cache',
        });
        ctx.res.end(manifest);
        return;
      }

      await next();
    });
  }
}

export default PluginPwaServer;

import { Plugin } from '@nocobase/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/** Read pixel dimensions from a PNG or JPEG buffer. Returns [width, height] or null. */
function getImageDimensions(buf: Buffer): [number, number] | null {
  // PNG: bytes 0-7 are the signature, IHDR width at 16-19, height at 20-23
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  // JPEG: scan for SOF0/SOF2 marker (0xFF 0xC0 or 0xFF 0xC2)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return [width, height];
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }
  return null;
}

function buildFallbackSvg(title: string): string {
  const initial = title.charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1677ff"/>
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
        font-family="sans-serif" font-size="280" font-weight="bold" fill="#fff">${initial}</text>
</svg>`;
}

export class PluginPwaServer extends Plugin {
  async load() {
    this.app.use(async (ctx, next) => {
      // 1. PWA icon — serve logo if large enough, otherwise fallback SVG
      if (ctx.path === '/api/pwa-icon') {
        const settings = await ctx.db.getRepository('systemSettings')?.findOne();
        const logoId = settings?.get('logoId');
        const title = (settings?.get('title') as string) || 'App';

        if (logoId) {
          const attachment = await ctx.db.getRepository('attachments')?.findOne({ filter: { id: logoId } });
          if (attachment) {
            const filename = attachment.get('filename') as string;
            const mimetype = (attachment.get('mimetype') as string) || 'image/png';
            const subPath = (attachment.get('path') as string) || '';
            const storageId = attachment.get('storageId');

            let documentRoot = 'storage/uploads';
            if (storageId) {
              const storage = await ctx.db.getRepository('storages')?.findOne({ filter: { id: storageId } });
              if (storage) {
                const options = storage.get('options') as Record<string, string> | undefined;
                documentRoot = options?.documentRoot
              }
            }

            const filePath = resolve(process.cwd(), documentRoot, subPath, filename);
            try {
              const fileData = await readFile(filePath);
              const dims = getImageDimensions(fileData);

              // Only serve the actual image if both dimensions are >= 512
              if (dims && dims[0] >= 512 && dims[1] >= 512) {
                ctx.respond = false;
                ctx.res.writeHead(200, {
                  'Content-Type': mimetype,
                  'Cache-Control': 'public, max-age=86400',
                });
                ctx.res.end(fileData);
                return;
              }
              // Image too small — fall through to SVG
            } catch {
              // File not found — fall through to SVG
            }
          }
        }

        // Fallback: generated SVG (valid at any declared size)
        ctx.respond = false;
        ctx.res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        });
        ctx.res.end(buildFallbackSvg(title));
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

      // 3. Web App Manifest — always declare SVG to guarantee Chrome accepts it
      if (ctx.path === '/api/manifest.json') {
        const settings = await ctx.db.getRepository('systemSettings')?.findOne();
        const title = (settings?.get('title') as string) || 'NocoBase';

        const logoId = settings?.get('logoId');

        let hasSuitableLogo = false
        let mimetype = 'image/svg+xml';

        if (logoId) {
          const attachment = await ctx.db.getRepository('attachments')?.findOne({ filter: { id: logoId } });
          if (attachment) {
            const filename = attachment.get('filename') as string;
            mimetype = (attachment.get('mimetype') as string) || 'image/png';
            const subPath = (attachment.get('path') as string) || '';
            const storageId = attachment.get('storageId');

            let documentRoot = 'storage/uploads';
            if (storageId) {
              const storage = await ctx.db.getRepository('storages')?.findOne({ filter: { id: storageId } });
              if (storage) {
                const options = storage.get('options') as Record<string, string> | undefined;
                documentRoot = options?.documentRoot
              }
            }

            const filePath = resolve(process.cwd(), documentRoot, subPath, filename);
            try {
              const fileData = await readFile(filePath);
              const dims = getImageDimensions(fileData);

              // Only serve the actual image if both dimensions are >= 512
              hasSuitableLogo = dims && dims[0] >= 512 && dims[1] >= 512
              // Image too small — fall through to SVG
            } catch {
              // File not found — fall through to SVG
            }
          }
        }

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
              src: '/api/pwa-icon',
              sizes: '192x192',
              type: hasSuitableLogo ? mimetype : 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/api/pwa-icon',
              sizes: '512x512',
              type: hasSuitableLogo ? mimetype : 'image/svg+xml',
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

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const VIRTUAL_PHOTOS_ID = 'virtual:photos';
const RESOLVED_VIRTUAL_PHOTOS_ID = `\0${VIRTUAL_PHOTOS_ID}`;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

function listPublicPhotos(photosDir: string): string[] {
  if (!fs.existsSync(photosDir)) return [];
  return fs
    .readdirSync(photosDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `/photos/${encodeURIComponent(name)}`);
}

function publicPhotosPlugin(): Plugin {
  const photosDir = path.resolve(process.cwd(), 'public', 'photos');

  return {
    name: 'public-photos',
    resolveId(id) {
      if (id === VIRTUAL_PHOTOS_ID) {
        return RESOLVED_VIRTUAL_PHOTOS_ID;
      }
      return undefined;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_PHOTOS_ID) {
        const photos = listPublicPhotos(photosDir);
        return `export default ${JSON.stringify(photos)};`;
      }
      return undefined;
    },
    configureServer(server) {
      server.watcher.add(photosDir);
      const reloadIfPhoto = (filePath: string) => {
        const rel = path.relative(photosDir, filePath);
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
        if (!IMAGE_EXT_RE.test(filePath)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_PHOTOS_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reloadIfPhoto);
      server.watcher.on('unlink', reloadIfPhoto);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), publicPhotosPlugin()],
});

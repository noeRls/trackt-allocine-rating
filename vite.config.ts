import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'AlloCiné Rating on Trakt',
        namespace: 'https://github.com/noeRls/trackt-allocine-rating',
        version: pkg.version,
        description: 'Injects AlloCiné Press and Spectator ratings directly into Trakt.tv movie and TV show pages. Compatible with Tampermonkey and Violentmonkey.',
        author: 'noeRls',
        license: 'MIT',
        downloadURL: 'https://github.com/noeRls/trackt-allocine-rating/releases/latest/download/allocine-rating-on-trakt.user.js',
        updateURL: 'https://github.com/noeRls/trackt-allocine-rating/releases/latest/download/allocine-rating-on-trakt.user.js',
        match: [
          'https://trakt.tv/*',
          'https://*.trakt.tv/*'
        ],
        icon: 'https://www.allocine.fr/favicon.ico',
        grant: [
          'GM_xmlhttpRequest',
          'GM_getValue',
          'GM_setValue'
        ],
        connect: [
          'www.allocine.fr',
          'allocine.fr'
        ],
        'run-at': 'document-idle'
      },
    }),
  ],
});

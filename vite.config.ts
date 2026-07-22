import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'AlloCiné Rating on Trakt',
        namespace: 'https://github.com/allocine-rating-on-trakt',
        version: '1.0.0',
        description: 'Injects AlloCiné Press and Spectator ratings directly into Trakt.tv movie and TV show pages.',
        author: 'Antigravity',
        match: [
          'https://trakt.tv/movies/*',
          'https://trakt.tv/shows/*',
          'https://*.trakt.tv/movies/*',
          'https://*.trakt.tv/shows/*'
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

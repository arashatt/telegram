import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  /* Two pages, two HTML entries. The Instagram site needs its own <title>,
     description and robots rule, which a shared index.html cannot give it.

     Scoped to the client environment on purpose: the Cloudflare plugin builds
     the Worker as a second environment, and a top-level `build.rollupOptions`
     would hand these HTML entries to it too, which it cannot resolve. */
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: 'index.html',
            instagram: 'instagram.html',
          },
        },
      },
    },
  },
})
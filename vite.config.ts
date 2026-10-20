import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    {
      name: 'moamoa-development-prototype',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const pathname = (req.url ?? '').split('?')[0];
          if (pathname === '/__moamoa' || pathname.startsWith('/__moamoa/')) {
            // Separate HTML entry: no Auth, PlannerProvider, Supabase or product CSS.
            req.url = '/prototypes/moamoa.html';
          }
          next();
        });
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
})
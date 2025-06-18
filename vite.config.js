import { defineConfig } from 'vite'
import { ghPages } from 'vite-plugin-gh-pages'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: '/three-fps/',
    plugins: [ghPages(), react()],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
    },
})
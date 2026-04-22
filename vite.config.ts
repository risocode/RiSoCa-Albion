import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const aodpProxy = (prefix: string, target: string) => ({
  [prefix]: {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
  },
})

const gameInfoProxy = (prefix: string, target: string) => ({
  [prefix]: {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      ...aodpProxy('/aodp-americas', 'https://west.albion-online-data.com'),
      ...aodpProxy('/aodp-europe', 'https://europe.albion-online-data.com'),
      ...aodpProxy('/aodp-asia', 'https://east.albion-online-data.com'),
      ...gameInfoProxy('/gameinfo-americas', 'https://gameinfo.albiononline.com'),
      ...gameInfoProxy('/gameinfo-europe', 'https://gameinfo-ams.albiononline.com'),
      ...gameInfoProxy('/gameinfo-asia', 'https://gameinfo-sgp.albiononline.com'),
    },
  },
  preview: {
    proxy: {
      ...aodpProxy('/aodp-americas', 'https://west.albion-online-data.com'),
      ...aodpProxy('/aodp-europe', 'https://europe.albion-online-data.com'),
      ...aodpProxy('/aodp-asia', 'https://east.albion-online-data.com'),
      ...gameInfoProxy('/gameinfo-americas', 'https://gameinfo.albiononline.com'),
      ...gameInfoProxy('/gameinfo-europe', 'https://gameinfo-ams.albiononline.com'),
      ...gameInfoProxy('/gameinfo-asia', 'https://gameinfo-sgp.albiononline.com'),
    },
  },
})

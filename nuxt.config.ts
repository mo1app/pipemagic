import tailwindcss from "@tailwindcss/vite";

const baseURL = process.env.NUXT_APP_BASE_URL || "/";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  ssr: false,
  srcDir: "app/",
  debug: false,
  devServer: {
    port: 3003,
  },

  modules: ["@pinia/nuxt", "@nuxtjs/plausible"],

  plausible: {
    enabled: false,
  },

  css: ["~/assets/css/main.css"],

  app: {
    baseURL,
    head: {
      title: "PipeMagic",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: `${baseURL}favicon.svg` },
      ],
      script: [{ src: `${baseURL}coi-serviceworker.min.js` }],
    },
    spaLoadingTemplate: true,
  },

  vite: {
    plugins: [tailwindcss()],
    worker: {
      format: "es",
    },
    optimizeDeps: {
      exclude: ["pipemagic"],
    },
  },

  routeRules: {
    "/**": {
      headers: {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    },
  },

  nitro: {
    routeRules: {
      "/**": {
        headers: {
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Opener-Policy": "same-origin",
        },
      },
    },
  },
});

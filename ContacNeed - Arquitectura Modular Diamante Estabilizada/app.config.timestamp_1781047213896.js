// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";
import tailwindcss from "@tailwindcss/vite";
var app_config_default = defineConfig({
  tsr: {
    appDirectory: "src"
  },
  vite: {
    plugins: () => [tailwindcss()]
  },
  server: {
    preset: "netlify"
  }
});
export {
  app_config_default as default
};

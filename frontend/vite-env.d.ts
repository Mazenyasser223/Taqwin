/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_BACKDOOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

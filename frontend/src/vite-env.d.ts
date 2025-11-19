interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_EPAYCO_PUBLIC_KEY: string;
  readonly VITE_USD_RATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly DEV: boolean;
}

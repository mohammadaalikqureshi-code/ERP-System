/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. "/api/v1" or "https://api.example.com/api/v1". */
  readonly VITE_API_BASE_URL?: string;
  /** Product name shown in the UI. */
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  // Environment variables are now handled via `process.env` to support
  // the execution environment. VITE_ prefixed variables are no longer used for API keys.
  // Add any other custom Vite environment variables your app uses here.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

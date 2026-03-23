/**
 * Vite/WXT environment type augmentation for packages.
 * Provides typing for `import.meta.env` used across packages.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

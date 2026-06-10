import { defineConfig } from 'tsup';
import { resolve } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  esbuildOptions(opts) {
    opts.alias = {
      '@': resolve(__dirname, 'src'),
    };
  },
});

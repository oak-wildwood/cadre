import { includeIgnoreFile } from '@eslint/compat'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import vueTsConfig from '@vue/eslint-config-typescript'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfig(),
  eslintConfigPrettier,
)

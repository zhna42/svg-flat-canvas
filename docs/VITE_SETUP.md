# Подключение svg-canvas в Vite-проекте (с автообновлением)

## 1. Линк библиотеки

В **этом** проекте (`svg-editor`):

```bash
cd /Users/nikitazhitin/Desktop/svg-editor
npm run dev    # уже запущен — tsup в watch-режиме
```

В **твоём Vite-проекте** (`my-vue-project`):

```bash
cd /путь/до/моего/vue-проекта
npm link svg-canvas
```

## 2. Настройка Vite-конфига

В `vite.config.ts` твоего Vue-проекта добавь `optimizeDeps.exclude`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['svg-canvas']
  }
})
```

Это нужно, чтобы Vite не кешировал линкованную библиотеку, а перечитывал её при изменении.

## 3. Импорт в коде

```ts
import { SvgCanvas, ExternalApi, Events } from 'svg-canvas'
```

## 4. Сценарий работы

| Терминал | Команда |
|---|---|
| `svg-editor/` | `npm run dev` (tsup --watch) — пересобирает dist/ при изменениях |
| `my-vue-project/` | `npm run dev` (Vite dev) — dev-сервер твоего приложения |

Меняешь код в `svg-editor/src/` → tsup пересобирает → обновляешь страницу в браузере Vue-проекта. Vite перезапускать не нужно.

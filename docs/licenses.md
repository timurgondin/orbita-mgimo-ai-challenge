# Сторонние материалы и лицензии

> ТЗ: «Открытые библиотеки, шрифты, иконки и изображения используй только с лицензией, которая это разрешает». Здесь — всё стороннее, что попадает в продукт, и на каком основании. Пересобрать сводку по зависимостям: `node web/scripts/licenses.mjs`.

## Шрифт

| Что | Лицензия | Как используем |
|---|---|---|
| Onest | SIL Open Font License 1.1 | Сайт — через `next/font/google`; PDF-справки — файл `web/assets/fonts/Onest.ttf`, рядом `OFL.txt` (OFL требует прикладывать лицензию к файлу шрифта) |

## Иконки и графика

| Что | Лицензия | Условие | Где |
|---|---|---|---|
| Lucide (`lucide-react`) | ISC | — | иконки интерфейса |
| Solar, 480 Design | CC BY 4.0 | указать авторство — страница «О проекте» (`/about`, пункт в меню аватара) со ссылкой на набор | плитки «Сегодня» (`web/src/components/today/tile-icons.tsx`) |
| Thinking Orbs (`thinking-orbs`), Jakub Antalik | MIT | — | индикатор «думаю» на кнопке входа |
| Логотип, фавикон, точечные узоры, иллюстрации | собственные | — | — |

Изображений и фотографий из интернета в продукте нет; аватары — монограммы с инициалами.

## Библиотеки (production)

Все прямые зависимости — разрешительные: `next`, `react`, `react-dom`, `next-themes`, `clsx`, `tailwind-merge`, `pdf-lib`, `@pdf-lib/fontkit`, `qrcode`, `@node-rs/argon2`, `server-only`, `thinking-orbs` — MIT; `lucide-react` — ISC; `@prisma/client` — Apache 2.0; `@fontsource/onest` — OFL 1.1.

Транзитивные (на 16.11.2026): MIT — 44, ISC — 10, Apache 2.0 — 6, 0BSD — 2, BSD-3-Clause — 1, MIT AND Zlib — 1 (`pako`), CC BY 4.0 — 1 (`caniuse-lite`, данные о браузерах для сборки), LGPL-3.0-or-later — 1 (`@img/sharp-libvips`, нативная библиотека обработки изображений в `sharp`, подключается динамически и без изменений — LGPL это разрешает).

Запрещающих или «копилефт для всего проекта» (GPL, AGPL) лицензий нет.

## Только в макетах (`docs/design/mockups`, не в продукте)

- `tiles-v4.html` — знаки из наборов Solar (CC BY 4.0), Phosphor (MIT), Hugeicons (MIT), MingCute (Apache 2.0), Material Symbols (Apache 2.0), Fluent Emoji (MIT), Streamline Ultimate Color (CC BY 4.0); авторство указано внизу макета.
- Макеты подключают Onest с Google Fonts и Lucide с unpkg — те же лицензии, что выше.

## Референсы

`docs/design/references/*.png` — скриншоты чужих дизайнов для внутренней работы (в продукте не используются). Репозиторий приватный; перед публикацией — удалить из репозитория.

# Commands

Instead of `pnpm`, use `vp`. Example: `vp run build`

- `vp run build` – typecheck and build
- `vp test` – To run all tests
- `vp test run PATH_TO_FILE --reporter=verbose`
-

# Tone and rules.

Be direct, friendly and honest to a fault. We're friends, and friends don't let friends write code that could do with one more pass to get the details right.

Keep things short. Do not waste time writing a lot of words when few will do.

Mantras to live by:

- Simple is better than clever.
- Implement like a senior developer, but write it for juniors to understand.
- Always consider the next person coming into this project.

If you were told to go look in a certain place, do that. If you were told where to look, ask where you might find relevant code/examples.

Structure:

- CSS - `src/css`
- Markdown/documentation - `docs/`
- Web components - `src/components`

## About the project

This is vanilla Typescript app/SPA (not React or the like) for generating color palettes. OKLCH is the load-bearing technology and we're using the color.js library to help us do the color math.

## How to do styling

Before writing custom CSS, use the utility classes. See `docs/styling.md` for more information.
If no applicable utilities exists, ask yourself if an inline style is OK or if a custom rule is needed.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs for vite+ are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

# Styling

This is a vanilla CSS utility system. Everything below is a class you can use directly in HTML.

## Vanilla HTML

Semantic tags like strong and ul/ol does what you'd expect.

## Spacing

Pattern: `{property}{side}-{size}`

```
m         margin
p         padding
gap       gap (flex/grid)

Sides: (nothing) | l | r | t | b | x | y
Sizes: 3xs, 2xs, xs, s, m, l, xl, 2xl, 3xl, 4xl, 0, auto
```

Examples: `mx-auto`, `pt-s`, `gap-m`, `p-0`.

Negative margins use a double dash: `mt--xs`, `mx--s`.

## Layout

Flex primitives:

```
.stack                    column flex
.stack-horizontal         row flex, items centered

.items-start / .items-end / .items-center / .items-stretch
.justify-start / .justify-end / .justify-center / .justify-between / .justify-around
.grow / .shrink / .flex-1
.nowrap / .inline-flex
.self-stretch / .self-justify-start / .self-justify-end
```

## Color

```
.text-high / .text-mid / .text-low / .text-accent
.surface-sunken / .surface-default / .surface-raised / .surface-hover / .surface-overlay
.border-default / .border-weak / .border-strong
.shadow-default / .shadow-dialog
.scrim
```

## Typography

```
.fs-xs → .fs-4xl              font-size
.t-regular / .t-medium / .t-bold    font-weight
.t-center / .t-left / .t-right      text-align
.t-uppercase
.lh-tight / .lh-normal / .lh-relaxed
.t-tabular                      tabular-nums (good for data)
```

Use `.typeset` on prose containers — it sets a reading width, auto-spaces block siblings, and styles headings and definition lists.

## Misc

```
.br-s / .br-m / .br-l / .br-xl     border-radius
.overlap                            grid stacking (children overlap in same cell)
.grid / .block                      display helpers
```

## Components

### Buttons

```html
<button class="button" data-variant="filled" data-size="small">Click</button>
```

Variants: `filled` (default), `plain`. Sizes: `small`, `medium` (default), `large`.

### Form controls

```html
<input class="input" data-size="small" />
<select class="select" data-size="large">
  ...
</select>
<textarea class="textarea"></textarea>
<input class="checkbox" type="checkbox" />
<input class="radio" type="radio" />
```

Size via `data-size` (same values as buttons).

### Stagger reveal

Add `[stagger-reveal]` to a container to stagger-animate its direct children.

```html
<div stagger-reveal>
  <div>one</div>
  <div>two</div>
</div>
```

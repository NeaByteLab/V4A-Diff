<div align='center'>

# V4A Diff

Context-anchored diff engine for LLM-powered file editing

[![Deno](https://img.shields.io/badge/deno-compatible-ffcb00?logo=deno&logoColor=000000)](https://deno.com) [![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![Bun](https://img.shields.io/badge/bun-compatible-f9f1e1?logo=bun&logoColor=000000)](https://bun.sh) [![Browser](https://img.shields.io/badge/browser-compatible-4285F4?logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

[![Module type: Deno/ESM](https://img.shields.io/badge/module%20type-deno%2Fesm-brightgreen)](https://github.com/NeaByteLab/V4A-Diff) [![npm version](https://img.shields.io/npm/v/@neabyte/v4a-diff.svg)](https://www.npmjs.org/package/@neabyte/v4a-diff) [![JSR](https://jsr.io/badges/@neabyte/v4a-diff)](https://jsr.io/@neabyte/v4a-diff) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<img src="./assets/preview.webp" alt="V4A Diff Preview" width="100%">

</div>

## What is V4A?

V4A is a context-anchored diff format designed for LLM tool calling. Instead of line numbers, hunks use `@@` text anchors to locate edits - making diffs resilient to file changes between turns. This package parses V4A diffs, applies them to source text, and returns both the patched result and structured diff metadata with line numbers.

## Features

- **Token efficient** - Returns only changed lines, not the entire file.
- **Instant rollback** - Original source included in result, no manual tracking.
- **Structured diff** - Line-by-line add/delete/equal metadata with line numbers.
- **Smart matching** - Fuzzy context resolution with whitespace and Unicode tolerance.

## Installation

**Deno (JSR):**

```bash
deno add jsr:@neabyte/v4a-diff
```

**npm:**

```bash
npm install @neabyte/v4a-diff
```

**CDN (jsDelivr/esm.sh):**

```html
<script type="module">
  import V4A from 'https://cdn.jsdelivr.net/npm/@neabyte/v4a-diff/dist/index.mjs'
</script>
```

Or via [esm.sh](https://esm.sh):

```html
<script type="module">
  import V4A from 'https://esm.sh/@neabyte/v4a-diff'
</script>
```

## Usage

```ts
import V4A from '@neabyte/v4a-diff'

// Update an existing file
const result = V4A.apply(
  'function add(a, b) {\n  return a - b\n}',
  '@@\n function add(a, b) {\n-  return a - b\n+  return a + b\n }'
)

console.log(result.source)
// function add(a, b) {
//   return a - b
// }

console.log(result.text)
// function add(a, b) {
//   return a + b
// }

console.log(result.diff)
// [
//   { type: 'equal',  value: 'function add(a, b) {', oldLine: 1, newLine: 1 },
//   { type: 'delete', value: '  return a - b',       oldLine: 2, newLine: null },
//   { type: 'add',    value: '  return a + b',       oldLine: null, newLine: 2 },
//   { type: 'equal',  value: '}',                    oldLine: 3, newLine: 3 }
// ]
```

### With `*** Begin Patch` envelope

```ts
const result = V4A.apply(
  'const x = 1',
  '*** Begin Patch\n*** Update File: /src/config.ts\n@@\n-const x = 1\n+const x = 2\n*** End Patch'
)
// result.text === 'const x = 2'
```

### Create a new file

```ts
const result = V4A.apply(
  '',
  '+export const PORT = 8080\n+export const HOST = "localhost"',
  'create'
)
// result.text === 'export const PORT = 8080\nexport const HOST = "localhost"'
```

### Multi-hunk edits

```ts
const result = V4A.apply(
  'function add(a, b) {\n  return a - b\n}\nfunction sub(a, b) {\n  return a + b\n}',
  '@@ function add(\n function add(a, b) {\n-  return a - b\n+  return a + b\n }\n@@ function sub(\n function sub(a, b) {\n-  return a + b\n+  return a - b\n }'
)
```

## API

### `V4A.apply(sourceText, diffText, mode?)`

| Parameter    | Type                    | Description                                                          |
| ------------ | ----------------------- | -------------------------------------------------------------------- |
| `sourceText` | `string`                | Original file content                                                |
| `diffText`   | `string`                | V4A format diff string                                               |
| `mode`       | `'default' \| 'create'` | `default` updates existing text, `create` builds from `+` lines only |

**Returns:** `ApplyDiffResult`

```ts
type ApplyDiffResult = {
  text: string // Patched output text
  diff: DiffLine[] // Structured line-by-line diff
  source: string // Original source text for rollback
}

type DiffLine = {
  type: 'add' | 'delete' | 'equal'
  value: string // Line content
  oldLine: number | null // Source line number (null for adds)
  newLine: number | null // Result line number (null for deletes)
}
```

## V4A Diff Format

```
*** Begin Patch
*** Update File: {path}
@@ {anchor_text}
 context line (space prefix, exact copy from file)
-removed line (must match file exactly)
+added line
*** End Patch
```

- `@@` followed by text anchors to a matching line in the source file.
- A bare `@@` alone means "start of file."
- Every line in a hunk must start with ``(space),`-`, or `+`.
- `*** Add File:` with `+` prefixed lines creates new files.

## LLM Tool Schemas

Pre-built schemas for tool calling live in [`schema/`](schema/README.md):

- [`schema/openai.json`](schema/openai.json) - OpenAI function calling format
- [`schema/anthropic.json`](schema/anthropic.json) - Anthropic tool use format

## Build

```bash
npm run build
```

## Testing

```bash
deno task check
```

```bash
deno task test
```

## Acknowledgements

This is a clean-room TypeScript reimplementation of the V4A context-anchored diff format, with additional features including fuzz matching, envelope stripping, and structured diff output.

Based on the V4A format specification and reference implementations by OpenAI:

- [Apply Patch Tool Documentation](https://developers.openai.com/api/docs/guides/tools-apply-patch)
- [Rust Reference (codex apply-patch)](https://github.com/openai/codex/tree/main/codex-rs/apply-patch)
- [TypeScript Reference (openai-agents-js)](https://github.com/openai/openai-agents-js/blob/main/packages/agents-core/src/utils/applyDiff.ts)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for details.

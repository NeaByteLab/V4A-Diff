import { assertEquals } from '@std/assert'
import V4A from '@neabyte/v4a-diff'

Deno.test('V4A.apply - applies multi-hunk diff', () => {
  const applyResult = V4A.apply(
    'function add(a, b) {\n  return a - b\n}\nfunction sub(a, b) {\n  return a + b\n}',
    '@@ function add(\n function add(a, b) {\n-  return a - b\n+  return a + b\n }\n@@ function sub(\n function sub(a, b) {\n-  return a + b\n+  return a - b\n }'
  )
  assertEquals(
    applyResult.text,
    'function add(a, b) {\n  return a + b\n}\nfunction sub(a, b) {\n  return a - b\n}'
  )
})

Deno.test('V4A.apply - create mode diff entries are all add type', () => {
  const applyResult = V4A.apply('', '+hello\n+world', 'create')
  assertEquals(applyResult.diff.length, 2)
  assertEquals(applyResult.diff[0]!.type, 'add')
  assertEquals(applyResult.diff[1]!.type, 'add')
  assertEquals(applyResult.diff[0]!.oldLine, null)
  assertEquals(applyResult.diff[1]!.oldLine, null)
  assertEquals(applyResult.diff[0]!.newLine, 1)
  assertEquals(applyResult.diff[1]!.newLine, 2)
})

Deno.test('V4A.apply - creates file with envelope stripped', () => {
  const applyResult = V4A.apply(
    '',
    '*** Begin Patch\n*** Add File: /src/new.ts\n+const V = "1.0"\n+export default V\n*** End Patch',
    'create'
  )
  assertEquals(applyResult.text, 'const V = "1.0"\nexport default V')
})

Deno.test('V4A.apply - creates multi-line file', () => {
  const applyResult = V4A.apply(
    '',
    '+import { foo } from "bar"\n+\n+export function main() {\n+  foo()\n+}',
    'create'
  )
  assertEquals(
    applyResult.text,
    'import { foo } from "bar"\n\nexport function main() {\n  foo()\n}'
  )
})

Deno.test('V4A.apply - creates single line file', () => {
  const applyResult = V4A.apply('', '+hello', 'create')
  assertEquals(applyResult.text, 'hello')
})

Deno.test('V4A.apply - default mode with explicit parameter', () => {
  const applyResult = V4A.apply('const x = 1', '@@\n-const x = 1\n+const x = 2', 'default')
  assertEquals(applyResult.text, 'const x = 2')
})

Deno.test('V4A.apply - deletes line without inserting', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n ccc')
  assertEquals(applyResult.text, 'aaa\nccc')
})

Deno.test('V4A.apply - diff contains correct line types', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.diff.length, 4)
  assertEquals(applyResult.diff[0]!.type, 'equal')
  assertEquals(applyResult.diff[1]!.type, 'delete')
  assertEquals(applyResult.diff[2]!.type, 'add')
  assertEquals(applyResult.diff[3]!.type, 'equal')
})

Deno.test('V4A.apply - diff has correct new line numbers', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.diff[0]!.newLine, 1)
  assertEquals(applyResult.diff[1]!.newLine, null)
  assertEquals(applyResult.diff[2]!.newLine, 2)
  assertEquals(applyResult.diff[3]!.newLine, 3)
})

Deno.test('V4A.apply - diff has correct old line numbers', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.diff[0]!.oldLine, 1)
  assertEquals(applyResult.diff[1]!.oldLine, 2)
  assertEquals(applyResult.diff[2]!.oldLine, null)
  assertEquals(applyResult.diff[3]!.oldLine, 3)
})

Deno.test('V4A.apply - diff has correct values', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.diff[0]!.value, 'aaa')
  assertEquals(applyResult.diff[1]!.value, 'bbb')
  assertEquals(applyResult.diff[2]!.value, 'BBB')
  assertEquals(applyResult.diff[3]!.value, 'ccc')
})

Deno.test('V4A.apply - expands one line into multiple', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+line1\n+line2\n+line3\n ccc')
  assertEquals(applyResult.text, 'aaa\nline1\nline2\nline3\nccc')
})

Deno.test('V4A.apply - fuzz matches trailing whitespace in context', () => {
  const applyResult = V4A.apply('aaa\nbbb  ', '@@\n aaa\n-bbb\n+BBB')
  assertEquals(applyResult.text, 'aaa\nBBB')
})

Deno.test('V4A.apply - handles *** End of File marker', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@ bbb\n bbb\n-ccc\n+CCC\n*** End of File')
  assertEquals(applyResult.text, 'aaa\nbbb\nCCC')
})

Deno.test('V4A.apply - handles adjacent add and delete', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc\nddd', '@@\n aaa\n-bbb\n+BBB\n-ccc\n+CCC\n ddd')
  assertEquals(applyResult.text, 'aaa\nBBB\nCCC\nddd')
})

Deno.test('V4A.apply - handles chunk at end of file', () => {
  const applyResult = V4A.apply('aaa\nbbb\nold', '@@ bbb\n bbb\n-old\n+new')
  assertEquals(applyResult.text, 'aaa\nbbb\nnew')
})

Deno.test('V4A.apply - handles chunk at start of file', () => {
  const applyResult = V4A.apply('old\nbbb\nccc', '@@\n-old\n+new\n bbb')
  assertEquals(applyResult.text, 'new\nbbb\nccc')
})

Deno.test('V4A.apply - handles empty line as context', () => {
  const applyResult = V4A.apply('aaa\n\nbbb', '@@\n aaa\n\n-bbb\n+BBB')
  assertEquals(applyResult.text, 'aaa\n\nBBB')
})

Deno.test('V4A.apply - handles unified @@ -N,N +N,N @@ numbers', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@ -1,3 +1,3 @@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.text, 'aaa\nBBB\nccc')
})

Deno.test('V4A.apply - inserts new line without deleting', () => {
  const applyResult = V4A.apply(
    'function div(a, b) {\n  return a / b\n}',
    '@@ function div(\n function div(a, b) {\n+  if (b === 0) throw new Error("zero")\n   return a / b\n }'
  )
  assertEquals(
    applyResult.text,
    'function div(a, b) {\n  if (b === 0) throw new Error("zero")\n  return a / b\n}'
  )
})

Deno.test('V4A.apply - multiple spread chunks across file', () => {
  const applyResult = V4A.apply(
    'aaa\nbbb\nccc\nddd\neee\nfff\nggg',
    '@@\n aaa\n-bbb\n+BBB\n ccc\n@@ eee\n eee\n-fff\n+FFF\n ggg'
  )
  assertEquals(applyResult.text, 'aaa\nBBB\nccc\nddd\neee\nFFF\nggg')
})

Deno.test('V4A.apply - preserves untouched lines around change', () => {
  const applyResult = V4A.apply(
    'keep1\nkeep2\nchange\nkeep3\nkeep4',
    '@@ change\n-change\n+CHANGED'
  )
  assertEquals(applyResult.text, 'keep1\nkeep2\nCHANGED\nkeep3\nkeep4')
})

Deno.test('V4A.apply - pure delete produces correct diff line numbers', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n ccc')
  assertEquals(applyResult.diff.length, 3)
  assertEquals(applyResult.diff[1]!.type, 'delete')
  assertEquals(applyResult.diff[1]!.oldLine, 2)
  assertEquals(applyResult.diff[1]!.newLine, null)
  assertEquals(applyResult.diff[2]!.oldLine, 3)
  assertEquals(applyResult.diff[2]!.newLine, 2)
})

Deno.test('V4A.apply - pure insert produces correct diff line numbers', () => {
  const applyResult = V4A.apply('aaa\nccc', '@@\n aaa\n+bbb\n ccc')
  assertEquals(applyResult.diff.length, 3)
  assertEquals(applyResult.diff[0]!.type, 'equal')
  assertEquals(applyResult.diff[0]!.oldLine, 1)
  assertEquals(applyResult.diff[0]!.newLine, 1)
  assertEquals(applyResult.diff[1]!.type, 'add')
  assertEquals(applyResult.diff[1]!.oldLine, null)
  assertEquals(applyResult.diff[1]!.newLine, 2)
  assertEquals(applyResult.diff[2]!.type, 'equal')
  assertEquals(applyResult.diff[2]!.oldLine, 2)
  assertEquals(applyResult.diff[2]!.newLine, 3)
})

Deno.test('V4A.apply - replaces entire file content', () => {
  const applyResult = V4A.apply('old1\nold2\nold3', '@@\n-old1\n-old2\n-old3\n+new1\n+new2')
  assertEquals(applyResult.text, 'new1\nnew2')
})

Deno.test('V4A.apply - replaces line with bare @@ anchor', () => {
  const applyResult = V4A.apply(
    'function add(a, b) {\n  return a - b\n}',
    '@@\n function add(a, b) {\n-  return a - b\n+  return a + b\n }'
  )
  assertEquals(applyResult.text, 'function add(a, b) {\n  return a + b\n}')
})

Deno.test('V4A.apply - replaces line with text anchor', () => {
  const applyResult = V4A.apply(
    'aaa\nfunction greet() {\n  return "hi"\n}\nbbb',
    '@@ function greet()\n function greet() {\n-  return "hi"\n+  return "hello"\n }'
  )
  assertEquals(applyResult.text, 'aaa\nfunction greet() {\n  return "hello"\n}\nbbb')
})

Deno.test('V4A.apply - replaces single line file', () => {
  const applyResult = V4A.apply('only', '@@\n-only\n+replaced')
  assertEquals(applyResult.text, 'replaced')
})

Deno.test('V4A.apply - returns source as empty string in create mode', () => {
  const applyResult = V4A.apply('', '+hello', 'create')
  assertEquals(applyResult.source, '')
})

Deno.test('V4A.apply - returns source field matching original input', () => {
  const sourceText = 'aaa\nbbb\nccc'
  const applyResult = V4A.apply(sourceText, '@@\n aaa\n-bbb\n+BBB\n ccc')
  assertEquals(applyResult.source, sourceText)
})

Deno.test('V4A.apply - shrinks multiple lines into one', () => {
  const applyResult = V4A.apply(
    'aaa\nbbb\nccc\nddd\neee',
    '@@\n aaa\n-bbb\n-ccc\n-ddd\n+REPLACED\n eee'
  )
  assertEquals(applyResult.text, 'aaa\nREPLACED\neee')
})

Deno.test('V4A.apply - source is not mutated by apply', () => {
  const sourceText = 'function hello() {\n  return "hi"\n}'
  const applyResult = V4A.apply(
    sourceText,
    '@@\n function hello() {\n-  return "hi"\n+  return "hello"\n }'
  )
  assertEquals(applyResult.source, sourceText)
  assertEquals(applyResult.text !== sourceText, true)
})

Deno.test('V4A.apply - strips *** Begin/End Patch envelope', () => {
  const applyResult = V4A.apply(
    'const x = 1',
    '*** Begin Patch\n*** Update File: /f.ts\n@@\n-const x = 1\n+const x = 2\n*** End Patch'
  )
  assertEquals(applyResult.text, 'const x = 2')
})

Deno.test('V4A.apply - strips \\ No newline at end of file', () => {
  const applyResult = V4A.apply(
    'const z = 1',
    '@@\n-const z = 1\n+const z = 2\n\\ No newline at end of file'
  )
  assertEquals(applyResult.text, 'const z = 2')
})

Deno.test('V4A.apply - strips backslash unified headers', () => {
  const applyResult = V4A.apply(
    'const y = 1',
    '--- a\\f.ts\n+++ b\\f.ts\n@@\n-const y = 1\n+const y = 2'
  )
  assertEquals(applyResult.text, 'const y = 2')
})

Deno.test('V4A.apply - strips leading empty lines', () => {
  const applyResult = V4A.apply('aaa\nbbb', '\n\n@@\n aaa\n-bbb\n+BBB')
  assertEquals(applyResult.text, 'aaa\nBBB')
})

Deno.test('V4A.apply - strips unified --- a/ +++ b/ headers', () => {
  const applyResult = V4A.apply(
    'const y = 1',
    '--- a/f.ts\n+++ b/f.ts\n@@\n-const y = 1\n+const y = 2'
  )
  assertEquals(applyResult.text, 'const y = 2')
})

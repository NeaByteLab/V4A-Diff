import { assertEquals } from '@std/assert'
import V4A from '@neabyte/v4a-diff'

Deno.test('V4A.refine - add before delete stays untouched', () => {
  const refined = V4A.refine([
    { type: 'add', value: 'a+b', oldLine: null, newLine: 1 },
    { type: 'delete', value: 'a-b', oldLine: 1, newLine: null }
  ])
  assertEquals(refined[0]!.segments, undefined)
  assertEquals(refined[1]!.segments, undefined)
})

Deno.test('V4A.refine - block pairs delete and add by index', () => {
  const applyResult = V4A.apply(
    'const b = 2\nconst c = 3',
    '@@\n-const b = 2\n-const c = 3\n+const b = 20\n+const c = 30'
  )
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined.map((line) => line.type), ['delete', 'delete', 'add', 'add'])
  assertEquals(refined[2]!.value, 'const b = 20')
  assertEquals(refined[2]!.segments, [
    { type: 'equal', value: 'const b = 2' },
    { type: 'add', value: '0' }
  ])
  assertEquals(refined[3]!.value, 'const c = 30')
  assertEquals(refined[3]!.segments, [
    { type: 'equal', value: 'const c = 3' },
    { type: 'add', value: '0' }
  ])
})

Deno.test('V4A.refine - empty diff returns empty array', () => {
  assertEquals(V4A.refine([]), [])
})

Deno.test('V4A.refine - handles unicode graphemes safely', () => {
  const applyResult = V4A.apply('hi \u{1F600}', '@@\n-hi \u{1F600}\n+hi \u{1F603}')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(
    refined[1]!.segments,
    [
      { type: 'equal', value: 'hi ' },
      { type: 'delete', value: '\u{1F600}' },
      { type: 'add', value: '\u{1F603}' }
    ].filter((segment) => segment.type !== 'delete')
  )
})

Deno.test('V4A.refine - leaves equal lines untouched', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[0]!.segments, undefined)
  assertEquals(refined[3]!.segments, undefined)
})

Deno.test('V4A.refine - leaves unpaired delete untouched', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n ccc')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[1]!.type, 'delete')
  assertEquals(refined[1]!.segments, undefined)
})

Deno.test('V4A.refine - leaves unpaired insert untouched', () => {
  const applyResult = V4A.apply('aaa\nccc', '@@\n aaa\n+bbb\n ccc')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[1]!.type, 'add')
  assertEquals(refined[1]!.segments, undefined)
})

Deno.test('V4A.refine - non-array input returns empty array', () => {
  assertEquals(V4A.refine(null as unknown as Parameters<typeof V4A.refine>[0]), [])
  assertEquals(V4A.refine(undefined as unknown as Parameters<typeof V4A.refine>[0]), [])
})

Deno.test('V4A.refine - non-string values pass through unrefined', () => {
  const refined = V4A.refine([
    { type: 'delete', value: 123 as unknown as string, oldLine: 1, newLine: null },
    { type: 'add', value: null as unknown as string, oldLine: null, newLine: 1 }
  ])
  assertEquals(refined[0]!.segments, undefined)
  assertEquals(refined[1]!.segments, undefined)
})

Deno.test('V4A.refine - preserves line count and line numbers', () => {
  const applyResult = V4A.apply('aaa\nbbb\nccc', '@@\n aaa\n-bbb\n+BBB\n ccc')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined.length, applyResult.diff.length)
  assertEquals(refined[1]!.oldLine, 2)
  assertEquals(refined[2]!.newLine, 2)
})

Deno.test('V4A.refine - segments pure deletion within line', () => {
  const applyResult = V4A.apply('axb', '@@\n-axb\n+ab')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[0]!.segments, [
    { type: 'equal', value: 'a' },
    { type: 'delete', value: 'x' },
    { type: 'equal', value: 'b' }
  ])
})

Deno.test('V4A.refine - segments pure insertion within line', () => {
  const applyResult = V4A.apply('ab', '@@\n-ab\n+axb')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[1]!.segments, [
    { type: 'equal', value: 'a' },
    { type: 'add', value: 'x' },
    { type: 'equal', value: 'b' }
  ])
})

Deno.test('V4A.refine - segments single char change on add line', () => {
  const applyResult = V4A.apply('return a - b', '@@\n-return a - b\n+return a + b')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[1]!.type, 'add')
  assertEquals(refined[1]!.segments, [
    { type: 'equal', value: 'return a ' },
    { type: 'add', value: '+' },
    { type: 'equal', value: ' b' }
  ])
})

Deno.test('V4A.refine - segments single char change on delete line', () => {
  const applyResult = V4A.apply('return a - b', '@@\n-return a - b\n+return a + b')
  const refined = V4A.refine(applyResult.diff)
  assertEquals(refined[0]!.type, 'delete')
  assertEquals(refined[0]!.segments, [
    { type: 'equal', value: 'return a ' },
    { type: 'delete', value: '-' },
    { type: 'equal', value: ' b' }
  ])
})

Deno.test('V4A.refine - trims shared prefix and suffix around small edit', () => {
  const prefix = 'a'.repeat(20000)
  const refined = V4A.refine([
    { type: 'delete', value: `${prefix}=1;`, oldLine: 1, newLine: null },
    { type: 'add', value: `${prefix}=2;`, oldLine: null, newLine: 1 }
  ])
  assertEquals(refined[1]!.segments, [
    { type: 'equal', value: `${prefix}=` },
    { type: 'add', value: '2' },
    { type: 'equal', value: ';' }
  ])
})

Deno.test('V4A.refine - uneven block refines pairs leaves extras untouched', () => {
  const refined = V4A.refine([
    { type: 'delete', value: 'x1', oldLine: 1, newLine: null },
    { type: 'delete', value: 'x2', oldLine: 2, newLine: null },
    { type: 'delete', value: 'x3', oldLine: 3, newLine: null },
    { type: 'add', value: 'X1', oldLine: null, newLine: 1 }
  ])
  assertEquals(refined[0]!.segments, [
    { type: 'delete', value: 'x' },
    { type: 'equal', value: '1' }
  ])
  assertEquals(refined[1]!.segments, undefined)
  assertEquals(refined[2]!.segments, undefined)
  assertEquals(refined[3]!.segments, [
    { type: 'add', value: 'X' },
    { type: 'equal', value: '1' }
  ])
})

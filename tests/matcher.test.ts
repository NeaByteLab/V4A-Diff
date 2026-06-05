import type * as Types from '@app/types.ts'
import { assertEquals } from '@std/assert'
import Matcher from '@app/matcher.ts'

function makeState(): Types.ParserState {
  return { lines: [], currentIndex: 0, fuzzScore: 0 }
}

Deno.test('Matcher.anchorStrategies - first strategy is identity', () => {
  const mapFn = Matcher.anchorStrategies[0]!.mapFn
  assertEquals(mapFn('  hello  '), '  hello  ')
  assertEquals(Matcher.anchorStrategies[0]!.fuzzScore, 0)
})

Deno.test('Matcher.anchorStrategies - has 3 strategies', () => {
  assertEquals(Matcher.anchorStrategies.length, 3)
})

Deno.test('Matcher.anchorStrategies - second strategy is trim', () => {
  const mapFn = Matcher.anchorStrategies[1]!.mapFn
  assertEquals(mapFn('  hello  '), 'hello')
  assertEquals(Matcher.anchorStrategies[1]!.fuzzScore, 1)
})

Deno.test('Matcher.contextStrategies - first strategy is identity with fuzz 0', () => {
  assertEquals(Matcher.contextStrategies[0]!.fuzzScore, 0)
})

Deno.test('Matcher.contextStrategies - fourth strategy normalizes unicode with fuzz 1000', () => {
  const mapFn = Matcher.contextStrategies[3]!.mapFn
  assertEquals(mapFn('\u201chello\u201d'), '"hello"')
  assertEquals(mapFn('a\u2014b'), 'a-b')
  assertEquals(mapFn('a\u00a0b'), 'a b')
  assertEquals(Matcher.contextStrategies[3]!.fuzzScore, 1000)
})

Deno.test('Matcher.contextStrategies - has 4 strategies', () => {
  assertEquals(Matcher.contextStrategies.length, 4)
})

Deno.test('Matcher.contextStrategies - second strategy is trimEnd with fuzz 1', () => {
  const mapFn = Matcher.contextStrategies[1]!.mapFn
  assertEquals(mapFn('  hello  '), '  hello')
  assertEquals(Matcher.contextStrategies[1]!.fuzzScore, 1)
})

Deno.test('Matcher.contextStrategies - third strategy is trim with fuzz 100', () => {
  const mapFn = Matcher.contextStrategies[2]!.mapFn
  assertEquals(mapFn('  hello  '), 'hello')
  assertEquals(Matcher.contextStrategies[2]!.fuzzScore, 100)
})

Deno.test('Matcher.findContext - EOF mode falls back with penalty', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'ccc'], ['aaa'], 0, true)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 10000)
})

Deno.test('Matcher.findContext - EOF mode matches at end of file', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'ccc'], ['ccc'], 0, true)
  assertEquals(matchResult.matchedIndex, 2)
  assertEquals(matchResult.fuzzScore, 0)
})

Deno.test('Matcher.findContext - does not match before startIndex', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'aaa'], ['aaa'], 1, false)
  assertEquals(matchResult.matchedIndex, 2)
})

Deno.test('Matcher.findContext - empty context returns startIndex', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb'], [], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 0)
})

Deno.test('Matcher.findContext - exact match at offset', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'ccc'], ['bbb', 'ccc'], 1, false)
  assertEquals(matchResult.matchedIndex, 1)
  assertEquals(matchResult.fuzzScore, 0)
})

Deno.test('Matcher.findContext - exact match returns index 0 fuzz 0', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'ccc'], ['aaa', 'bbb'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 0)
})

Deno.test('Matcher.findContext - multi-line context match', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb', 'ccc', 'ddd'], ['bbb', 'ccc'], 0, false)
  assertEquals(matchResult.matchedIndex, 1)
  assertEquals(matchResult.fuzzScore, 0)
})

Deno.test('Matcher.findContext - returns -1 for no match', () => {
  const matchResult = Matcher.findContext(['aaa', 'bbb'], ['zzz'], 0, false)
  assertEquals(matchResult.matchedIndex, -1)
})

Deno.test('Matcher.findContext - trim fuzz matches leading and trailing whitespace', () => {
  const matchResult = Matcher.findContext(['  aaa  '], ['aaa'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 100)
})

Deno.test('Matcher.findContext - trimEnd fuzz matches trailing whitespace', () => {
  const matchResult = Matcher.findContext(['aaa  ', 'bbb'], ['aaa'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 1)
})

Deno.test('Matcher.findContext - unicode fuzz matches em dash', () => {
  const matchResult = Matcher.findContext(['a \u2014 b'], ['a - b'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 1000)
})

Deno.test('Matcher.findContext - unicode fuzz matches non-breaking space', () => {
  const matchResult = Matcher.findContext(['a\u00a0b'], ['a b'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 1000)
})

Deno.test('Matcher.findContext - unicode fuzz matches smart quotes', () => {
  const matchResult = Matcher.findContext(['\u201chello\u201d'], ['"hello"'], 0, false)
  assertEquals(matchResult.matchedIndex, 0)
  assertEquals(matchResult.fuzzScore, 1000)
})

Deno.test('Matcher.resolveAnchor - accumulates fuzz score in state', () => {
  const state = makeState()
  state.fuzzScore = 5
  Matcher.resolveAnchor('bbb', ['aaa', '  bbb  ', 'ccc'], 0, state)
  assertEquals(state.fuzzScore, 6)
})

Deno.test('Matcher.resolveAnchor - exact anchor match returns index', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor('bbb', ['aaa', 'bbb', 'ccc'], 0, state)
  assertEquals(anchorIndex, 1)
  assertEquals(state.fuzzScore, 0)
})

Deno.test('Matcher.resolveAnchor - returns sourceOffset when not found', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor('zzz', ['aaa', 'bbb'], 0, state)
  assertEquals(anchorIndex, 0)
})

Deno.test('Matcher.resolveAnchor - searches forward from sourceOffset', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor('ccc', ['aaa', 'bbb', 'ccc', 'ddd'], 1, state)
  assertEquals(anchorIndex, 2)
})

Deno.test('Matcher.resolveAnchor - skips pre-match and keeps sourceOffset', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor('aaa', ['aaa', 'bbb', 'ccc'], 2, state)
  assertEquals(anchorIndex, 2)
})

Deno.test('Matcher.resolveAnchor - trim fuzz matches anchor with whitespace', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor('bbb', ['aaa', '  bbb  ', 'ccc'], 0, state)
  assertEquals(anchorIndex, 1)
  assertEquals(state.fuzzScore, 1)
})

Deno.test('Matcher.resolveAnchor - unicode fuzz matches anchor with smart chars', () => {
  const state = makeState()
  const anchorIndex = Matcher.resolveAnchor(
    '"hello"',
    ['aaa', '\u201chello\u201d', 'ccc'],
    0,
    state
  )
  assertEquals(anchorIndex, 1)
  assertEquals(state.fuzzScore, 10)
})

import { assertEquals, assertThrows } from '@std/assert'
import Parser from '@app/parser.ts'

Deno.test('Parser.normalizeDiffLines - handles empty string', () => {
  const diffLines = Parser.normalizeDiffLines('')
  assertEquals(diffLines, [])
})

Deno.test('Parser.normalizeDiffLines - handles single line', () => {
  const diffLines = Parser.normalizeDiffLines('single')
  assertEquals(diffLines, ['single'])
})

Deno.test('Parser.normalizeDiffLines - preserves internal empty lines', () => {
  const diffLines = Parser.normalizeDiffLines('aaa\n\nbbb')
  assertEquals(diffLines, ['aaa', '', 'bbb'])
})

Deno.test('Parser.normalizeDiffLines - splits on CRLF', () => {
  const diffLines = Parser.normalizeDiffLines('aaa\r\nbbb\r\nccc')
  assertEquals(diffLines, ['aaa', 'bbb', 'ccc'])
})

Deno.test('Parser.normalizeDiffLines - splits on newline', () => {
  const diffLines = Parser.normalizeDiffLines('aaa\nbbb\nccc')
  assertEquals(diffLines, ['aaa', 'bbb', 'ccc'])
})

Deno.test('Parser.normalizeDiffLines - trims trailing empty line', () => {
  const diffLines = Parser.normalizeDiffLines('aaa\nbbb\n')
  assertEquals(diffLines, ['aaa', 'bbb'])
})

Deno.test('Parser.parseCreateDiff - error has no colon after line number', () => {
  try {
    Parser.parseCreateDiff(['+ok', '-bad'])
  } catch (error) {
    const err = error as Error
    assertEquals(err.message.includes('line 2 '), true)
    assertEquals(err.message.includes('line 2:'), false)
  }
})

Deno.test('Parser.parseCreateDiff - error includes line number', () => {
  assertThrows(
    () => Parser.parseCreateDiff(['+ok', '+fine', '-bad']),
    SyntaxError,
    'line 3'
  )
})

Deno.test('Parser.parseCreateDiff - parses multiple add lines', () => {
  const createText = Parser.parseCreateDiff(['+aaa', '+bbb', '+ccc'])
  assertEquals(createText, 'aaa\nbbb\nccc')
})

Deno.test('Parser.parseCreateDiff - parses single add line', () => {
  const createText = Parser.parseCreateDiff(['+hello'])
  assertEquals(createText, 'hello')
})

Deno.test('Parser.parseCreateDiff - preserves empty line content', () => {
  const createText = Parser.parseCreateDiff(['+line1', '+', '+line3'])
  assertEquals(createText, 'line1\n\nline3')
})

Deno.test('Parser.parseCreateDiff - throws on delete prefix', () => {
  assertThrows(
    () => Parser.parseCreateDiff(['+ok', '-bad']),
    SyntaxError,
    "expected '+' prefix"
  )
})

Deno.test('Parser.parseCreateDiff - throws on missing + prefix', () => {
  assertThrows(
    () => Parser.parseCreateDiff(['+ok', ' bad']),
    SyntaxError,
    "expected '+' prefix"
  )
})

Deno.test('Parser.parseUpdateDiff - error messages show expected vs found', () => {
  try {
    Parser.parseUpdateDiff(['@@', ' zzz'], 'aaa')
  } catch (error) {
    const err = error as Error
    assertEquals(err.message.includes('expected'), true)
    assertEquals(err.message.includes('but found'), true)
  }
})

Deno.test('Parser.parseUpdateDiff - fuzz score nonzero for whitespace match', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', '+BBB'],
    'aaa\nbbb  '
  )
  assertEquals(parseResult.fuzzScore > 0, true)
})

Deno.test('Parser.parseUpdateDiff - fuzz score zero for exact match', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', '+BBB'],
    'aaa\nbbb'
  )
  assertEquals(parseResult.fuzzScore, 0)
})

Deno.test('Parser.parseUpdateDiff - handles *** End of File marker', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@ bbb', ' bbb', '-ccc', '+CCC', '*** End of File'],
    'aaa\nbbb\nccc'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.insertedLines, ['CCC'])
})

Deno.test('Parser.parseUpdateDiff - handles adjacent delete-add transitions', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', '+BBB', '-ccc', '+CCC', ' ddd'],
    'aaa\nbbb\nccc\nddd'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, ['bbb', 'ccc'])
  assertEquals(parseResult.diffChunks[0]!.insertedLines, ['BBB', 'CCC'])
})

Deno.test('Parser.parseUpdateDiff - handles empty line as context (normalized to space)', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '', '-bbb', '+BBB'],
    'aaa\n\nbbb'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, ['bbb'])
})

Deno.test('Parser.parseUpdateDiff - handles pure delete chunk', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', ' ccc'],
    'aaa\nbbb\nccc'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, ['bbb'])
  assertEquals(parseResult.diffChunks[0]!.insertedLines, [])
})

Deno.test('Parser.parseUpdateDiff - handles pure insert chunk', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '+new', ' bbb'],
    'aaa\nbbb'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, [])
  assertEquals(parseResult.diffChunks[0]!.insertedLines, ['new'])
})

Deno.test('Parser.parseUpdateDiff - parses anchor @@ hunk', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@ bbb', ' bbb', '-ccc', '+CCC'],
    'aaa\nbbb\nccc'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.sourceIndex, 2)
})

Deno.test('Parser.parseUpdateDiff - parses bare @@ hunk', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', '+BBB', ' ccc'],
    'aaa\nbbb\nccc'
  )
  assertEquals(parseResult.diffChunks.length, 1)
  assertEquals(parseResult.diffChunks[0]!.sourceIndex, 1)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, ['bbb'])
  assertEquals(parseResult.diffChunks[0]!.insertedLines, ['BBB'])
})

Deno.test('Parser.parseUpdateDiff - parses multi-hunk diff', () => {
  const parseResult = Parser.parseUpdateDiff(
    ['@@', ' aaa', '-bbb', '+BBB', ' ccc', '@@ eee', ' eee', '-fff', '+FFF'],
    'aaa\nbbb\nccc\nddd\neee\nfff'
  )
  assertEquals(parseResult.diffChunks.length, 2)
  assertEquals(parseResult.diffChunks[0]!.deletedLines, ['bbb'])
  assertEquals(parseResult.diffChunks[1]!.deletedLines, ['fff'])
})

Deno.test('Parser.parseUpdateDiff - throws on unmatched context', () => {
  assertThrows(
    () => Parser.parseUpdateDiff(['@@', ' zzz', '-bbb', '+BBB'], 'aaa\nbbb'),
    SyntaxError,
    'unmatched context'
  )
})

Deno.test('Parser.parseUpdateDiff - unexpected prefix error includes line number', () => {
  try {
    Parser.parseUpdateDiff(['@@', ' aaa', 'Xbad'], 'aaa\nbbb')
  } catch (error) {
    const err = error as Error
    assertEquals(err.message.startsWith('line '), true)
    assertEquals(err.message.includes('unexpected line prefix'), true)
  }
})

Deno.test('Parser.parseUpdateDiff - unmatched context error includes line number', () => {
  try {
    Parser.parseUpdateDiff(['@@', ' zzz', '-bbb', '+BBB'], 'aaa\nbbb')
  } catch (error) {
    const err = error as Error
    assertEquals(err.message.startsWith('line '), true)
  }
})

Deno.test('Parser.parseUpdateDiff - unmatched context error includes source line', () => {
  assertThrows(
    () => Parser.parseUpdateDiff(['@@', ' zzz', '-bbb', '+BBB'], 'aaa\nbbb'),
    SyntaxError,
    'source line'
  )
})

import type * as Types from '@app/types.ts'

/**
 * Fuzzy line matching for diffs.
 * @description Resolves anchors and context using fuzz strategies.
 */
export default class Matcher {
  /** Anchor matching strategies with fuzz scores */
  static readonly anchorStrategies: ReadonlyArray<Types.FuzzStrategy> = [
    { mapFn: (line) => line, fuzzScore: 0 },
    { mapFn: (line) => line.trim(), fuzzScore: 1 },
    { mapFn: this.normalizeUnicode.bind(this), fuzzScore: 10 }
  ]
  /** Context matching strategies with fuzz scores */
  static readonly contextStrategies: ReadonlyArray<Types.FuzzStrategy> = [
    { mapFn: (line) => line, fuzzScore: 0 },
    { mapFn: (line) => line.trimEnd(), fuzzScore: 1 },
    { mapFn: (line) => line.trim(), fuzzScore: 100 },
    { mapFn: this.normalizeUnicode.bind(this), fuzzScore: 1000 }
  ]
  /** Unicode codepoint to ASCII replacement map */
  private static readonly unicodeMap = new Map<number, string>([
    [0x2010, '-'],
    [0x2011, '-'],
    [0x2012, '-'],
    [0x2013, '-'],
    [0x2014, '-'],
    [0x2015, '-'],
    [0x2212, '-'],
    [0x2018, "'"],
    [0x2019, "'"],
    [0x201a, "'"],
    [0x201b, "'"],
    [0x201c, '"'],
    [0x201d, '"'],
    [0x201e, '"'],
    [0x201f, '"'],
    [0x00a0, ' '],
    [0x2002, ' '],
    [0x2003, ' '],
    [0x2004, ' '],
    [0x2005, ' '],
    [0x2006, ' '],
    [0x2007, ' '],
    [0x2008, ' '],
    [0x2009, ' '],
    [0x200a, ' '],
    [0x202f, ' '],
    [0x205f, ' '],
    [0x3000, ' ']
  ])

  /**
   * Find context lines in source.
   * @description Matches context lines with EOF-aware fallback search.
   * @param sourceLines - Original file lines
   * @param contextLines - Context lines to match
   * @param startIndex - Search start position
   * @param isEndOfFile - Whether section ends at EOF
   * @returns Context match with index and fuzz score
   */
  static findContext(
    sourceLines: string[],
    contextLines: string[],
    startIndex: number,
    isEndOfFile: boolean
  ): Types.ContextMatch {
    if (isEndOfFile) {
      const eofMatch = this.findContextCore(
        sourceLines,
        contextLines,
        Math.max(0, sourceLines.length - contextLines.length)
      )
      if (eofMatch.matchedIndex !== -1) {
        return eofMatch
      }
      const fallbackMatch = this.findContextCore(sourceLines, contextLines, startIndex)
      return {
        matchedIndex: fallbackMatch.matchedIndex,
        fuzzScore: fallbackMatch.fuzzScore + 10000
      }
    }
    return this.findContextCore(sourceLines, contextLines, startIndex)
  }

  /**
   * Resolve anchor to source offset.
   * @description Finds anchor line position using fuzz strategies.
   * @param anchorText - Anchor line text to locate
   * @param sourceLines - Original file lines
   * @param sourceOffset - Current source cursor position
   * @param state - Mutable parser state for fuzz tracking
   * @returns Resolved source offset position
   */
  static resolveAnchor(
    anchorText: string,
    sourceLines: string[],
    sourceOffset: number,
    state: Types.ParserState
  ): number {
    for (const strategy of this.anchorStrategies) {
      const mappedAnchor = strategy.mapFn(anchorText)
      let hasPreMatch = false
      for (let scanIndex = 0; scanIndex < sourceOffset; scanIndex += 1) {
        if (strategy.mapFn(sourceLines[scanIndex]!) === mappedAnchor) {
          hasPreMatch = true
          break
        }
      }
      if (hasPreMatch) {
        return sourceOffset
      }
      const anchorIndex = this.searchLines(
        sourceLines,
        anchorText,
        sourceOffset,
        strategy.mapFn
      )
      if (anchorIndex !== -1) {
        state.fuzzScore += strategy.fuzzScore
        return anchorIndex
      }
    }
    return sourceOffset
  }

  /**
   * Core context matching with strategies.
   * @description Iterates fuzz strategies to find context match.
   * @param sourceLines - Original file lines
   * @param contextLines - Context lines to match
   * @param startIndex - Search start position
   * @returns Context match with index and fuzz score
   */
  private static findContextCore(
    sourceLines: string[],
    contextLines: string[],
    startIndex: number
  ): Types.ContextMatch {
    if (!contextLines.length) {
      return { matchedIndex: startIndex, fuzzScore: 0 }
    }
    for (const strategy of this.contextStrategies) {
      for (let lineIndex = startIndex; lineIndex < sourceLines.length; lineIndex += 1) {
        if (this.sliceEquals(sourceLines, contextLines, lineIndex, strategy.mapFn)) {
          return { matchedIndex: lineIndex, fuzzScore: strategy.fuzzScore }
        }
      }
    }
    return { matchedIndex: -1, fuzzScore: 0 }
  }

  /**
   * Normalize Unicode to ASCII equivalents.
   * @description Trims and replaces fancy quotes, dashes, spaces.
   * @param line - Input line with potential Unicode
   * @returns ASCII-normalized line string
   */
  private static normalizeUnicode(line: string): string {
    const trimmedLine = line.trim()
    const charBuffer: string[] = []
    for (let charIndex = 0; charIndex < trimmedLine.length; charIndex += 1) {
      charBuffer.push(
        this.unicodeMap.get(trimmedLine.charCodeAt(charIndex)) ?? trimmedLine[charIndex]!
      )
    }
    return charBuffer.join('')
  }

  /**
   * Search for matching line in source.
   * @description Finds first line matching target via mapFn.
   * @param sourceLines - Lines to search through
   * @param targetText - Text to find
   * @param startIndex - Search start position
   * @param mapFn - Line transformation for comparison
   * @returns Matched line index or -1
   */
  private static searchLines(
    sourceLines: string[],
    targetText: string,
    startIndex: number,
    mapFn: Types.FuzzStrategy['mapFn']
  ): number {
    const mappedTarget = mapFn(targetText)
    for (let lineIndex = startIndex; lineIndex < sourceLines.length; lineIndex += 1) {
      if (mapFn(sourceLines[lineIndex]!) === mappedTarget) {
        return lineIndex
      }
    }
    return -1
  }

  /**
   * Compare source slice against target lines.
   * @description Checks if consecutive source lines match target.
   * @param sourceLines - Lines to compare from
   * @param targetLines - Expected line sequence
   * @param startIndex - Source start position
   * @param mapFn - Line transformation for comparison
   * @returns True if all lines match
   */
  private static sliceEquals(
    sourceLines: string[],
    targetLines: string[],
    startIndex: number,
    mapFn: Types.FuzzStrategy['mapFn']
  ): boolean {
    if (startIndex + targetLines.length > sourceLines.length) {
      return false
    }
    for (let lineIndex = 0; lineIndex < targetLines.length; lineIndex += 1) {
      if (mapFn(sourceLines[startIndex + lineIndex]!) !== mapFn(targetLines[lineIndex]!)) {
        return false
      }
    }
    return true
  }
}

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
  /** Unicode to ASCII replacement map */
  private static readonly unicodeReplacements: Record<string, string> = {
    '\u2010': '-',
    '\u2011': '-',
    '\u2012': '-',
    '\u2013': '-',
    '\u2014': '-',
    '\u2015': '-',
    '\u2212': '-',
    '\u2018': "'",
    '\u2019': "'",
    '\u201a': "'",
    '\u201b': "'",
    '\u201c': '"',
    '\u201d': '"',
    '\u201e': '"',
    '\u201f': '"',
    '\u00a0': ' ',
    '\u2002': ' ',
    '\u2003': ' ',
    '\u2004': ' ',
    '\u2005': ' ',
    '\u2006': ' ',
    '\u2007': ' ',
    '\u2008': ' ',
    '\u2009': ' ',
    '\u200a': ' ',
    '\u202f': ' ',
    '\u205f': ' ',
    '\u3000': ' '
  }
  /** Precompiled Unicode replacement pattern */
  private static readonly unicodePattern = new RegExp(
    `[${Object.keys(this.unicodeReplacements).join('')}]`,
    'g'
  )

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
    return line.trim().replace(
      this.unicodePattern,
      (char) => this.unicodeReplacements[char]!
    )
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
    mapFn: Types.LineTransformFn
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
    mapFn: Types.LineTransformFn
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

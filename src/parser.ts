import type * as Types from '@app/types.ts'
import Matcher from '@app/matcher.ts'

/**
 * V4A diff format parser.
 * @description Parses context-anchored diff into typed chunks.
 */
export default class Parser {
  /** End of file marker string */
  private static readonly endFile = '*** End of File'
  /** Prefix character to hunk mode mapping */
  private static readonly prefixToMode: Readonly<Record<string, Types.HunkLineMode>> = {
    '+': 'add',
    '-': 'delete',
    ' ': 'keep'
  }
  /** Patch section terminator markers */
  private static readonly terminators = [
    '*** End Patch',
    '*** Update File:',
    '*** Delete File:',
    '*** Add File:'
  ] as const

  /**
   * Normalize diff text into lines.
   * @description Splits on newlines and trims trailing empty.
   * @param diffText - Raw diff text string
   * @returns Array of diff lines
   */
  static normalizeDiffLines(diffText: string): string[] {
    const lines = diffText.split(/\r?\n/)
    if (lines.at(-1) === '') {
      lines.pop()
    }
    return lines
  }

  /**
   * Parse create-mode diff lines.
   * @description Extracts added lines from create diff format.
   * @param diffLines - Prefixed diff lines to parse
   * @returns Joined output text string
   * @throws SyntaxError when line lacks '+' prefix
   */
  static parseCreateDiff(diffLines: string[]): string {
    const state = this.createState(diffLines)
    const outputLines: string[] = []
    while (!this.isDone(state, false)) {
      const currentLine = state.lines[state.currentIndex]!
      state.currentIndex += 1
      if (!currentLine.startsWith('+')) {
        throw new SyntaxError(`expected '+' prefix but got "${currentLine}"`)
      }
      outputLines.push(currentLine.slice(1))
    }
    return outputLines.join('\n')
  }

  /**
   * Parse update-mode diff against source.
   * @description Resolves anchors and context to produce chunks.
   * @param diffLines - Prefixed diff lines to parse
   * @param sourceText - Original source file text
   * @returns Parsed update with chunks and fuzz
   * @throws SyntaxError when context or anchor unmatched
   */
  static parseUpdateDiff(diffLines: string[], sourceText: string): Types.ParsedUpdate {
    const state = this.createState(diffLines)
    const sourceLines = sourceText.split('\n')
    const diffChunks: Types.DiffChunk[] = []
    let sourceOffset = 0
    while (!this.isDone(state, true)) {
      const anchorText = this.consumePrefix(state, '@@ ')
      const hasBareAnchor = !anchorText && state.lines[state.currentIndex] === '@@'
      if (hasBareAnchor) {
        state.currentIndex += 1
      }
      if (!anchorText && !hasBareAnchor && sourceOffset !== 0) {
        throw new SyntaxError(`unexpected line "${state.lines[state.currentIndex]}"`)
      }
      if (anchorText?.trim()) {
        sourceOffset = Matcher.resolveAnchor(anchorText, sourceLines, sourceOffset, state)
      }
      const hunkSection = this.readSection(state.lines, state.currentIndex)
      const contextMatch = Matcher.findContext(
        sourceLines,
        hunkSection.contextLines,
        sourceOffset,
        hunkSection.isEndOfFile
      )
      if (contextMatch.matchedIndex === -1) {
        const errorLabel = hunkSection.isEndOfFile ? 'EOF context' : 'context'
        throw new SyntaxError(
          `unmatched ${errorLabel} at cursor ${sourceOffset} "${
            hunkSection.contextLines.join('\n')
          }"`
        )
      }
      state.fuzzScore += contextMatch.fuzzScore
      for (const sectionChunk of hunkSection.diffChunks) {
        diffChunks.push({
          ...sectionChunk,
          sourceIndex: sectionChunk.sourceIndex + contextMatch.matchedIndex
        })
      }
      sourceOffset = contextMatch.matchedIndex + hunkSection.contextLines.length
      state.currentIndex = hunkSection.endIndex
    }
    return { diffChunks, fuzzScore: state.fuzzScore }
  }

  /**
   * Consume line with matching prefix.
   * @description Advances state if current line matches prefix.
   * @param state - Mutable parser state
   * @param linePrefix - Prefix string to match
   * @returns Text after prefix or empty string
   */
  private static consumePrefix(state: Types.ParserState, linePrefix: string): string {
    if (state.lines[state.currentIndex]?.startsWith(linePrefix)) {
      state.currentIndex += 1
      return state.lines[state.currentIndex - 1]!.slice(linePrefix.length)
    }
    return ''
  }

  /**
   * Create initial parser state.
   * @description Copies lines and appends sentinel terminator.
   * @param diffLines - Diff lines to wrap
   * @returns Fresh parser state object
   */
  private static createState(diffLines: string[]): Types.ParserState {
    return { lines: [...diffLines, this.terminators[0]], currentIndex: 0, fuzzScore: 0 }
  }

  /**
   * Check if parsing is complete.
   * @description Tests for end of lines or terminator.
   * @param state - Current parser state
   * @param includeEndFile - Whether EOF marker terminates
   * @returns True if no more lines to parse
   */
  private static isDone(state: Types.ParserState, includeEndFile: boolean): boolean {
    return (
      state.currentIndex >= state.lines.length ||
      this.isTerminator(state.lines[state.currentIndex]!, includeEndFile)
    )
  }

  /**
   * Check if line is section boundary.
   * @description Tests for anchor marker or terminator line.
   * @param currentLine - Line to test
   * @returns True if line starts new section
   */
  private static isSectionBoundary(currentLine: string): boolean {
    return currentLine.startsWith('@@') || this.isTerminator(currentLine, true)
  }

  /**
   * Check if line is a terminator.
   * @description Tests against known patch terminator prefixes.
   * @param currentLine - Line to test
   * @param includeEndFile - Whether EOF marker counts
   * @returns True if line is a terminator
   */
  private static isTerminator(currentLine: string, includeEndFile: boolean): boolean {
    if (this.terminators.some((terminator) => currentLine.startsWith(terminator))) {
      return true
    }
    return includeEndFile && currentLine.startsWith(this.endFile)
  }

  /**
   * Read one hunk section from lines.
   * @description Collects context, deletions, and insertions into chunks.
   * @param lines - All diff lines
   * @param startIndex - Section start position
   * @returns Parsed section with context and chunks
   * @throws SyntaxError on unexpected markers or prefixes
   */
  private static readSection(
    lines: string[],
    startIndex: number
  ): Types.SectionResult {
    const contextLines: string[] = []
    let deletedLines: string[] = []
    let insertedLines: string[] = []
    const diffChunks: Types.DiffChunk[] = []
    let lineMode: Types.HunkLineMode = 'keep'
    let lineIndex = startIndex
    while (lineIndex < lines.length) {
      const rawLine = lines[lineIndex]!
      if (this.isSectionBoundary(rawLine) || rawLine === '***') {
        break
      }
      if (rawLine.startsWith('***')) {
        throw new SyntaxError(`unexpected marker "${rawLine}"`)
      }
      lineIndex += 1
      const lastMode: Types.HunkLineMode = lineMode
      const normalizedLine = rawLine || ' '
      const resolvedMode = this.prefixToMode[normalizedLine[0]!]
      if (!resolvedMode) {
        throw new SyntaxError(`unexpected line prefix "${normalizedLine}"`)
      }
      lineMode = resolvedMode
      const unprefixedLine = normalizedLine.slice(1)
      if (lineMode === 'keep' && lastMode !== lineMode) {
        if (deletedLines.length || insertedLines.length) {
          diffChunks.push({
            sourceIndex: contextLines.length - deletedLines.length,
            deletedLines,
            insertedLines
          })
          deletedLines = []
          insertedLines = []
        }
      }
      if (lineMode === 'delete') {
        deletedLines.push(unprefixedLine)
        contextLines.push(unprefixedLine)
      } else if (lineMode === 'add') {
        insertedLines.push(unprefixedLine)
      } else {
        contextLines.push(unprefixedLine)
      }
    }
    if (deletedLines.length || insertedLines.length) {
      diffChunks.push({
        sourceIndex: contextLines.length - deletedLines.length,
        deletedLines,
        insertedLines
      })
    }
    if (lineIndex < lines.length && lines[lineIndex] === this.endFile) {
      return { contextLines, diffChunks, endIndex: lineIndex + 1, isEndOfFile: true }
    }
    if (lineIndex === startIndex) {
      throw new SyntaxError(`empty section at index ${lineIndex} "${lines[lineIndex]}"`)
    }
    return { contextLines, diffChunks, endIndex: lineIndex, isEndOfFile: false }
  }
}

import type * as Types from '@app/types.ts'
import Parser from '@app/parser.ts'
import Refiner from '@app/refine.ts'

/**
 * V4A context-anchored diff applicator.
 * @description Applies V4A patches and produces structured diff output.
 */
export default class V4A {
  /** Exact envelope lines to strip */
  private static readonly envelopeExact = new Set([
    '*** Begin Patch',
    '*** End Patch',
    '\\ No newline at end of file'
  ])
  /** Prefix-based envelope markers to strip */
  private static readonly envelopePrefixes = [
    '*** Add File:',
    '*** Delete File:',
    '*** Move to:',
    '*** Update File:',
    '--- a/',
    '--- a\\',
    '+++ b/',
    '+++ b\\'
  ] as const

  /**
   * Apply V4A diff to source.
   * @description Parses and applies diff to produce patched output.
   * @param sourceText - Original source file text
   * @param diffText - V4A format diff string
   * @param mode - Operation mode: update, create, move, or delete
   * @returns Result with patched text and diff lines
   */
  static apply(
    sourceText: string,
    diffText: string,
    mode: Types.ApplyDiffMode = 'update'
  ): Types.ApplyDiffResult {
    sourceText = (sourceText ?? '').replaceAll('\r\n', '\n')
    diffText = diffText ?? ''
    if (mode === 'delete') {
      return this.buildResult(sourceText, '', sourceText.split('\n'), 'delete')
    }
    const diffLines = this.stripLeadingEmpty(
      this.stripEnvelope(Parser.normalizeDiffLines(diffText))
    )
    if (mode === 'create') {
      const resultText = Parser.parseCreateDiff(diffLines)
      return this.buildResult(sourceText, resultText, resultText.split('\n'), 'add')
    }
    return this.applyChunks(sourceText, Parser.parseUpdateDiff(diffLines, sourceText).diffChunks)
  }

  /**
   * Refine line diff into grapheme segments.
   * @description Attaches intra-line segments to changed lines.
   * @param diffLines - Structured line diff from apply
   * @returns Diff with segments on changed lines
   */
  static refine(diffLines: Types.DiffLine[]): Types.DiffLine[] {
    return Refiner.refine(diffLines)
  }

  /**
   * Apply diff chunks to source text.
   * @description Builds output text and structured diff from chunks.
   * @param sourceText - Original source file text
   * @param diffChunks - Parsed diff chunks to apply
   * @returns Result with patched text and diff lines
   * @throws RangeError on out-of-bounds or overlapping chunks
   */
  private static applyChunks(
    sourceText: string,
    diffChunks: Types.DiffChunk[]
  ): Types.ApplyDiffResult {
    const sourceLines = sourceText.split('\n')
    const outputLines: string[] = []
    const diffOutput: Types.DiffLine[] = []
    let sourceOffset = 0
    let newLineCounter = 1
    for (const diffChunk of diffChunks) {
      if (diffChunk.sourceIndex > sourceLines.length) {
        throw new RangeError(
          `chunk targets source line ${
            diffChunk.sourceIndex + 1
          } but file only has ${sourceLines.length} lines`
        )
      }
      if (sourceOffset > diffChunk.sourceIndex) {
        throw new RangeError(
          `overlapping chunk at source line ${
            diffChunk.sourceIndex + 1
          } but cursor already at line ${sourceOffset + 1}`
        )
      }
      for (let lineIndex = sourceOffset; lineIndex < diffChunk.sourceIndex; lineIndex += 1) {
        outputLines.push(sourceLines[lineIndex]!)
        diffOutput.push({
          type: 'equal',
          value: sourceLines[lineIndex]!,
          oldLine: lineIndex + 1,
          newLine: newLineCounter
        })
        newLineCounter += 1
      }
      sourceOffset = diffChunk.sourceIndex
      for (const deletedLine of diffChunk.deletedLines) {
        diffOutput.push({
          type: 'delete',
          value: deletedLine,
          oldLine: sourceOffset + 1,
          newLine: null
        })
        sourceOffset += 1
      }
      for (const insertedLine of diffChunk.insertedLines) {
        outputLines.push(insertedLine)
        diffOutput.push({
          type: 'add',
          value: insertedLine,
          oldLine: null,
          newLine: newLineCounter
        })
        newLineCounter += 1
      }
    }
    for (let lineIndex = sourceOffset; lineIndex < sourceLines.length; lineIndex += 1) {
      outputLines.push(sourceLines[lineIndex]!)
      diffOutput.push({
        type: 'equal',
        value: sourceLines[lineIndex]!,
        oldLine: lineIndex + 1,
        newLine: newLineCounter
      })
      newLineCounter += 1
    }
    return { text: outputLines.join('\n'), diff: diffOutput, source: sourceText }
  }

  /**
   * Build result for uniform operations.
   * @description Maps lines to DiffLine entries for single-type operations.
   * @param sourceText - Original source file text
   * @param resultText - Patched output text
   * @param lines - Split result lines array
   * @param type - Diff line mutation type
   * @returns Structured diff result with text and source
   */
  private static buildResult(
    sourceText: string,
    resultText: string,
    lines: string[],
    type: Types.DiffMutationType
  ): Types.ApplyDiffResult {
    return {
      text: resultText,
      source: sourceText,
      diff: lines.map((value, index) => ({
        type,
        value,
        oldLine: type === 'delete' ? index + 1 : null,
        newLine: type === 'add' ? index + 1 : null
      }))
    }
  }

  /**
   * Strip patch envelope markers from lines.
   * @description Removes Begin/End Patch, file headers, and git markers.
   * @param diffLines - Raw diff lines to filter
   * @returns Lines without envelope markers
   */
  private static stripEnvelope(diffLines: string[]): string[] {
    return diffLines.filter((currentLine) => {
      const trimmedLine = currentLine.trim()
      return !this.envelopeExact.has(trimmedLine) &&
        !this.envelopePrefixes.some((prefix) => trimmedLine.startsWith(prefix))
    })
  }

  /**
   * Strip leading empty lines from diff.
   * @description Skips empty lines at start of array.
   * @param diffLines - Lines to trim
   * @returns Lines without leading empties
   */
  private static stripLeadingEmpty(diffLines: string[]): string[] {
    let startIndex = 0
    while (startIndex < diffLines.length && diffLines[startIndex] === '') {
      startIndex += 1
    }
    return startIndex > 0 ? diffLines.slice(startIndex) : diffLines
  }
}

/** Re-export all type definitions */
export type * from '@app/types.ts'

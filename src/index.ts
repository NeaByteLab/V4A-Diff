import type * as Types from '@app/types.ts'
import Parser from '@app/parser.ts'

/**
 * V4A context-anchored diff applicator.
 * @description Applies V4A patches and produces structured diff output.
 */
export default class V4A {
  /**
   * Apply a V4A diff patch.
   * @description Parses and applies diff to source text.
   * @param sourceText - Original source file text
   * @param diffText - V4A format diff string
   * @param mode - Apply mode: default or create
   * @returns Result with patched text and diff lines
   */
  static apply(
    sourceText: string,
    diffText: string,
    mode: Types.ApplyDiffMode = 'default'
  ): Types.ApplyDiffResult {
    const diffLines = this.stripLeadingEmpty(
      this.stripEnvelope(Parser.normalizeDiffLines(diffText))
    )
    if (mode === 'create') {
      const resultText = Parser.parseCreateDiff(diffLines)
      const resultLines = resultText.split('\n')
      const diffOutput: Types.DiffLine[] = []
      for (let lineIndex = 0; lineIndex < resultLines.length; lineIndex += 1) {
        diffOutput.push({
          type: 'add',
          value: resultLines[lineIndex]!,
          oldLine: null,
          newLine: lineIndex + 1
        })
      }
      return { text: resultText, diff: diffOutput, source: sourceText }
    }
    return this.applyChunks(sourceText, Parser.parseUpdateDiff(diffLines, sourceText).diffChunks)
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
          `chunk sourceIndex ${diffChunk.sourceIndex} exceeds input length ${sourceLines.length}`
        )
      }
      if (sourceOffset > diffChunk.sourceIndex) {
        throw new RangeError(
          `overlapping chunk at ${diffChunk.sourceIndex} cursor already at ${sourceOffset}`
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
   * Strip patch envelope markers from lines.
   * @description Removes Begin/End Patch, file headers, and git markers.
   * @param diffLines - Raw diff lines to filter
   * @returns Lines without envelope markers
   */
  private static stripEnvelope(diffLines: string[]): string[] {
    return diffLines.filter((currentLine) => {
      if (currentLine === '*** Begin Patch' || currentLine === '*** End Patch') {
        return false
      }
      if (currentLine.startsWith('*** Update File:') || currentLine.startsWith('*** Add File:')) {
        return false
      }
      if (currentLine.startsWith('--- a/') || currentLine.startsWith('+++ b/')) {
        return false
      }
      if (currentLine.startsWith('--- a\\') || currentLine.startsWith('+++ b\\')) {
        return false
      }
      if (currentLine === '\\ No newline at end of file') {
        return false
      }
      return true
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

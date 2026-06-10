import type * as Types from '@app/types.ts'

/**
 * Intra-line diff refiner.
 * @description Refines line diffs into grapheme-level segments.
 */
export default class Refiner {
  /** Unicode-aware grapheme segmenter */
  private static readonly segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  /**
   * Refine line diff with intra-line segments.
   * @description Attaches grapheme segments to paired delete and add lines.
   * @param diffLines - Structured line diff to refine
   * @returns New diff with segments on changed lines
   */
  static refine(diffLines: Types.DiffLine[]): Types.DiffLine[] {
    if (!Array.isArray(diffLines)) {
      return []
    }
    const refined: Types.DiffLine[] = []
    let lineIndex = 0
    while (lineIndex < diffLines.length) {
      const deleteStart = lineIndex
      while (diffLines[lineIndex]?.type === 'delete') {
        lineIndex += 1
      }
      const addStart = lineIndex
      while (diffLines[lineIndex]?.type === 'add') {
        lineIndex += 1
      }
      const deletedLines = diffLines.slice(deleteStart, addStart)
      const addedLines = diffLines.slice(addStart, lineIndex)
      if (deletedLines.length && addedLines.length) {
        this.pushPaired(refined, deletedLines, addedLines)
      } else if (deletedLines.length || addedLines.length) {
        refined.push(...deletedLines, ...addedLines)
      } else {
        refined.push(diffLines[lineIndex]!)
        lineIndex += 1
      }
    }
    return refined
  }

  /**
   * Build longest common subsequence length table.
   * @description Computes suffix LCS lengths for grapheme arrays.
   * @param oldGraphemes - Original graphemes
   * @param newGraphemes - Replacement graphemes
   * @returns Table of suffix LCS lengths
   */
  private static buildLcsTable(oldGraphemes: string[], newGraphemes: string[]): number[][] {
    const table = Array.from(
      { length: oldGraphemes.length + 1 },
      () => new Array<number>(newGraphemes.length + 1).fill(0)
    )
    for (let oldIndex = oldGraphemes.length - 1; oldIndex >= 0; oldIndex -= 1) {
      for (let newIndex = newGraphemes.length - 1; newIndex >= 0; newIndex -= 1) {
        table[oldIndex]![newIndex] = oldGraphemes[oldIndex] === newGraphemes[newIndex]
          ? table[oldIndex + 1]![newIndex + 1]! + 1
          : Math.max(table[oldIndex + 1]![newIndex]!, table[oldIndex]![newIndex + 1]!)
      }
    }
    return table
  }

  /**
   * Diff two strings at grapheme level.
   * @description Trims shared edges then runs LCS on the rest.
   * @param oldText - Original line text
   * @param newText - Replacement line text
   * @returns Ordered intra-line segments
   */
  private static diffGraphemes(oldText: string, newText: string): Types.CharSegment[] {
    const oldGraphemes = this.toGraphemes(oldText)
    const newGraphemes = this.toGraphemes(newText)
    let prefix = 0
    const maxPrefix = Math.min(oldGraphemes.length, newGraphemes.length)
    while (prefix < maxPrefix && oldGraphemes[prefix] === newGraphemes[prefix]) {
      prefix += 1
    }
    let suffix = 0
    const maxSuffix = maxPrefix - prefix
    while (
      suffix < maxSuffix &&
      oldGraphemes[oldGraphemes.length - 1 - suffix] ===
        newGraphemes[newGraphemes.length - 1 - suffix]
    ) {
      suffix += 1
    }
    const oldMiddle = oldGraphemes.slice(prefix, oldGraphemes.length - suffix)
    const newMiddle = newGraphemes.slice(prefix, newGraphemes.length - suffix)
    const segments: Types.CharSegment[] = []
    if (prefix) {
      segments.push({ type: 'equal', value: oldGraphemes.slice(0, prefix).join('') })
    }
    this.diffMiddle(oldMiddle, newMiddle, segments)
    if (suffix) {
      segments.push({
        type: 'equal',
        value: oldGraphemes.slice(oldGraphemes.length - suffix).join('')
      })
    }
    return segments
  }

  /**
   * Diff middle graphemes after edge trimming.
   * @description Runs LCS on the differing middle region.
   * @param oldGraphemes - Original middle graphemes
   * @param newGraphemes - Replacement middle graphemes
   * @param segments - Segment list to mutate
   */
  private static diffMiddle(
    oldGraphemes: string[],
    newGraphemes: string[],
    segments: Types.CharSegment[]
  ): void {
    const table = this.buildLcsTable(oldGraphemes, newGraphemes)
    let oldIndex = 0
    let newIndex = 0
    while (oldIndex < oldGraphemes.length && newIndex < newGraphemes.length) {
      if (oldGraphemes[oldIndex] === newGraphemes[newIndex]) {
        this.pushSegment(segments, 'equal', oldGraphemes[oldIndex]!)
        oldIndex += 1
        newIndex += 1
      } else if (table[oldIndex + 1]![newIndex]! >= table[oldIndex]![newIndex + 1]!) {
        this.pushSegment(segments, 'delete', oldGraphemes[oldIndex]!)
        oldIndex += 1
      } else {
        this.pushSegment(segments, 'add', newGraphemes[newIndex]!)
        newIndex += 1
      }
    }
    while (oldIndex < oldGraphemes.length) {
      this.pushSegment(segments, 'delete', oldGraphemes[oldIndex]!)
      oldIndex += 1
    }
    while (newIndex < newGraphemes.length) {
      this.pushSegment(segments, 'add', newGraphemes[newIndex]!)
      newIndex += 1
    }
  }

  /**
   * Push paired delete and add lines.
   * @description Refines index-paired lines and keeps grouped order.
   * @param refined - Output diff list to mutate
   * @param deletedLines - Consecutive delete lines
   * @param addedLines - Consecutive add lines
   */
  private static pushPaired(
    refined: Types.DiffLine[],
    deletedLines: Types.DiffLine[],
    addedLines: Types.DiffLine[]
  ): void {
    const pairCount = Math.min(deletedLines.length, addedLines.length)
    const deleteOutput = [...deletedLines]
    const addOutput = [...addedLines]
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const deletedLine = deletedLines[pairIndex]!
      const addedLine = addedLines[pairIndex]!
      if (typeof deletedLine.value === 'string' && typeof addedLine.value === 'string') {
        const segments = this.diffGraphemes(deletedLine.value, addedLine.value)
        deleteOutput[pairIndex] = {
          ...deletedLine,
          segments: segments.filter((segment) => segment.type !== 'add')
        }
        addOutput[pairIndex] = {
          ...addedLine,
          segments: segments.filter((segment) => segment.type !== 'delete')
        }
      }
    }
    refined.push(...deleteOutput, ...addOutput)
  }

  /**
   * Append grapheme to segment list.
   * @description Merges into the last segment when type matches.
   * @param segments - Segment list to mutate
   * @param type - Segment operation type
   * @param value - Grapheme to append
   */
  private static pushSegment(
    segments: Types.CharSegment[],
    type: Types.DiffLineType,
    value: string
  ): void {
    const lastSegment = segments.at(-1)
    if (lastSegment?.type === type) {
      lastSegment.value += value
    } else {
      segments.push({ type, value })
    }
  }

  /**
   * Split text into graphemes.
   * @description Uses Unicode segmenter for grapheme-safe splitting.
   * @param text - Text to split
   * @returns Array of graphemes
   */
  private static toGraphemes(text: string): string[] {
    return Array.from(this.segmenter.segment(text), (entry) => entry.segment)
  }
}

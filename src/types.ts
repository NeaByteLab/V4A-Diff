/** Diff application mode selector */
export type ApplyDiffMode = 'default' | 'create'

/**
 * Result from applying a diff.
 * @description Contains patched text, structured diff, and source.
 */
export type ApplyDiffResult = {
  /** Patched output text */
  text: string
  /** Structured line-by-line diff entries */
  diff: DiffLine[]
  /** Original source text before patching */
  source: string
}

/**
 * Fuzzy context match result.
 * @description Holds matched line index and fuzz penalty.
 */
export type ContextMatch = {
  /** Matched source line index */
  matchedIndex: number
  /** Accumulated fuzz penalty score */
  fuzzScore: number
}

/**
 * Single chunk of diff operations.
 * @description Groups deleted and inserted lines at source position.
 */
export type DiffChunk = {
  /** Starting index in source lines */
  sourceIndex: number
  /** Lines removed from source */
  deletedLines: string[]
  /** Lines added to output */
  insertedLines: string[]
}

/**
 * Single line in structured diff.
 * @description Represents one add, delete, or equal line entry.
 */
export type DiffLine = {
  /** Operation type for this line */
  type: 'add' | 'delete' | 'equal'
  /** Line content without prefix */
  value: string
  /** Source line number or null */
  oldLine: number | null
  /** Result line number or null */
  newLine: number | null
}

/**
 * Fuzzy matching strategy with penalty.
 * @description Pairs a line transform with fuzz score.
 */
export type FuzzStrategy = {
  /** Line transformation function */
  mapFn: (line: string) => string
  /** Penalty score for this strategy */
  fuzzScore: number
}

/** Hunk line operation mode */
export type HunkLineMode = 'keep' | 'add' | 'delete'

/**
 * Parsed update diff result.
 * @description Contains diff chunks and total fuzz score.
 */
export type ParsedUpdate = {
  /** Ordered list of diff chunks */
  diffChunks: DiffChunk[]
  /** Total accumulated fuzz score */
  fuzzScore: number
}

/**
 * Mutable parser state during processing.
 * @description Tracks lines, cursor position, and fuzz score.
 */
export type ParserState = {
  /** All diff lines being parsed */
  lines: string[]
  /** Current cursor position */
  currentIndex: number
  /** Running fuzz penalty total */
  fuzzScore: number
}

/**
 * Parsed section with context and chunks.
 * @description Groups context lines, chunks, and boundary info.
 */
export type SectionResult = {
  /** Context lines from source */
  contextLines: string[]
  /** Diff chunks in this section */
  diffChunks: DiffChunk[]
  /** Line index after section end */
  endIndex: number
  /** True when section ends at EOF */
  isEndOfFile: boolean
}

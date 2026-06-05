import { defineBuildConfig } from 'unbuild'
import { resolve } from 'node:path'

/**
 * Unbuild config for package bundle.
 * @description Entry, alias, CJS/ESM, declarations, no sourcemaps.
 */
export default defineBuildConfig({
  /** Entry module path(s) for build. */
  entries: ['src/index'],
  /** Emit TypeScript declaration files. */
  declaration: true,
  /** Remove output directory before build. */
  clean: true,
  /** Path alias for imports (e.g. @root → src). */
  alias: {
    '@app': resolve(__dirname, 'src')
  },
  /** Rollup options: emit CJS and inline runtime deps. */
  rollup: {
    emitCJS: true,
    inlineDependencies: true
  },
  /** Disable source map generation. */
  sourcemap: false,
  /** Do not fail build on Rollup warnings. */
  failOnWarn: false
})

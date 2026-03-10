#!/usr/bin/env node
/**
 * EAS Build lifecycle hook: runs at end of build (success or failure).
 * No-op that exits 0 so the "Build complete hook" phase never fails.
 * Used by: npm/yarn run eas-build-on-complete (from package.json).
 */
process.exit(0);

export * from './types';
export { parseLab } from './parser';
export { PersistentShell } from './shell';
export { WalkthroughRunner, compareOutput } from './runner';
export {
  runStaticChecks, summarizeFindings,
  checkPlaceholderConsistency, checkSnippetDrift, checkRequiredVariables,
  Finding, Severity, StaticCheckOptions,
} from './static-checks';

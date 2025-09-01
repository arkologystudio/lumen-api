// Re-export spec-compliant types and aggregator
export { 
  LighthouseAIReport,
  SpecIndicator as IndicatorResult,
  SpecCategory as Category,
  SpecWeights as Weights,
  SpecCompliantAggregator as DiagnosticAggregator,
  DEFAULT_WEIGHTS
} from './specAggregator';

// Import to use in type alias
import { LighthouseAIReport } from './specAggregator';

// Legacy type alias for compatibility
export type AggregatedResult = LighthouseAIReport;
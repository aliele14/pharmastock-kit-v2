/** Public surface of the supply-chain domain layer. */
export * from './types';
export { daysToExpiry, expiryBucket, fefoRank, valueAtRisk } from './expiry';
export {
  SERVICE_LEVEL_Z,
  demandStats,
  safetyStock,
  reorderPoint,
  stockStatus,
  suggestedOrderQty,
} from './reorder';
export { Z_THRESHOLD, MIN_DATAPOINTS, detectAnomalies, hasRecentAnomaly } from './anomalies';
export {
  VAR_RISK_THRESHOLD,
  generateBriefing,
  type BriefingInput,
  type BriefingProduct,
  type BriefingBatch,
  type BriefingAnomaly,
  type BriefingReport,
  type BriefingLine,
  type BriefingSection,
} from './briefing';

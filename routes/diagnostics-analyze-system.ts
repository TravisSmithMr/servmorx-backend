import type {
  DiagnosticsAnalyzeSystemRequest,
  DiagnosticsAnalyzeSystemResponse,
} from '@/backend/contracts/diagnostics';
import { analyzeSystemPerformance } from '@/core/analytics-engine';

export async function handleDiagnosticsAnalyzeSystem(
  request: DiagnosticsAnalyzeSystemRequest
): Promise<DiagnosticsAnalyzeSystemResponse> {
  return {
    analytics: analyzeSystemPerformance({
      suctionPressure: request.measurements.suctionPressure ?? null,
      liquidPressure: request.measurements.liquidPressure ?? null,
      suctionLineTemp: request.measurements.suctionLineTemp ?? null,
      liquidLineTemp: request.measurements.liquidLineTemp ?? null,
      outdoorAmbientTemp: request.measurements.outdoorAmbientTemp ?? null,
      indoorReturnTemp: request.measurements.indoorReturnTemp ?? null,
      indoorSupplyTemp: request.measurements.indoorSupplyTemp ?? null,
      superheat: request.measurements.superheat ?? null,
      subcool: request.measurements.subcool ?? null,
    }),
  };
}

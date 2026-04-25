import { buildDiagnosticContext } from '@/features/copilot/build-diagnostic-context';
import type { DiagnosticSession } from '@/types/diagnostic';

export function buildCopilotContext(session: DiagnosticSession) {
  const diagnosticContext = buildDiagnosticContext(session);
  const knownFacts = [
    diagnosticContext.issue ? `Issue lane: ${diagnosticContext.issue}` : null,
    diagnosticContext.primaryRoute ? `Primary route: ${diagnosticContext.primaryRoute}` : null,
    diagnosticContext.secondaryRoute ? `Secondary route: ${diagnosticContext.secondaryRoute}` : null,
    diagnosticContext.equipment.systemType
      ? `System type: ${diagnosticContext.equipment.systemType}`
      : null,
    diagnosticContext.equipment.indoorPlatform
      ? `Indoor platform: ${diagnosticContext.equipment.indoorPlatform}`
      : null,
    diagnosticContext.equipment.refrigerant
      ? `Refrigerant: ${diagnosticContext.equipment.refrigerant}`
      : null,
    diagnosticContext.equipment.brand || diagnosticContext.equipment.modelNumber
      ? `Equipment: ${[
          diagnosticContext.equipment.brand,
          diagnosticContext.equipment.modelNumber,
        ]
          .filter(Boolean)
          .join(' | ')}`
      : null,
    diagnosticContext.route ? `Current route: ${diagnosticContext.route}` : null,
    diagnosticContext.result ? `Top route explanation: ${diagnosticContext.result.summary}` : null,
  ].filter(Boolean) as string[];

  return {
    hash: diagnosticContext.hash,
    issueLabel: diagnosticContext.issue,
    systemLabel: diagnosticContext.equipment.systemType,
    routeLabel: diagnosticContext.route,
    primaryRouteLabel: diagnosticContext.primaryRoute,
    secondaryRouteLabel: diagnosticContext.secondaryRoute,
    equipmentLabel: [
      diagnosticContext.equipment.brand,
      diagnosticContext.equipment.modelNumber,
      diagnosticContext.equipment.serialNumber,
    ]
      .filter(Boolean)
      .join(' ') || null,
    knownFacts,
    missingFacts: diagnosticContext.missingDataFlags,
    routeReasons: diagnosticContext.routeReasons,
    routeSwapReason: diagnosticContext.routeSwapReason,
    contradictions: diagnosticContext.contradictions,
    result: diagnosticContext.result,
    analytics: diagnosticContext.analytics,
  };
}

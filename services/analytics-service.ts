import { analyzeSystemPerformance } from '@/core/analytics-engine';
import { postDiagnosticsAnalyzeSystem } from '@/services/backend-api';
import type { AnalyticsSummary, DiagnosticSession, OcrProviderPath } from '@/types/diagnostic';

export interface AnalyticsProviderResult {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string;
  usedFallback: boolean;
  analytics: AnalyticsSummary;
}

function titleCase(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildFallbackResult(session: DiagnosticSession, errorMessage: string | null): AnalyticsProviderResult {
  return {
    provider: 'local_analytics_engine',
    providerPath: 'fallback_provider',
    providerStatus: errorMessage
      ? `Backend analytics unavailable: ${errorMessage} Local analytics fallback was used.`
      : 'Local analytics fallback was used.',
    usedFallback: true,
    analytics: analyzeSystemPerformance(session),
  };
}

export async function analyzeSystemViaBackend(
  session: DiagnosticSession
): Promise<AnalyticsProviderResult> {
  try {
    const response = await postDiagnosticsAnalyzeSystem({
      context: {
        issue: titleCase(session.issue),
        route: titleCase(session.currentRoute),
        equipment: {
          brand: session.brand,
          modelNumber: session.modelNumber,
          serialNumber: session.serialNumber,
          systemType: titleCase(session.systemType),
          indoorPlatform: titleCase(session.indoorPlatform),
          refrigerant: session.specData?.refrigerant ?? null,
        },
      },
      measurements: { ...session.measurements },
    });

    if (!response.analytics || !Array.isArray(response.analytics.signals)) {
      return buildFallbackResult(
        session,
        'Backend analytics response did not match the expected analytics contract.'
      );
    }

    return {
      provider: response.provider ?? 'backend_analytics_engine',
      providerPath: response.providerPath ?? 'backend_proxy',
      providerStatus:
        response.providerStatus ?? 'Backend analytics responded without provider status metadata.',
      usedFallback: response.usedFallback ?? false,
      analytics: response.analytics,
    };
  } catch (error) {
    return buildFallbackResult(
      session,
      error instanceof Error ? error.message : 'Unknown backend analytics request error.'
    );
  }
}

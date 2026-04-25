import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { RoutePill } from '@/components/route-pill';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { servmorxTheme } from '@/constants/theme';
import {
  buildEquipmentFlowDecision,
} from '@/features/equipment/flow/resolve-equipment-flow';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

const TOTAL_STEPS = 4;

function deriveUsedFallback(provider: string | null, providerPath: string | null, providerStatus: string | null) {
  const debugText = `${provider ?? ''} ${providerPath ?? ''} ${providerStatus ?? ''}`.toLowerCase();

  return debugText.includes('fallback') || debugText.includes('mock');
}

export default function EquipmentConfirmationScreen() {
  const router = useRouter();
  const {
    session,
    setCurrentStep,
    setFlowControl,
    setSystemType,
    setIndoorPlatform,
  } = useSession();

  useEffect(() => {
    if (!session.capture) {
      router.replace('/scan-equipment');
      return;
    }

    setCurrentStep('equipment-confirmation');
  }, [router, session.capture, setCurrentStep]);

  const decision = buildEquipmentFlowDecision(session);
  const confidenceLabel =
    session.extractionConfidence !== null ? `${Math.round(session.extractionConfidence * 100)}%` : 'Unknown';
  const editLabel = decision.confidenceLevel === 'low' ? 'Edit Manually' : 'Edit';
  const primaryLabel =
    decision.confidenceLevel === 'low' ? 'Continue with Manual Entry' : 'Confirm & Continue';
  const usedFallback = deriveUsedFallback(
    session.ocrProvider,
    session.scanDebug.ocrProviderPath,
    session.scanDebug.ocrProviderStatus
  );
  const hasOcrFailure = Boolean(session.scanDebug.errorMessage || session.scanDebug.openAiError || usedFallback);

  const handleConfirm = () => {
    if (decision.shouldFallbackToManual) {
      router.replace('/manual-equipment');
      return;
    }

    setFlowControl({
      inferredValues: {
        systemType: decision.inferredSystemType,
        indoorPlatform: decision.inferredIndoorPlatform,
        detectedUnitType: session.detectedUnitType,
      },
      confirmedValues: {
        equipment: true,
      },
      skippedQuestions: decision.skippedQuestions,
    });

    if (decision.skippedQuestions.includes('system-type') && decision.inferredSystemType) {
      setSystemType(decision.inferredSystemType);
    }

    if (
      decision.skippedQuestions.includes('split-system-follow-up') &&
      decision.inferredIndoorPlatform
    ) {
      setIndoorPlatform(decision.inferredIndoorPlatform);
    }

    router.replace(decision.nextScreen);
  };

  return (
    <AppScreen
      footer={<PrimaryButton label={primaryLabel} onPress={handleConfirm} />}>
      <FlowHeader
        title="Confirm equipment"
        subtitle="Use the extracted tag details if they look right. You can override at any point."
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('equipment-confirmation', session))}
      />

      <SectionCard
        title="Extracted details"
        subtitle="Known values from the scan are shown below.">
        {decision.confidenceLevel === 'high' ? <RoutePill label="High-confidence detection" /> : null}
        {decision.confidenceLevel === 'medium' ? <RoutePill label="Needs confirmation" /> : null}
        {decision.confidenceLevel === 'low' ? <RoutePill label="Low-confidence scan" /> : null}
        <Text style={styles.line}>Brand: {session.brand ?? 'Unknown'}</Text>
        <Text style={styles.line}>Model: {session.modelNumber ?? 'Unknown'}</Text>
        <Text style={styles.line}>Serial: {session.serialNumber ?? 'Unknown'}</Text>
        <Text style={styles.line}>Detected unit type: {session.detectedUnitType ?? 'Unknown'}</Text>
        <Text style={styles.line}>
          Detected system type: {decision.inferredSystemType?.replaceAll('_', ' ') ?? 'Unknown'}
        </Text>
        <Text style={styles.line}>Confidence: {confidenceLabel}</Text>
        <Text style={styles.line}>Confidence level: {decision.confidenceLevel}</Text>
        <Text style={styles.line}>OCR provider: {session.ocrProvider ?? 'Unavailable'}</Text>
        <Text style={styles.line}>
          Provider path: {session.scanDebug.ocrProviderPath ?? 'Unknown'}
        </Text>
        <Text style={styles.line}>
          Provider status: {session.scanDebug.ocrProviderStatus ?? 'Unknown'}
        </Text>
        <Text style={styles.line}>Used fallback: {usedFallback ? 'yes' : 'no'}</Text>
      </SectionCard>

      {hasOcrFailure ? (
        <SectionCard
          title="OCR failed"
          subtitle="The scan path returned weak or fallback data. Manual model entry remains the safe path.">
          <Text style={styles.warningLine}>
            Reason: {session.scanDebug.errorMessage ?? session.scanDebug.failureReason ?? 'Unknown OCR failure.'}
          </Text>
          <Text style={styles.warningLine}>
            Backend status: {session.scanDebug.ocrProviderStatus ?? 'Unknown'}
          </Text>
          <Text style={styles.warningLine}>
            HTTP status: {session.scanDebug.httpStatus ?? 'Unknown'}
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Flow impact"
        subtitle="The app will skip questions only where the scan is strong enough and still let the tech override.">
        <Text style={styles.line}>
          {decision.confidenceLevel === 'high'
            ? 'Confidence is high, so broad equipment questions can be skipped where detection is strong.'
            : decision.confidenceLevel === 'medium'
              ? 'Confidence is medium, so extracted data will be shown for confirmation and prefilling.'
              : 'Confidence is low, so the next step falls back to manual model entry instead of forcing weak scan data.'}
        </Text>
        <Text style={styles.line}>
          {decision.skippedQuestions.includes('system-type')
            ? 'System type can be skipped after confirmation.'
            : 'System type will be shown for confirmation or correction.'}
        </Text>
        <Text style={styles.line}>
          {decision.skippedQuestions.includes('split-system-follow-up')
            ? 'Indoor platform can also be skipped.'
            : 'Indoor platform follow-up will stay visible if needed.'}
        </Text>
      </SectionCard>

      <View style={styles.buttonStack}>
        <SecondaryButton label={editLabel} onPress={() => router.replace('/manual-equipment')} />
        <SecondaryButton label="Rescan" onPress={() => router.replace('/scan-equipment')} />
      </View>

      <SectionCard
        title="OCR debug text"
        subtitle="Use the raw and normalized text below to verify whether the parser is working from real scan output.">
        <Text style={styles.debugText}>{session.ocrText || 'No OCR text returned from backend.'}</Text>
        <Text style={styles.debugLabel}>Normalized OCR text</Text>
        <Text style={styles.debugText}>
          {session.scanDebug.normalizedOcrText || 'No normalized OCR text available.'}
        </Text>
        <Text style={styles.debugLabel}>Backend URL</Text>
        <Text style={styles.debugText}>{session.scanDebug.backendUrl ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>HTTP status</Text>
        <Text style={styles.debugText}>{session.scanDebug.httpStatus ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>OpenAI returned error</Text>
        <Text style={styles.debugText}>{session.scanDebug.openAiError ? 'yes' : 'no'}</Text>
        <Text style={styles.debugLabel}>Error message</Text>
        <Text style={styles.debugText}>
          {session.scanDebug.errorMessage ?? 'No OCR error message recorded.'}
        </Text>
        <Text style={styles.debugLabel}>Raw backend response</Text>
        <Text style={styles.debugText}>
          {session.scanDebug.rawBackendResponse ?? 'No raw backend response recorded.'}
        </Text>
        <Text style={styles.debugLabel}>Brand candidates</Text>
        {(session.scanDebug.brandCandidates.length > 0
          ? session.scanDebug.brandCandidates
          : ['No brand candidates found.']
        ).map((item) => (
          <Text key={`confirm-brand-${item}`} style={styles.debugText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Model candidates</Text>
        {(session.scanDebug.modelCandidates.length > 0
          ? session.scanDebug.modelCandidates
          : ['No model candidates found.']
        ).map((item) => (
          <Text key={`confirm-model-${item}`} style={styles.debugText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Serial candidates</Text>
        {(session.scanDebug.serialCandidates.length > 0
          ? session.scanDebug.serialCandidates
          : ['No serial candidates found.']
        ).map((item) => (
          <Text key={`confirm-serial-${item}`} style={styles.debugText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Confidence reasoning</Text>
        {(session.scanDebug.confidenceSignals.length > 0
          ? session.scanDebug.confidenceSignals
          : ['No confidence signals recorded.']
        ).map((item) => (
          <Text key={`confirm-signal-${item}`} style={styles.debugText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Failure reason</Text>
        <Text style={styles.debugText}>
          {session.scanDebug.failureReason ?? 'No failure reason recorded.'}
        </Text>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  line: {
    color: servmorxTheme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  buttonStack: {
    gap: servmorxTheme.spacing.md,
  },
  warningLine: {
    color: servmorxTheme.colors.warning,
    fontSize: 14,
    lineHeight: 20,
  },
  debugText: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  debugLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: servmorxTheme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

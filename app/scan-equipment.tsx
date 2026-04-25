import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { servmorxTheme } from '@/constants/theme';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { processEquipmentScan } from '@/services/scan-service';
import { useSession } from '@/state/session-store';
import { getExtractionConfidenceLevel } from '@/features/equipment/flow/resolve-equipment-flow';

const TOTAL_STEPS = 4;

function deriveUsedFallback(provider: string | null, providerPath: string | null, providerStatus: string | null) {
  const debugText = `${provider ?? ''} ${providerPath ?? ''} ${providerStatus ?? ''}`.toLowerCase();

  return debugText.includes('fallback') || debugText.includes('mock');
}

export default function ScanEquipmentScreen() {
  const router = useRouter();
  const {
    session,
    setCurrentStep,
    setEquipmentSource,
    setCapture,
    applyExtraction,
    applyEnrichment,
  } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const usedFallback = deriveUsedFallback(
    session.ocrProvider,
    session.scanDebug.ocrProviderPath,
    session.scanDebug.ocrProviderStatus
  );
  const hasOcrFailure = Boolean(session.scanDebug.errorMessage || session.scanDebug.openAiError || usedFallback);

  useEffect(() => {
    setCurrentStep('scan-equipment');
  }, [setCurrentStep]);

  const runScanPipeline = async (mode: 'camera' | 'library') => {
    setError(null);
    setIsWorking(true);

    try {
      const scan = await processEquipmentScan(mode);

      if (!scan) {
        setIsWorking(false);
        return;
      }

      setEquipmentSource('scan');
      setCapture(scan.capture);
      applyExtraction(scan.extraction);
      applyEnrichment(scan.enrichment);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to process that scan.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AppScreen
      footer={
        <PrimaryButton
          label="Review Extraction"
          onPress={() => router.replace('/equipment-confirmation')}
          disabled={!session.capture || isWorking}
        />
      }>
      <FlowHeader
        title="Scan the equipment tag"
        subtitle="This path uses real camera or photo intake, then runs OCR extraction and equipment enrichment."
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('scan-equipment', session))}
      />

      <SectionCard
        title="Capture"
        subtitle="Use the camera on-site or pull a saved image from the device.">
        <View style={styles.buttonRow}>
          <SecondaryButton label={isWorking ? 'Working...' : 'Use Camera'} onPress={() => runScanPipeline('camera')} />
          <SecondaryButton
            label={isWorking ? 'Working...' : 'Choose Photo'}
            onPress={() => runScanPipeline('library')}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SectionCard>

      {hasOcrFailure ? (
        <SectionCard
          title="OCR failed"
          subtitle="The scan path stayed alive, but OCR did not produce a trustworthy result. Manual entry is still available.">
          <Text style={styles.errorLine}>
            Reason: {session.scanDebug.errorMessage ?? session.scanDebug.failureReason ?? 'Unknown OCR failure.'}
          </Text>
          <Text style={styles.errorLine}>
            Backend status: {session.scanDebug.ocrProviderStatus ?? 'Unknown'}
          </Text>
          <Text style={styles.errorLine}>Fallback used: {usedFallback ? 'yes' : 'no'}</Text>
          <SecondaryButton label="Use Manual Entry" onPress={() => router.replace('/manual-equipment')} />
        </SectionCard>
      ) : null}

      {session.capture ? (
        <SectionCard title="Captured image" subtitle="Stored in the current diagnostic session.">
          <Image source={{ uri: session.capture.uri }} style={styles.preview} contentFit="cover" />
        </SectionCard>
      ) : null}

      {session.brand || session.modelNumber ? (
        <SectionCard
          title="Extracted equipment"
          subtitle="OCR text is parsed into structured equipment fields, then enrichment runs separately.">
          <Text style={styles.dataLine}>Brand: {session.brand ?? 'Unknown'}</Text>
          <Text style={styles.dataLine}>Model: {session.modelNumber ?? 'Unknown'}</Text>
          <Text style={styles.dataLine}>Serial: {session.serialNumber ?? 'Unknown'}</Text>
          <Text style={styles.dataLine}>Unit type: {session.detectedUnitType ?? 'Unknown'}</Text>
          <Text style={styles.dataLine}>
            Confidence: {session.extractionConfidence ? `${Math.round(session.extractionConfidence * 100)}%` : 'Unknown'}
          </Text>
          <Text style={styles.dataLine}>
            Confidence level: {getExtractionConfidenceLevel(session.extractionConfidence)}
          </Text>
          <Text style={styles.dataLine}>OCR provider: {session.ocrProvider ?? 'Unavailable'}</Text>
          <Text style={styles.dataLine}>
            Provider path: {session.scanDebug.ocrProviderPath ?? 'Unknown'}
          </Text>
          <Text style={styles.dataLine}>
            Provider status: {session.scanDebug.ocrProviderStatus ?? 'Unknown'}
          </Text>
          <Text style={styles.dataLine}>Used fallback: {usedFallback ? 'yes' : 'no'}</Text>
          <Text style={styles.dataLine}>Warranty: {session.warrantyStatus.replaceAll('_', ' ')}</Text>
        </SectionCard>
      ) : null}

      {session.capture ? (
        <SectionCard title="OCR raw text" subtitle="Raw OCR output stored for review and future parsing improvements.">
          <Text style={styles.ocrText}>{session.ocrText || 'No OCR text returned from backend.'}</Text>
        </SectionCard>
      ) : null}

      {session.capture ? (
        <SectionCard
          title="OCR normalized text"
          subtitle="This is the parser input after OCR cleanup and normalization.">
          <Text style={styles.ocrText}>
            {session.scanDebug.normalizedOcrText || 'No normalized OCR text available.'}
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Parser debug"
        subtitle="Use this to see whether the failure is OCR, normalization, or parser logic.">
        <Text style={styles.debugLabel}>OCR provider</Text>
        <Text style={styles.ocrText}>{session.ocrProvider ?? 'Unavailable'}</Text>
        <Text style={styles.debugLabel}>Provider path</Text>
        <Text style={styles.ocrText}>{session.scanDebug.ocrProviderPath ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>Provider status</Text>
        <Text style={styles.ocrText}>{session.scanDebug.ocrProviderStatus ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>Backend URL</Text>
        <Text style={styles.ocrText}>{session.scanDebug.backendUrl ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>HTTP status</Text>
        <Text style={styles.ocrText}>{session.scanDebug.httpStatus ?? 'Unknown'}</Text>
        <Text style={styles.debugLabel}>Used fallback</Text>
        <Text style={styles.ocrText}>{usedFallback ? 'yes' : 'no'}</Text>
        <Text style={styles.debugLabel}>OpenAI returned error</Text>
        <Text style={styles.ocrText}>{session.scanDebug.openAiError ? 'yes' : 'no'}</Text>
        <Text style={styles.debugLabel}>Error message</Text>
        <Text style={styles.ocrText}>{session.scanDebug.errorMessage ?? 'No OCR error message recorded.'}</Text>
        <Text style={styles.debugLabel}>Raw backend response</Text>
        <Text style={styles.ocrText}>
          {session.scanDebug.rawBackendResponse ?? 'No raw backend response recorded.'}
        </Text>
        <Text style={styles.debugLabel}>Brand candidates</Text>
        {(session.scanDebug.brandCandidates.length > 0
          ? session.scanDebug.brandCandidates
          : ['No brand candidates found.']
        ).map((item) => (
          <Text key={`brand-${item}`} style={styles.ocrText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Model candidates</Text>
        {(session.scanDebug.modelCandidates.length > 0
          ? session.scanDebug.modelCandidates
          : ['No model candidates found.']
        ).map((item) => (
          <Text key={`model-${item}`} style={styles.ocrText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Serial candidates</Text>
        {(session.scanDebug.serialCandidates.length > 0
          ? session.scanDebug.serialCandidates
          : ['No serial candidates found.']
        ).map((item) => (
          <Text key={`serial-${item}`} style={styles.ocrText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Confidence reasoning</Text>
        {(session.scanDebug.confidenceSignals.length > 0
          ? session.scanDebug.confidenceSignals
          : ['No confidence signals recorded.']
        ).map((item) => (
          <Text key={`signal-${item}`} style={styles.ocrText}>
            - {item}
          </Text>
        ))}
        <Text style={styles.debugLabel}>Failure reason</Text>
        <Text style={styles.ocrText}>{session.scanDebug.failureReason ?? 'No failure reason recorded.'}</Text>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    gap: servmorxTheme.spacing.md,
  },
  error: {
    color: servmorxTheme.colors.warning,
    fontSize: 14,
  },
  errorLine: {
    color: servmorxTheme.colors.warning,
    fontSize: 14,
    lineHeight: 20,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: servmorxTheme.radius.md,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
  },
  dataLine: {
    color: servmorxTheme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  ocrText: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  debugLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: servmorxTheme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

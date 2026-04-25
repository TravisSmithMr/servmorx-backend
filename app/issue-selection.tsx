import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { DiagnosticSupportStack } from '@/components/diagnostic-support-stack';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { SelectionCard } from '@/components/selection-card';
import { servmorxTheme } from '@/constants/theme';
import { generateResults } from '@/core/result-engine';
import { resolveRoute } from '@/core/route-resolver';
import { issueOptions, systemTypeOptions } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';
import type { IssueId, RouteHistoryEntry } from '@/types/diagnostic';

const TOTAL_STEPS = 4;

function buildHistoryEntry(
  route: RouteHistoryEntry['route'],
  reasons: string[],
  confidence: number,
  stage: RouteHistoryEntry['stage']
): RouteHistoryEntry {
  return {
    route,
    stage,
    reasons,
    confidence,
    timestamp: new Date().toISOString(),
  };
}

export default function IssueSelectionScreen() {
  const router = useRouter();
  const {
    session,
    setCurrentStep,
    setIssue,
    setResolvedRoute,
    setResults,
    markCompleted,
  } = useSession();
  const [selectedIssue, setSelectedIssue] = useState<IssueId | null>(session.issue);

  useEffect(() => {
    if (!session.systemType) {
      router.replace('/system-type');
      return;
    }

    setCurrentStep('issue-selection');
  }, [router, session.systemType, setCurrentStep]);

  const handleContinue = () => {
    if (!selectedIssue) {
      return;
    }

    setIssue(selectedIssue);

    if (selectedIssue === 'no_cooling') {
      router.replace('/no-cooling-gates');
      return;
    }

    if (selectedIssue === 'no_airflow') {
      router.replace('/no-airflow-gates');
      return;
    }

    if (selectedIssue === 'weak_cooling') {
      router.replace('/weak-cooling-gates');
      return;
    }

    if (selectedIssue === 'icing_frozen_coil') {
      router.replace('/icing-gates');
      return;
    }

    if (selectedIssue === 'system_not_doing_anything') {
      router.replace('/system-idle-gates');
      return;
    }

    if (selectedIssue === 'outdoor_unit_not_running') {
      router.replace('/outdoor-unit-not-running-gates');
      return;
    }

    const previewSession = {
      ...session,
      issue: selectedIssue,
    };
    const resolution = resolveRoute(previewSession);

    setResolvedRoute(resolution.route, resolution.reasons, resolution.confidence);

    const result = generateResults({
      ...previewSession,
      currentRoute: resolution.route,
      routeHistory:
        resolution.route !== null
          ? [
              ...previewSession.routeHistory,
              buildHistoryEntry(
                resolution.route,
                resolution.reasons,
                resolution.confidence,
                resolution.stage
              ),
            ]
          : previewSession.routeHistory,
    });

    setResults(result);
    setCurrentStep('results');
    markCompleted();
    router.replace('/results');
  };

  const selectedSystemLabel =
    systemTypeOptions.find((option) => option.id === session.systemType)?.title ?? 'Unknown system';

  const selectedIndoorSide =
    session.indoorPlatform && session.indoorPlatform !== 'not_sure'
      ? session.indoorPlatform === 'air_handler'
        ? 'Air Handler'
        : 'Furnace'
      : session.indoorPlatform === 'not_sure'
        ? 'Indoor side not confirmed'
        : null;

  return (
    <AppScreen
      footer={<PrimaryButton label="Continue" onPress={handleContinue} disabled={!selectedIssue} />}
      supportPanel={<DiagnosticSupportStack />}>
      <FlowHeader
        title="What issue are you seeing?"
        subtitle="Choose the lane that matches the call. The deeper routing comes later."
        currentStep={4}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('issue-selection', session))}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Session setup</Text>
        <Text style={styles.summaryValue}>{selectedSystemLabel}</Text>
        {selectedIndoorSide ? <Text style={styles.summaryMeta}>{selectedIndoorSide}</Text> : null}
        {session.brand || session.modelNumber ? (
          <Text style={styles.summaryMeta}>
            {[session.brand, session.modelNumber].filter(Boolean).join(' | ')}
          </Text>
        ) : null}
      </View>

      <View style={styles.stack}>
        {issueOptions.map((issue) => (
          <SelectionCard
            key={issue.id}
            title={issue.title}
            description={issue.subtitle}
            icon={issue.icon}
            selected={selectedIssue === issue.id}
            onPress={() => setSelectedIssue(issue.id)}
            layout="row"
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: servmorxTheme.colors.surface,
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    padding: servmorxTheme.spacing.md,
    gap: 4,
  },
  summaryLabel: {
    color: servmorxTheme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    color: servmorxTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMeta: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 15,
  },
  stack: {
    gap: servmorxTheme.spacing.md,
  },
});

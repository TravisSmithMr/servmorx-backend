import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { DiagnosticSupportStack } from '@/components/diagnostic-support-stack';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressiveQuestionFlow } from '@/components/progressive-question-flow';
import { RoutePill } from '@/components/route-pill';
import { SectionCard } from '@/components/section-card';
import { servmorxTheme } from '@/constants/theme';
import { generateResults } from '@/core/result-engine';
import { resolveRoute } from '@/core/route-resolver';
import { noCoolingGateQuestions, routeLabels } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';
import type { RouteHistoryEntry } from '@/types/diagnostic';

const TOTAL_STEPS = 5;

function buildHistoryEntry(
  route: RouteHistoryEntry['route'],
  reasons: string[],
  confidence: number,
  stage: RouteHistoryEntry['stage'] = 'primary'
): RouteHistoryEntry {
  return {
    route,
    stage,
    reasons,
    confidence,
    timestamp: new Date().toISOString(),
  };
}

export default function NoCoolingGatesScreen() {
  const router = useRouter();
  const {
    session,
    setCurrentStep,
    setGateAnswer,
    setResolvedRoute,
    setResults,
    markCompleted,
  } = useSession();

  useEffect(() => {
    if (session.issue !== 'no_cooling') {
      router.replace('/issue-selection');
      return;
    }

    setCurrentStep('gate-questions');
  }, [router, session.issue, setCurrentStep]);

  const isComplete = noCoolingGateQuestions.every((question) => {
    return session.gateAnswers[question.key as keyof typeof session.gateAnswers] !== undefined;
  });

  const previewResolution = resolveRoute(session);

  const handleContinue = () => {
    const resolution = resolveRoute(session);

    if (!resolution.route) {
      return;
    }

    setResolvedRoute(resolution.route, resolution.reasons, resolution.confidence);

    if (resolution.shouldAskFocusedDiagnostic) {
      if (resolution.route === 'outdoor_unit_diag') {
        router.replace('/outdoor-unit-diagnostic');
        return;
      }

      if (resolution.route === 'indoor_unit_diag') {
        router.replace('/indoor-unit-diagnostic');
        return;
      }
    }

    const result = generateResults({
      ...session,
      currentRoute: resolution.route,
      routeHistory: [
        ...session.routeHistory,
        buildHistoryEntry(resolution.route, resolution.reasons, resolution.confidence, resolution.stage),
      ],
    });

    setResults(result);
    setCurrentStep('results');
    markCompleted();
    router.replace('/results');
  };

  return (
    <AppScreen
      footer={<PrimaryButton label="Continue" onPress={handleContinue} disabled={!isComplete} />}
      supportPanel={<DiagnosticSupportStack />}>
      <FlowHeader
        title="No Cooling gate checks"
        subtitle="Only capture enough to place the first subsystem route."
        currentStep={5}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('gate-questions', session))}
      />

      <SectionCard
        title="Current route bias"
        subtitle="This updates as the gate answers come in."
        rightSlot={previewResolution.route ? <RoutePill label={routeLabels[previewResolution.route]} /> : null}>
        {previewResolution.reasons.map((reason) => (
          <Text key={reason} style={styles.reasonText}>
            {reason}
          </Text>
        ))}
      </SectionCard>

      <ProgressiveQuestionFlow
        questions={noCoolingGateQuestions.map((question) => ({
          ...question,
          key: question.key,
          options: question.options,
        }))}
        values={session.gateAnswers as Record<string, string | undefined>}
        onChange={(key, value) => setGateAnswer(key as keyof typeof session.gateAnswers, value as never)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  reasonText: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});

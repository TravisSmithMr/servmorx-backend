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
import { indoorUnitQuestions, routeLabels } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';
import type { RouteHistoryEntry } from '@/types/diagnostic';

const TOTAL_STEPS = 5;

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

export default function IndoorUnitDiagnosticScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setDiagAnswer, setResolvedRoute, setResults, markCompleted } =
    useSession();

  useEffect(() => {
    if (session.currentRoute !== 'indoor_unit_diag') {
      router.replace('/issue-selection');
      return;
    }

    setCurrentStep('focused-diagnostic');
  }, [router, session.currentRoute, setCurrentStep]);

  useEffect(() => {
    if (!session.diagAnswers.boardFaultLights && session.gateAnswers.boardFaultLights) {
      setDiagAnswer('boardFaultLights', session.gateAnswers.boardFaultLights);
    }
  }, [session.diagAnswers.boardFaultLights, session.gateAnswers.boardFaultLights, setDiagAnswer]);

  const blowerType = session.gateAnswers.blowerType ?? 'not_sure';

  const visibleQuestions = indoorUnitQuestions.filter((question) => {
    if (question.key === 'capacitorCondition') {
      return blowerType === 'psc';
    }

    if (question.key === 'ecmModuleClues') {
      return blowerType === 'ecm';
    }

    return true;
  });

  const isComplete = visibleQuestions.every((question) => {
    return session.diagAnswers[question.key as keyof typeof session.diagAnswers] !== undefined;
  });

  const handleContinue = () => {
    const resolution = resolveRoute(session);

    if (
      resolution.route &&
      resolution.stage === 'secondary' &&
      resolution.route !== session.currentRoute &&
      resolution.shouldAskFocusedDiagnostic
    ) {
      setResolvedRoute(
        resolution.route,
        resolution.reasons,
        resolution.confidence,
        resolution.stage
      );
      setCurrentStep('focused-diagnostic');
      router.replace('/secondary-diagnostic' as never);
      return;
    }

    const result = generateResults(
      resolution.route && resolution.route !== session.currentRoute
        ? {
            ...session,
            currentRoute: resolution.route,
            routeHistory: [
              ...session.routeHistory,
              buildHistoryEntry(
                resolution.route,
                resolution.reasons,
                resolution.confidence,
                resolution.stage
              ),
            ],
          }
        : session
    );
    setResults(result);
    setCurrentStep('results');
    markCompleted();
    router.replace('/results');
  };

  return (
    <AppScreen
      footer={<PrimaryButton label="Build Results" onPress={handleContinue} disabled={!isComplete} />}
      supportPanel={<DiagnosticSupportStack />}>
      <FlowHeader
        title="Indoor unit diagnostics"
        subtitle="Now stay tight on the blower-side checks that matter."
        currentStep={5}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('indoor-unit-diagnostic', session))}
      />

      <SectionCard
        title="Focused branch"
        subtitle={`Blower type from gates: ${blowerType.toUpperCase()}`}
        rightSlot={<RoutePill label={routeLabels.indoor_unit_diag} />}>
        <Text style={styles.helper}>
          This screen only asks the indoor-side checks needed for a first ranked result.
        </Text>
      </SectionCard>

      <ProgressiveQuestionFlow
        questions={visibleQuestions.map((question) => ({
          ...question,
          key: question.key,
          options: question.options,
        }))}
        values={session.diagAnswers as Record<string, string | undefined>}
        onChange={(key, value) => setDiagAnswer(key as keyof typeof session.diagAnswers, value as never)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});

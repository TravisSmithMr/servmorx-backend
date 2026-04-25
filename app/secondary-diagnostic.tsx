import { useEffect, useMemo } from 'react';
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
import { getSecondaryRouteConfig } from '@/features/diagnostic/secondary-config';
import { routeLabels } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

const TOTAL_STEPS = 5;

export default function SecondaryDiagnosticScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setDiagAnswer, setResults, markCompleted } = useSession();
  const config = useMemo(() => getSecondaryRouteConfig(session, session.currentRoute), [session]);

  useEffect(() => {
    if (!config) {
      router.replace('/issue-selection');
      return;
    }

    setCurrentStep('focused-diagnostic');
  }, [config, router, setCurrentStep]);

  if (!config) {
    return null;
  }

  const isComplete = config.questions.every((question) => {
    return session.diagAnswers[question.key as keyof typeof session.diagAnswers] !== undefined;
  });

  const handleContinue = () => {
    const result = generateResults(session);
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
        title={config.title}
        subtitle={config.subtitle}
        currentStep={5}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('secondary-diagnostic', session))}
      />

      <SectionCard
        title="Narrowed branch"
        subtitle={config.helper}
        rightSlot={<RoutePill label={routeLabels[config.route] ?? config.route} />}>
        <Text style={styles.helper}>
          The structured engine has narrowed past the primary route. Confirm these answers before ranking causes.
        </Text>
      </SectionCard>

      <ProgressiveQuestionFlow
        questions={config.questions.map((question) => ({
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

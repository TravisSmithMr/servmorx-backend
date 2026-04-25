import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { DiagnosticSupportStack } from '@/components/diagnostic-support-stack';
import { PrimaryButton } from '@/components/primary-button';
import { RoutePill } from '@/components/route-pill';
import { SectionCard } from '@/components/section-card';
import { servmorxTheme } from '@/constants/theme';
import { generateResults } from '@/core/result-engine';
import { routeLabels } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

export default function ResultsScreen() {
  const router = useRouter();
  const { session } = useSession();

  const result = session.results ?? (session.currentRoute ? generateResults(session) : null);

  if (!result) {
    return (
      <AppScreen footer={<PrimaryButton label="Back Home" onPress={() => router.replace('/')} />}>
        <FlowHeader
          title="Results"
          subtitle="This session still needs a structured route before results can render."
          currentStep={5}
          totalSteps={5}
          onBack={() => router.replace(getBackRoute('results', session))}
        />
        <SectionCard
          title="No structured result yet"
          subtitle="This session needs a route before results can render."
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      footer={<PrimaryButton label="Back Home" onPress={() => router.replace('/')} />}
      supportPanel={<DiagnosticSupportStack />}>
      <FlowHeader
        title="Results"
        subtitle="Structured first-pass findings based on the current route and answers."
        currentStep={5}
        totalSteps={5}
        onBack={() => router.replace(getBackRoute('results', session))}
      />
      <SectionCard
        title="First-pass result"
        subtitle={result.summary}
        rightSlot={<RoutePill label={routeLabels[result.route] ?? result.route} />}>
        {result.primaryRoute ? (
          <Text style={styles.summaryLabel}>
            Primary route: {routeLabels[result.primaryRoute] ?? result.primaryRoute}
          </Text>
        ) : null}
        {result.secondaryRoute ? (
          <Text style={styles.summaryLabel}>
            Secondary route: {routeLabels[result.secondaryRoute] ?? result.secondaryRoute}
          </Text>
        ) : null}
        <Text style={styles.summaryLabel}>
          {[session.issue, session.systemType].filter(Boolean).join(' | ').replaceAll('_', ' ')}
        </Text>
        <Text style={styles.summaryLabel}>Confidence: {result.confidenceLevel}</Text>
        {result.routeSwapReason ? (
          <Text style={styles.summaryReason}>Secondary swap: {result.routeSwapReason}</Text>
        ) : null}
        {result.routeReasons.length > 0 ? (
          <View style={styles.reasonsBlock}>
            {result.routeReasons.map((reason) => (
              <Text key={reason} style={styles.summaryReason}>
                - {reason}
              </Text>
            ))}
          </View>
        ) : null}
        {session.brand || session.modelNumber ? (
          <Text style={styles.summaryLabel}>
            {[session.brand, session.modelNumber].filter(Boolean).join(' | ')}
          </Text>
        ) : null}
      </SectionCard>

      <View style={styles.stack}>
        {result.likelyCauses.map((cause, index) => (
          <SectionCard key={cause.title} title={`${index + 1}. ${cause.title}`} subtitle={cause.why}>
            <Text style={styles.checkLabel}>Confirming check</Text>
            <Text style={styles.checkText}>{cause.nextCheck}</Text>
          </SectionCard>
        ))}
      </View>

      <SectionCard title="Next checks" subtitle="Use these to confirm or eliminate the top causes.">
        {result.nextChecks.map((check) => (
          <Text key={check} style={styles.listItem}>
            - {check}
          </Text>
        ))}
      </SectionCard>

      {result.contradictions && result.contradictions.length > 0 ? (
        <SectionCard title="Contradictions" subtitle="These answers do not fit cleanly together yet.">
          {result.contradictions.map((item) => (
            <Text key={item} style={styles.listItem}>
              - {item}
            </Text>
          ))}
        </SectionCard>
      ) : null}

      {result.missingInfo && result.missingInfo.length > 0 ? (
        <SectionCard title="Still Missing" subtitle="These checks would tighten the ranking further.">
          {result.missingInfo.map((item) => (
            <Text key={item} style={styles.listItem}>
              - {item}
            </Text>
          ))}
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: servmorxTheme.spacing.md,
  },
  summaryLabel: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonsBlock: {
    gap: 6,
  },
  summaryReason: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  checkLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  checkText: {
    color: servmorxTheme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  listItem: {
    color: servmorxTheme.colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});

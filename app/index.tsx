import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { PrimaryButton } from '@/components/primary-button';
import { RoutePill } from '@/components/route-pill';
import { SectionCard } from '@/components/section-card';
import { SecondaryButton } from '@/components/secondary-button';
import { ServmorxLogo } from '@/components/servmorx-logo';
import { StartDiagnosisCard } from '@/components/start-diagnosis-card';
import { servmorxTheme } from '@/constants/theme';
import { getResumeRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

export default function HomeScreen() {
  const router = useRouter();
  const { session, startNewSession } = useSession();

  const handleStart = () => {
    startNewSession();
    router.replace('/equipment-intake');
  };

  const handleResume = () => {
    router.replace(getResumeRoute(session));
  };

  const hasSessionProgress = Boolean(
    session.status !== 'draft' || session.systemType || session.issue || session.modelNumber
  );

  const systemLabel = session.systemType
    ? session.systemType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not selected yet';

  const issueLabel = session.issue
    ? session.issue.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Issue not selected';

  return (
    <AppScreen>
      <View style={styles.header}>
        <ServmorxLogo />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Let&apos;s get this diagnosed.</Text>
        <Text style={styles.heroSubtitle}>Start a new job or jump back into a recent session.</Text>
      </View>

      <StartDiagnosisCard onPress={handleStart} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Current Session</Text>
      </View>

      {hasSessionProgress ? (
        <SectionCard
          title={session.status === 'completed' ? 'Latest completed diagnosis' : 'Draft in progress'}
          subtitle={`Updated ${new Date(session.updatedAt).toLocaleString()}`}>
          <View style={styles.summaryStack}>
            {session.currentRoute ? <RoutePill label={session.currentRoute.replaceAll('_', ' ')} /> : null}
            <Text style={styles.summaryValue}>{issueLabel}</Text>
            <Text style={styles.summaryMeta}>{systemLabel}</Text>
            {session.brand || session.modelNumber ? (
              <Text style={styles.summaryMeta}>
                {[session.brand, session.modelNumber].filter(Boolean).join(' | ')}
              </Text>
            ) : null}
          </View>
          <PrimaryButton
            label={session.status === 'completed' ? 'Open Results' : 'Resume Session'}
            onPress={handleResume}
          />
        </SectionCard>
      ) : (
        <SectionCard
          title="No active session yet"
          subtitle="Once a technician starts intake, the current diagnostic session will live here.">
          <SecondaryButton label="Start New Diagnosis" onPress={handleStart} />
        </SectionCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: servmorxTheme.spacing.sm,
  },
  hero: {
    gap: servmorxTheme.spacing.sm,
  },
  heroTitle: {
    color: servmorxTheme.colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: servmorxTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  summaryStack: {
    gap: servmorxTheme.spacing.md,
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
});

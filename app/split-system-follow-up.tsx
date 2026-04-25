import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { SelectionCard } from '@/components/selection-card';
import { servmorxTheme } from '@/constants/theme';
import { splitSystemOptions } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';
import type { IndoorPlatformId } from '@/types/diagnostic';

const TOTAL_STEPS = 4;

export default function SplitSystemFollowUpScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setIndoorPlatform } = useSession();
  const [selectedOption, setSelectedOption] = useState<IndoorPlatformId | null>(
    session.indoorPlatform ?? session.inferredValues.indoorPlatform
  );

  useEffect(() => {
    if (session.systemType !== 'split_system_ac') {
      router.replace('/system-type');
      return;
    }

    setCurrentStep('split-system-follow-up');
  }, [router, session.systemType, setCurrentStep]);

  const handleContinue = () => {
    if (!selectedOption) {
      return;
    }

    setIndoorPlatform(selectedOption);
    router.replace('/issue-selection');
  };

  return (
    <AppScreen
      footer={
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selectedOption} />
      }>
      <FlowHeader
        title="What is the indoor side of this split system?"
        subtitle={
          session.inferredValues.indoorPlatform
            ? 'We prefilled this from the detected unit type. Change it if needed.'
            : 'This helps routing later, but you can keep moving if you are not sure.'
        }
        currentStep={3}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('split-system-follow-up', session))}
      />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>Selected system: Split System AC</Text>
      </View>

      <View style={styles.stack}>
        {splitSystemOptions.map((option) => (
          <SelectionCard
            key={option.id}
            title={option.title}
            description={option.description}
            icon={option.icon}
            selected={selectedOption === option.id}
            onPress={() => setSelectedOption(option.id)}
            layout="row"
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: servmorxTheme.radius.pill,
    backgroundColor: servmorxTheme.colors.accentSoft,
  },
  badgeText: {
    color: servmorxTheme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  stack: {
    gap: servmorxTheme.spacing.md,
  },
});

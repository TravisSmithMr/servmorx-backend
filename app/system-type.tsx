import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { SelectionCard } from '@/components/selection-card';
import { servmorxTheme } from '@/constants/theme';
import { systemTypeOptions } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';
import type { SystemTypeId } from '@/types/diagnostic';

const TOTAL_STEPS = 4;

export default function SystemTypeScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setSystemType } = useSession();
  const [selectedSystemType, setSelectedSystemType] = useState<SystemTypeId | null>(
    session.systemType ?? session.inferredValues.systemType ?? session.detectedSystemType
  );

  useEffect(() => {
    if (!session.equipmentSource) {
      router.replace('/equipment-intake');
      return;
    }

    setCurrentStep('system-type');
  }, [router, session.equipmentSource, setCurrentStep]);

  const handleContinue = () => {
    if (!selectedSystemType) {
      return;
    }

    const option = systemTypeOptions.find((item) => item.id === selectedSystemType);

    setSystemType(selectedSystemType);

    if (option?.requiresSplitFollowUp) {
      router.replace('/split-system-follow-up');
      return;
    }

    router.replace('/issue-selection');
  };

  return (
    <AppScreen
      footer={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selectedSystemType}
        />
      }>
      <FlowHeader
        title="What system are you working on?"
        subtitle={
          session.inferredValues.systemType
            ? 'We prefilled this from equipment context. Adjust it if needed.'
            : 'Pick the closest match.'
        }
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('system-type', session))}
      />

      <View style={styles.grid}>
        {systemTypeOptions.map((option) => (
          <SelectionCard
            key={option.id}
            title={option.title}
            description={option.description}
            icon={option.icon}
            accentColor={option.accentColor}
            selected={selectedSystemType === option.id}
            onPress={() => setSelectedSystemType(option.id)}
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: servmorxTheme.spacing.md,
  },
});

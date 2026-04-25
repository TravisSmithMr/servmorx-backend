import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { PrimaryButton } from '@/components/primary-button';
import { SelectionCard } from '@/components/selection-card';
import { servmorxTheme } from '@/constants/theme';
import { intakeMethodOptions } from '@/features/diagnostic/config';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

const TOTAL_STEPS = 4;

export default function EquipmentIntakeScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setEquipmentSource } = useSession();
  const [selectedMethod, setSelectedMethod] = useState<'scan' | 'manual_model' | 'manual_selection' | null>(
    session.equipmentSource === 'scan' ? 'scan' : session.modelNumber || session.brand ? 'manual_model' : null
  );

  useEffect(() => {
    setCurrentStep('equipment-intake');
  }, [setCurrentStep]);

  const handleContinue = () => {
    if (!selectedMethod) {
      return;
    }

    if (selectedMethod === 'scan') {
      setEquipmentSource('scan');
      router.replace('/scan-equipment');
      return;
    }

    setEquipmentSource('manual');

    if (selectedMethod === 'manual_model') {
      router.replace('/manual-equipment');
      return;
    }

    router.replace('/system-type');
  };

  return (
    <AppScreen
      footer={
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selectedMethod} />
      }>
      <FlowHeader
        title="How would you like to identify your equipment?"
        subtitle="Choose the best option."
        currentStep={1}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('equipment-intake', session))}
      />

      <View style={styles.stack}>
        {intakeMethodOptions.map((option) => (
          <SelectionCard
            key={option.id ?? option.title}
            title={option.title}
            description={option.description}
            icon={option.icon}
            accentColor={option.accentColor}
            selected={selectedMethod === option.id}
            onPress={() => setSelectedMethod(option.id)}
            layout="row"
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: servmorxTheme.spacing.md,
  },
});

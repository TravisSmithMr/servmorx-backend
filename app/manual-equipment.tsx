import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FlowHeader } from '@/components/flow-header';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { SectionCard } from '@/components/section-card';
import { servmorxTheme } from '@/constants/theme';
import { getBackRoute } from '@/features/navigation/diagnostic-navigation';
import { useSession } from '@/state/session-store';

const TOTAL_STEPS = 4;

export default function ManualEquipmentScreen() {
  const router = useRouter();
  const { session, setCurrentStep, setEquipmentSource, updateManualEquipment } = useSession();
  const [brand, setBrand] = useState(session.brand ?? '');
  const [modelNumber, setModelNumber] = useState(session.modelNumber ?? '');
  const [serialNumber, setSerialNumber] = useState(session.serialNumber ?? '');

  useEffect(() => {
    setCurrentStep('manual-equipment');
  }, [setCurrentStep]);

  const handleContinue = () => {
    setEquipmentSource('manual');
    updateManualEquipment({
      brand: brand.trim() || null,
      modelNumber: modelNumber.trim() || null,
      serialNumber: serialNumber.trim() || null,
    });
    router.replace('/system-type');
  };

  return (
    <AppScreen footer={<PrimaryButton label="Continue" onPress={handleContinue} />}>
      <FlowHeader
        title="Enter model details"
        subtitle="Use whatever you have. Partial entry is fine for the first pass."
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        onBack={() => router.replace(getBackRoute('manual-equipment', session))}
      />

      <SectionCard
        title="Manual equipment entry"
        subtitle="This stores real equipment context in the diagnostic session.">
        <FormField label="Brand" value={brand} placeholder="Carrier" onChangeText={setBrand} />
        <FormField
          label="Model Number"
          value={modelNumber}
          placeholder="24ACC636A003"
          onChangeText={setModelNumber}
        />
        <FormField
          label="Serial Number"
          value={serialNumber}
          placeholder="2312E12345"
          onChangeText={setSerialNumber}
        />
      </SectionCard>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          You can continue even if only one of these is known. Routing should never block field flow.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    paddingHorizontal: servmorxTheme.spacing.xs,
  },
  noteText: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

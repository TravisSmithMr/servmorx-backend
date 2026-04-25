import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';
import { calculateSystemAnalytics } from '@/features/analytics/calculate-system-analytics';
import { analyzeSystemViaBackend, type AnalyticsProviderResult } from '@/services/analytics-service';
import { useSession } from '@/state/session-store';
import type { MeasurementKey } from '@/types/diagnostic';

import { SectionCard } from '@/components/section-card';

type MeasurementDefinition = {
  key: MeasurementKey;
  label: string;
  placeholder: string;
  unit: string;
};

const measurementDefinitions: MeasurementDefinition[] = [
  { key: 'suctionPressure', label: 'Suction', placeholder: '118', unit: 'psig' },
  { key: 'liquidPressure', label: 'Liquid', placeholder: '325', unit: 'psig' },
  { key: 'suctionLineTemp', label: 'Suction line', placeholder: '54', unit: 'F' },
  { key: 'liquidLineTemp', label: 'Liquid line', placeholder: '92', unit: 'F' },
  { key: 'outdoorAmbientTemp', label: 'Outdoor ambient', placeholder: '95', unit: 'F' },
  { key: 'indoorReturnTemp', label: 'Indoor return', placeholder: '76', unit: 'F' },
  { key: 'indoorSupplyTemp', label: 'Indoor supply', placeholder: '58', unit: 'F' },
  { key: 'superheat', label: 'Superheat', placeholder: '14', unit: 'F' },
  { key: 'subcool', label: 'Subcool', placeholder: '10', unit: 'F' },
];

function parseNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusStyle(status: 'normal' | 'low' | 'high' | 'mixed' | 'insufficient') {
  if (status === 'normal') {
    return styles.signalNormal;
  }

  if (status === 'insufficient') {
    return styles.signalInsufficient;
  }

  return styles.signalAlert;
}

interface SystemAnalyticsCardProps {
  embedded?: boolean;
}

function SystemAnalyticsCardBody() {
  const { session, setMeasurement } = useSession();
  const localAnalytics = useMemo(() => calculateSystemAnalytics(session), [session]);
  const [providerResult, setProviderResult] = useState<AnalyticsProviderResult>(() => ({
    provider: 'local_analytics_engine',
    providerPath: 'fallback_provider',
    providerStatus: 'Local analytics shown while backend analysis loads.',
    usedFallback: true,
    analytics: localAnalytics,
  }));
  const analyticsRequestKey = useMemo(
    () =>
      JSON.stringify({
        issue: session.issue,
        route: session.currentRoute,
        equipment: {
          brand: session.brand,
          modelNumber: session.modelNumber,
          serialNumber: session.serialNumber,
          systemType: session.systemType,
          indoorPlatform: session.indoorPlatform,
        },
        measurements: session.measurements,
      }),
    [
      session.brand,
      session.currentRoute,
      session.indoorPlatform,
      session.issue,
      session.measurements,
      session.modelNumber,
      session.serialNumber,
      session.systemType,
    ]
  );
  const analytics = providerResult.analytics;

  useEffect(() => {
    let active = true;

    analyzeSystemViaBackend(session).then((nextResult) => {
      if (active) {
        setProviderResult(nextResult);
      }
    });

    return () => {
      active = false;
    };
  }, [analyticsRequestKey, session]);

  return (
    <>
      <View style={styles.debugBlock}>
        <Text style={styles.debugText}>Analytics provider: {providerResult.provider}</Text>
        <Text style={styles.debugText}>Provider path: {providerResult.providerPath ?? 'unknown'}</Text>
        <Text style={styles.debugText}>Provider status: {providerResult.providerStatus}</Text>
        <Text style={styles.debugText}>Used fallback: {providerResult.usedFallback ? 'yes' : 'no'}</Text>
        <Text style={styles.debugText}>
          Analytics output: Delta T {analytics.deltaT ?? 'n/a'}F | Superheat{' '}
          {analytics.calculatedSuperheat ?? 'n/a'}F | Subcool {analytics.calculatedSubcool ?? 'n/a'}F
        </Text>
        <Text style={styles.debugText}>
          Analytics interpretation: {analytics.interpretation[0] ?? 'No interpretation yet.'}
        </Text>
      </View>

      {(analytics.refrigerant || analytics.saturatedSuctionTemp !== null || analytics.saturatedLiquidTemp !== null) ? (
        <View style={styles.computedBlock}>
          {analytics.refrigerant ? (
            <Text style={styles.computedText}>Refrigerant context: {analytics.refrigerant}</Text>
          ) : null}
          {analytics.saturatedSuctionTemp !== null ? (
            <Text style={styles.computedText}>
              Saturated suction temp: {analytics.saturatedSuctionTemp} F
            </Text>
          ) : null}
          {analytics.saturatedLiquidTemp !== null ? (
            <Text style={styles.computedText}>
              Saturated liquid temp: {analytics.saturatedLiquidTemp} F
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.grid}>
        {measurementDefinitions.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.fieldLabel}>
              {field.label} <Text style={styles.unitLabel}>{field.unit}</Text>
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={session.measurements[field.key]?.toString() ?? ''}
              onChangeText={(value) => setMeasurement(field.key, parseNumber(value))}
              placeholder={field.placeholder}
              placeholderTextColor={servmorxTheme.colors.textDim}
              style={styles.input}
            />
          </View>
        ))}
      </View>

      {analytics.signals.length > 0 ? (
        <View style={styles.signalWrap}>
          {analytics.signals.map((signal) => (
            <View key={signal.id} style={[styles.signalChip, statusStyle(signal.status)]}>
              <Text style={styles.signalTitle}>{signal.label}</Text>
              <Text style={styles.signalValue}>{signal.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {analytics.interpretation.length > 0 ? (
        <View style={styles.listBlock}>
          {analytics.interpretation.slice(0, 3).map((line) => (
            <Text key={line} style={styles.listItem}>
              - {line}
            </Text>
          ))}
        </View>
      ) : null}

      {analytics.missingData.length > 0 ? (
        <View style={styles.missingBlock}>
          <Text style={styles.missingTitle}>Useful next measurements</Text>
          {analytics.missingData.slice(0, 3).map((line) => (
            <Text key={line} style={styles.listItem}>
              - {line}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function SystemAnalyticsCard({ embedded = false }: SystemAnalyticsCardProps) {
  if (embedded) {
    return <SystemAnalyticsCardBody />;
  }

  return (
    <SectionCard
      title="System analytics"
      subtitle="Add measurements when available. The copilot uses these, but they never block the flow.">
      <SystemAnalyticsCardBody />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: servmorxTheme.spacing.md,
  },
  field: {
    width: '47%',
    gap: 6,
  },
  fieldLabel: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  unitLabel: {
    color: servmorxTheme.colors.textDim,
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: servmorxTheme.radius.sm,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    paddingHorizontal: servmorxTheme.spacing.md,
    color: servmorxTheme.colors.text,
    fontSize: 16,
  },
  signalWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: servmorxTheme.spacing.sm,
  },
  computedBlock: {
    gap: 4,
  },
  computedText: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  signalChip: {
    minWidth: '47%',
    borderRadius: servmorxTheme.radius.sm,
    paddingHorizontal: servmorxTheme.spacing.sm,
    paddingVertical: servmorxTheme.spacing.sm,
    gap: 2,
    borderWidth: 1,
  },
  signalNormal: {
    borderColor: 'rgba(27, 201, 142, 0.3)',
    backgroundColor: 'rgba(27, 201, 142, 0.12)',
  },
  signalAlert: {
    borderColor: 'rgba(243, 166, 75, 0.3)',
    backgroundColor: 'rgba(243, 166, 75, 0.12)',
  },
  signalInsufficient: {
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
  },
  signalTitle: {
    color: servmorxTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  signalValue: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
  },
  listBlock: {
    gap: 6,
  },
  missingBlock: {
    gap: 6,
  },
  missingTitle: {
    color: servmorxTheme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listItem: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  debugBlock: {
    borderRadius: servmorxTheme.radius.sm,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    padding: servmorxTheme.spacing.sm,
    gap: 4,
  },
  debugText: {
    color: servmorxTheme.colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
});

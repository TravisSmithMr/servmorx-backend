import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';
import { buildDiagnosticContext } from '@/features/copilot/build-diagnostic-context';
import { useSession } from '@/state/session-store';

import { DiagnosticCopilotPanel } from '@/components/diagnostic-copilot-panel';
import { SectionCard } from '@/components/section-card';
import { SystemAnalyticsCard } from '@/components/system-analytics-card';

export function DiagnosticCopilotDock() {
  const { session, refreshCopilot, setCopilotPanel } = useSession();
  const contextHash = useMemo(() => buildDiagnosticContext(session).hash, [session]);

  useEffect(() => {
    if (session.copilot.lastContextHash !== contextHash) {
      void refreshCopilot();
    }
  }, [contextHash, refreshCopilot, session.copilot.lastContextHash]);

  const summaryLine =
    session.copilot.activeInsight?.direction ??
    'The copilot will summarize the diagnostic path as soon as the structured flow has enough context.';

  return (
    <SectionCard
      title="Diagnostic copilot"
      subtitle="Persistent support panel. The structured backbone still drives the route and results.">
      <Pressable
        onPress={() => setCopilotPanel({ isExpanded: !session.copilot.isExpanded })}
        style={({ pressed }) => [styles.headerButton, pressed ? styles.headerPressed : null]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerLabel}>{session.copilot.isExpanded ? 'Hide panel' : 'Open panel'}</Text>
          <Text numberOfLines={2} style={styles.headerSummary}>
            {summaryLine}
          </Text>
        </View>
        <Text style={styles.chevron}>{session.copilot.isExpanded ? 'v' : '^'}</Text>
      </Pressable>

      {session.copilot.isExpanded ? (
        <View style={styles.expanded}>
          <View style={styles.tabRow}>
            {(['copilot', 'analytics'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setCopilotPanel({ activeTab: tab })}
                style={({ pressed }) => [
                  styles.tabButton,
                  session.copilot.activeTab === tab ? styles.tabButtonActive : null,
                  pressed ? styles.headerPressed : null,
                ]}>
                <Text
                  style={[
                    styles.tabLabel,
                    session.copilot.activeTab === tab ? styles.tabLabelActive : null,
                  ]}>
                  {tab === 'copilot' ? 'Copilot' : 'Analytics'}
                </Text>
              </Pressable>
            ))}
          </View>

          {session.copilot.activeTab === 'copilot' ? (
            <DiagnosticCopilotPanel embedded />
          ) : (
            <SystemAnalyticsCard embedded />
          )}
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    padding: servmorxTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: servmorxTheme.spacing.md,
  },
  headerPressed: {
    opacity: 0.88,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerSummary: {
    color: servmorxTheme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  expanded: {
    gap: servmorxTheme.spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: servmorxTheme.spacing.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: servmorxTheme.radius.pill,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: servmorxTheme.colors.accentSoft,
    borderColor: 'rgba(18, 215, 192, 0.2)',
  },
  tabLabel: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: servmorxTheme.colors.accent,
  },
});

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';
import { buildCopilotContext } from '@/features/copilot/build-copilot-context';
import { useSession } from '@/state/session-store';

import { SectionCard } from '@/components/section-card';

function humanizePrompt(prompt: string) {
  return prompt.trim();
}

interface DiagnosticCopilotPanelProps {
  embedded?: boolean;
}

function DiagnosticCopilotPanelBody() {
  const { session, sendCopilotMessage } = useSession();
  const [draft, setDraft] = useState('');
  const copilotContext = useMemo(() => buildCopilotContext(session), [session]);

  const visibleMessages = useMemo(() => session.copilot.messages.slice(-4), [session.copilot.messages]);

  const handleSend = (message?: string) => {
    const text = (message ?? draft).trim();

    if (!text) {
      return;
    }

    void sendCopilotMessage(text);
    setDraft('');
  };

  return (
    <>
      {session.copilot.activeInsight ? (
        <View style={styles.insightBlock}>
          <Text style={styles.sectionLabel}>What is known</Text>
          <Text style={styles.bodyText}>{session.copilot.activeInsight.summary}</Text>

          <Text style={styles.sectionLabel}>What it points toward</Text>
          <Text style={styles.bodyText}>{session.copilot.activeInsight.direction}</Text>

          <Text style={styles.sectionLabel}>Smart follow-up</Text>
          <Text style={styles.bodyText}>{session.copilot.activeInsight.followUpQuestion}</Text>

          <Text style={styles.sectionLabel}>Next best tests</Text>
          {session.copilot.activeInsight.nextBestTests.map((test) => (
            <Text key={test} style={styles.listItem}>
              - {test}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>
          The copilot will populate once the structured session has enough context to interpret.
        </Text>
      )}

      <View style={styles.debugBlock}>
        <Text style={styles.debugText}>Copilot provider: {session.copilot.provider}</Text>
        <Text style={styles.debugText}>
          Provider path: {session.copilot.providerPath ?? 'unknown'}
        </Text>
        <Text style={styles.debugText}>
          Provider status: {session.copilot.providerStatus ?? 'unknown'}
        </Text>
        <Text style={styles.debugText}>
          Used fallback: {session.copilot.usedFallback ? 'yes' : 'no'}
        </Text>
        <Text style={styles.debugText}>
          Route input: {copilotContext.primaryRouteLabel ?? 'unknown'}
          {copilotContext.secondaryRouteLabel ? ` -> ${copilotContext.secondaryRouteLabel}` : ''}
        </Text>
        <Text style={styles.debugText}>
          AI reasoning input: {copilotContext.knownFacts.slice(0, 2).join(' | ') || 'No structured facts yet.'}
        </Text>
        <Text style={styles.debugText}>
          Route swap input: {copilotContext.routeSwapReason ?? 'No secondary route swap yet.'}
        </Text>
        <Text style={styles.debugText}>
          Analytics input: {copilotContext.analytics.interpretation[0] ?? 'No interpreted analytics yet.'}
        </Text>
        <Text style={styles.debugText}>
          Missing input: {copilotContext.missingFacts[0] ?? 'No major missing flags.'}
        </Text>
      </View>

      {session.copilot.quickPrompts.length > 0 ? (
        <View style={styles.promptWrap}>
          {session.copilot.quickPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => handleSend(prompt)}
              style={({ pressed }) => [styles.promptChip, pressed ? styles.promptChipPressed : null]}>
              <Text style={styles.promptText}>{humanizePrompt(prompt)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputWrap}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask what to check next"
          placeholderTextColor={servmorxTheme.colors.textDim}
          style={styles.input}
          multiline
        />
        <Pressable onPress={() => handleSend()} style={({ pressed }) => [styles.sendButton, pressed ? styles.sendPressed : null]}>
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>

      {visibleMessages.length > 0 ? (
        <View style={styles.thread}>
          {visibleMessages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'assistant' ? styles.assistantBubble : styles.userBubble,
              ]}>
              <Text style={styles.messageRole}>{message.role === 'assistant' ? 'Copilot' : 'You'}</Text>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function DiagnosticCopilotPanel({ embedded = false }: DiagnosticCopilotPanelProps) {
  if (embedded) {
    return <DiagnosticCopilotPanelBody />;
  }

  return (
    <SectionCard
      title="Diagnostic copilot"
      subtitle="Live interpretation rides alongside the structured route. It explains the current state, but it does not replace the backbone.">
      <DiagnosticCopilotPanelBody />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  insightBlock: {
    gap: servmorxTheme.spacing.sm,
  },
  sectionLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bodyText: {
    color: servmorxTheme.colors.text,
    fontSize: 15,
    lineHeight: 22,
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
  promptWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: servmorxTheme.spacing.sm,
  },
  promptChip: {
    borderRadius: servmorxTheme.radius.pill,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    paddingHorizontal: servmorxTheme.spacing.md,
    paddingVertical: 8,
  },
  promptChipPressed: {
    opacity: 0.85,
  },
  promptText: {
    color: servmorxTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrap: {
    gap: servmorxTheme.spacing.sm,
  },
  input: {
    minHeight: 72,
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    paddingHorizontal: servmorxTheme.spacing.md,
    paddingVertical: servmorxTheme.spacing.sm,
    color: servmorxTheme.colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  sendButton: {
    minHeight: 48,
    borderRadius: servmorxTheme.radius.md,
    backgroundColor: servmorxTheme.colors.accentSoft,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: {
    opacity: 0.88,
  },
  sendLabel: {
    color: servmorxTheme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  thread: {
    gap: servmorxTheme.spacing.sm,
  },
  messageBubble: {
    borderRadius: servmorxTheme.radius.md,
    padding: servmorxTheme.spacing.md,
    gap: 6,
  },
  assistantBubble: {
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
  },
  userBubble: {
    backgroundColor: servmorxTheme.colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(18, 215, 192, 0.2)',
  },
  messageRole: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  messageText: {
    color: servmorxTheme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

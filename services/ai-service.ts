import { postDiagnosticsCopilot } from '@/services/backend-api';
import { buildDiagnosticContext } from '@/features/copilot/build-diagnostic-context';
import { localCopilotProvider } from '@/features/copilot/providers/local-copilot-provider';
import type { CopilotMessage, CopilotState, DiagnosticSession } from '@/types/diagnostic';

type BackendCopilotAttempt =
  | {
      state: CopilotState;
      errorMessage: null;
    }
  | {
      state: null;
      errorMessage: string;
    };

function createMessage(
  role: CopilotMessage['role'],
  kind: CopilotMessage['kind'],
  text: string
): CopilotMessage {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    kind,
    text,
    createdAt: new Date().toISOString(),
  };
}

function limitMessages(messages: CopilotMessage[]) {
  return messages.slice(-10);
}

function isBackendCopilotResponseUsable(response: Awaited<ReturnType<typeof postDiagnosticsCopilot>>) {
  return (
    response.insight &&
    typeof response.insight.summary === 'string' &&
    typeof response.insight.direction === 'string' &&
    typeof response.insight.followUpQuestion === 'string' &&
    Array.isArray(response.insight.nextBestTests) &&
    Array.isArray(response.quickPrompts) &&
    typeof response.messageText === 'string'
  );
}

async function tryBackendCopilot(
  session: DiagnosticSession,
  currentState: CopilotState,
  userMessage?: string
): Promise<BackendCopilotAttempt> {
  const context = buildDiagnosticContext(session);

  if (!userMessage && currentState.lastContextHash === context.hash) {
    return {
      state: currentState,
      errorMessage: null,
    };
  }

  try {
    const response = await postDiagnosticsCopilot({
      context: {
        issue: context.issue,
        route: context.route,
        primaryRoute: context.primaryRoute,
        secondaryRoute: context.secondaryRoute,
        equipment: context.equipment,
        gateAnswers: context.gateAnswers,
        diagAnswers: context.diagAnswers,
        likelyCauses: context.likelyCauses,
        routeConfidence: context.routeConfidence,
        resultConfidence: context.resultConfidence,
        routeReasons: context.routeReasons,
        routeSwapReason: context.routeSwapReason,
        contradictions: context.contradictions,
        missingDataFlags: context.missingDataFlags,
        analytics: context.analytics,
      },
      message: userMessage ?? null,
    });

    if (!isBackendCopilotResponseUsable(response)) {
      throw new Error('Backend copilot response did not match the expected copilot contract.');
    }

    const messages = userMessage
      ? [
          ...currentState.messages,
          createMessage('user', 'user', userMessage),
          createMessage('assistant', 'reply', response.messageText),
        ]
      : [
          ...currentState.messages.filter((message) => message.kind !== 'auto'),
          createMessage('assistant', 'auto', response.messageText),
        ];

    return {
      state: {
        ...currentState,
        provider: response.provider,
        providerPath: response.providerPath ?? 'backend_proxy',
        providerStatus:
          response.providerStatus ?? 'Backend copilot responded without provider status metadata.',
        usedFallback: response.usedFallback ?? false,
        lastContextHash: context.hash,
        quickPrompts: response.quickPrompts,
        activeInsight: response.insight,
        messages: limitMessages(messages),
      },
      errorMessage: null,
    };
  } catch (error) {
    return {
      state: null,
      errorMessage:
        error instanceof Error ? error.message : 'Unknown backend copilot request error.',
    };
  }
}

function buildLocalProviderStatus(errorMessage: string | null) {
  return errorMessage
    ? `Backend copilot unavailable: ${errorMessage} Local diagnostic fallback was used.`
    : 'Local diagnostic copilot fallback was used.';
}

export async function generateCopilotPassiveUpdate(
  session: DiagnosticSession,
  currentState: CopilotState
): Promise<CopilotState> {
  const backendAttempt = await tryBackendCopilot(session, currentState);

  if (backendAttempt.state) {
    return backendAttempt.state;
  }

  const context = buildDiagnosticContext(session);

  if (currentState.lastContextHash === context.hash) {
    return currentState;
  }

  const response = localCopilotProvider.buildAutoResponse(context);
  const messages = [
    ...currentState.messages.filter((message) => message.kind !== 'auto'),
    createMessage('assistant', 'auto', response.messageText),
  ];

  return {
    ...currentState,
    provider: localCopilotProvider.id,
    providerPath: 'fallback_provider',
    providerStatus: buildLocalProviderStatus(backendAttempt.errorMessage),
    usedFallback: true,
    lastContextHash: context.hash,
    quickPrompts: response.quickPrompts,
    activeInsight: response.insight,
    messages: limitMessages(messages),
  };
}

export async function generateCopilotReply(
  session: DiagnosticSession,
  currentState: CopilotState,
  userMessage: string
): Promise<CopilotState> {
  const trimmed = userMessage.trim();

  if (!trimmed) {
    return currentState;
  }

  const backendAttempt = await tryBackendCopilot(session, currentState, trimmed);

  if (backendAttempt.state) {
    return backendAttempt.state;
  }

  const context = buildDiagnosticContext(session);
  const response = localCopilotProvider.buildReply(context, trimmed);
  const messages = [
    ...currentState.messages,
    createMessage('user', 'user', trimmed),
    createMessage('assistant', 'reply', response.messageText),
  ];

  return {
    ...currentState,
    provider: localCopilotProvider.id,
    providerPath: 'fallback_provider',
    providerStatus: buildLocalProviderStatus(backendAttempt.errorMessage),
    usedFallback: true,
    lastContextHash: context.hash,
    quickPrompts: response.quickPrompts,
    activeInsight: response.insight,
    messages: limitMessages(messages),
  };
}

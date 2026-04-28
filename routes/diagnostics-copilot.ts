import type {
  DiagnosticsCopilotRequest,
  DiagnosticsCopilotResponse,
} from '@/backend/contracts/diagnostics';
import { createServerTextResponse } from '@/backend/lib/openai-server-client';

function extractJsonObject(rawText: string) {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Backend copilot did not return a JSON object.');
  }

  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as DiagnosticsCopilotResponse;
}

function buildCopilotPrompt(request: DiagnosticsCopilotRequest) {
  const issue = request.context?.issue ?? 'unknown';
  const equipment = request.context?.equipment ?? null;
  const followUpAnswers = 'followUpAnswers' in request.context ? request.context.followUpAnswers : {};
  const techNotes = 'techNotes' in request.context ? request.context.techNotes : [];

  return [
    'You are SERVMORX TECH, an AI HVAC diagnostic copilot assisting a field technician.',
    'All reasoning must come from the supplied diagnostic context. Do not invent readings.',
    'Sound like an experienced field tech: practical, specific, confident but not absolute.',
    'Explain what the evidence points toward and what to check next.',
    'Keep messageText to 2-4 short sentences. No paragraphs. No filler.',
    'Avoid generic language: "it depends", "various factors", "could be anything", "several things".',
    'Use grounded language: "points toward", "likely", "worth checking next".',
    'Return strict JSON with keys: provider, insight, quickPrompts, messageText.',
    'provider must be exactly "openai".',
    'insight must be a short string the app can display.',
    'quickPrompts should be 0-3 short field checks, not generic chat suggestions.',
    '',
    `User message: ${request.message ?? 'Passive update only.'}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    '',
    'Diagnostic context JSON:',
    JSON.stringify(request.context, null, 2),
    '',
    'If analytics.symptoms exists, treat those boolean symptom fields as normalized technician observations.',
  ].join('\n');
}

export async function handleDiagnosticsCopilot(
  request: DiagnosticsCopilotRequest
): Promise<DiagnosticsCopilotResponse> {
  console.log('[diagnostics/copilot] route hit');
  console.log('[diagnostics/copilot] request body:', JSON.stringify(request));
  console.log(
    `[diagnostics/copilot] OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY?.trim())}`
  );

  try {
    const rawText = await createServerTextResponse(buildCopilotPrompt(request));
    const parsed = extractJsonObject(rawText);
    console.log('[diagnostics/copilot] OpenAI response success');

    return {
      ...parsed,
      provider: 'openai',
      insight: typeof parsed.insight === 'string' ? parsed.insight : '',
      quickPrompts: Array.isArray(parsed.quickPrompts) ? parsed.quickPrompts : [],
      messageText:
        typeof parsed.messageText === 'string'
          ? parsed.messageText
          : 'Backend AI returned no reasoning text.',
    };
  } catch (error) {
    console.error('[diagnostics/copilot] OpenAI response failure:', error);

    return {
      provider: 'backend',
      error: true,
      insight: '',
      quickPrompts: [],
      messageText: 'AI request failed',
    };
  }
}

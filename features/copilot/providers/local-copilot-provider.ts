import type { CopilotInsight } from '@/types/diagnostic';

import type { DiagnosticContext } from '@/features/copilot/build-diagnostic-context';

export interface CopilotProviderResponse {
  insight: CopilotInsight;
  quickPrompts: string[];
  messageText: string;
}

export interface CopilotProvider {
  id: string;
  buildAutoResponse: (context: DiagnosticContext) => CopilotProviderResponse;
  buildReply: (context: DiagnosticContext, userMessage: string) => CopilotProviderResponse;
}

function fallbackTests(context: DiagnosticContext) {
  if (context.result?.nextChecks.length) {
    return context.result.nextChecks.slice(0, 4);
  }

  if (context.route?.includes('Outdoor Unit')) {
    return ['Verify the contactor is in.', 'Check 24V at the contactor coil.', 'Verify line voltage at the unit.'];
  }

  if (context.route?.includes('Indoor Unit')) {
    return ['Verify blower call.', 'Confirm high voltage at the indoor unit.', 'Check motor-specific clues.'];
  }

  return ['Confirm the current route with one more decisive field check.', 'Capture the next missing high-value measurement.'];
}

function buildAnalyticsDirection(context: DiagnosticContext) {
  const lines: string[] = [];

  if (context.analytics.deltaT !== null) {
    if (context.analytics.deltaT < 14) {
      lines.push(`Delta T is only ${context.analytics.deltaT}F, which keeps airflow or charge issues in play.`);
    } else if (context.analytics.deltaT > 24) {
      lines.push(`Delta T is ${context.analytics.deltaT}F, which is elevated enough to recheck airflow and coil loading.`);
    } else {
      lines.push(`Delta T is ${context.analytics.deltaT}F, which is workable for a first-pass cooling check.`);
    }
  }

  if (context.analytics.calculatedSuperheat !== null) {
    if (context.analytics.calculatedSuperheat > 20) {
      lines.push(`Superheat is high at ${context.analytics.calculatedSuperheat}F, which can fit underfeed, low charge, or load-side problems.`);
    } else if (context.analytics.calculatedSuperheat < 5) {
      lines.push(`Superheat is low at ${context.analytics.calculatedSuperheat}F, which can fit flooding or overfeed behavior.`);
    }
  }

  if (context.analytics.calculatedSubcool !== null) {
    if (context.analytics.calculatedSubcool > 18) {
      lines.push(`Subcooling is high at ${context.analytics.calculatedSubcool}F, which can fit restriction, overcharge, or condenser heat rejection trouble.`);
    } else if (context.analytics.calculatedSubcool < 5) {
      lines.push(`Subcooling is low at ${context.analytics.calculatedSubcool}F, which can fit low charge or feed issues.`);
    }
  }

  return lines[0] ?? null;
}

function followUpQuestion(context: DiagnosticContext) {
  if (context.contradictions.length > 0) {
    return context.contradictions[0];
  }

  if (context.missingDataFlags.length > 0) {
    return context.missingDataFlags[0];
  }

  if (context.analytics.deltaT === null) {
    return 'Can you get indoor return and supply temperatures to tighten the cooling picture?';
  }

  return 'What is the next measurement or observation you can confirm right now?';
}

function buildSummary(context: DiagnosticContext) {
  const known = [
    context.issue ? `Issue: ${context.issue}.` : null,
    context.primaryRoute ? `Primary route: ${context.primaryRoute}.` : null,
    context.secondaryRoute ? `Secondary route: ${context.secondaryRoute}.` : null,
    context.route && !context.secondaryRoute ? `Active route: ${context.route}.` : null,
    context.equipment.brand || context.equipment.modelNumber
      ? `Equipment: ${[context.equipment.brand, context.equipment.modelNumber].filter(Boolean).join(' | ')}.`
      : null,
    context.routeReasons[0] ? `Why: ${context.routeReasons[0]}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return known || 'The session is still early, so the copilot only has partial context.';
}

function buildDirection(context: DiagnosticContext) {
  const analyticsDirection = buildAnalyticsDirection(context);

  if (context.result) {
    const topCause = context.likelyCauses[0];
    const confidence = context.resultConfidence ? ` The current structured confidence is ${context.resultConfidence}.` : '';
    const causeNote = topCause ? ` Right now the leading path is ${topCause.title.toLowerCase()}.` : '';
    const secondary = context.routeSwapReason ? ` The route narrowed because ${context.routeSwapReason.toLowerCase()}` : '';
    const analytics = analyticsDirection ? ` ${analyticsDirection}` : '';

    return `${context.result.summary}${secondary}${causeNote}${confidence}${analytics}`;
  }

  if (context.routeReasons.length > 0) {
    return context.routeReasons[0];
  }

  if (context.route) {
    return `The current structured flow is leaning toward ${context.route}.`;
  }

  return 'The structured flow needs one more decisive answer before the route is clear.';
}

function buildQuickPrompts(context: DiagnosticContext) {
  const prompts = ['What does this point to?', 'What would you check next?', 'What is still missing?'];

  if (context.analytics.deltaT === null) {
    prompts.push('How would temperatures help?');
  }

  if (context.route?.includes('Outdoor Unit')) {
    prompts.push('Could this be a capacitor issue?');
  }

  if (context.secondaryRoute) {
    prompts.push('Why did the route narrow?');
  }

  if (context.contradictions.length > 0) {
    prompts.push('What looks contradictory here?');
  }

  return prompts.slice(0, 4);
}

function composeMessage(insight: CopilotInsight) {
  return [
    `Known: ${insight.summary}`,
    `Direction: ${insight.direction}`,
    `Follow-up: ${insight.followUpQuestion}`,
    `Next tests: ${insight.nextBestTests.join(' | ')}`,
  ].join('\n');
}

function buildInsight(context: DiagnosticContext): CopilotInsight {
  return {
    summary: buildSummary(context),
    direction: buildDirection(context),
    followUpQuestion: followUpQuestion(context),
    nextBestTests: fallbackTests(context),
  };
}

function buildReplyDirection(context: DiagnosticContext, userMessage: string) {
  const query = userMessage.toLowerCase();
  const analyticsDirection = buildAnalyticsDirection(context);

  if (query.includes('charge') || query.includes('meter') || query.includes('refrigerant')) {
    if (context.analytics.calculatedSuperheat !== null || context.analytics.calculatedSubcool !== null) {
      return `I would read the refrigerant side cautiously. Superheat is ${context.analytics.calculatedSuperheat ?? 'not available'} and subcool is ${context.analytics.calculatedSubcool ?? 'not available'}. That does not replace the route, but it does help decide whether charge or metering deserves more attention.`;
    }

    return 'Charge is still on the table, but I would not lean there yet without better refrigerant-side readings or a cleaner airflow picture.';
  }

  if (query.includes('amps') || query.includes('current')) {
    return 'If the component is drawing current, that moves the conversation away from a simple no-call and toward a load-side or mechanical problem. I would pair amp draw with capacitor and voltage checks before condemning the component.';
  }

  if (query.includes('next') || query.includes('test') || query.includes('check')) {
    return `Based on the current route, I would stay disciplined: ${fallbackTests(context).join(', ')}. ${analyticsDirection ?? ''}`.trim();
  }

  if (query.includes('missing') || query.includes('need') || query.includes('else') || query.includes('contradict')) {
    return context.missingDataFlags.length > 0 || context.contradictions.length > 0
      ? `The highest-value gaps are: ${[...context.contradictions, ...context.missingDataFlags]
          .slice(0, 3)
          .join(' ')}`
      : 'The session already has enough structure for a decent first-pass route, so the next step is confirming the top branch with one more field check.';
  }

  if (query.includes('point') || query.includes('think') || query.includes('likely')) {
    return buildDirection(context);
  }

  if (query.includes('why') && query.includes('route')) {
    return context.routeSwapReason
      ? `The route narrowed because ${context.routeSwapReason.toLowerCase()}. I would treat that as the strongest field clue until a contradiction shows up.`
      : `The active route is being held by these reasons: ${context.routeReasons.slice(0, 2).join(' ')}`;
  }

  return `${buildDirection(context)} ${context.analytics.interpretation[0] ?? ''}`.trim();
}

export const localCopilotProvider: CopilotProvider = {
  id: 'local-diagnostic-copilot',
  buildAutoResponse(context) {
    const insight = buildInsight(context);

    return {
      insight,
      quickPrompts: buildQuickPrompts(context),
      messageText: composeMessage(insight),
    };
  },
  buildReply(context, userMessage) {
    const insight = buildInsight(context);
    const direction = buildReplyDirection(context, userMessage);
    const replyInsight: CopilotInsight = {
      ...insight,
      direction,
    };

    return {
      insight: replyInsight,
      quickPrompts: buildQuickPrompts(context),
      messageText: composeMessage(replyInsight),
    };
  },
};

import type { DiagnosticRouteId, DiagnosticSession, IssueId } from '@/types/diagnostic';

export type AppRoute =
  | '/'
  | '/equipment-intake'
  | '/scan-equipment'
  | '/equipment-confirmation'
  | '/manual-equipment'
  | '/system-type'
  | '/split-system-follow-up'
  | '/issue-selection'
  | '/no-cooling-gates'
  | '/no-airflow-gates'
  | '/weak-cooling-gates'
  | '/icing-gates'
  | '/system-idle-gates'
  | '/outdoor-unit-not-running-gates'
  | '/indoor-unit-diagnostic'
  | '/outdoor-unit-diagnostic'
  | '/secondary-diagnostic'
  | '/results';

export type FlowScreenId =
  | 'equipment-intake'
  | 'scan-equipment'
  | 'equipment-confirmation'
  | 'manual-equipment'
  | 'system-type'
  | 'split-system-follow-up'
  | 'issue-selection'
  | 'gate-questions'
  | 'indoor-unit-diagnostic'
  | 'outdoor-unit-diagnostic'
  | 'secondary-diagnostic'
  | 'results';

function getIssueGateRoute(issue: IssueId | null): AppRoute {
  switch (issue) {
    case 'no_cooling':
      return '/no-cooling-gates';
    case 'no_airflow':
      return '/no-airflow-gates';
    case 'weak_cooling':
      return '/weak-cooling-gates';
    case 'icing_frozen_coil':
      return '/icing-gates';
    case 'system_not_doing_anything':
      return '/system-idle-gates';
    case 'outdoor_unit_not_running':
      return '/outdoor-unit-not-running-gates';
    default:
      return '/issue-selection';
  }
}

function getPrimaryFocusedRoute(route: DiagnosticRouteId | null): AppRoute | null {
  if (route === 'outdoor_unit_diag') {
    return '/outdoor-unit-diagnostic';
  }

  if (route === 'indoor_unit_diag') {
    return '/indoor-unit-diagnostic';
  }

  return null;
}

function getPrimaryRouteFromHistory(session: DiagnosticSession): DiagnosticRouteId | null {
  const primaryEntry = session.routeHistory.find((entry) => entry.stage === 'primary');
  return primaryEntry?.route ?? null;
}

function isSecondaryRoute(route: DiagnosticRouteId | null) {
  return Boolean(
    route &&
      [
        'low_voltage_diag',
        'line_voltage_diag',
        'blower_diag',
        'compressor_diag',
        'condenser_fan_diag',
        'board_control_diag',
        'safety_open_diag',
      ].includes(route)
  );
}

export function getResumeRoute(session: DiagnosticSession): AppRoute {
  switch (session.currentStep) {
    case 'home':
    case 'equipment-intake':
      return '/equipment-intake';
    case 'scan-equipment':
      return '/scan-equipment';
    case 'equipment-confirmation':
      return '/equipment-confirmation';
    case 'manual-equipment':
      return '/manual-equipment';
    case 'system-type':
      return '/system-type';
    case 'split-system-follow-up':
      return '/split-system-follow-up';
    case 'issue-selection':
      return '/issue-selection';
    case 'gate-questions':
      return getIssueGateRoute(session.issue);
    case 'focused-diagnostic':
      if (isSecondaryRoute(session.currentRoute)) {
        return '/secondary-diagnostic';
      }

      return getPrimaryFocusedRoute(session.currentRoute) ?? getIssueGateRoute(session.issue);
    case 'results':
      return '/results';
    default:
      return '/equipment-intake';
  }
}

export function getBackRoute(screen: FlowScreenId, session: DiagnosticSession): AppRoute {
  switch (screen) {
    case 'equipment-intake':
      return '/';
    case 'scan-equipment':
      return '/equipment-intake';
    case 'equipment-confirmation':
      return '/scan-equipment';
    case 'manual-equipment':
      return session.capture ? '/equipment-confirmation' : '/equipment-intake';
    case 'system-type':
      return session.capture
        ? '/equipment-confirmation'
        : session.brand || session.modelNumber || session.serialNumber
          ? '/manual-equipment'
          : '/equipment-intake';
    case 'split-system-follow-up':
      return '/system-type';
    case 'issue-selection':
      return session.systemType === 'split_system_ac' ? '/split-system-follow-up' : '/system-type';
    case 'gate-questions':
      return '/issue-selection';
    case 'indoor-unit-diagnostic':
    case 'outdoor-unit-diagnostic':
      return getIssueGateRoute(session.issue);
    case 'secondary-diagnostic': {
      const primaryRoute = getPrimaryRouteFromHistory(session);
      return getPrimaryFocusedRoute(primaryRoute) ?? getIssueGateRoute(session.issue);
    }
    case 'results':
      if (isSecondaryRoute(session.currentRoute)) {
        return '/secondary-diagnostic';
      }

      return getPrimaryFocusedRoute(session.currentRoute) ?? getIssueGateRoute(session.issue);
    default:
      return '/';
  }
}

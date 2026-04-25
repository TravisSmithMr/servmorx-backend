import type { DiagnosticSession } from '@/types/diagnostic';

export function getCurrentRouteEntry(session: DiagnosticSession) {
  return [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute) ?? null;
}

export function getPrimaryRouteEntry(session: DiagnosticSession) {
  return session.routeHistory.find((entry) => entry.stage === 'primary') ?? null;
}

export function getSecondaryRouteEntry(session: DiagnosticSession) {
  return [...session.routeHistory].reverse().find((entry) => entry.stage === 'secondary') ?? null;
}

export function getPrimaryRoute(session: DiagnosticSession) {
  return getPrimaryRouteEntry(session)?.route ?? session.currentRoute ?? null;
}

export function getSecondaryRoute(session: DiagnosticSession) {
  return getSecondaryRouteEntry(session)?.route ?? null;
}

export function getRouteReasons(session: DiagnosticSession) {
  return getCurrentRouteEntry(session)?.reasons ?? [];
}

export function getRouteSwapReason(session: DiagnosticSession) {
  return getSecondaryRouteEntry(session)?.reasons[0] ?? null;
}

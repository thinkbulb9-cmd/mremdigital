import 'server-only';
/** Pilot stays loopback-only; college-wide access must opt into course approvals. */
export function approvalRequired(): boolean {
  return process.env.MREM_CAMPUS_REQUIRE_APPROVAL === 'enabled';
}

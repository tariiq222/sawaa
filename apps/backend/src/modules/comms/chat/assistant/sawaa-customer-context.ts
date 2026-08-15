export type SawaaJourneyStage = 'EXPLORING' | 'COMPARING' | 'READY_TO_BOOK' | 'HANDOFF';
export type SawaaCustomerContext = {
  journeyStage?: SawaaJourneyStage; serviceInterestIds?: string[]; practitionerPreferenceIds?: string[];
  modality?: 'IN_PERSON' | 'ONLINE'; preferredDays?: string[]; preferredTimeWindow?: string;
  budgetConcern?: boolean; selectedServiceId?: string; selectedPractitionerId?: string;
};

type ContextKey = keyof SawaaCustomerContext;
const keys: ContextKey[] = ['journeyStage', 'serviceInterestIds', 'practitionerPreferenceIds', 'modality', 'preferredDays', 'preferredTimeWindow', 'budgetConcern', 'selectedServiceId', 'selectedPractitionerId'];
const stages = new Set<SawaaJourneyStage>(['EXPLORING', 'COMPARING', 'READY_TO_BOOK', 'HANDOFF']);
const modalities = new Set(['IN_PERSON', 'ONLINE']);
const weekdays = new Set(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mergeSawaaCustomerContext(current: unknown, patch: unknown): SawaaCustomerContext | null {
  const base = projectContext(current);
  if (base === null || !isRecord(patch) || !hasOnlyAllowedKeys(patch)) return null;
  const projectedPatch = projectContext(patch);
  return projectedPatch === null ? null : { ...base, ...projectedPatch };
}

function projectContext(value: unknown): SawaaCustomerContext | null {
  if (value === null || value === undefined) return {};
  if (!isRecord(value) || !hasOnlyAllowedKeys(value)) return null;
  const result: SawaaCustomerContext = {};
  if (hasOwn(value, 'journeyStage')) {
    const journeyStage = value.journeyStage;
    if (typeof journeyStage !== 'string' || !stages.has(journeyStage as SawaaJourneyStage)) return null;
    result.journeyStage = journeyStage as SawaaJourneyStage;
  }
  for (const key of ['serviceInterestIds', 'practitionerPreferenceIds', 'selectedServiceId', 'selectedPractitionerId'] as const) {
    if (!hasOwn(value, key)) continue;
    if (key.endsWith('Ids')) {
      const ids = boundedIds(value[key]);
      if (!ids) return null;
      if (key === 'serviceInterestIds') result.serviceInterestIds = ids;
      else result.practitionerPreferenceIds = ids;
    } else {
      if (!isId(value[key])) return null;
      if (key === 'selectedServiceId') result.selectedServiceId = value[key];
      else result.selectedPractitionerId = value[key];
    }
  }
  if (hasOwn(value, 'modality')) {
    const modality = value.modality;
    if (typeof modality !== 'string' || !modalities.has(modality)) return null;
    result.modality = modality as 'IN_PERSON' | 'ONLINE';
  }
  if (hasOwn(value, 'preferredDays')) {
    const preferredDays = value.preferredDays;
    if (!Array.isArray(preferredDays) || preferredDays.length > 7 || preferredDays.some((day) => typeof day !== 'string' || !weekdays.has(day))) return null;
    result.preferredDays = [...preferredDays];
  }
  if (hasOwn(value, 'preferredTimeWindow')) {
    const preferredTimeWindow = value.preferredTimeWindow;
    if (typeof preferredTimeWindow !== 'string' || !preferredTimeWindow.trim() || preferredTimeWindow.length > 80) return null;
    result.preferredTimeWindow = preferredTimeWindow.trim();
  }
  if (hasOwn(value, 'budgetConcern')) {
    const budgetConcern = value.budgetConcern;
    if (typeof budgetConcern !== 'boolean') return null;
    result.budgetConcern = budgetConcern;
  }
  return result;
}
function boundedIds(value: unknown): string[] | null { return Array.isArray(value) && value.length <= 10 && value.every(isId) ? [...value] as string[] : null; }
function isId(value: unknown): value is string { return typeof value === 'string' && idPattern.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function hasOnlyAllowedKeys(value: Record<string, unknown>): boolean { return Object.keys(value).every((key) => keys.includes(key as ContextKey)); }

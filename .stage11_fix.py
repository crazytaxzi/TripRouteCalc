from pathlib import Path

path = Path('packages/foundation/src/commercial-routing.ts')
text = path.read_text()
before = '''export interface NormalizedCommercialRouteResult extends CommercialRoutePayload {
  readonly assessment: CommercialRouteAssessment;
}
'''
after = '''export type NormalizedCommercialRouteResult = Readonly<
  Omit<
    CommercialRoutePayload,
    'legs' | 'restrictions' | 'unavailableFields'
  > & {
    readonly legs: readonly CommercialRouteLeg[];
    readonly restrictions: readonly CommercialRouteRestriction[];
    readonly unavailableFields: readonly RouteUnavailableField[];
    readonly assessment: CommercialRouteAssessment;
  }
>;
'''
if after not in text:
    if before not in text:
        raise SystemExit('normalized route result declaration not found')
    path.write_text(text.replace(before, after, 1))

Path('.stage11_fix.py').unlink(missing_ok=True)

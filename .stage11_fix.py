from pathlib import Path

path = Path('packages/persistence/src/route-provider-response-repository.ts')
text = path.read_text()
before = '    const result = assessCommercialRoute(input.result);\n'
after = '''    const result = assessCommercialRoute({
      routeId: input.result.routeId,
      routeKind: input.result.routeKind,
      provider: input.result.provider,
      totalDistance: input.result.totalDistance,
      travelDuration: input.result.travelDuration,
      geometry: input.result.geometry,
      legs: input.result.legs,
      restrictions: input.result.restrictions,
      unavailableFields: input.result.unavailableFields,
    });
'''
if after not in text:
    if before not in text:
        raise SystemExit('normalized evidence assessment call not found')
    path.write_text(text.replace(before, after, 1))

Path('.github/workflows/stage11-test-diagnostic.yml').unlink(missing_ok=True)
Path('docs/implementation/.stage11-test-trigger').unlink(missing_ok=True)
Path('.stage11_fix.py').unlink(missing_ok=True)

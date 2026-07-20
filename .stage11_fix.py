from pathlib import Path

path = Path('packages/foundation/src/commercial-routing.ts')
text = path.read_text()
text = text.replace(
    'export function commercialRouteResultSnapshot(\n  input: unknown,\n): Readonly<Record<string, unknown>> {\n  const result = assessCommercialRoute(input);\n',
    'export function commercialRouteResultSnapshot(\n  result: NormalizedCommercialRouteResult,\n): Readonly<Record<string, unknown>> {\n',
    1,
)
path.write_text(text)
Path('.stage11_fix.py').unlink(missing_ok=True)

from pathlib import Path
import re
import traceback


errors: list[str] = []
changes: list[str] = []


def run(label: str, action) -> None:
    try:
        action()
    except Exception:
        errors.append(f'## {label}\n{traceback.format_exc()}')


def replace_text(path: str, before: str, after: str, label: str) -> None:
    def action() -> None:
        target = Path(path)
        text = target.read_text()
        if after in text:
            return
        updated = text.replace(before, after, 1)
        if updated != text:
            target.write_text(updated)
            changes.append(label)
    run(label, action)


def replace_pattern(path: str, pattern: str, replacement: str, label: str) -> None:
    def action() -> None:
        target = Path(path)
        text = target.read_text()
        updated, count = re.subn(pattern, replacement, text, count=1)
        if count > 0:
            target.write_text(updated)
            changes.append(label)
    run(label, action)


foundation = 'packages/foundation/test/commercial-routing.test.ts'
replace_text(
    foundation,
    "} from '../src/index.js';\n",
    "} from '../src/index.js';\n"
    "import type {\n"
    "  CommercialRoutePayload,\n"
    "  CommercialRouteRequest,\n"
    "  ResolvedCommercialLocation,\n"
    "} from '../src/index.js';\n",
    'foundation type imports',
)
replace_pattern(
    foundation,
    r"function location\(\n  referenceId: string,\n  longitude: number,\n\): Readonly<Record<string, unknown>> \{",
    "function location(\n  referenceId: string,\n  longitude: number,\n): ResolvedCommercialLocation {",
    'foundation location return type',
)
replace_text(
    foundation,
    'function request(): Readonly<Record<string, unknown>> {',
    'function request(): CommercialRouteRequest {',
    'foundation request return type',
)
replace_pattern(
    foundation,
    r"function payload\(\n  overrides: Record<string, unknown> = \{\},\n\): Readonly<Record<string, unknown>> \{",
    "function payload(\n  overrides: Partial<CommercialRoutePayload> = {},\n): CommercialRoutePayload {",
    'foundation payload return type',
)

persistence = 'packages/persistence/test/route-provider-contract.integration.test.ts'
replace_text(
    persistence,
    "} from '@trip-route-calc/foundation';\n",
    "} from '@trip-route-calc/foundation';\n"
    "import type { NormalizedCommercialRouteResult } from '@trip-route-calc/foundation';\n",
    'persistence result import',
)
replace_text(
    persistence,
    'function routeResult() {',
    'function routeResult(): NormalizedCommercialRouteResult {',
    'persistence result return type',
)

service = 'packages/routing/src/commercial-routing-service.ts'
replace_text(
    service,
    'const calculateComparison = this.provider.calculateConsumerComparison;',
    'const calculateComparison = this.provider.calculateConsumerComparison.bind(\n      this.provider,\n    );',
    'consumer comparison binding',
)
replace_text(
    service,
    'const getTrafficEstimate = this.provider.getTrafficEstimate;',
    'const getTrafficEstimate = this.provider.getTrafficEstimate.bind(\n      this.provider,\n    );',
    'traffic estimate binding',
)
replace_text(
    service,
    'const getRoadClosures = this.provider.getRoadClosures;',
    'const getRoadClosures = this.provider.getRoadClosures.bind(this.provider);',
    'road closure binding',
)
replace_text(
    service,
    "config.provider.metadata.credentialRequirement === 'required'",
    "config.provider?.metadata.credentialRequirement === 'required'",
    'provider optional chain',
)

routing_test = 'packages/routing/test/commercial-routing-service.test.ts'
replace_text(
    routing_test,
    'JSON.stringify { credential })',
    'JSON.stringify({ credential })',
    'credential JSON syntax',
)

if errors:
    Path('.stage11_recovery_error.txt').write_text('\n\n'.join(errors))
else:
    Path('.stage11_recovery_error.txt').unlink(missing_ok=True)

for temporary in (
    '.github/workflows/stage11-lint-diagnostic.yml',
    '.github/workflows/stage11-lint-fix.yml',
    '.stage11_fix.py',
):
    Path(temporary).unlink(missing_ok=True)

print('Applied Stage 11 recovery changes:')
for change in changes:
    print(f'- {change}')
print(f'Captured exceptions: {len(errors)}')

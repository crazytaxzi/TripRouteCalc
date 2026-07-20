from pathlib import Path
import re


def replace_text(path: str, before: str, after: str) -> bool:
    target = Path(path)
    text = target.read_text()
    if after in text:
        return False
    updated = text.replace(before, after, 1)
    if updated == text:
        return False
    target.write_text(updated)
    return True


def replace_pattern(path: str, pattern: str, replacement: str) -> bool:
    target = Path(path)
    text = target.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1)
    if count == 0:
        return False
    target.write_text(updated)
    return True


changes: list[str] = []

foundation = 'packages/foundation/test/commercial-routing.test.ts'
if replace_text(
    foundation,
    "} from '../src/index.js';\n",
    "} from '../src/index.js';\n"
    "import type {\n"
    "  CommercialRoutePayload,\n"
    "  CommercialRouteRequest,\n"
    "  ResolvedCommercialLocation,\n"
    "} from '../src/index.js';\n",
):
    changes.append('foundation type imports')
if replace_pattern(
    foundation,
    r"function location\(\n  referenceId: string,\n  longitude: number,\n\): Readonly<Record<string, unknown>> \{",
    "function location(\n  referenceId: string,\n  longitude: number,\n): ResolvedCommercialLocation {",
):
    changes.append('foundation location return type')
if replace_text(
    foundation,
    'function request(): Readonly<Record<string, unknown>> {',
    'function request(): CommercialRouteRequest {',
):
    changes.append('foundation request return type')
if replace_pattern(
    foundation,
    r"function payload\(\n  overrides: Record<string, unknown> = \{\},\n\): Readonly<Record<string, unknown>> \{",
    "function payload(\n  overrides: Partial<CommercialRoutePayload> = {},\n): CommercialRoutePayload {",
):
    changes.append('foundation payload return type')

persistence = 'packages/persistence/test/route-provider-contract.integration.test.ts'
if replace_text(
    persistence,
    "} from '@trip-route-calc/foundation';\n",
    "} from '@trip-route-calc/foundation';\n"
    "import type { NormalizedCommercialRouteResult } from '@trip-route-calc/foundation';\n",
):
    changes.append('persistence result import')
if replace_text(
    persistence,
    'function routeResult() {',
    'function routeResult(): NormalizedCommercialRouteResult {',
):
    changes.append('persistence result return type')

service = 'packages/routing/src/commercial-routing-service.ts'
if replace_text(
    service,
    'const calculateComparison = this.provider.calculateConsumerComparison;',
    'const calculateComparison = this.provider.calculateConsumerComparison.bind(\n      this.provider,\n    );',
):
    changes.append('consumer comparison binding')
if replace_text(
    service,
    'const getTrafficEstimate = this.provider.getTrafficEstimate;',
    'const getTrafficEstimate = this.provider.getTrafficEstimate.bind(\n      this.provider,\n    );',
):
    changes.append('traffic estimate binding')
if replace_text(
    service,
    'const getRoadClosures = this.provider.getRoadClosures;',
    'const getRoadClosures = this.provider.getRoadClosures.bind(this.provider);',
):
    changes.append('road closure binding')
if replace_text(
    service,
    "config.provider.metadata.credentialRequirement === 'required'",
    "config.provider?.metadata.credentialRequirement === 'required'",
):
    changes.append('provider optional chain')

routing_test = 'packages/routing/test/commercial-routing-service.test.ts'
if replace_text(
    routing_test,
    'JSON.stringify { credential })',
    'JSON.stringify({ credential })',
):
    changes.append('credential JSON syntax')

for temporary in (
    '.github/workflows/stage11-lint-diagnostic.yml',
    '.github/workflows/stage11-lint-fix.yml',
    '.stage11_fix.py',
):
    Path(temporary).unlink(missing_ok=True)

print('Applied Stage 11 recovery changes:')
for change in changes:
    print(f'- {change}')

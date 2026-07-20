from pathlib import Path
import re


def write(path: str, text: str) -> None:
    Path(path).write_text(text)

foundation_path = 'packages/foundation/test/commercial-routing.test.ts'
text = Path(foundation_path).read_text()
if 'CommercialRoutePayload,' not in text:
    marker = "} from '../src/index.js';\n"
    insertion = (
        "} from '../src/index.js';\n"
        "import type {\n"
        "  CommercialRoutePayload,\n"
        "  CommercialRouteRequest,\n"
        "  ResolvedCommercialLocation,\n"
        "} from '../src/index.js';\n"
    )
    if marker not in text:
        raise SystemExit('foundation import marker missing')
    text = text.replace(marker, insertion, 1)
text = re.sub(
    r"function location\(\n  referenceId: string,\n  longitude: number,\n\): Readonly<Record<string, unknown>> \{",
    "function location(\n  referenceId: string,\n  longitude: number,\n): ResolvedCommercialLocation {",
    text,
    count=1,
)
text = text.replace(
    'function request(): Readonly<Record<string, unknown>> {',
    'function request(): CommercialRouteRequest {',
    1,
)
text = re.sub(
    r"function payload\(\n  overrides: Record<string, unknown> = \{\},\n\): Readonly<Record<string, unknown>> \{",
    "function payload(\n  overrides: Partial<CommercialRoutePayload> = {},\n): CommercialRoutePayload {",
    text,
    count=1,
)
write(foundation_path, text)

persistence_path = 'packages/persistence/test/route-provider-contract.integration.test.ts'
text = Path(persistence_path).read_text()
if 'NormalizedCommercialRouteResult' not in text:
    marker = "} from '@trip-route-calc/foundation';\n"
    insertion = (
        "} from '@trip-route-calc/foundation';\n"
        "import type { NormalizedCommercialRouteResult } from '@trip-route-calc/foundation';\n"
    )
    if marker not in text:
        raise SystemExit('persistence import marker missing')
    text = text.replace(marker, insertion, 1)
text = text.replace(
    'function routeResult() {',
    'function routeResult(): NormalizedCommercialRouteResult {',
    1,
)
write(persistence_path, text)

service_path = 'packages/routing/src/commercial-routing-service.ts'
text = Path(service_path).read_text()
text = text.replace(
    'const calculateComparison = this.provider.calculateConsumerComparison;',
    'const calculateComparison = this.provider.calculateConsumerComparison.bind(\n      this.provider,\n    );',
    1,
)
text = text.replace(
    'const getTrafficEstimate = this.provider.getTrafficEstimate;',
    'const getTrafficEstimate = this.provider.getTrafficEstimate.bind(\n      this.provider,\n    );',
    1,
)
text = text.replace(
    'const getRoadClosures = this.provider.getRoadClosures;',
    'const getRoadClosures = this.provider.getRoadClosures.bind(this.provider);',
    1,
)
text = text.replace(
    "config.provider.metadata.credentialRequirement === 'required'",
    "config.provider?.metadata.credentialRequirement === 'required'",
    1,
)
write(service_path, text)

routing_test_path = 'packages/routing/test/commercial-routing-service.test.ts'
text = Path(routing_test_path).read_text()
text = text.replace('JSON.stringify { credential })', 'JSON.stringify({ credential })', 1)
write(routing_test_path, text)

for temporary in (
    '.github/workflows/stage11-lint-diagnostic.yml',
    '.github/workflows/stage11-lint-fix.yml',
    '.stage11_fix.py',
):
    Path(temporary).unlink(missing_ok=True)

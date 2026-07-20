from pathlib import Path

path = Path('packages/foundation/src/commercial-routing.ts')
text = path.read_text()
before = '  const providerVerificationStatus =\n'
after = "  const providerVerificationStatus: CommercialRouteAssessment['providerVerificationStatus'] =\n"
if after not in text:
    if before not in text:
        raise SystemExit('provider verification declaration not found')
    text = text.replace(before, after, 1)
    path.write_text(text)

Path('.github/workflows/stage11-typecheck-diagnostic.yml').unlink(missing_ok=True)
Path('.stage11_fix.py').unlink(missing_ok=True)

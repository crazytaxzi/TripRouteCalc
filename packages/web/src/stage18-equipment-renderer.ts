import type {
  LoadProfileFacts,
  Stage18CompleteFacts,
  TractorProfileFacts,
  TrailerProfileFacts,
} from './stage18-details.js';

export type EquipmentKind = 'tractor' | 'trailer' | 'load';
export interface ProfileOption {
  readonly id: string;
  readonly label: string;
  readonly profile?: unknown;
}
export interface ProfileCache {
  readonly drivers: readonly ProfileOption[];
  readonly tractors: readonly ProfileOption[];
  readonly trailers: readonly ProfileOption[];
  readonly loads: readonly ProfileOption[];
}

let cache: ProfileCache = { drivers: [], tractors: [], trailers: [], loads: [] };

export function setStage18ProfileCache(value: ProfileCache): void { cache = value; }
export function getStage18ProfileCache(): ProfileCache { return cache; }

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/gu,
    (character): string =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

function selected(value: string, expected: string): string {
  return value === expected ? ' selected' : '';
}

function checked(value: boolean): string {
  return value ? ' checked' : '';
}

function numeric(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '' : String(value);
}

function textField(
  kind: EquipmentKind,
  name: string,
  label: string,
  value: string,
  type = 'text',
): string {
  return `<label class="field"><span>${label}</span><input data-stage18-equipment-kind="${kind}" data-stage18-field="${name}" type="${type}" value="${escapeHtml(value)}"></label>`;
}

function numberField(
  kind: EquipmentKind,
  name: string,
  label: string,
  value: number,
): string {
  return `<label class="field"><span>${label}</span><input data-stage18-equipment-kind="${kind}" data-stage18-field="${name}" type="number" step="any" inputmode="decimal" value="${numeric(value)}"></label>`;
}

function checkField(
  kind: EquipmentKind,
  name: string,
  label: string,
  value: boolean,
): string {
  return `<label class="check"><input data-stage18-equipment-kind="${kind}" data-stage18-field="${name}" type="checkbox"${checked(value)}> ${label}</label>`;
}

function textareaField(
  kind: EquipmentKind,
  name: string,
  label: string,
  value: string,
  hint: string,
): string {
  return `<label class="field"><span>${label}</span><textarea data-stage18-equipment-kind="${kind}" data-stage18-field="${name}" rows="3">${escapeHtml(value)}</textarea><small>${escapeHtml(hint)}</small></label>`;
}

function evidenceFields(
  kind: EquipmentKind,
  sourceType: string,
  sourceName: string,
): string {
  return `<div class="grid two"><label class="field"><span>Measurement source classification</span><select data-stage18-equipment-kind="${kind}" data-stage18-field="sourceType"><option value="">Choose source</option><option value="measured"${selected(sourceType, 'measured')}>Measured</option><option value="manufacturer-rated"${selected(sourceType, 'manufacturer-rated')}>Manufacturer rated</option><option value="carrier-configured"${selected(sourceType, 'carrier-configured')}>Carrier configured</option><option value="user-estimated"${selected(sourceType, 'user-estimated')}>User estimated</option></select></label>${textField(kind, 'sourceName', 'Source name or record', sourceName)}</div>`;
}

function profileOptions(
  options: readonly ProfileOption[],
  activeId: string | undefined,
): string {
  return [
    '<option value="">Create new profile</option>',
    ...options.map(
      (option): string =>
        `<option value="${escapeHtml(option.id)}"${selected(option.id, activeId ?? '')}>${escapeHtml(option.label)}</option>`,
    ),
  ].join('');
}

function renderTractor(facts: TractorProfileFacts): string {
  return `<details open class="subpanel"><summary>Tractor profile</summary>
    <label class="field"><span>Reuse existing tractor</span><select data-stage18-profile-select="tractor">${profileOptions(cache.tractors, facts.id)}</select></label>
    <div class="grid three">
      ${textField('tractor', 'unitNumber', 'Unit number', facts.unitNumber)}
      ${textField('tractor', 'vin', 'VIN, optional', facts.vin)}
      <label class="field"><span>Tractor type</span><select data-stage18-equipment-kind="tractor" data-stage18-field="tractorType"><option value="day-cab"${selected(facts.tractorType, 'day-cab')}>Day cab</option><option value="sleeper"${selected(facts.tractorType, 'sleeper')}>Sleeper</option><option value="cabover"${selected(facts.tractorType, 'cabover')}>Cabover</option><option value="other"${selected(facts.tractorType, 'other')}>Other</option></select></label>
      ${numberField('tractor', 'axleCount', 'Axle count', facts.axleCount)}
      ${numberField('tractor', 'overallLengthFeet', 'Overall length, ft', facts.overallLengthFeet)}
      ${numberField('tractor', 'wheelbaseFeet', 'Wheelbase, ft', facts.wheelbaseFeet)}
      ${numberField('tractor', 'heightFeet', 'Height, ft', facts.heightFeet)}
      ${numberField('tractor', 'widthInches', 'Width, in', facts.widthInches)}
      ${numberField('tractor', 'emptyWeightPounds', 'Empty weight, lb', facts.emptyWeightPounds)}
      ${numberField('tractor', 'grossVehicleWeightRatingPounds', 'GVWR, lb', facts.grossVehicleWeightRatingPounds)}
      ${numberField('tractor', 'registeredGrossWeightPounds', 'Registered gross weight, lb', facts.registeredGrossWeightPounds)}
      ${numberField('tractor', 'fuelCapacityGallons', 'Fuel capacity, gal', facts.fuelCapacityGallons)}
      ${numberField('tractor', 'estimatedFuelRangeMiles', 'Estimated range, mi', facts.estimatedFuelRangeMiles)}
      ${numberField('tractor', 'governedSpeedMph', 'Governed speed, mph', facts.governedSpeedMph)}
      ${numberField('tractor', 'planningCruiseSpeedMph', 'Planning cruise speed, mph', facts.planningCruiseSpeedMph)}
    </div>
    <div class="grid three">${checkField('tractor', 'hazmatEquipped', 'Hazmat equipped', facts.hazmatEquipped)}${checkField('tractor', 'idleAllowed', 'Idling allowed', facts.idleAllowed)}${checkField('tractor', 'auxiliaryPowerUnitAvailable', 'APU available', facts.auxiliaryPowerUnitAvailable)}</div>
    <div class="grid two"><label class="field"><span>California compliance status</span><select data-stage18-equipment-kind="tractor" data-stage18-field="californiaComplianceStatus"><option value="not-evaluated"${selected(facts.californiaComplianceStatus, 'not-evaluated')}>Not evaluated</option><option value="carrier-asserted-compliant"${selected(facts.californiaComplianceStatus, 'carrier-asserted-compliant')}>Carrier asserted compliant</option><option value="carrier-asserted-noncompliant"${selected(facts.californiaComplianceStatus, 'carrier-asserted-noncompliant')}>Carrier asserted noncompliant</option><option value="manual-verification-required"${selected(facts.californiaComplianceStatus, 'manual-verification-required')}>Manual verification required</option></select></label>${textField('tractor', 'californiaComplianceSource', 'Compliance source', facts.californiaComplianceSource)}${textField('tractor', 'californiaComplianceVerifiedAt', 'Verified timestamp with offset', facts.californiaComplianceVerifiedAt)}${textField('tractor', 'californiaComplianceExplanation', 'Compliance explanation', facts.californiaComplianceExplanation)}</div>
    ${evidenceFields('tractor', facts.sourceType, facts.sourceName)}
    ${textareaField('tractor', 'notes', 'Tractor notes', facts.notes, 'Operational notes only. Legal authority remains server-side.')}
  </details>`;
}

function renderTrailer(facts: TrailerProfileFacts): string {
  return `<details open class="subpanel"><summary>Trailer profile</summary>
    <label class="field"><span>Reuse existing trailer</span><select data-stage18-profile-select="trailer">${profileOptions(cache.trailers, facts.id)}</select></label>
    <div class="grid three">
      ${textField('trailer', 'trailerNumber', 'Trailer number', facts.trailerNumber)}
      <label class="field"><span>Trailer type</span><select data-stage18-equipment-kind="trailer" data-stage18-field="trailerType"><option value="dry-van"${selected(facts.trailerType, 'dry-van')}>Dry van</option><option value="refrigerated"${selected(facts.trailerType, 'refrigerated')}>Refrigerated</option><option value="flatbed"${selected(facts.trailerType, 'flatbed')}>Flatbed</option><option value="similar-general-freight"${selected(facts.trailerType, 'similar-general-freight')}>Similar general freight</option></select></label>
      ${numberField('trailer', 'axleCount', 'Axle count', facts.axleCount)}
      ${numberField('trailer', 'lengthFeet', 'Length, ft', facts.lengthFeet)}
      ${numberField('trailer', 'heightFeet', 'Height, ft', facts.heightFeet)}
      ${numberField('trailer', 'widthInches', 'Width, in', facts.widthInches)}
      <label class="field"><span>Axle configuration</span><select data-stage18-equipment-kind="trailer" data-stage18-field="axleConfiguration"><option value="fixed"${selected(facts.axleConfiguration, 'fixed')}>Fixed</option><option value="sliding"${selected(facts.axleConfiguration, 'sliding')}>Sliding</option></select></label>
      ${numberField('trailer', 'currentKpraFeet', 'Current KPRA, ft', facts.currentKpraFeet)}
      ${numberField('trailer', 'minimumKpraFeet', 'Minimum KPRA, ft', facts.minimumKpraFeet)}
      ${numberField('trailer', 'maximumKpraFeet', 'Maximum KPRA, ft', facts.maximumKpraFeet)}
      ${textField('trailer', 'currentRailPosition', 'Current rail position', facts.currentRailPosition)}
      ${numberField('trailer', 'emptyWeightPounds', 'Empty weight, lb', facts.emptyWeightPounds)}
      ${numberField('trailer', 'grossVehicleWeightRatingPounds', 'GVWR, lb', facts.grossVehicleWeightRatingPounds)}
      ${numberField('trailer', 'maximumPayloadPounds', 'Maximum payload, lb', facts.maximumPayloadPounds)}
    </div>
    <div class="grid three">${checkField('trailer', 'slidingTandemCapability', 'Sliding tandem capable', facts.slidingTandemCapability)}${checkField('trailer', 'reefer', 'Reefer', facts.reefer)}${checkField('trailer', 'liftgate', 'Liftgate', facts.liftgate)}</div>
    ${textareaField('trailer', 'railPositionMappingsText', 'Verified rail mappings', facts.railPositionMappingsText, 'One line: rail position|KPRA feet|verification source|verified timestamp with offset|explanation')}
    ${textareaField('trailer', 'specialEquipmentText', 'Special equipment', facts.specialEquipmentText, 'Comma or line separated.')}
    ${evidenceFields('trailer', facts.sourceType, facts.sourceName)}
    ${textareaField('trailer', 'notes', 'Trailer notes', facts.notes, 'Operational notes only.')}
  </details>`;
}

function renderLoad(facts: LoadProfileFacts): string {
  return `<details open class="subpanel"><summary>Load profile</summary>
    <label class="field"><span>Reuse existing load</span><select data-stage18-profile-select="load">${profileOptions(cache.loads, facts.id)}</select></label>
    <div class="grid three">
      ${textField('load', 'loadIdentifier', 'Load identifier', facts.loadIdentifier)}
      ${textField('load', 'commodity', 'Commodity', facts.commodity)}
      ${textField('load', 'hazmatClass', 'Hazmat class', facts.hazmatClass)}
      ${numberField('load', 'grossCargoWeightPounds', 'Cargo weight, lb', facts.grossCargoWeightPounds)}
      ${numberField('load', 'steerAxleWeightPounds', 'Steer axle weight, lb', facts.steerAxleWeightPounds)}
      ${numberField('load', 'driveAxleWeightPounds', 'Drive axle weight, lb', facts.driveAxleWeightPounds)}
      ${numberField('load', 'trailerAxleWeightPounds', 'Trailer axle weight, lb', facts.trailerAxleWeightPounds)}
      ${numberField('load', 'totalGrossCombinationWeightPounds', 'Total gross combination, lb', facts.totalGrossCombinationWeightPounds)}
      ${numberField('load', 'lengthFeet', 'Load length, ft', facts.lengthFeet)}
      ${numberField('load', 'widthFeet', 'Load width, ft', facts.widthFeet)}
      ${numberField('load', 'heightFeet', 'Load height, ft', facts.heightFeet)}
      ${numberField('load', 'frontOverhangFeet', 'Front overhang, ft', facts.frontOverhangFeet)}
      ${numberField('load', 'rearOverhangFeet', 'Rear overhang, ft', facts.rearOverhangFeet)}
    </div>
    <div class="grid two">${checkField('load', 'hazmat', 'Hazmat load', facts.hazmat)}${checkField('load', 'reeferRequired', 'Reefer required', facts.reeferRequired)}</div>
    <div class="grid three"><label class="field"><span>Minimum temperature, F</span><input data-stage18-equipment-kind="load" data-stage18-field="minimumTemperatureFahrenheit" type="number" step="any" value="${numeric(facts.minimumTemperatureFahrenheit)}"></label><label class="field"><span>Maximum temperature, F</span><input data-stage18-equipment-kind="load" data-stage18-field="maximumTemperatureFahrenheit" type="number" step="any" value="${numeric(facts.maximumTemperatureFahrenheit)}"></label><label class="field"><span>Set point, F</span><input data-stage18-equipment-kind="load" data-stage18-field="setPointTemperatureFahrenheit" type="number" step="any" value="${numeric(facts.setPointTemperatureFahrenheit)}"></label></div>
    ${textField('load', 'temperatureExplanation', 'Temperature explanation', facts.temperatureExplanation)}
    <div class="grid two"><label class="field"><span>Permit requirement</span><select data-stage18-equipment-kind="load" data-stage18-field="permitRequirement"><option value="unknown"${selected(facts.permitRequirement, 'unknown')}>Unknown</option><option value="not-required"${selected(facts.permitRequirement, 'not-required')}>Not required</option><option value="required"${selected(facts.permitRequirement, 'required')}>Required</option></select></label><label class="field"><span>Secure parking</span><select data-stage18-equipment-kind="load" data-stage18-field="secureParkingRequirement"><option value="none"${selected(facts.secureParkingRequirement, 'none')}>None</option><option value="high-value"${selected(facts.secureParkingRequirement, 'high-value')}>High value</option><option value="secure-parking"${selected(facts.secureParkingRequirement, 'secure-parking')}>Secure parking</option><option value="high-value-and-secure-parking"${selected(facts.secureParkingRequirement, 'high-value-and-secure-parking')}>High value and secure parking</option></select></label></div>
    ${textareaField('load', 'permitsText', 'Permits', facts.permitsText, 'One line: permit ID|jurisdiction|restriction one;restriction two')}
    ${textareaField('load', 'escortRequirementsText', 'Escort requirements', facts.escortRequirementsText, 'Comma or line separated.')}
    ${textareaField('load', 'routeRestrictionsText', 'Load route restrictions', facts.routeRestrictionsText, 'Comma or line separated.')}
    ${evidenceFields('load', facts.sourceType, facts.sourceName)}
    ${textareaField('load', 'notes', 'Load notes', facts.notes, 'Operational notes only.')}
  </details>`;
}

function routeEditor(facts: Stage18CompleteFacts): string {
  const avoid = new Set(facts.route.avoidances);
  const option = (value: string, label: string): string =>
    `<label class="check"><input data-stage18-route-avoidance="${value}" type="checkbox"${checked(avoid.has(value as never))}> ${label}</label>`;
  return `<details open class="subpanel"><summary>Commercial route choices</summary><label class="field"><span>Route policy</span><select data-stage18-route-policy><option value="">Choose policy</option><option value="fastest-compliant"${selected(facts.route.policy, 'fastest-compliant')}>Fastest compliant</option><option value="shortest-compliant"${selected(facts.route.policy, 'shortest-compliant')}>Shortest compliant</option><option value="balanced-compliant"${selected(facts.route.policy, 'balanced-compliant')}>Balanced compliant</option></select></label><div class="grid two">${option('tolls', 'Avoid tolls')}${option('ferries', 'Avoid ferries')}${option('tunnels', 'Avoid tunnels')}${option('uncontrolled-border-crossings', 'Avoid uncontrolled border crossings')}${option('unpaved-roads', 'Avoid unpaved roads')}${option('seasonal-roads', 'Avoid seasonal roads')}${option('hazmat-restricted-roads', 'Avoid hazmat-restricted roads')}${option('permit-only-roads', 'Avoid permit-only roads')}</div><p class="hint">These are explicit planning choices, not legal conclusions.</p></details>`;
}

export function renderDriverOptions(facts: Stage18CompleteFacts): string {
  return `<div data-stage18-driver-enhanced><label class="field"><span>Reuse existing driver</span><select data-stage18-driver-select>${profileOptions(cache.drivers, facts.driver.id)}</select></label><p class="hint">Choose an existing driver, or edit the driver-name field to create a new reusable profile.</p></div>`;
}

export function renderEquipmentHost(facts: Stage18CompleteFacts): string {
  return `${renderTractor(facts.tractor)}${renderTrailer(facts.trailer)}${renderLoad(facts.load)}${routeEditor(facts)}`;
}

-- Stage 09: equipment and load profile details.
-- Existing Tractor, Trailer, and Load identity tables remain authoritative for
-- their original columns. The detail tables extend them without rewriting
-- prior migrations or weakening trip-revision references.

CREATE TABLE "tractor_profile_details" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "tractorId" UUID NOT NULL,
  "vin" TEXT,
  "tractorType" TEXT NOT NULL,
  "axleCount" INTEGER NOT NULL,
  "wheelbaseValue" DECIMAL(18,6),
  "wheelbaseUnit" TEXT DEFAULT 'inch',
  "emptyWeightValue" DECIMAL(18,6),
  "emptyWeightUnit" TEXT DEFAULT 'pound',
  "registeredGrossWeightValue" DECIMAL(18,6),
  "registeredGrossWeightUnit" TEXT DEFAULT 'pound',
  "fuelCapacityValue" DECIMAL(18,6),
  "fuelCapacityUnit" TEXT DEFAULT 'us-gallon',
  "estimatedFuelRangeValue" DECIMAL(18,6),
  "estimatedFuelRangeUnit" TEXT DEFAULT 'meter',
  "governedSpeedValue" DECIMAL(18,6),
  "governedSpeedUnit" TEXT DEFAULT 'meter-per-second',
  "planningCruiseSpeedValue" DECIMAL(18,6),
  "planningCruiseSpeedUnit" TEXT DEFAULT 'meter-per-second',
  "hazmatEquipped" BOOLEAN NOT NULL,
  "californiaComplianceStatus" TEXT NOT NULL,
  "californiaComplianceSource" TEXT,
  "californiaComplianceVerifiedAt" TIMESTAMPTZ(3),
  "californiaComplianceExplanation" TEXT,
  "idleAllowed" BOOLEAN NOT NULL,
  "auxiliaryPowerUnitAvailable" BOOLEAN NOT NULL,
  "estimatedIdleFuelRateValue" DECIMAL(18,6),
  "estimatedIdleFuelRateUnit" TEXT DEFAULT 'us-gallon-per-hour',
  "estimatedAuxiliaryPowerFuelRateValue" DECIMAL(18,6),
  "estimatedAuxiliaryPowerFuelRateUnit" TEXT DEFAULT 'us-gallon-per-hour',
  "idleAuxiliaryPowerExplanation" TEXT,
  "notes" TEXT,
  "fieldEvidence" JSONB NOT NULL,
  "extensionMetadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tractor_profile_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tractor_profile_details_tractorId_fkey" FOREIGN KEY ("tractorId") REFERENCES "tractors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tractor_profile_details_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tractor_profile_details_axle_count_check" CHECK ("axleCount" > 0),
  CONSTRAINT "tractor_profile_details_type_check" CHECK ("tractorType" IN ('day-cab', 'sleeper', 'cabover', 'other')),
  CONSTRAINT "tractor_profile_details_vin_check" CHECK ("vin" IS NULL OR "vin" ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  CONSTRAINT "tractor_profile_details_units_check" CHECK (
    ("wheelbaseValue" IS NULL OR ("wheelbaseValue" > 0 AND "wheelbaseUnit" = 'inch')) AND
    ("emptyWeightValue" IS NULL OR ("emptyWeightValue" > 0 AND "emptyWeightUnit" = 'pound')) AND
    ("registeredGrossWeightValue" IS NULL OR ("registeredGrossWeightValue" > 0 AND "registeredGrossWeightUnit" = 'pound')) AND
    ("fuelCapacityValue" IS NULL OR ("fuelCapacityValue" > 0 AND "fuelCapacityUnit" = 'us-gallon')) AND
    ("estimatedFuelRangeValue" IS NULL OR ("estimatedFuelRangeValue" > 0 AND "estimatedFuelRangeUnit" = 'meter')) AND
    ("governedSpeedValue" IS NULL OR ("governedSpeedValue" > 0 AND "governedSpeedUnit" = 'meter-per-second')) AND
    ("planningCruiseSpeedValue" IS NULL OR ("planningCruiseSpeedValue" > 0 AND "planningCruiseSpeedUnit" = 'meter-per-second')) AND
    ("estimatedIdleFuelRateValue" IS NULL OR ("estimatedIdleFuelRateValue" >= 0 AND "estimatedIdleFuelRateUnit" = 'us-gallon-per-hour')) AND
    ("estimatedAuxiliaryPowerFuelRateValue" IS NULL OR ("estimatedAuxiliaryPowerFuelRateValue" >= 0 AND "estimatedAuxiliaryPowerFuelRateUnit" = 'us-gallon-per-hour'))
  ),
  CONSTRAINT "tractor_profile_details_speed_check" CHECK (
    "planningCruiseSpeedValue" IS NULL OR "governedSpeedValue" IS NULL OR "planningCruiseSpeedValue" <= "governedSpeedValue"
  ),
  CONSTRAINT "tractor_profile_details_california_status_check" CHECK (
    "californiaComplianceStatus" IN ('not-evaluated', 'carrier-asserted-compliant', 'carrier-asserted-noncompliant', 'manual-verification-required')
  )
);

CREATE UNIQUE INDEX "tractor_profile_details_tractorId_key" ON "tractor_profile_details"("tractorId");
CREATE UNIQUE INDEX "tractor_profile_details_tractorId_carrierId_key" ON "tractor_profile_details"("tractorId", "carrierId");
CREATE INDEX "tractor_profile_details_carrierId_tractorType_idx" ON "tractor_profile_details"("carrierId", "tractorType");

CREATE TABLE "trailer_profile_details" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "trailerId" UUID NOT NULL,
  "axleCount" INTEGER NOT NULL,
  "slidingTandemCapability" BOOLEAN NOT NULL,
  "axleConfiguration" TEXT NOT NULL,
  "minimumKpraValue" DECIMAL(18,6),
  "minimumKpraUnit" TEXT DEFAULT 'inch',
  "maximumKpraValue" DECIMAL(18,6),
  "maximumKpraUnit" TEXT DEFAULT 'inch',
  "currentRailPosition" TEXT,
  "emptyWeightValue" DECIMAL(18,6),
  "emptyWeightUnit" TEXT DEFAULT 'pound',
  "maximumPayloadValue" DECIMAL(18,6),
  "maximumPayloadUnit" TEXT DEFAULT 'pound',
  "reefer" BOOLEAN NOT NULL,
  "liftgate" BOOLEAN NOT NULL,
  "specialEquipment" JSONB NOT NULL,
  "notes" TEXT,
  "fieldEvidence" JSONB NOT NULL,
  "extensionMetadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "trailer_profile_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trailer_profile_details_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "trailer_profile_details_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "trailer_profile_details_axle_count_check" CHECK ("axleCount" > 0),
  CONSTRAINT "trailer_profile_details_configuration_check" CHECK (
    ("axleConfiguration" = 'fixed' AND NOT "slidingTandemCapability") OR
    ("axleConfiguration" = 'sliding' AND "slidingTandemCapability")
  ),
  CONSTRAINT "trailer_profile_details_units_check" CHECK (
    ("minimumKpraValue" IS NULL OR ("minimumKpraValue" > 0 AND "minimumKpraUnit" = 'inch')) AND
    ("maximumKpraValue" IS NULL OR ("maximumKpraValue" > 0 AND "maximumKpraUnit" = 'inch')) AND
    ("emptyWeightValue" IS NULL OR ("emptyWeightValue" > 0 AND "emptyWeightUnit" = 'pound')) AND
    ("maximumPayloadValue" IS NULL OR ("maximumPayloadValue" > 0 AND "maximumPayloadUnit" = 'pound'))
  ),
  CONSTRAINT "trailer_profile_details_kpra_range_check" CHECK (
    "minimumKpraValue" IS NULL OR "maximumKpraValue" IS NULL OR "minimumKpraValue" <= "maximumKpraValue"
  ),
  CONSTRAINT "trailer_profile_details_fixed_range_check" CHECK (
    "axleConfiguration" <> 'fixed' OR "minimumKpraValue" IS NULL OR "maximumKpraValue" IS NULL OR "minimumKpraValue" = "maximumKpraValue"
  )
);

CREATE UNIQUE INDEX "trailer_profile_details_trailerId_key" ON "trailer_profile_details"("trailerId");
CREATE UNIQUE INDEX "trailer_profile_details_trailerId_carrierId_key" ON "trailer_profile_details"("trailerId", "carrierId");
CREATE INDEX "trailer_profile_details_carrierId_axleConfiguration_idx" ON "trailer_profile_details"("carrierId", "axleConfiguration");

CREATE TABLE "trailer_rail_position_mappings" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "trailerId" UUID NOT NULL,
  "railPosition" TEXT NOT NULL,
  "kpraValue" DECIMAL(18,6) NOT NULL,
  "kpraUnit" TEXT NOT NULL DEFAULT 'inch',
  "verificationSource" TEXT NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
  "explanation" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trailer_rail_position_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trailer_rail_position_mappings_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "trailer_rail_position_mappings_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "trailer_rail_position_mappings_kpra_check" CHECK ("kpraValue" > 0 AND "kpraUnit" = 'inch'),
  CONSTRAINT "trailer_rail_position_mappings_text_check" CHECK (length(btrim("railPosition")) > 0 AND length(btrim("verificationSource")) > 0)
);

CREATE UNIQUE INDEX "trailer_rail_position_mappings_trailerId_railPosition_key" ON "trailer_rail_position_mappings"("trailerId", "railPosition");
CREATE UNIQUE INDEX "trailer_rail_position_mappings_id_carrierId_key" ON "trailer_rail_position_mappings"("id", "carrierId");
CREATE INDEX "trailer_rail_position_mappings_carrierId_trailerId_idx" ON "trailer_rail_position_mappings"("carrierId", "trailerId");

CREATE TABLE "load_profile_details" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "loadId" UUID NOT NULL,
  "commodity" TEXT NOT NULL,
  "hazmat" BOOLEAN NOT NULL,
  "hazmatClass" TEXT,
  "steerAxleWeightValue" DECIMAL(18,6),
  "steerAxleWeightUnit" TEXT DEFAULT 'pound',
  "driveAxleWeightValue" DECIMAL(18,6),
  "driveAxleWeightUnit" TEXT DEFAULT 'pound',
  "trailerAxleWeightValue" DECIMAL(18,6),
  "trailerAxleWeightUnit" TEXT DEFAULT 'pound',
  "totalGrossCombinationWeightValue" DECIMAL(18,6),
  "totalGrossCombinationWeightUnit" TEXT DEFAULT 'pound',
  "lengthValue" DECIMAL(18,6),
  "lengthUnit" TEXT DEFAULT 'inch',
  "widthValue" DECIMAL(18,6),
  "widthUnit" TEXT DEFAULT 'inch',
  "heightValue" DECIMAL(18,6),
  "heightUnit" TEXT DEFAULT 'inch',
  "frontOverhangValue" DECIMAL(18,6),
  "frontOverhangUnit" TEXT DEFAULT 'inch',
  "rearOverhangValue" DECIMAL(18,6),
  "rearOverhangUnit" TEXT DEFAULT 'inch',
  "reeferRequired" BOOLEAN,
  "minimumTemperatureValue" DECIMAL(18,6),
  "minimumTemperatureUnit" TEXT DEFAULT 'celsius',
  "maximumTemperatureValue" DECIMAL(18,6),
  "maximumTemperatureUnit" TEXT DEFAULT 'celsius',
  "temperatureSetPointValue" DECIMAL(18,6),
  "temperatureSetPointUnit" TEXT DEFAULT 'celsius',
  "temperatureExplanation" TEXT,
  "permitRequirement" TEXT NOT NULL,
  "permits" JSONB NOT NULL,
  "escortRequirements" JSONB NOT NULL,
  "routeRestrictions" JSONB NOT NULL,
  "secureParkingRequirement" TEXT NOT NULL,
  "notes" TEXT,
  "fieldEvidence" JSONB NOT NULL,
  "extensionMetadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "load_profile_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "load_profile_details_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "loads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "load_profile_details_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "load_profile_details_hazmat_check" CHECK (NOT "hazmat" OR ("hazmatClass" IS NOT NULL AND length(btrim("hazmatClass")) > 0)),
  CONSTRAINT "load_profile_details_permit_requirement_check" CHECK ("permitRequirement" IN ('not-required', 'required', 'unknown')),
  CONSTRAINT "load_profile_details_permit_data_check" CHECK ("permitRequirement" <> 'required' OR jsonb_array_length("permits") > 0),
  CONSTRAINT "load_profile_details_secure_parking_check" CHECK ("secureParkingRequirement" IN ('none', 'high-value', 'secure-parking', 'high-value-and-secure-parking')),
  CONSTRAINT "load_profile_details_units_check" CHECK (
    ("steerAxleWeightValue" IS NULL OR ("steerAxleWeightValue" > 0 AND "steerAxleWeightUnit" = 'pound')) AND
    ("driveAxleWeightValue" IS NULL OR ("driveAxleWeightValue" > 0 AND "driveAxleWeightUnit" = 'pound')) AND
    ("trailerAxleWeightValue" IS NULL OR ("trailerAxleWeightValue" > 0 AND "trailerAxleWeightUnit" = 'pound')) AND
    ("totalGrossCombinationWeightValue" IS NULL OR ("totalGrossCombinationWeightValue" > 0 AND "totalGrossCombinationWeightUnit" = 'pound')) AND
    ("lengthValue" IS NULL OR ("lengthValue" > 0 AND "lengthUnit" = 'inch')) AND
    ("widthValue" IS NULL OR ("widthValue" > 0 AND "widthUnit" = 'inch')) AND
    ("heightValue" IS NULL OR ("heightValue" > 0 AND "heightUnit" = 'inch')) AND
    ("frontOverhangValue" IS NULL OR ("frontOverhangValue" >= 0 AND "frontOverhangUnit" = 'inch')) AND
    ("rearOverhangValue" IS NULL OR ("rearOverhangValue" >= 0 AND "rearOverhangUnit" = 'inch')) AND
    ("minimumTemperatureValue" IS NULL OR "minimumTemperatureUnit" = 'celsius') AND
    ("maximumTemperatureValue" IS NULL OR "maximumTemperatureUnit" = 'celsius') AND
    ("temperatureSetPointValue" IS NULL OR "temperatureSetPointUnit" = 'celsius')
  ),
  CONSTRAINT "load_profile_details_axle_gross_check" CHECK (
    "totalGrossCombinationWeightValue" IS NULL OR
    "totalGrossCombinationWeightValue" >= COALESCE("steerAxleWeightValue", 0) + COALESCE("driveAxleWeightValue", 0) + COALESCE("trailerAxleWeightValue", 0)
  ),
  CONSTRAINT "load_profile_details_temperature_range_check" CHECK (
    ("minimumTemperatureValue" IS NULL OR "maximumTemperatureValue" IS NULL OR "minimumTemperatureValue" <= "maximumTemperatureValue") AND
    ("temperatureSetPointValue" IS NULL OR "minimumTemperatureValue" IS NULL OR "temperatureSetPointValue" >= "minimumTemperatureValue") AND
    ("temperatureSetPointValue" IS NULL OR "maximumTemperatureValue" IS NULL OR "temperatureSetPointValue" <= "maximumTemperatureValue")
  ),
  CONSTRAINT "load_profile_details_overhang_check" CHECK (
    ("frontOverhangValue" IS NULL OR "lengthValue" IS NULL OR "frontOverhangValue" <= "lengthValue") AND
    ("rearOverhangValue" IS NULL OR "lengthValue" IS NULL OR "rearOverhangValue" <= "lengthValue")
  )
);

CREATE UNIQUE INDEX "load_profile_details_loadId_key" ON "load_profile_details"("loadId");
CREATE UNIQUE INDEX "load_profile_details_loadId_carrierId_key" ON "load_profile_details"("loadId", "carrierId");
CREATE INDEX "load_profile_details_carrierId_hazmat_permitRequirement_idx" ON "load_profile_details"("carrierId", "hazmat", "permitRequirement");

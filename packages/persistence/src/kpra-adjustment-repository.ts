import {
  kpraAdjustmentEvidenceSnapshot,
  validateKpraAdjustmentEvidence,
} from '@trip-route-calc/foundation';
import type { KpraAdjustmentEvidence } from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import { asInputJson, toDate } from './repository-shared.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

export interface CaptureKpraAdjustmentEvidenceInput {
  readonly evidence: KpraAdjustmentEvidence;
  readonly reason: string;
}

export interface CapturedKpraAdjustmentEvidence {
  readonly acknowledgementId: string;
  readonly auditEventId: string;
}

export class KpraAdjustmentRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async captureAdjustmentEvidence(
    input: CaptureKpraAdjustmentEvidenceInput,
  ): Promise<CapturedKpraAdjustmentEvidence> {
    await assertTenantMembership(this.client, this.context);
    const evidence = validateKpraAdjustmentEvidence(input.evidence);

    return this.client.$transaction(async (transaction) => {
      const revisions = await transaction.tripRevision.findMany({
        where: {
          carrierId: this.context.carrierId,
          id: {
            in: [
              evidence.originalTripRevisionId,
              evidence.recalculationTripRevisionId,
            ],
          },
        },
        select: {
          id: true,
          tripId: true,
          revisionNumber: true,
          ruleSetVersion: true,
        },
      });
      const original = revisions.find(
        (revision) => revision.id === evidence.originalTripRevisionId,
      );
      const recalculation = revisions.find(
        (revision) => revision.id === evidence.recalculationTripRevisionId,
      );
      if (original === undefined || recalculation === undefined) {
        throw new TenantObjectNotFoundError(
          'Both KPRA trip revisions must exist in the requested carrier account.',
        );
      }
      if (original.tripId !== recalculation.tripId) {
        throw new RangeError(
          'KPRA revalidation revisions must belong to the same trip.',
        );
      }
      if (recalculation.revisionNumber <= original.revisionNumber) {
        throw new RangeError(
          'The KPRA recalculation revision must follow the original revision.',
        );
      }
      if (recalculation.ruleSetVersion !== evidence.action.ruleSetVersion) {
        throw new RangeError(
          'The recalculation revision must retain the action rule-set version.',
        );
      }

      const warning = await transaction.complianceWarning.findFirst({
        where: {
          carrierId: this.context.carrierId,
          tripRevisionId: original.id,
          code: evidence.action.findingId,
        },
      });
      if (warning === null) {
        throw new TenantObjectNotFoundError(
          'The original KPRA compliance warning was not found in the requested carrier account.',
        );
      }
      if (
        warning.sourceReference !== null &&
        warning.sourceReference !== evidence.action.source.reference
      ) {
        throw new RangeError(
          'The KPRA action source does not match the persisted warning source.',
        );
      }

      const existingAcknowledgement =
        await transaction.warningAcknowledgement.findFirst({
          where: {
            carrierId: this.context.carrierId,
            warningId: warning.id,
            userId: this.context.actorUserId,
          },
          select: { id: true },
        });
      if (existingAcknowledgement !== null) {
        throw new RangeError(
          'This user has already captured acknowledgement evidence for the KPRA warning.',
        );
      }

      const acknowledgement =
        await transaction.warningAcknowledgement.create({
          data: {
            carrierId: this.context.carrierId,
            warningId: warning.id,
            userId: this.context.actorUserId,
            acknowledgedAt: toDate(evidence.confirmation.acknowledgedAt),
            note:
              evidence.confirmation.note ??
              `KPRA resolution selected: ${evidence.confirmation.resolution}`,
          },
          select: { id: true },
        });

      const auditEvent = await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'kpra-adjustment',
          entityId: recalculation.id,
          action: 'kpra-adjustment-revalidated',
          metadata: asInputJson(
            {
              evidence: kpraAdjustmentEvidenceSnapshot(evidence),
              originalWarningId: warning.id,
              reason: input.reason,
            },
            'audit.metadata',
          ),
        },
        select: { id: true },
      });

      return {
        acknowledgementId: acknowledgement.id,
        auditEventId: auditEvent.id,
      };
    });
  }
}

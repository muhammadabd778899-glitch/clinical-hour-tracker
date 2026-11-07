/** Loads the data needed by the Record Quality Check and runs the domain rules. */
import {
  activityRepository,
  categoryRepository,
  ceuRepository,
  renewalPeriodRepository,
  requirementRepository,
  type Db,
} from '@/repositories';
import { runQualityCheck, summarizeIssues, type QualityIssue, type QualitySummary } from '@/domain/quality';

export async function runQualityCheckForUser(db?: Db): Promise<QualityIssue[]> {
  const [activities, categories, ceus, renewalPeriods, requirements] = await Promise.all([
    activityRepository.list(db),
    categoryRepository.list(db),
    ceuRepository.list(db),
    renewalPeriodRepository.list(db),
    requirementRepository.list(db),
  ]);
  return runQualityCheck({ activities, categories, ceus, renewalPeriods, requirements });
}

export type { QualityIssue, QualitySummary };
export { summarizeIssues };

/**
 * Resolve the path to a lab's markdown source.
 *
 * Two valid locations:
 *   1. LAB_REPO_ROOT env var → reads from `<repo>/labs/lab<N>.md` (canonical
 *      during the iterate-and-test loop; what the EC2 walkthrough uses).
 *   2. Fallback: the Google Drive `iteration_1/` directory on the local
 *      Windows machine. Lets local development work without a repo clone.
 *
 * When the lab is "done" and ready to publish, Stage 6b takes the repo MD
 * and regenerates the Google Doc.
 */

import * as path from 'path';

const DEFAULT_DRIVE_ROOT =
  'I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/labforge_iterations/iteration_1';

const DRIVE_FILENAMES: Record<number, string> = {
  1: 'Lab_01_Multi_Environment_State_Strategy.md',
  2: 'Lab_02_Import_Legacy_Application.md',
  3: 'Lab_03_Pipeline_Operations.md',
  4: 'Lab_04_Auditing_and_Observability.md',
};

export function labSourcePath(labNumber: number): string {
  const repoRoot = process.env.LAB_REPO_ROOT;
  if (repoRoot) {
    return path.join(repoRoot, 'labs', `lab${labNumber}.md`);
  }
  return path.join(DEFAULT_DRIVE_ROOT, DRIVE_FILENAMES[labNumber]);
}

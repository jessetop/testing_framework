/**
 * IO-107 — Lab markdown source resolver + fixture-monorepo metadata.
 *
 * Lab markdown lives at:
 *   1. LAB_REPO_ROOT env var → `<repo>/labs/lab<N>.md` (canonical during the
 *      iterate-and-test loop).
 *   2. Fallback: Google Drive — what CourseCreationKit + labforge generate
 *      and what the SYF/IO-107 course folder canonically holds.
 *
 * Lab code lives at https://github.com/roi-cloud-fun/io-107 — ONE monorepo,
 * with each lab in its own `lab_<N>/` subdirectory. The per-student CodeCommit
 * mirrors that monorepo's `lab_<N>/` subdir (flattened) so students experience
 * "one repo per lab" while authors maintain a single source-of-truth.
 */

import * as path from 'path';

const DEFAULT_DRIVE_ROOT =
  'I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/content/labs';

const DRIVE_FILENAMES: Record<number, string> = {
  1: 'Lab_1_Guide.md',
  2: 'Lab_2_Guide.md',
  3: 'Lab_3_Guide.md',
  4: 'Lab_4_Guide.md',
};

export function labSourcePath(labNumber: number): string {
  const repoRoot = process.env.LAB_REPO_ROOT;
  if (repoRoot) {
    return path.join(repoRoot, 'labs', `lab${labNumber}.md`);
  }
  return path.join(DEFAULT_DRIVE_ROOT, DRIVE_FILENAMES[labNumber]);
}

/** Path to the lab_env_student Terraform module — the unified module LTF
 *  applies before any lab spec runs. */
export const LAB_ENV_TF_PATH =
  'I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/lab_environment/lab_env_student';

/** Course-level monorepo. All four labs live here as lab_<N>/ subdirs.
 *  The lab_env_student/ Terraform clones this at apply time and seeds each
 *  per-student CodeCommit with the matching subdir's flattened contents. */
export const COURSE_MONOREPO = {
  url:   'https://github.com/roi-cloud-fun/io-107.git',
  owner: 'roi-cloud-fun',
  name:  'io-107',
  /** Repo-relative subdir for each lab. The seed extracts these into
   *  per-student CodeCommit repos, flattened to root. */
  subdirs: {
    1: 'lab_1',
    2: 'lab_2',
    3: 'lab_3',
    4: 'lab_4',
  } as Record<number, string>,
} as const;

/** @deprecated Use COURSE_MONOREPO + per-student CodeCommit URLs from
 *  `terraform output`. Kept for any historical specs still referencing
 *  the legacy per-lab GitHub fixtures under jessetop. */
export const FIXTURE_REPOS: Record<number, { url: string; owner: string; name: string }> = {
  1: { url: 'https://github.com/jessetop/io107-lab1-eks-app.git',           owner: 'jessetop', name: 'io107-lab1-eks-app' },
  2: { url: 'https://github.com/jessetop/io107-lab2-sam-app.git',           owner: 'jessetop', name: 'io107-lab2-sam-app' },
  3: { url: 'https://github.com/jessetop/io107-lab3-policy-violations.git', owner: 'jessetop', name: 'io107-lab3-policy-violations' },
  4: { url: 'https://github.com/jessetop/io107-lab4-aurora-bluegreen.git',  owner: 'jessetop', name: 'io107-lab4-aurora-bluegreen' },
};

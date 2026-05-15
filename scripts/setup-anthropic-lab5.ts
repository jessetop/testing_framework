#!/usr/bin/env npx ts-node

/**
 * Setup Script: Anthropic Lab 5 (Media & Entertainment)
 * Creates S3 documents for the Content Intelligence Platform lab.
 *
 * Usage: npx ts-node scripts/setup-anthropic-lab5.ts [--teardown]
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0 && !process.env[t.substring(0, i)]) process.env[t.substring(0, i)] = t.substring(i + 1).replace(/^"|"$/g, ''); }
  }
}

const accountId = process.env.AWS_ACCOUNT_ID || '';
const region = process.env.AWS_REGION || 'us-east-1';
const profile = 'roitraining';
const bucketName = `bedrock-training-${accountId}`;
const prefix = 'lab5-media';
const awsBase = `aws --profile ${profile} --region ${region}`;

const documents = [
  { filename: 'content_catalog.txt', content: `StreamVault — Content Catalog (Fictional)
Last Updated: January 2025

ACTION/ADVENTURE
- "Iron Frontier" (2024) | Rating: TV-14 | Genre: Sci-Fi Action | 8 episodes
  A retired military pilot discovers an alien artifact that grants superhuman abilities. Stars Alex Chen.
  Tags: aliens, military, superpowers, drama | Viewer Rating: 4.2/5

- "Storm Chasers" (2023) | Rating: PG-13 | Genre: Action Adventure | Film, 2h 15m
  Three meteorologists race to deploy experimental tornado-stopping technology. High-octane practical effects.
  Tags: weather, science, adventure, disaster | Viewer Rating: 3.8/5

- "The Last Expedition" (2024) | Rating: TV-MA | Genre: Survival Thriller | 10 episodes
  An archaeological team discovers a hidden civilization beneath the Antarctic ice shelf.
  Tags: archaeology, survival, mystery, Antarctica | Viewer Rating: 4.5/5

COMEDY
- "Debugging Love" (2024) | Rating: TV-14 | Genre: Romantic Comedy | 6 episodes
  Two rival software engineers are forced to pair-program on a deadline project and fall for each other.
  Tags: tech, romance, workplace, humor | Viewer Rating: 4.0/5

- "Family Algorithm" (2023) | Rating: PG | Genre: Family Comedy | Film, 1h 45m
  A tech CEO's smart home AI starts giving unsolicited life advice to the whole neighborhood.
  Tags: family, technology, AI, neighborhood | Viewer Rating: 3.5/5

DRAMA
- "Quiet Hours" (2024) | Rating: TV-MA | Genre: Psychological Drama | 8 episodes
  A night-shift nurse uncovers a pattern of unexplained patient deaths at a prestigious hospital.
  Tags: hospital, mystery, psychological, thriller | Viewer Rating: 4.7/5

- "The Conductor" (2023) | Rating: PG-13 | Genre: Biographical Drama | Film, 2h 30m
  The story of a deaf woman who becomes one of the world's greatest orchestra conductors.
  Tags: music, biography, inspiration, disability | Viewer Rating: 4.6/5

DOCUMENTARY
- "Ocean Deep" (2024) | Rating: PG | Genre: Nature Documentary | 4 episodes
  Stunning footage of deep-sea creatures never before filmed, narrated by Dr. Maya Patel.
  Tags: ocean, nature, science, exploration | Viewer Rating: 4.3/5

- "The Algorithm" (2024) | Rating: TV-14 | Genre: Tech Documentary | Film, 1h 50m
  How social media recommendation algorithms shape political opinions and cultural trends.
  Tags: technology, social media, politics, culture | Viewer Rating: 4.1/5

KIDS/FAMILY
- "Cosmic Wanderers" (2024) | Rating: TV-Y7 | Genre: Animated Sci-Fi | 12 episodes
  A group of young space explorers befriend alien species while searching for their lost home planet.
  Tags: animation, space, friendship, adventure | Viewer Rating: 4.4/5

- "Pet Academy" (2023) | Rating: TV-G | Genre: Animated Comedy | 24 episodes
  Talking pets attend a school where they learn to be better companions to their human families.
  Tags: animals, school, comedy, wholesome | Viewer Rating: 3.9/5

HORROR/THRILLER
- "The Hollow" (2024) | Rating: TV-MA | Genre: Horror | 6 episodes
  A family moves to a remote farmhouse where the previous residents disappeared without a trace.
  Tags: horror, haunted house, mystery, rural | Viewer Rating: 4.0/5

SCI-FI
- "Parallel" (2024) | Rating: TV-14 | Genre: Sci-Fi Drama | 10 episodes
  A physicist accidentally opens a portal to a parallel universe where her other self made different life choices.
  Tags: multiverse, physics, drama, identity | Viewer Rating: 4.6/5

- "Neon District" (2023) | Rating: TV-MA | Genre: Cyberpunk | 8 episodes
  In a rain-soaked megacity, a low-level hacker stumbles onto a corporate conspiracy to control human memories.
  Tags: cyberpunk, hacking, corporate, dystopia | Viewer Rating: 4.3/5` },
  { filename: 'viewer_preferences.txt', content: `StreamVault — Viewer Preference Profiles (Anonymized)
Last Updated: January 2025

PROFILE: Sci-Fi Enthusiast (18% of viewers)
- Top genres: Sci-Fi (85%), Action (60%), Documentary (40%)
- Avg session: 2.5 hours
- Binge pattern: completes series within 1 week
- Rating behavior: rates 70% of watched content
- Preferred ratings: TV-14, TV-MA
- Engagement: high (shares, adds to lists)

PROFILE: Family Viewer (25% of viewers)
- Top genres: Kids/Family (90%), Comedy (70%), Documentary (50%)
- Avg session: 1.5 hours
- Binge pattern: 1-2 episodes per day
- Rating behavior: rates 30% of content
- Preferred ratings: TV-G, TV-Y7, PG
- Engagement: moderate (adds to kids profiles)

PROFILE: Drama Lover (22% of viewers)
- Top genres: Drama (80%), Thriller (55%), Documentary (45%)
- Avg session: 2 hours
- Binge pattern: 2-3 episodes per session
- Rating behavior: rates 50% of content, writes reviews
- Preferred ratings: TV-MA, TV-14
- Engagement: high (reviews, recommendations)

PROFILE: Casual Viewer (20% of viewers)
- Top genres: Comedy (65%), Action (50%), varied others
- Avg session: 1 hour
- Binge pattern: infrequent, watches popular titles
- Rating behavior: rarely rates
- Preferred ratings: PG-13, TV-14
- Engagement: low (passive consumption)

PROFILE: Documentary Buff (15% of viewers)
- Top genres: Documentary (90%), Drama (40%), Sci-Fi (30%)
- Avg session: 1.5 hours
- Binge pattern: watches 1 title completely then moves on
- Rating behavior: rates 80% of content, detailed reviews
- Preferred ratings: PG, TV-14
- Engagement: very high (shares, discusses)

TRENDING THIS MONTH:
1. "Quiet Hours" — 4.2M streams (drama surge)
2. "Parallel" — 3.8M streams (sci-fi consistent)
3. "Cosmic Wanderers" — 3.1M streams (kids favorite)
4. "The Last Expedition" — 2.9M streams (adventure buzz)
5. "Ocean Deep" — 2.5M streams (documentary crossover appeal)` },
  { filename: 'content_guidelines.txt', content: `StreamVault — Content Classification Guidelines
Effective: January 2025

AGE RATINGS
TV-G: Suitable for all ages. No violence, no sexual content, no strong language.
TV-Y7: Suitable for ages 7+. Mild fantasy violence, simple conflict resolution.
PG: Parental guidance suggested. Mild action, brief mild language.
TV-14: Parents strongly cautioned. Moderate violence, suggestive themes, infrequent strong language.
TV-MA: Mature audiences only. Graphic violence, sexual content, explicit language.

CONTENT WARNING CATEGORIES
- Violence: mild (cartoon), moderate (action sequences), graphic (realistic injury/death)
- Language: mild (damn, hell), moderate (occasional profanity), strong (frequent/heavy profanity)
- Sexual content: none, suggestive, partial nudity, explicit
- Substance use: none, social drinking, drug use depicted, substance abuse themes
- Thematic elements: death/grief, mental health, discrimination, war/conflict

CLASSIFICATION PROCESS
1. Watch/review complete content
2. Document instances of each warning category with timestamps
3. Assign primary age rating based on most restrictive element
4. Generate content warnings for each applicable category
5. Review by second classifier for consistency
6. Final approval by content standards team

GENRE ASSIGNMENT RULES
- Primary genre: the single best-fit genre
- Secondary genres: up to 2 additional genres
- Genre tags: specific subgenres and themes (unlimited)
- Cross-genre content: list most prominent genre first` },
  { filename: 'moderation_policy.txt', content: `StreamVault — Content Moderation Policy
Effective: January 2025

1. USER-GENERATED CONTENT RULES
   Prohibited:
   - Hate speech, harassment, or threats
   - Spam or commercial solicitation
   - Spoilers without spoiler tags (enforced for 30 days after release)
   - Links to piracy or illegal streaming sites
   - Personal information of others (doxxing)
   - Impersonation of StreamVault staff or content creators

   Allowed:
   - Honest reviews and ratings (including negative ones)
   - Discussion of content themes and quality
   - Recommendations to other users
   - Constructive criticism of platform features

2. AUTOMATED MODERATION TIERS
   Tier 1 (Automatic block): Piracy links, phone numbers, credit cards, hate speech keywords
   Tier 2 (Queue for review): Potential spoilers, borderline language, reported content
   Tier 3 (Community flagging): User reports reviewed within 24 hours

3. ESCALATION PROCEDURES
   - Tier 1 violations: automatic removal, user warning (first offense)
   - Repeated Tier 1: 7-day suspension
   - Tier 2 confirmed: content removed, user notified
   - Severe violations (threats, doxxing): immediate account suspension, legal review

4. AI ASSISTANT RULES
   The StreamVault AI assistant must:
   - Never recommend piracy or illegal streaming alternatives
   - Never reveal major plot spoilers without explicit user consent
   - Never direct users to competing streaming platforms
   - Always respect age rating restrictions for user profiles
   - Report piracy-related queries to the security team` },
  { filename: 'recommendation_rules.txt', content: `StreamVault — Recommendation Engine Rules
Effective: January 2025

1. PERSONALIZATION LOGIC
   - Weight recent viewing (last 30 days) at 3x vs. older history
   - Rating-weighted: 5-star content types preferred 2x over 3-star
   - Genre affinity: calculated from viewing hours, not just count
   - Completion rate: titles watched to completion weighted higher
   - Time-of-day patterns: action/comedy for evening, documentaries for weekends

2. DIVERSITY REQUIREMENTS
   - Maximum 60% of recommendations from user's top genre
   - At least 1 recommendation from an unexplored genre per session
   - New releases (<30 days) get 20% boost in recommendation score
   - StreamVault originals get 10% boost (business priority)

3. CONTENT RESTRICTIONS
   - Kids profiles: only TV-G, TV-Y7, PG content
   - Teen profiles: add TV-14 content
   - Adult profiles: all ratings
   - Parental controls: respect per-profile rating restrictions

4. PROMOTIONAL RULES
   - Featured content: appears in first 3 recommendations max once
   - Promoted content clearly labeled as "Featured" or "Spotlight"
   - Seasonal relevance: holiday content boosted during relevant periods
   - Never recommend content the user has already completed

5. RECOMMENDATION PRESENTATION
   - Primary recommendation: "Because you watched [Title]..."
   - Secondary: "Trending in [Genre]"
   - Discovery: "Something different you might enjoy"
   - Each recommendation includes: title, rating, genre, 1-line reason` },
];

function run(cmd: string): string {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim(); }
  catch (err: any) { throw new Error(err.stderr?.toString().trim() || err.message); }
}

if (process.argv.includes('--teardown')) {
  console.log(`Deleting s3://${bucketName}/${prefix}/...`);
  try { run(`${awsBase} s3 rm s3://${bucketName}/${prefix}/ --recursive`); } catch {}
  console.log('Done.'); process.exit(0);
}

console.log(`Setting up Lab 5 (Media) documents...`);
try { run(`${awsBase} s3api head-bucket --bucket ${bucketName}`); }
catch {
  if (region === 'us-east-1') run(`${awsBase} s3api create-bucket --bucket ${bucketName}`);
  else run(`${awsBase} s3api create-bucket --bucket ${bucketName} --create-bucket-configuration LocationConstraint=${region}`);
  run(`${awsBase} s3api wait bucket-exists --bucket ${bucketName}`);
}

const tmpDir = path.join(__dirname, '../.tmp-lab5-docs');
fs.mkdirSync(tmpDir, { recursive: true });
for (const doc of documents) fs.writeFileSync(path.join(tmpDir, doc.filename), doc.content, 'utf-8');
run(`${awsBase} s3 sync "${tmpDir}" s3://${bucketName}/${prefix}/`);
fs.rmSync(tmpDir, { recursive: true, force: true });

const count = run(`${awsBase} s3 ls s3://${bucketName}/${prefix}/`).split('\n').filter(l => l.trim()).length;
console.log(`  ${count} files uploaded to s3://${bucketName}/${prefix}/`);

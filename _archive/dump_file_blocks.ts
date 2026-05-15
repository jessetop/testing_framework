import { parseLab } from '../core/walkthrough/parser';
const labPath = 'I:\\My Drive\\CourseCreationKit\\courses\\Terraform_Day_3\\labforge_iterations\\iteration_1\\Lab_01_Multi_Environment_State_Strategy.md';
const parsed = parseLab(labPath);
for (const s of parsed.steps) {
  for (const b of s.blocks) {
    if (b.classification !== 'file-content') continue;
    console.log(`\n=== Step ${s.stepId} → ${b.targetPath} (lang=${b.lang}) ===`);
    console.log(`title: ${s.title.slice(0, 70)}`);
    console.log(`preceding last: ${(b.precedingText.split('\n').pop() || '').slice(0, 100)}`);
    console.log(`content first 300 chars:\n${b.content.slice(0, 300)}`);
  }
}

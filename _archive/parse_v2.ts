import { parseLab } from '../core/walkthrough/parser';
const parsed = parseLab('I:\\My Drive\\CourseCreationKit\\courses\\Terraform_Day_3\\labforge_iterations\\iteration_1\\Lab_01_Multi_Environment_State_Strategy.md');
console.log('steps:', parsed.steps.length);
const step35 = parsed.steps.find((s) => s.stepId === '35');
if (step35) {
  console.log('Step 35 blocks:', step35.blocks.length);
  for (const b of step35.blocks) {
    console.log('  ', b.classification, '/', b.lang, '|', b.content.slice(0, 60).replace(/\n/g, ' / '));
  }
}

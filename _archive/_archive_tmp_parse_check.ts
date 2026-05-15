import { parseLab } from './core/walkthrough/parser';
const parsed = parseLab('I:\\My Drive\\CourseCreationKit\\courses\\Terraform_Day_3\\labforge_iterations\\iteration_1\\Lab_01_Multi_Environment_State_Strategy.md');
let fc = 0, hclRef = 0;
for (const s of parsed.steps) {
  for (const b of s.blocks) {
    if (b.classification === 'file-content') fc++;
    if (b.classification === 'reference-only' && ['hcl','terraform','tf'].includes(b.lang)) {
      hclRef++;
      const lastPre = (b.precedingText.split('\n').pop() || '').slice(0, 100);
      console.log('REF-ONLY HCL Step', s.stepId, '| last preceding:', JSON.stringify(lastPre));
    }
    if (b.classification === 'file-content') {
      console.log('FILE-CONTENT Step', s.stepId, '→', b.targetPath);
    }
  }
}
console.log('Total: file-content=' + fc + ', reference-only HCL=' + hclRef + ', steps=' + parsed.steps.length);

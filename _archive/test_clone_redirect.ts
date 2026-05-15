import { redirectLabRepoCloneToLocal } from '../core/walkthrough/runner';
const input = `cd ~
git clone https://github.com/AWSClassroom-com/Advanced_Terraform.git
cd Advanced_Terraform/lab1/state-infra`;
const out = redirectLabRepoCloneToLocal(input, { LAB_REPO_ROOT: '/home/ec2-user/Advanced_Terraform' });
console.log('---INPUT---');
console.log(input);
console.log('---OUTPUT---');
console.log(out);
console.log('---CHANGED:', input !== out, '---');

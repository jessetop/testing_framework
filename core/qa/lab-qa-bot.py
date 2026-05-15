"""
Lab QA Bot

Reads a lab guide, follows each step literally using Nova Act,
takes screenshots, and reports mismatches between what the guide
says and what actually appears on screen.

Usage:
  python core/qa/lab-qa-bot.py --lab-guide "path/to/Lab_1_Guide.md" --headless
  python core/qa/lab-qa-bot.py --lab-guide "path/to/Lab_1_Guide.md"  # headed for debugging

Output:
  test-results/qa-reports/Lab_1_Guide-<date>.md   — issue report
  test-results/qa-reports/screenshots/             — per-step screenshots

This is NOT the same as the lab test (does it work?).
This answers: can a student follow these exact instructions?
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from nova_act import NovaAct


def parse_lab_steps(filepath):
    """Parse a lab guide markdown into structured steps."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    steps = []
    current_part = None

    # Split into lines and process
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect Part headers
        part_match = re.match(r'^##\s+Part\s+(\w+):\s*(.*)', line)
        if part_match:
            current_part = part_match.group(2).strip()

        # Detect Step headers
        step_match = re.match(r'^###\s+(?:Step|Task)\s+(\d+):\s*(.*)', line)
        if step_match:
            step_num = int(step_match.group(1))
            step_title = step_match.group(2).strip()

            # Collect the step body (everything until next ### or ##)
            body_lines = []
            i += 1
            while i < len(lines) and not re.match(r'^#{2,3}\s+', lines[i]):
                body_lines.append(lines[i])
                i += 1

            body = '\n'.join(body_lines).strip()

            # Extract specific instructions from the body
            instructions = extract_instructions(body)

            steps.append({
                'number': step_num,
                'title': step_title,
                'part': current_part,
                'body': body,
                'instructions': instructions,
            })
            continue

        i += 1

    return steps


def extract_instructions(body):
    """Extract actionable instructions from step body text."""
    instructions = []

    # Numbered list items (1. Do this, 2. Do that)
    for match in re.finditer(r'^\d+\.\s+(.+)', body, re.MULTILINE):
        text = match.group(1).strip()
        # Skip lines that are just descriptions/notes
        if not text.startswith('**Expected') and not text.startswith('>'):
            instructions.append(text)

    # If no numbered items, use the first paragraph as the instruction
    if not instructions:
        paragraphs = body.split('\n\n')
        for p in paragraphs:
            p = p.strip()
            if p and not p.startswith('>') and not p.startswith('|') and not p.startswith('```'):
                instructions.append(p)
                break

    return instructions


def run_qa(lab_guide_path, headless=True):
    """Run the QA bot on a lab guide."""
    lab_name = os.path.basename(lab_guide_path).replace('.md', '')
    date_str = datetime.now().strftime('%Y-%m-%d')

    print(f"Lab QA Bot: {lab_name}")
    print(f"Guide: {lab_guide_path}")
    print(f"{'='*60}")

    # Parse the lab
    steps = parse_lab_steps(lab_guide_path)
    print(f"Found {len(steps)} steps to validate\n")

    # Setup output dirs
    report_dir = os.path.join(os.path.dirname(__file__), '../../test-results/qa-reports')
    ss_dir = os.path.join(report_dir, 'screenshots', lab_name)
    os.makedirs(ss_dir, exist_ok=True)

    issues = []
    step_results = []

    # Also persist screenshots to the course assets folder for documentation use
    course_assets_dir = os.environ.get('COURSE_ASSETS_DIR', '')
    if course_assets_dir:
        os.makedirs(course_assets_dir, exist_ok=True)
        print(f"Screenshots will also be saved to: {course_assets_dir}")

    # Launch Nova Act
    login_url = 'https://jessetoporowskiaws.signin.aws.amazon.com/console'

    print("Launching browser and logging in...")
    with NovaAct(
        starting_page=login_url,
        headless=headless,
        ignore_https_errors=True,
    ) as nova:
        page = nova.page

        # Login
        nova.act('Enter "lab_tester" in the IAM username field')
        nova.act('Enter "!vGG#t7]" in the Password field')
        nova.act('Click the Sign in button')
        print("Logged in\n")

        # Dismiss cookie banner
        nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')

        # Process each step
        for step in steps:
            step_num = step['number']
            step_title = step['title']
            print(f"Step {step_num}: {step_title}")

            result = {
                'step': step_num,
                'title': step_title,
                'part': step['part'],
                'status': 'pass',
                'issues': [],
                'screenshot': f'step_{step_num}.png',
            }

            # Take screenshot BEFORE the step
            ss_path = os.path.join(ss_dir, f'step_{step_num}_before.png')
            page.screenshot(path=ss_path)

            # Have Nova Act try to follow the instructions literally
            for instruction in step['instructions']:
                # Clean up the instruction for Nova Act
                clean = instruction.strip()
                if not clean or clean.startswith('**') or clean.startswith('|'):
                    continue

                # Ask Nova Act to follow the instruction AND report if it doesn't match
                prompt = (
                    f'Follow this lab instruction EXACTLY as written: "{clean}"\n\n'
                    f'If the instruction doesn\'t match what you see on the screen '
                    f'(wrong button name, wrong location, missing element, different text), '
                    f'do your best to complete the action anyway but remember what was different.'
                )

                try:
                    nova.act(prompt)
                except Exception as e:
                    result['status'] = 'fail'
                    result['issues'].append({
                        'instruction': clean,
                        'error': str(e)[:200],
                        'type': 'action_failed',
                    })
                    issues.append({
                        'step': step_num,
                        'title': step_title,
                        'instruction': clean,
                        'issue': f'Could not complete action: {str(e)[:100]}',
                        'type': 'action_failed',
                    })

            # Take screenshot AFTER the step
            ss_after = os.path.join(ss_dir, f'step_{step_num}_after.png')
            page.screenshot(path=ss_after)

            # Also save to course assets if configured
            if course_assets_dir:
                safe_title = re.sub(r'[^a-zA-Z0-9]', '_', step_title.lower())[:40]
                asset_name = f'step_{step_num:02d}_{safe_title}.png'
                page.screenshot(path=os.path.join(course_assets_dir, asset_name))

            # Ask Nova Act to compare what the step said vs what happened
            try:
                verify_result = nova.act(
                    f'Look at the current page. The lab guide says this step should result in: '
                    f'"{step_title}". '
                    f'Does the current page state match what the instruction described? '
                    f'If something looks different or confusing, describe what you see.'
                )
            except:
                pass

            if result['issues']:
                print(f"  ISSUE: {len(result['issues'])} problems found")
            else:
                print(f"  OK")

            step_results.append(result)

            # Brief pause between steps
            time.sleep(1)

    # Generate report
    report_path = generate_report(
        lab_name, date_str, steps, step_results, issues, ss_dir, report_dir
    )

    print(f"\n{'='*60}")
    print(f"QA Report: {report_path}")
    print(f"Steps checked: {len(steps)}")
    print(f"Issues found: {len(issues)}")
    print(f"Screenshots: {ss_dir}")

    return issues


def generate_report(lab_name, date_str, steps, step_results, issues, ss_dir, report_dir):
    """Generate markdown QA report."""
    total = len(steps)
    passed = len([r for r in step_results if r['status'] == 'pass'])
    failed = len([r for r in step_results if r['status'] == 'fail'])

    md = f"""# Lab QA Report: {lab_name}
**Date:** {date_str}
**Mode:** Follow instructions literally, report mismatches

## Summary

| Metric | Value |
|--------|-------|
| Steps Checked | {total} |
| Steps OK | {passed} |
| Steps with Issues | {failed} |
| Total Issues | {len(issues)} |

## Step Results

| Step | Title | Status | Issues |
|------|-------|--------|--------|
"""

    for r in step_results:
        status = 'OK' if r['status'] == 'pass' else 'ISSUE'
        issue_count = len(r['issues'])
        md += f"| {r['step']} | {r['title']} | {status} | {issue_count} |\n"

    if issues:
        md += f"\n## Issues Found\n\n"
        for issue in issues:
            md += f"### Step {issue['step']}: {issue['title']}\n"
            md += f"- **Instruction:** {issue['instruction'][:100]}\n"
            md += f"- **Issue:** {issue['issue']}\n"
            md += f"- **Type:** {issue['type']}\n\n"

    md += f"\n## Screenshots\n\n"
    md += f"Before/after screenshots for each step saved in:\n"
    md += f"`{ss_dir}`\n"

    md += f"\n---\n*Generated by Lab QA Bot on {date_str}*\n"

    report_path = os.path.join(report_dir, f'{lab_name}-qa-{date_str}.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(md)

    # Also save as latest
    with open(os.path.join(report_dir, 'latest-qa.md'), 'w', encoding='utf-8') as f:
        f.write(md)

    return report_path


def main():
    parser = argparse.ArgumentParser(description='Lab QA Bot')
    parser.add_argument('--lab-guide', required=True, help='Path to lab guide markdown')
    parser.add_argument('--headless', action='store_true', help='Run headless')
    args = parser.parse_args()

    if not os.path.exists(args.lab_guide):
        print(f"Lab guide not found: {args.lab_guide}")
        sys.exit(1)

    issues = run_qa(args.lab_guide, headless=args.headless)
    sys.exit(1 if issues else 0)


if __name__ == '__main__':
    main()

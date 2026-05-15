"""
Screenshot Capture Service

Captures, catalogs, and stores screenshots from lab testing and QA runs.
Screenshots are persisted in the course's assets/images/lab-screenshots/ folder
for use in documentation, lab guides, and review.

Sources:
  - Lab QA Bot (per-step before/after)
  - Lab Tests (failure screenshots)
  - Manual capture (on-demand)

Output structure:
  courses/<course>/assets/images/lab-screenshots/
    lab1/
      step_01_playground_navigation.png
      step_02_model_selection.png
      step_10_kb_create_dropdown.png
      ...
    lab2/
      ...
    catalog.json   — metadata index of all screenshots

Usage:
  # Capture screenshots for a lab (runs Nova Act through each step)
  python core/qa/screenshot-capture.py --lab-guide "path/to/Lab_1_Guide.md" --output-dir "path/to/assets/images/lab-screenshots/lab1"

  # Capture a single page
  python core/qa/screenshot-capture.py --url "https://console.aws.amazon.com/bedrock" --name "bedrock_console" --output-dir "path/to/output"

  # Catalog existing screenshots
  python core/qa/screenshot-capture.py --catalog "path/to/assets/images/lab-screenshots"
"""

import argparse
import json
import os
import re
import time
from datetime import datetime
from nova_act import NovaAct


def capture_lab_screenshots(lab_guide_path, output_dir, headless=True):
    """Walk through a lab guide and capture screenshots at each step."""
    from lab_qa_bot import parse_lab_steps

    steps = parse_lab_steps(lab_guide_path)
    lab_name = os.path.basename(lab_guide_path).replace('.md', '').replace('_Guide', '')
    os.makedirs(output_dir, exist_ok=True)

    catalog = []
    login_url = 'https://jessetoporowskiaws.signin.aws.amazon.com/console'

    print(f"Capturing screenshots for {lab_name} ({len(steps)} steps)")

    with NovaAct(starting_page=login_url, headless=headless, ignore_https_errors=True) as nova:
        page = nova.page

        # Login
        nova.act('Enter "lab_tester" in the IAM username field')
        nova.act('Enter "!vGG#t7]" in the Password field')
        nova.act('Click the Sign in button')
        nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')

        for step in steps:
            step_num = step['number']
            step_title = step['title']
            safe_title = re.sub(r'[^a-zA-Z0-9]', '_', step_title.lower())[:40]

            print(f"  Step {step_num}: {step_title}")

            # Try to execute the step
            for instruction in step['instructions'][:2]:  # First 2 instructions only for speed
                try:
                    nova.act(instruction)
                    time.sleep(1)
                except:
                    pass

            # Capture screenshot
            filename = f"step_{step_num:02d}_{safe_title}.png"
            filepath = os.path.join(output_dir, filename)
            page.screenshot(path=filepath)

            catalog.append({
                'step': step_num,
                'title': step_title,
                'filename': filename,
                'captured': datetime.now().isoformat(),
                'lab': lab_name,
            })

            print(f"    Saved: {filename}")

    # Save catalog
    catalog_path = os.path.join(output_dir, 'catalog.json')
    with open(catalog_path, 'w') as f:
        json.dump(catalog, f, indent=2)

    print(f"\n{len(catalog)} screenshots captured")
    print(f"Catalog: {catalog_path}")
    return catalog


def capture_single(url, name, output_dir, headless=True):
    """Capture a single screenshot of a URL."""
    os.makedirs(output_dir, exist_ok=True)
    login_url = 'https://jessetoporowskiaws.signin.aws.amazon.com/console'

    with NovaAct(starting_page=login_url, headless=headless, ignore_https_errors=True) as nova:
        nova.act('Enter "lab_tester" in the IAM username field')
        nova.act('Enter "!vGG#t7]" in the Password field')
        nova.act('Click the Sign in button')
        nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')
        nova.act(f'Navigate to {url}')
        nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')
        time.sleep(3)

        filepath = os.path.join(output_dir, f'{name}.png')
        nova.page.screenshot(path=filepath)
        print(f"Saved: {filepath}")


def build_catalog(base_dir):
    """Build a catalog.json from existing screenshots."""
    catalog = []
    for root, dirs, files in os.walk(base_dir):
        for f in sorted(files):
            if f.endswith('.png'):
                rel_path = os.path.relpath(os.path.join(root, f), base_dir)
                # Extract step number from filename
                step_match = re.match(r'step_(\d+)', f)
                step_num = int(step_match.group(1)) if step_match else 0

                catalog.append({
                    'filename': rel_path.replace('\\', '/'),
                    'step': step_num,
                    'captured': datetime.fromtimestamp(
                        os.path.getmtime(os.path.join(root, f))
                    ).isoformat(),
                })

    catalog_path = os.path.join(base_dir, 'catalog.json')
    with open(catalog_path, 'w') as f:
        json.dump(catalog, f, indent=2)

    print(f"Cataloged {len(catalog)} screenshots in {catalog_path}")
    return catalog


def main():
    parser = argparse.ArgumentParser(description='Screenshot Capture Service')
    parser.add_argument('--lab-guide', help='Path to lab guide markdown')
    parser.add_argument('--url', help='Single URL to capture')
    parser.add_argument('--name', help='Name for single capture', default='screenshot')
    parser.add_argument('--output-dir', required=True, help='Output directory')
    parser.add_argument('--catalog', help='Build catalog from existing directory')
    parser.add_argument('--headless', action='store_true')
    args = parser.parse_args()

    if args.catalog:
        build_catalog(args.catalog)
    elif args.lab_guide:
        capture_lab_screenshots(args.lab_guide, args.output_dir, args.headless)
    elif args.url:
        capture_single(args.url, args.name, args.output_dir, args.headless)
    else:
        parser.error('Provide --lab-guide, --url, or --catalog')


if __name__ == '__main__':
    main()

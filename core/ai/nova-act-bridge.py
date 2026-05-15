"""
Nova Act Bridge

Called from TypeScript Playwright tests to perform complex browser
interactions that Playwright selectors can't handle (CloudScape
dropdowns, wizard dialogs, etc.).

Nova Act launches its own browser, logs in to AWS, and performs
the requested actions visually — like a human clicking through.

Usage:
  python core/ai/nova-act-bridge.py --login --preset create-kb-full
  python core/ai/nova-act-bridge.py --login --action "Click the Create button"
"""

import argparse
import json
import os
import sys
from nova_act import NovaAct


def create_kb_full_wizard(nova, kb_name='lab1-jt-kb',
                          s3_uri='s3://bedrock-training-029331796573/lab1-documents/',
                          kb_url='https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/knowledge-bases'):
    """Complete KB creation wizard. Each act() = one UI action."""

    # Navigate to KB page
    nova.act(f'Navigate to {kb_url}')
    nova.act('If there is a cookie consent banner, click the Accept button. Otherwise do nothing.')
    print("OK: On Knowledge Bases page", flush=True)

    # Open Create wizard
    nova.act('Click the "Create" button that has a dropdown arrow')
    nova.act('Click "Knowledge Base with vector store" in the dropdown menu')
    print("OK: Wizard opened", flush=True)

    # Step 1: KB name
    nova.act(f'Triple-click the Knowledge Base name field to select all text, then type "{kb_name}"')
    nova.act('Click the Next button at the bottom right of the page')
    print("OK: Step 1 done - Name set", flush=True)

    # Step 2: Data source
    nova.act(f'Find the S3 URI input field and type "{s3_uri}"')
    nova.act('Click the Next button at the bottom right of the page')
    print("OK: Step 2 done - Data source set", flush=True)

    # Step 3a: Embedding model (one action per act call)
    nova.act('Click the "Select model" button')
    print("OK: Model picker opened", flush=True)

    nova.act('In the model picker dialog, click "Amazon" in the left Categories panel')
    print("OK: Amazon provider selected", flush=True)

    nova.act('Click on "Titan Embeddings G1 - Text" in the middle Models panel')
    print("OK: Titan Embeddings selected", flush=True)

    nova.act('Click the "Apply" button at the bottom right of the model picker dialog')
    print("OK: Model applied", flush=True)

    # Step 3b: Vector store
    nova.act('Scroll down on the page to see the "Vector store type" section')
    print("OK: Scrolled to vector store", flush=True)

    nova.act('Click the dropdown that currently says "Select a vector store"')
    print("OK: Vector store dropdown clicked", flush=True)

    nova.act('Click "Amazon OpenSearch Serverless" in the dropdown list')
    print("OK: OpenSearch Serverless selected", flush=True)

    nova.act('Click the Next button at the bottom right of the page')
    print("OK: Step 3 done", flush=True)

    # Step 4: Review and create
    # The Create button is at the BOTTOM of a long review page - must scroll down
    nova.act('Scroll to the very bottom of the page to see the Create Knowledge Base button')
    print("OK: Scrolled to bottom of review page", flush=True)

    nova.act('Click the orange "Create Knowledge Base" button at the bottom right')
    print("OK: Create Knowledge Base clicked", flush=True)

    # CRITICAL: Keep browser alive while OpenSearch Serverless provisions.
    # This takes ~2 minutes. If the browser closes too early, the KB
    # creation silently fails (OpenSearch collection is created but the
    # KB entity never gets registered with Bedrock).
    import time
    page = nova.page
    print("OK: Waiting for KB provisioning (up to 5 minutes)...", flush=True)

    for i in range(15):  # 15 x 20s = 5 minutes max
        time.sleep(20)
        current_url = page.url
        # KB creation redirects to detail page when complete
        if 'knowledge-bases/' in current_url and 'create' not in current_url:
            # Extract KB ID from URL: .../knowledge-bases/<name>/<id>
            parts = current_url.split('/')
            kb_id = parts[-1] if len(parts) > 1 else 'unknown'
            print(f"OK: KB created successfully! ID: {kb_id}", flush=True)
            return
        print(f"  Still provisioning... ({(i+1)*20}s)", flush=True)

    print("WARNING: KB provisioning did not complete in 5 minutes", flush=True)


def test_kb_rag_queries(nova, kb_name='lab1-jt-kb',
                        kb_url='https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/knowledge-bases'):
    """Open a KB, run ALL RAG queries in one session, report results."""
    import time

    # Navigate to KB and open test panel
    nova.act(f'Navigate to {kb_url}')
    nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')
    nova.act(f'Scroll down and click on the link "{kb_name}" in the Knowledge Bases table')
    print("OK: Opened KB detail page", flush=True)

    nova.act('If you see a message about data sources needing to be synced, click the Sync button and wait. Otherwise continue.')
    nova.act('Click the "Test Knowledge Base" button at the top right of the page')
    print("OK: Test panel opened", flush=True)

    queries = [
        ("return_policy", "What is the return policy for damaged products?"),
        ("warranty", "What warranty coverage is included with the premium product tier?"),
        ("hallucination", "What is the CEO's favorite color?"),
        ("vague", "How do I return something?"),
    ]

    page = nova.page
    ss_dir = 'C:/Users/jesse/OneDrive/Code/testing_framework/test-results'

    for name, query in queries:
        nova.act(f'In the test panel, clear any previous text and type: "{query}"')
        nova.act('Click the "Run" button in the test panel')
        time.sleep(8)

        # Screenshot the response
        page.screenshot(path=f'{ss_dir}/rag-{name}.png')
        print(f"OK: Query '{name}' completed", flush=True)


def create_guardrail(nova, name='Lab2ProductionGuardrail',
                     gr_url='https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/guardrails'):
    """Create a Bedrock Guardrail with content filters, denied topics, and PII protection."""

    nova.act(f'Navigate to {gr_url}')
    nova.act('If there is a cookie consent banner, click Accept. Otherwise do nothing.')
    print("OK: On Guardrails page", flush=True)

    # Check if already exists
    nova.act(f'Look at the guardrails list. If "{name}" already exists, click on it. Otherwise click "Create guardrail".')
    print("OK: Create guardrail started", flush=True)

    # Step 1: Name and description
    nova.act(f'In the Name field, type "{name}"')
    nova.act('In the Description field, type "Production guardrail with content filtering, denied topics, and PII protection"')
    nova.act('Click the Next button')
    print("OK: Step 1 - Name configured", flush=True)

    # Step 2: Content filters — set all to HIGH
    nova.act('Enable all content filter categories (Hate, Insults, Sexual, Violence, Misconduct) and set both input and output strengths to HIGH')
    nova.act('Click the Next button')
    print("OK: Step 2 - Content filters set to HIGH", flush=True)

    # Step 3: Denied topics
    nova.act('Click "Add denied topic"')
    nova.act('For the topic name, type "Competitor Information"')
    nova.act('For the definition, type "Requests for information about competitor products, pricing, or comparisons"')
    nova.act('Click "Add denied topic" to save it')
    nova.act('Click the Next button')
    print("OK: Step 3 - Denied topic added", flush=True)

    # Step 4: PII filters
    nova.act('Enable PII filtering. Set Email to ANONYMIZE and SSN to BLOCK.')
    nova.act('Click the Next button')
    print("OK: Step 4 - PII filters configured", flush=True)

    # Step 5: Review and create
    nova.act('Scroll to the bottom and click "Create guardrail"')

    import time
    time.sleep(5)
    print("OK: Guardrail creation submitted", flush=True)


PRESETS = {
    'create-kb-full': create_kb_full_wizard,
    'test-kb-rag': test_kb_rag_queries,
    'create-guardrail': create_guardrail,
}


def main():
    parser = argparse.ArgumentParser(description='Nova Act Bridge')
    parser.add_argument('--action', help='Single action to perform')
    parser.add_argument('--preset', choices=list(PRESETS.keys()), help='Predefined action set')
    parser.add_argument('--actions-file', help='JSON file with action list')
    parser.add_argument('--login', action='store_true', help='Login to AWS first')
    parser.add_argument('--headless', action='store_true', help='Headless mode')
    parser.add_argument('--login-url', default='https://jessetoporowskiaws.signin.aws.amazon.com/console')
    parser.add_argument('--username', default='lab_tester')
    parser.add_argument('--password', default='!vGG#t7]')
    parser.add_argument('--kb-name', default='lab1-jt-kb', help='KB name for create-kb-full preset')
    parser.add_argument('--s3-uri', default='s3://bedrock-training-029331796573/lab1-documents/', help='S3 URI for KB')
    parser.add_argument('--guardrail-name', default='Lab2ProductionGuardrail', help='Guardrail name')
    args = parser.parse_args()

    if not args.action and not args.preset and not args.actions_file:
        parser.error('Must provide --action, --preset, or --actions-file')

    starting_page = args.login_url if args.login else 'https://console.aws.amazon.com'

    print(f"Launching Nova Act (headless={args.headless})", flush=True)

    try:
        with NovaAct(
            starting_page=starting_page,
            headless=args.headless,
            ignore_https_errors=True,
        ) as nova:

            # AWS login
            if args.login:
                nova.act(f'Enter "{args.username}" in the IAM username field')
                nova.act(f'Enter "{args.password}" in the Password field')
                nova.act('Click the Sign in button')
                print("OK: Logged in to AWS", flush=True)

            # Execute requested action
            if args.preset:
                print(f"Running preset: {args.preset}", flush=True)
                if args.preset == 'create-kb-full':
                    PRESETS[args.preset](nova, kb_name=args.kb_name, s3_uri=args.s3_uri)
                elif args.preset == 'create-guardrail':
                    PRESETS[args.preset](nova, name=args.guardrail_name)
                elif args.preset == 'test-kb-rag':
                    PRESETS[args.preset](nova, kb_name=args.kb_name)
                else:
                    PRESETS[args.preset](nova)

            elif args.actions_file:
                with open(args.actions_file) as f:
                    actions = json.load(f)
                for i, action in enumerate(actions):
                    print(f"Action {i+1}/{len(actions)}: {action}", flush=True)
                    nova.act(action)
                print(f"OK: All {len(actions)} actions done", flush=True)

            elif args.action:
                nova.act(args.action)
                print("OK: Action done", flush=True)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

// Simple test to verify Node.js and Playwright work
const { chromium } = require('playwright');

async function main() {
  console.log('Starting browser test...');

  try {
    const browser = await chromium.launch({ headless: true });
    console.log('Browser launched successfully');

    const page = await browser.newPage();
    await page.goto('https://www.google.com');
    console.log('Navigated to Google');

    const title = await page.title();
    console.log('Page title:', title);

    await browser.close();
    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

main();

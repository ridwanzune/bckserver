// Using ES Module imports, compatible with "type": "module" in package.json
import puppeteer from 'puppeteer';

const APP_URL = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

async function sendStatusUpdate(status, message, details = {}) {
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                level: status,
                message: message,
                category: 'GitHub Action E2E',
                details: details
            }),
        });
        console.log(`Successfully sent status update: ${status}`);
    } catch (error) {
        console.error('Failed to send status update to webhook:', error);
    }
}

async function runAutomation() {
    if (!APP_URL || !APP_PASSWORD) {
        console.error('APP_URL and APP_PASSWORD environment variables must be set.');
        await sendStatusUpdate('ERROR', 'Environment variables not configured in GitHub repository secrets.');
        throw new Error('APP_URL and APP_PASSWORD environment variables must be set.');
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000); // 2 minutes

    try {
        console.log(`Navigating to ${APP_URL}...`);
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        console.log('Page loaded. Entering password...');

        // Step 1: Unlock the App
        await page.waitForSelector('input[type="password"]', { timeout: 30000 });
        await page.type('input[type="password"]', APP_PASSWORD);
        await page.click('button[type="submit"]');
        console.log('Password submitted.');

        // Step 2: Start Automation
        const startButtonSelector = '//button[contains(text(), "START AUTOMATION")]';
        await page.waitForXPath(startButtonSelector, { timeout: 30000 });
        const [startButton] = await page.$x(startButtonSelector);
        await startButton.click();
        console.log('Automation started. Waiting for completion...');

        // Step 3: Wait for Completion
        await page.waitForXPath(`${startButtonSelector}[not(@disabled)]`, { timeout: 900000 });
        console.log('Automation process has finished.');

        // Step 4: Check for Errors on Page
        const hasErrors = await page.evaluate(() => {
            return !!document.querySelector('.border-red-500');
        });

        // Step 5: Report Final Status
        if (hasErrors) {
            console.log('Errors detected in the batch process.');
            await sendStatusUpdate('ERROR', 'Automation completed with one or more failed tasks.');
        } else {
            console.log('All tasks completed successfully.');
            await sendStatusUpdate('SUCCESS', 'Automation batch process completed successfully.');
        }

    } catch (error) {
        console.error('An error occurred during the automation script:', error);
        await sendStatusUpdate('ERROR', 'The automation script failed to run to completion.', {
            error: error.message
        });
        throw error;
    } finally {
        console.log('Closing browser.');
        await browser.close();
    }
}

runAutomation().catch(() => process.exit(1));

import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_URL = process.env.TARGET_URL;
const PASSWORD = process.env.PASSWORD;
const STATUS_WEBHOOK = process.env.STATUS_WEBHOOK;

async function runAutomation() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Page loaded. Entering password...');
        await page.waitForSelector('input[type="password"]', { timeout: 20000 });
        await page.type('input[type="password"]', PASSWORD);
        await page.keyboard.press('Enter');

        // Wait for the dashboard to load
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        // XPath selector for the start button
        const startButtonXPath = '//button[contains(., "START AUTOMATION")]';

        console.log('Waiting for START AUTOMATION button...');
        await page.waitForXPath(startButtonXPath, { timeout: 30000 });

        const [startButton] = await page.$x(startButtonXPath);
        if (!startButton) {
            throw new Error('START AUTOMATION button not found.');
        }

        await startButton.click();
        console.log('Automation started. Waiting for completion...');

        // Wait for button to become enabled again
        await page.waitForXPath(`${startButtonXPath}[not(@disabled)]`, { timeout: 15 * 60 * 1000 });

        console.log('Automation completed successfully.');
        await sendStatus('SUCCESS');
    } catch (error) {
        console.error('An error occurred during the automation script:', error);
        await sendStatus('ERROR');
    } finally {
        console.log('Closing browser.');
        await browser.close();
    }
}

async function sendStatus(status) {
    if (!STATUS_WEBHOOK) return;
    try {
        await fetch(STATUS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        console.log(`Successfully sent status update: ${status}`);
    } catch (err) {
        console.error('Failed to send status update:', err);
    }
}

runAutomation();

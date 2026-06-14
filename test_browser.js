import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        page.on('error', err => console.log('ERROR:', err.toString()));
        page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure().errorText));

        console.log('Navigating to http://localhost:3000/');
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });
        
        console.log('Waiting for 2 seconds to let it crash...');
        await new Promise(r => setTimeout(r, 2000));
        
        const bodyText = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
        console.log('Body snippet:', bodyText);
        
        await browser.close();
    } catch (e) {
        console.error('Puppeteer Script Error:', e);
    }
})();

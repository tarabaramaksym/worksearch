const { chromium } = require('playwright');

async function testScroll() {
	const browser = await chromium.launch({
		headless: false
	});

	const page = await browser.newPage();

	// Test configuration
	const url = 'file:///D:/Programming/job-dashboard/crawler/test-scroll.html'; // Replace with your test URL
	const scrollContainerSelector = '.scroll-container'; // Replace with your selector

	try {
		console.log(`🌐 Opening: ${url}`);
		await page.goto(url, { waitUntil: 'networkidle' });

		console.log('⏳ Waiting 1 seconds...');
		await page.waitForTimeout(1000);

		console.log(`📜 Scrolling through container: ${scrollContainerSelector}`);

		const scrollContainer = await page.locator(scrollContainerSelector).first();
		if (scrollContainer) {
			await scrollContainer.evaluate((container) => {
				return new Promise((resolve) => {
					const scrollHeight = container.scrollHeight;
					const clientHeight = container.clientHeight;
					const maxScroll = scrollHeight - clientHeight;

					if (maxScroll <= 0) {
						console.log('No scrolling needed');
						resolve();
						return;
					}

					console.log(`Scrolling from 0 to ${maxScroll}`);
					let currentScroll = 0;
					const scrollStep = 300;
					const scrollInterval = setInterval(() => {
						currentScroll += scrollStep;
						if (currentScroll >= maxScroll) {
							container.scrollTop = currentScroll;
							clearInterval(scrollInterval);
							console.log('Scrolling complete');
							resolve();
						} else {
							container.scrollTop = currentScroll;
						}
					}, 100);
				});
			});

			await page.waitForTimeout(1000);
		} else {
			console.log('❌ Scroll container not found');
		}

		console.log('✅ Test complete - keeping browser open for 30 seconds');
		await page.waitForTimeout(30000);

	} catch (error) {
		console.error('❌ Error:', error);
	} finally {
		await browser.close();
	}
}

testScroll();
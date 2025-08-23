require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function checkJobDuplicate(jobName, companyName, jobUrl, baseApiUrl = 'http://localhost:3000') {
	const startTime = Date.now();
	try {
		const response = await fetch(`${baseApiUrl}/api/jobs/check-duplicate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': process.env.CRAWLER_API_KEY
			},
			body: JSON.stringify({
				job_name: jobName,
				company_name: companyName,
				job_url: jobUrl
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		const responseTime = Date.now() - startTime;
		console.log(`⏱️ Duplicate check for "${jobName}" at "${companyName}": ${responseTime}ms`);

		return data.isDuplicate;
	} catch (error) {
		const responseTime = Date.now() - startTime;
		console.error(`❌ Error checking duplicate for "${jobName}" at "${companyName}" (${responseTime}ms):`, error.message);
		return false;
	}
}

const websitesData = getWebsitesData();

function getWebsitesData() {
	const websitesData = {};
	const websites = fs.readdirSync(path.join(__dirname, 'schema'));

	let urlsConfig = {};
	try {
		urlsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'urls.json'), 'utf8'));
	} catch (error) {
		console.warn('⚠️ Could not read urls.json config file:', error.message);
	}

	let websitesConfig = {};
	try {
		websitesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'websites.json'), 'utf8'));
	} catch (error) {
		console.warn('⚠️ Could not read websites.json config file:', error.message);
	}

	for (const website of websites) {
		const websiteName = website.replace('.json', '');

		if (!websitesConfig[websiteName]) {
			continue;
		}

		const websiteData = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema', website), 'utf8'));

		if (urlsConfig[websiteName] && Array.isArray(urlsConfig[websiteName])) {
			websiteData.urls = urlsConfig[websiteName];
			console.log(`✅ Loaded ${urlsConfig[websiteName].length} URLs for ${websiteName}`);
		} else {
			console.warn(`⚠️ No URLs found for ${websiteName} in urls.json`);
		}

		websitesData[websiteName] = websiteData;
	}

	return websitesData;
}


async function handleLoginWait(page, websiteData) {
	const { awaitsLogin, invisibleSelectorOnLogin } = websiteData;

	if (!awaitsLogin || !invisibleSelectorOnLogin) {
		return;
	}

	console.log(`🔐 Website requires login handling, waiting for login process...`);

	await page.waitForTimeout(2000);
	console.log(`🔍 Starting to monitor login selector: ${invisibleSelectorOnLogin}`);

	const maxWaitTime = 60000;
	const checkInterval = 1000;
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitTime) {
		try {
			const loginElement = await page.locator(invisibleSelectorOnLogin).first();
			const isVisible = await loginElement.isVisible({ timeout: 500 }).catch(() => false);

			if (!isVisible) {
				console.log(`✅ Login selector disappeared, login process completed`);
				return;
			}

			console.log(`⏳ Login selector still visible, waiting...`);
			await page.waitForTimeout(checkInterval);
		} catch (error) {
			console.log(`✅ Login selector not found, assuming login completed`);
			return;
		}
	}

	console.log(`⚠️ Login wait timeout reached (${maxWaitTime}ms), proceeding anyway...`);
}

async function closePopups(page, websiteData) {
	const { popupCloseSelectors } = websiteData;

	if (!popupCloseSelectors || !Array.isArray(popupCloseSelectors)) {
		return;
	}

	for (const selector of popupCloseSelectors) {
		try {
			const popup = await page.locator(selector).first();
			const isVisible = await popup.isVisible({ timeout: 1000 });

			if (isVisible) {
				console.log(`🔴 Closing popup: ${selector}`);
				await popup.click();
				await page.waitForTimeout(500);
			}
		} catch (error) {
			console.log(`ℹ️ Popup selector not found: ${selector}`);
		}
	}
}

async function createBrowserContext(isHeadless = false, isPersistent = false) {
	const options = {
		headless: isHeadless,
		executablePath: process.env.BROWSER_PATH,
		args: [],
		ignoreDefaultArgs: ['--enable-automation'],
	};

	let context;

	if (isPersistent) {
		context = await chromium.launchPersistentContext(process.env.BROWSER_USER_DATA_DIR, options);
	} else {
		const browser = await chromium.launch(options);
		context = await browser.newContext({
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			viewport: { width: 1920, height: 1080 },
			locale: 'en-US',
			timezoneId: 'America/New_York',
			permissions: ['geolocation'],
			geolocation: { latitude: 40.7128, longitude: -74.0060 },
			colorScheme: 'light',
			extraHTTPHeaders: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
				'Accept-Language': 'en-US,en;q=0.9',
				'Accept-Encoding': 'gzip, deflate, br',
				'Sec-Fetch-Dest': 'document',
				'Sec-Fetch-Mode': 'navigate',
				'Sec-Fetch-Site': 'none',
				'Sec-Fetch-User': '?1',
				'Upgrade-Insecure-Requests': '1'
			}
		});
	}

	await context.addInitScript(() => {
		// Remove webdriver traces
		delete navigator.webdriver;
		delete navigator.__driver_evaluate;
		delete navigator.__webdriver_evaluate;
		delete navigator.__selenium_evaluate;
		delete navigator.__fxdriver_evaluate;
		delete navigator.__driver_unwrapped;
		delete navigator.__webdriver_unwrapped;
		delete navigator.__selenium_unwrapped;
		delete navigator.__fxdriver_unwrapped;
		delete navigator.__webdriver_script_func;

		// Override webdriver property
		Object.defineProperty(navigator, 'webdriver', {
			get: () => undefined,
		});

		// Remove automation flags from window
		delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
		delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
		delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

		// Override chrome object
		window.chrome = {
			runtime: {
				onConnect: undefined,
				onMessage: undefined,
			},
			loadTimes: function () {
				return {
					commitLoadTime: Date.now() - Math.random() * 1000,
					connectionInfo: 'h2',
					finishDocumentLoadTime: Date.now() - Math.random() * 500,
					finishLoadTime: Date.now() - Math.random() * 100,
					firstPaintAfterLoadTime: 0,
					firstPaintTime: Date.now() - Math.random() * 2000,
					navigationType: 'Other',
					npnNegotiatedProtocol: 'h2',
					requestTime: Date.now() - Math.random() * 3000,
					startLoadTime: Date.now() - Math.random() * 2000,
					wasAlternateProtocolAvailable: false,
					wasFetchedViaSpdy: true,
					wasNpnNegotiated: true
				};
			},
			csi: function () {
				return {
					pageT: Date.now() - Math.random() * 100,
					tran: Math.floor(Math.random() * 20) + 15
				};
			},
			app: {}
		};

		// Override plugins
		Object.defineProperty(navigator, 'plugins', {
			get: () => [
				{
					0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin },
					description: "Portable Document Format",
					filename: "internal-pdf-viewer",
					length: 1,
					name: "Chrome PDF Plugin"
				},
				{
					0: { type: "application/pdf", suffixes: "pdf", description: "", enabledPlugin: Plugin },
					description: "",
					filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
					length: 1,
					name: "Chrome PDF Viewer"
				},
				{
					0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: Plugin },
					1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: Plugin },
					description: "",
					filename: "internal-nacl-plugin",
					length: 2,
					name: "Native Client"
				}
			],
		});

		// Override languages
		Object.defineProperty(navigator, 'languages', {
			get: () => ['en-US', 'en'],
		});

		// Override screen properties
		Object.defineProperty(screen, 'availTop', { get: () => 0 });
		Object.defineProperty(screen, 'availLeft', { get: () => 0 });
		Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
		Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

		// Override permissions
		const originalQuery = window.navigator.permissions.query;
		window.navigator.permissions.query = (parameters) => (
			parameters.name === 'notifications' ?
				Promise.resolve({ state: Notification.permission }) :
				originalQuery(parameters)
		);

		// Mock vendor and platform
		Object.defineProperty(navigator, 'vendor', {
			get: () => 'Google Inc.',
		});

		Object.defineProperty(navigator, 'platform', {
			get: () => 'Win32',
		});

		// Hide automation in iframe
		Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
			get: function () {
				return window;
			}
		});
	});

	return context;
}

async function crawlWebsite(websiteData) {
	console.log(`🔄 Launching with user profile: ${process.env.BROWSER_USER_DATA_DIR}`);

	const context = await createBrowserContext(false, true); // non-headless, persistent

	const { name, baseUrl, urls, loadMoreSelector, loadMoreBtnDisplayNone, scrollToButton, listSelector, listingLink, scrollMax } = websiteData;
	console.log(`🕷️ Starting to crawl ${name}...`);

	const allJobUrls = [];

	for (const urlPath of urls) {
		const fullUrl = baseUrl + urlPath;
		console.log(`📖 Opening: ${fullUrl}`);

		const page = await context.newPage();

		await page.goto(fullUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 30000
		});

		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(3000);

		await page.waitForTimeout(1000 + Math.random() * 2000);

		await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
		await page.waitForTimeout(500 + Math.random() * 1000);

		await handleLoginWait(page, websiteData);

		try {
			await page.waitForSelector(listSelector, { timeout: 10000 });
			console.log(`✅ Job list loaded for ${urlPath}`);
		} catch (error) {
			console.log(`⚠️ Job list selector not found, continuing anyway...`);
		}

		await page.waitForTimeout(1000 + Math.random() * 1000);

		await closePopups(page, websiteData);

		let loadMoreClicks = 0;
		const maxClicks = scrollMax || 50; // Use scrollMax from config, fallback to 50

		console.log(`🔄 Will click "Load More" up to ${maxClicks} times`);

		while (loadMoreClicks < maxClicks) {
			try {
				const loadMoreButton = await page.locator(loadMoreSelector).first();
				const isVisible = await loadMoreButton.isVisible().catch(() => false);

				if (!isVisible) {
					console.log(`✅ Load more button no longer visible after ${loadMoreClicks} clicks`);
					break;
				}

				if (loadMoreBtnDisplayNone) {
					const displayStyle = await loadMoreButton.evaluate(el => window.getComputedStyle(el).display);
					if (displayStyle === 'none') {
						console.log(`✅ Load more button has display:none after ${loadMoreClicks} clicks`);
						break;
					}
				}

				if (websiteData.scrollSelector) {
					console.log(`📜 Scrolling through specific container: ${websiteData.scrollSelector}`);

					const scrollContainer = await page.locator(websiteData.scrollSelector).first();
					if (scrollContainer) {
						// Scroll through the entire scroll container
						await scrollContainer.evaluate((container) => {
							return new Promise((resolve) => {
								const scrollHeight = container.scrollHeight;
								const clientHeight = container.clientHeight;
								const maxScroll = scrollHeight - clientHeight;

								if (maxScroll <= 0) {
									resolve();
									return;
								}

								let currentScroll = 0;
								const scrollStep = 300;
								const scrollInterval = setInterval(() => {
									currentScroll += scrollStep;
									if (currentScroll >= maxScroll) {
										console.log('Scrolling complete')
										container.scrollTop = maxScroll;
										clearInterval(scrollInterval);
										resolve();
									} else {
										console.log('Scrolling, ' + currentScroll)
										container.scrollTop = currentScroll;
									}
								}, 100);
							});
						});

						await page.waitForTimeout(1000 + Math.random() * 1000);
					}
				}

				console.log(`🔄 Clicking load more button (click #${loadMoreClicks + 1})...`);

				if (scrollToButton) {
					console.log(`📜 Scrolling to load more button...`);

					const buttonBox = await loadMoreButton.boundingBox();
					if (buttonBox) {
						const scrollY = buttonBox.y - 200;

						await page.evaluate((targetY) => {
							const currentY = window.scrollY;
							const distance = targetY - currentY;
							const duration = 2000 + Math.random() * 2000;
							const startTime = performance.now();

							function easeInOutQuad(t) {
								return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
							}

							function scrollStep(currentTime) {
								const elapsed = currentTime - startTime;
								const progress = Math.min(elapsed / duration, 1);

								const ease = easeInOutQuad(progress);
								const newY = currentY + (distance * ease);

								const randomOffset = (Math.random() - 0.5) * 10;

								window.scrollTo(0, newY + randomOffset);

								if (progress < 1) {
									requestAnimationFrame(scrollStep);
								}
							}

							requestAnimationFrame(scrollStep);
						}, scrollY);

						await page.waitForTimeout(2500 + Math.random() * 1500);

						console.log(`⏳ Waiting before clicking button...`);
						await page.waitForTimeout(2000 + Math.random() * 3000);
					}
				}

				// Extract jobs immediately if pagination mode
				if (websiteData.isPagination) {
					await extractJobsFromCurrentPage(page, websiteData, baseUrl, urlPath, name, allJobUrls);
				}

				await loadMoreButton.click();
				loadMoreClicks++;

				await page.waitForTimeout(2000);

				await closePopups(page, websiteData);

			} catch (error) {
				console.log(`ℹ️ Load more button not found or not clickable: ${error.message}`);
				break;
			}
		}

		if (loadMoreClicks >= maxClicks) {
			console.log(`⚠️ Reached maximum clicks (${maxClicks}) for safety`);
		}

		// Extract jobs at the end (either all accumulated or just the last page)
		if (!websiteData.isPagination) {
			console.log(`📋 Extracting job URLs from ${fullUrl}...`);
			await extractJobsFromCurrentPage(page, websiteData, baseUrl, urlPath, name, allJobUrls);
		}

		await page.close();
		console.log(`✅ Completed crawling ${urlPath}`);
	}

	await context.close();

	console.log(`\n🎯 CRAWLING COMPLETE FOR ${name}`);
	console.log(`📊 Total job URLs found: ${allJobUrls.length}`);
	console.log('\n📋 Job URLs:');

	allJobUrls.forEach((job, index) => {
		console.log(`${index + 1}. [${job.source}] ${job.url}`);
	});

	return allJobUrls;
}

async function saveJobDataToAPI(jobData, baseApiUrl = 'http://localhost:3000', retries = 3) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const urlObj = new URL(jobData.url);
			jobData.job_url = urlObj.pathname + urlObj.search;

			const createJobPayload = {
				job_name: jobData.job_name,
				job_description: jobData.job_description,
				company_name: jobData.company_name,
				location: jobData.location,
				publication_date: jobData.publication_date,
				website_name: jobData.website_name,
				website_url: urlObj.origin,
				job_url: jobData.job_url,
				tags: []
			};

			const response = await fetch(`${baseApiUrl}/api/jobs`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': process.env.CRAWLER_API_KEY
				},
				body: JSON.stringify(createJobPayload)
			});

			if (response.status === 201) {
				const data = await response.json();
				return data.id;
			}

		} catch (error) {
			if (error.response?.status === 409) {
				return 'duplicate';
			}

			if (attempt === retries) {
				console.error(`❌ Final attempt ${attempt} failed for "${jobData.job_name}":`, error.response?.data?.error || error.message);
				return null;
			}

			console.log(`⚠️ Attempt ${attempt}/${retries} failed for "${jobData.job_name}", retrying in ${attempt}s...`);
			await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
		}
	}
	return null;
}

async function getJobDataField(page, field) {
	if (!field) {
		return null;
	}

	const { selector, sanitize, split, translate, joinAfterSplit } = field;
	let text = null;

	try {
		text = await page.locator(selector).first().textContent().catch(() => null);
	} catch (error) {
		console.error(`❌ Error getting job data field: ${error.message}`);
		return null;
	}

	let parts = null;

	if (sanitize) {
		text = text.replace(/\s+/g, ' ').trim();
	}

	if (split) {
		parts = text.split(split);
	}

	if (translate && parts) {
		for (let i = 0; i < parts.length; i++) {
			let txt = parts[i].trim().toLowerCase();

			if (translate[txt]) {
				parts[i] = translate[txt];
			}
		}
	}

	if (translate && !parts) {
		text = translate[text] || text;
	}

	if (joinAfterSplit && parts) {
		text = parts.join(joinAfterSplit);
	} else if (parts) {
		return parts;
	}

	return text;
}

async function extractJobData(page, url, selectors) {
	try {
		await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: 15000
		});

		await page.waitForTimeout(500 + Math.random() * 1000);

		const {
			jobName,
			companyName,
			jobDescription,
			jobLocation,
			publicationDate
		} = selectors;

		return {
			url: url,
			job_name: await getJobDataField(page, jobName),
			company_name: await getJobDataField(page, companyName),
			job_description: await getJobDataField(page, jobDescription),
			location: await getJobDataField(page, jobLocation),
			publication_date: await getJobDataField(page, publicationDate)
		}
	} catch (error) {
		console.error(`❌ Error extracting data from ${url}:`, error.message);
		return null;
	}
}

async function extractJobsFromCurrentPage(page, websiteData, baseUrl, urlPath, name, allJobUrls) {
	try {
		const listItems = await page.locator(`${websiteData.listSelector}`).all();
		console.log(`📝 Found ${listItems.length} job listings`);
		for (let i = 0; i < listItems.length; i++) {
			try {
				const linkSelector = websiteData.listingLink;
				const jobLink = await listItems[i].locator(linkSelector).first();
				const href = await jobLink.getAttribute('href');

				if (href) {
					const absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;

					const { listingJobName, listingJobCompany } = websiteData;
					let jobName = null;
					let companyName = null;

					if (listingJobName) {
						jobName = await listItems[i].locator(listingJobName).first().textContent().catch(() => null);
						if (jobName) jobName = jobName.replace(/\s+/g, ' ').trim();
					}

					if (listingJobCompany) {
						companyName = await listItems[i].locator(listingJobCompany).first().textContent().catch(() => null);
						if (companyName) companyName = companyName.replace(/\s+/g, ' ').trim();
					}

					let isDuplicate = false;
					if (jobName && companyName) {
						isDuplicate = await checkJobDuplicate(jobName, companyName, absoluteUrl);
						if (isDuplicate) {
							console.log(`🔄 Duplicate found: ${jobName} at ${companyName}`);
							continue;
						}
					}

					allJobUrls.push({
						url: absoluteUrl,
						source: urlPath,
						website: name,
						jobName: jobName,
						companyName: companyName
					});
				}
			} catch (linkError) {
				continue;
			}
		}
	} catch (listError) {
		console.error(`❌ Error extracting job URLs: ${listError.message}`);
	}
}

async function processJobUrls(jobUrls) {
	const totalUrls = Object.values(jobUrls).flat().length;
	console.log(`\n🔍 Starting parallel job processing for ${totalUrls} URLs...`);

	const context = await createBrowserContext(false, true);

	const page = await context.newPage();

	const savePromises = [];
	const maxConcurrentSaves = 5;
	let activeSaves = 0;
	let processed = 0;
	let savedCount = 0;
	let skippedCount = 0;
	let duplicateCount = 0;
	const batchSize = 10;

	const saveJobWithTracking = async (jobData) => {
		const result = await saveJobDataToAPI(jobData);
		if (result === 'duplicate') {
			duplicateCount++;
			console.log(`🔄 Duplicate ${duplicateCount}: ${jobData.job_name}`);
		} else if (result) {
			savedCount++;
			console.log(`✅ Saved ${savedCount}/${totalUrls}: ${jobData.job_name} (ID: ${result})`);
		} else {
			skippedCount++;
			console.log(`❌ Failed ${skippedCount}: ${jobData.job_name}`);
		}
		activeSaves--;
		return result;
	};

	const manageConcurrency = async () => {
		while (activeSaves >= maxConcurrentSaves) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	};

	for (const websiteKey of Object.keys(jobUrls)) {
		const websiteUrls = jobUrls[websiteKey];
		const websiteData = websitesData[websiteKey];

		if (!websiteData || !websiteData.jobDataSelectors) {
			console.log(`⚠️ No selectors defined for ${websiteKey}, skipping...`);
			continue;
		}

		console.log(`\n📖 Processing ${websiteUrls.length} URLs from ${websiteData.name}...`);

		for (let i = 0; i < websiteUrls.length; i += batchSize) {
			const batch = websiteUrls.slice(i, i + batchSize);

			for (const jobUrlData of batch) {
				console.log(`📖 Processing ${processed + 1}/${totalUrls}: ${jobUrlData.url}`);

				const jobData = await extractJobData(page, jobUrlData.url, websiteData.jobDataSelectors);
				if (jobData && jobData.job_name && jobData.company_name) {
					jobData.website_name = websiteData.name;
					jobData.source = jobUrlData.source;

					await manageConcurrency();

					activeSaves++;
					const savePromise = saveJobWithTracking(jobData)
						.catch(error => {
							console.error(`❌ Unexpected error saving ${jobData.job_name}:`, error.message);
							skippedCount++;
							activeSaves--;
							return null;
						});

					savePromises.push(savePromise);
				} else {
					console.log(`⚠️ Skipping job with missing data: ${jobUrlData.url}`);
					skippedCount++;
				}

				processed++;
				await page.waitForTimeout(300 + Math.random() * 700);
			}

			console.log(`✅ Completed extraction batch ${Math.ceil((i + batchSize) / batchSize)} of ${Math.ceil(websiteUrls.length / batchSize)} for ${websiteData.name}`);
			await page.waitForTimeout(500);
		}
	}

	console.log(`\n⏳ Waiting for ${savePromises.length} remaining API saves to complete...`);
	await Promise.allSettled(savePromises);

	await context.close();

	console.log(`\n🎯 PARALLEL PROCESSING COMPLETE`);
	console.log(`📊 Total URLs processed: ${processed}`);
	console.log(`✅ Successfully saved: ${savedCount} jobs`);
	console.log(`🔄 Duplicates skipped: ${duplicateCount} jobs`);
	console.log(`❌ Failed to save: ${skippedCount} jobs`);

	return { processed, savedCount, duplicateCount, skippedCount };
}

async function main() {
	console.log('🚀 Starting job crawler...');

	const allResults = {};

	for (const website of Object.keys(websitesData)) {
		try {
			const websiteData = websitesData[website];
			allResults[website] = await crawlWebsite(websiteData);

			console.log(`\n⏳ Waiting before next website...\n`);

			await new Promise(resolve => setTimeout(resolve, 2000));
		} catch (error) {
			console.error(`❌ Error crawling ${website.name}:`, error);
		}
	}

	console.log('\n🎉 URL COLLECTION COMPLETED!');
	const totalUrls = Object.values(allResults).flat().length;
	console.log(`📊 Total URLs collected: ${totalUrls}`);

	if (Object.keys(allResults).length > 0) {
		const results = await processJobUrls(allResults);

		console.log(`\n🎯 FINAL SUMMARY`);
		console.log(`📊 Total URLs processed: ${results.processed}`);
		console.log(`✅ Successfully saved: ${results.savedCount} jobs`);
		console.log(`🔄 Duplicates skipped: ${results.duplicateCount} jobs`);
		console.log(`❌ Failed to save: ${results.skippedCount} jobs`);

		const successRate = ((results.savedCount / results.processed) * 100).toFixed(1);
		console.log(`📈 Success rate: ${successRate}%`);
	} else {
		console.log('⚠️ No URLs collected to process');
	}
}

main()
	.then(() => {
		for (const website of Object.keys(websitesData)) {
			const websiteData = websitesData[website];
			crawlWebsite(websiteData);
		}

		console.log('✅ Process completed successfully!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('❌ Fatal error:', error);
		process.exit(1);
	});
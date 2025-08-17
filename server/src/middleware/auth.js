/**
 * JWT Authentication Middleware
 */
function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

	if (!token) {
		return res.status(401).json({
			success: false,
			error: 'Access token required'
		});
	}

	// Get AuthService from the app instance
	const authService = req.app.locals.authService;

	try {
		const decoded = authService.verifyToken(token);
		req.user = decoded;
		next();
	} catch (error) {
		return res.status(403).json({
			success: false,
			error: 'Invalid or expired token'
		});
	}
}

const authMiddleware = (req, res, next) => {
	const apiKey = req.headers['x-api-key'];

	if (!apiKey) {
		return res.status(401).json({
			error: 'API key required',
			message: 'X-API-Key header is missing'
		});
	}

	const validApiKey = process.env.CRAWLER_API_KEY;

	if (!validApiKey) {
		console.error('❌ CRAWLER_API_KEY environment variable not set');
		return res.status(500).json({
			error: 'Server configuration error',
			message: 'API key validation not configured'
		});
	}

	if (apiKey !== validApiKey) {
		console.warn(`⚠️ Invalid API key attempt from ${req.ip}`);
		return res.status(403).json({
			error: 'Invalid API key',
			message: 'Access denied'
		});
	}

	next();
};

module.exports = {
	authenticateToken,
	authMiddleware
};

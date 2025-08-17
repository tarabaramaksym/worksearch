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

module.exports = {
	authenticateToken
};

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ResponseFormatter = require('../utils/ResponseFormatter');

class AuthService {
	constructor(userRepository) {
		this.userRepo = userRepository;
		this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
		this.saltRounds = 10;
	}

	/**
	 * Register new user
	 */
	async register(email, password) {
		try {
			// Check if user already exists
			const existingUser = await this.userRepo.findByEmail(email);
			if (existingUser) {
				const error = new Error('User already exists');
				error.statusCode = 409;
				throw error;
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, this.saltRounds);

			// Create user
			const newUser = await this.userRepo.create({
				email,
				password_hash: passwordHash
			});

			// Generate token
			const token = this.generateToken(newUser.user_id, email);

			return ResponseFormatter.formatCreated(newUser.user_id, 'User registered successfully', {
				token,
				user: {
					user_id: newUser.user_id,
					email: newUser.email
				}
			});
		} catch (error) {
			if (error.statusCode === 409) {
				throw error;
			}
			throw new Error(`Registration failed: ${error.message}`);
		}
	}

	/**
	 * Login user
	 */
	async login(email, password) {
		try {
			// Find user
			const user = await this.userRepo.findByEmail(email);
			if (!user) {
				const error = new Error('Invalid email or password');
				error.statusCode = 401;
				throw error;
			}

			// Verify password
			const isValidPassword = await bcrypt.compare(password, user.password_hash);
			if (!isValidPassword) {
				const error = new Error('Invalid email or password');
				error.statusCode = 401;
				throw error;
			}

			// Generate token
			const token = this.generateToken(user.user_id, user.email);

			return {
				success: true,
				message: 'Login successful',
				data: {
					token,
					user: {
						user_id: user.user_id,
						email: user.email
					}
				}
			};
		} catch (error) {
			if (error.statusCode === 401) {
				throw error;
			}
			throw new Error(`Login failed: ${error.message}`);
		}
	}

	/**
	 * Generate JWT token
	 */
	generateToken(userId, email) {
		return jwt.sign(
			{ userId, email },
			this.jwtSecret,
			{ expiresIn: '24h' }
		);
	}

	/**
	 * Verify JWT token
	 */
	verifyToken(token) {
		try {
			return jwt.verify(token, this.jwtSecret);
		} catch (error) {
			throw new Error('Invalid token');
		}
	}
}

module.exports = AuthService;

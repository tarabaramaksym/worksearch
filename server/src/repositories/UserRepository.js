const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
	constructor(dbService) {
		super(dbService, 'users', 'user_id');
	}

	/**
	 * Find user by email
	 */
	async findByEmail(email) {
		return await this.getBy('email', email);
	}
}

module.exports = UserRepository;

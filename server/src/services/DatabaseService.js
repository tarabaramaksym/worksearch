const sqlite3 = require('sqlite3').verbose();

class DatabaseService {
	constructor(dbPath) {
		this.dbPath = dbPath;
		this.db = null;
		this.transactionQueue = [];
		this.processingTransaction = false;
		this.initialized = false;
	}

	/**
	 * Initialize database connection
	 */
	async init() {
		return new Promise((resolve, reject) => {
			const sqlite3 = require('sqlite3').verbose();
			this.db = new sqlite3.Database(this.dbPath, (err) => {
				if (err) {
					reject(err);
					return;
				}

				this.db.run('PRAGMA foreign_keys = ON', (err) => {
					if (err) {
						reject(err);
						return;
					}

					this.initialized = true;
					resolve();
				});
			});
		});
	}

	/**
	 * Close database connection
	 */
	async close() {
		return new Promise((resolve, reject) => {
			if (this.db) {
				this.db.close((err) => {
					if (err) {
						reject(err);
					} else {
						this.db = null;
						this.initialized = false;
						resolve();
					}
				});
			} else {
				resolve();
			}
		});
	}

	/**
	 * Execute a single query
	 */
	async run(query, params = []) {
		return new Promise((resolve, reject) => {
			if (!this.initialized) {
				reject(new Error('Database not initialized'));
				return;
			}

			this.db.run(query, params, function (err) {
				if (err) {
					reject(err);
				} else {
					resolve({
						lastID: this.lastID,
						changes: this.changes
					});
				}
			});
		});
	}

	/**
	 * Get a single record
	 */
	async get(query, params = []) {
		return new Promise((resolve, reject) => {
			if (!this.initialized) {
				reject(new Error('Database not initialized'));
				return;
			}

			this.db.get(query, params, (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row);
				}
			});
		});
	}

	/**
	 * Get multiple records
	 */
	async all(query, params = []) {
		return new Promise((resolve, reject) => {
			if (!this.initialized) {
				reject(new Error('Database not initialized'));
				return;
			}

			this.db.all(query, params, (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	/**
	 * Execute multiple queries in a transaction using queue system
	 */
	async transaction(queries) {
		return new Promise((resolve, reject) => {
			this.transactionQueue.push({
				queries,
				resolve,
				reject
			});

			this.processTransactionQueue();
		});
	}

	/**
	 * Process the transaction queue to prevent overlapping transactions
	 */
	processTransactionQueue() {
		if (this.processingTransaction || this.transactionQueue.length === 0) {
			return;
		}

		this.processingTransaction = true;

		this.processNextTransaction();
	}

	/**
	 * Process the next transaction in the queue
	 */
	processNextTransaction() {
		if (this.transactionQueue.length === 0) {
			this.processingTransaction = false;
			return;
		}

		const { queries, resolve, reject } = this.transactionQueue.shift();

		this.executeTransaction(queries)
			.then(result => {
				resolve(result);
				this.processNextTransaction();
			})
			.catch(error => {
				reject(error);
				this.processNextTransaction();
			});
	}

	/**
	 * Execute a single transaction (internal method)
	 */
	async executeTransaction(queries) {
		return new Promise((resolve, reject) => {
			if (!this.initialized) {
				reject(new Error('Database not initialized'));
				return;
			}

			const db = this.db;

			db.serialize(() => {
				db.run('BEGIN TRANSACTION');

				const results = [];
				let completed = 0;
				let hasError = false;

				queries.forEach((queryData, index) => {
					const { query, params = [] } = queryData;

					db.run(query, params, function (err) {
						if (err && !hasError) {
							hasError = true;
							db.run('ROLLBACK', (rollbackErr) => {
								if (rollbackErr) {
									console.error('Rollback error:', rollbackErr);
								}
								reject(err);
							});
							return;
						}

						if (!hasError) {
							results[index] = {
								lastID: this.lastID,
								changes: this.changes
							};

							completed++;

							if (completed === queries.length) {
								db.run('COMMIT', (commitErr) => {
									if (commitErr) {
										reject(commitErr);
									} else {
										resolve(results);
									}
								});
							}
						}
					});
				});
			});
		});
	}

	/**
	 * Check if a record exists
	 */
	async exists(table, conditions) {
		const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
		const values = Object.values(conditions);

		const query = `SELECT 1 FROM ${table} WHERE ${whereClause} LIMIT 1`;
		const result = await this.get(query, values);
		return !!result;
	}

	/**
	 * Get or create a record
	 */
	async getOrCreate(table, data, uniqueFields = []) {
		try {
			const whereConditions = {};
			uniqueFields.forEach(field => {
				if (data[field] !== undefined) {
					whereConditions[field] = data[field];
				}
			});

			if (Object.keys(whereConditions).length > 0) {
				const whereClause = Object.keys(whereConditions).map(key => `${key} = ?`).join(' AND ');
				const values = Object.values(whereConditions);

				const selectQuery = `SELECT * FROM ${table} WHERE ${whereClause}`;
				const existingRecord = await this.get(selectQuery, values);

				if (existingRecord) {
					return existingRecord;
				}
			}

			const currentTimestamp = new Date().toISOString();
			const dataWithTimestamps = { ...data };

			if (!dataWithTimestamps.created_at) {
				dataWithTimestamps.created_at = currentTimestamp;
			}

			const fields = Object.keys(dataWithTimestamps);
			const placeholders = fields.map(() => '?').join(', ');
			const values = Object.values(dataWithTimestamps);

			const insertQuery = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
			const result = await this.run(insertQuery, values);

			const createdRecord = await this.get(`SELECT * FROM ${table} WHERE rowid = ?`, [result.lastID]);
			return createdRecord;
		} catch (error) {
			throw new Error(`Failed to get or create record in ${table}: ${error.message}`);
		}
	}

	/**
	 * Create a new record
	 */
	async create(table, data) {
		try {
			const currentTimestamp = new Date().toISOString();
			const dataWithTimestamps = { ...data };

			if (!dataWithTimestamps.created_at) {
				dataWithTimestamps.created_at = currentTimestamp;
			}

			const fields = Object.keys(dataWithTimestamps);
			const placeholders = fields.map(() => '?').join(', ');
			const values = Object.values(dataWithTimestamps);

			const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
			const result = await this.run(query, values);

			const createdRecord = await this.get(`SELECT * FROM ${table} WHERE rowid = ?`, [result.lastID]);
			return createdRecord;
		} catch (error) {
			throw new Error(`Failed to create record in ${table}: ${error.message}`);
		}
	}

	/**
	 * Update a record
	 */
	async update(table, id, data, idField = 'id') {
		try {
			const currentTimestamp = new Date().toISOString();
			const dataWithTimestamps = { ...data };

			if (!dataWithTimestamps.updated_at) {
				dataWithTimestamps.updated_at = currentTimestamp;
			}

			const setClause = Object.keys(dataWithTimestamps).map(key => `${key} = ?`).join(', ');
			const values = [...Object.values(dataWithTimestamps), id];

			const query = `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?`;
			const result = await this.run(query, values);

			if (result.changes === 0) {
				throw new Error(`No record found with ${idField} = ${id}`);
			}

			const updatedRecord = await this.get(`SELECT * FROM ${table} WHERE ${idField} = ?`, [id]);
			return updatedRecord;
		} catch (error) {
			throw new Error(`Failed to update record in ${table}: ${error.message}`);
		}
	}

	/**
	 * Delete a record
	 */
	async delete(table, id, idField = 'id') {
		try {
			const query = `DELETE FROM ${table} WHERE ${idField} = ?`;
			const result = await this.run(query, [id]);

			if (result.changes === 0) {
				throw new Error(`No record found with ${idField} = ${id}`);
			}

			return result.changes > 0;
		} catch (error) {
			throw new Error(`Failed to delete record from ${table}: ${error.message}`);
		}
	}

	/**
	 * Get all records with optional ordering
	 */
	async getAll(table, orderBy = null) {
		try {
			let query = `SELECT * FROM ${table}`;
			if (orderBy) {
				query += ` ORDER BY ${orderBy}`;
			}

			return await this.all(query);
		} catch (error) {
			throw new Error(`Failed to get all records from ${table}: ${error.message}`);
		}
	}

	/**
	 * Get record by ID
	 */
	async getById(table, id, idField = 'id') {
		try {
			const query = `SELECT * FROM ${table} WHERE ${idField} = ?`;
			return await this.get(query, [id]);
		} catch (error) {
			throw new Error(`Failed to get record from ${table}: ${error.message}`);
		}
	}

	/**
	 * Get record by field value
	 */
	async getBy(table, field, value) {
		try {
			const query = `SELECT * FROM ${table} WHERE ${field} = ?`;
			return await this.get(query, [value]);
		} catch (error) {
			throw new Error(`Failed to get record from ${table}: ${error.message}`);
		}
	}

	/**
	 * Get records by field value
	 */
	async getByMultiple(table, field, values) {
		try {
			const placeholders = values.map(() => '?').join(', ');
			const query = `SELECT * FROM ${table} WHERE ${field} IN (${placeholders})`;
			return await this.all(query, values);
		} catch (error) {
			throw new Error(`Failed to get records from ${table}: ${error.message}`);
		}
	}

	/**
	 * Count records with optional conditions
	 */
	async count(table, conditions = {}) {
		try {
			let query = `SELECT COUNT(*) as count FROM ${table}`;
			let values = [];

			if (Object.keys(conditions).length > 0) {
				const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
				values = Object.values(conditions);
				query += ` WHERE ${whereClause}`;
			}

			const result = await this.get(query, values);
			return result.count;
		} catch (error) {
			throw new Error(`Failed to count records in ${table}: ${error.message}`);
		}
	}
}

module.exports = DatabaseService; 
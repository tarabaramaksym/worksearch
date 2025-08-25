const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseInitializer {
	constructor(dbPath = 'data/job_dashboard.db') {
		const currentDir = __dirname;

		if (currentDir.includes('server')) {
			this.dbPath = dbPath;
			this.schemaPath = path.join(__dirname, '..', 'schema');
		} else {
			this.dbPath = path.join('server', 'data', dbPath);
			this.schemaPath = path.join('server', 'schema');
		}

		this.db = null;
	}

	/**
	 * Initialize the database with all tables
	 */
	async initialize() {
		try {
			await this.connect();
			await this.enableForeignKeys();
			await this.createTables();
			console.log('✅ Database initialized successfully!');
		} catch (error) {
			console.error('❌ Database initialization failed:', error);
			throw error;
		} finally {
			if (this.db) {
				this.db.close();
			}
		}
	}

	/**
	 * Connect to SQLite database
	 */
	connect() {
		return new Promise((resolve, reject) => {
			this.db = new sqlite3.Database(this.dbPath, (err) => {
				if (err) {
					reject(err);
				} else {
					console.log('🔗 Connected to SQLite database');
					resolve();
				}
			});
		});
	}

	/**
	 * Enable foreign key constraints
	 */
	enableForeignKeys() {
		return new Promise((resolve, reject) => {
			this.db.run('PRAGMA foreign_keys = ON', (err) => {
				if (err) {
					reject(err);
				} else {
					console.log('🔒 Foreign key constraints enabled');
					resolve();
				}
			});
		});
	}

	/**
	 * Create all tables in dependency order
	 */
	async createTables() {
		const tablesConfig = JSON.parse(
			fs.readFileSync(path.join(this.schemaPath, 'tables.json'), 'utf8')
		);

		const tableOrder = Object.keys(tablesConfig.tables);
		console.log('📋 Creating tables in order:', tableOrder);

		for (const tableName of tableOrder) {
			await this.createTable(tableName);
		}
	}

	/**
	 * Create a single table from schema
	 */
	createTable(tableName) {
		return new Promise((resolve, reject) => {
			try {
				const schemaFile = tableName + '.json';
				const schema = JSON.parse(
					fs.readFileSync(path.join(this.schemaPath, schemaFile), 'utf8')
				);

				const sql = this.generateCreateTableSQL(tableName, schema);
				console.log(`📝 Creating table: ${tableName}`);

				this.db.run(sql, (err) => {
					if (err) {
						console.error(`❌ Failed to create table ${tableName}:`, err);
						reject(err);
					} else {
						console.log(`✅ Table ${tableName} created successfully`);
						resolve();
					}
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Generate CREATE TABLE SQL from schema
	 */
	generateCreateTableSQL(tableName, schema) {
		let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
		const columns = [];
		const indexes = [];

		for (const [columnName, columnDef] of Object.entries(schema)) {
			if (columnName === 'indexes') {
				for (const [indexName, indexDef] of Object.entries(columnDef)) {
					indexes.push({
						name: indexName,
						type: indexDef.type,
						columns: indexDef.columns,
						tableName: tableName
					});
				}
				continue;
			}

			columns.push(this.generateColumnSQL(columnName, columnDef));
		}

		sql += columns.join(',\n');
		sql += '\n);';

		for (const index of indexes) {
			sql += '\n' + this.generateIndexSQL(index);
		}

		return sql;
	}

	/**
	 * Generate column SQL
	 */
	generateColumnSQL(columnName, columnDef) {
		let sql = `    ${columnName}`;

		if (columnDef.type) {
			if (columnDef.type.startsWith('ENUM')) {
				const enumValues = columnDef.type.match(/ENUM\((.*)\)/)[1];
				sql += ` TEXT CHECK(${columnName} IN (${enumValues}))`;
			} else {
				sql += ` ${columnDef.type}`;
			}
		}

		if (columnDef.primary_key) {
			sql += ' PRIMARY KEY';
		}

		if (columnDef.auto_increment) {
			sql += ' AUTOINCREMENT';
		}

		if (columnDef.nullable === false) {
			sql += ' NOT NULL';
		}

		if (columnDef.unique) {
			sql += ' UNIQUE';
		}

		if (columnDef.default !== undefined) {
			if (columnDef.default === 'CURRENT_TIMESTAMP') {
				sql += ' DEFAULT CURRENT_TIMESTAMP';
			} else if (columnDef.default === 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') {
				sql += ' DEFAULT CURRENT_TIMESTAMP';
			} else if (typeof columnDef.default === 'string' && columnDef.default !== null) {
				sql += ` DEFAULT '${columnDef.default}'`;
			} else if (typeof columnDef.default === 'boolean') {
				sql += ` DEFAULT ${columnDef.default ? 1 : 0}`;
			} else if (columnDef.default === null) {
				sql += ' DEFAULT NULL';
			} else {
				sql += ` DEFAULT ${columnDef.default}`;
			}
		}

		if (columnDef.foreign_key) {
			const fk = columnDef.foreign_key;
			const [table, column] = fk.references.split('.');

			sql += ` REFERENCES ${table}(${column})`;
			if (fk.on_delete) {
				sql += ` ON DELETE ${fk.on_delete}`;
			}
			if (fk.on_update) {
				sql += ` ON UPDATE ${fk.on_update}`;
			}
		}

		return sql;
	}

	/**
	 * Generate index SQL
	 */
	generateIndexSQL(index) {
		const { name, type, columns, tableName } = index;
		const columnList = columns.join(', ');

		if (type === 'UNIQUE') {
			return `CREATE UNIQUE INDEX IF NOT EXISTS ${name} ON ${tableName} (${columnList});`;
		} else {
			return `CREATE INDEX IF NOT EXISTS ${name} ON ${tableName} (${columnList});`;
		}
	}

	/**
	 * Helper to run queries with promises
	 */
	runQuery(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) {
					reject(err);
				} else {
					resolve(this);
				}
			});
		});
	}

	/**
	 * Reset database (drop all tables)
	 */
	async reset() {
		console.log('🗑️ Resetting database...');
		const tables = ['job_tags', 'jobs', 'responses', 'tags', 'websites'];

		for (const table of tables) {
			await this.runQuery(`DROP TABLE IF EXISTS ${table}`);
		}

		console.log('✅ Database reset complete');
	}
}

module.exports = DatabaseInitializer;

if (require.main === module) {
	const initializer = new DatabaseInitializer();

	const args = process.argv.slice(2);

	if (args.includes('--reset')) {
		initializer.connect()
			.then(() => initializer.reset())
			.then(() => initializer.initialize())
			.catch(console.error);
	} else {
		initializer.initialize();
	}
}

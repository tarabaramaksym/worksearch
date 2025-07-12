const sqlite3 = require('sqlite3').verbose();

class DatabaseService {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    /**
     * Connect to database
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('🔗 Connected to SQLite database');
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }

    /**
     * Execute a query that returns a single row
     */
    async get(query, params = []) {
        return new Promise((resolve, reject) => {
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
     * Execute a query that returns multiple rows
     */
    async all(query, params = []) {
        return new Promise((resolve, reject) => {
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
     * Execute a query that modifies data (INSERT, UPDATE, DELETE)
     */
    async run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
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
     * Execute multiple queries in a transaction
     */
    async transaction(queries) {
        return new Promise((resolve, reject) => {
            const db = this.db;
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                const results = [];
                let completed = 0;
                
                queries.forEach((queryData, index) => {
                    const { query, params = [] } = queryData;
                    
                    db.run(query, params, function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        
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

            const fields = Object.keys(data);
            const placeholders = fields.map(() => '?').join(', ');
            const values = Object.values(data);
            
            const insertQuery = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
            const result = await this.run(insertQuery, values);
            
            const createdRecord = await this.get(`SELECT * FROM ${table} WHERE rowid = ?`, [result.lastID]);
            return createdRecord;
            
        } catch (error) {
            throw new Error(`Failed to getOrCreate in ${table}: ${error.message}`);
        }
    }

    /**
     * Update a record by ID
     */
    async updateById(table, id, data, idField = 'id') {
        const fields = Object.keys(data);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(data), id];
        
        const query = `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?`;
        return await this.run(query, values);
    }

    /**
     * Delete a record by ID
     */
    async deleteById(table, id, idField = 'id') {
        const query = `DELETE FROM ${table} WHERE ${idField} = ?`;
        return await this.run(query, [id]);
    }

    /**
     * Get total count of records in a table
     */
    async count(table, conditions = {}) {
        let query = `SELECT COUNT(*) as count FROM ${table}`;
        const values = [];
        
        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
            query += ` WHERE ${whereClause}`;
            values.push(...Object.values(conditions));
        }
        
        const result = await this.get(query, values);
        return result.count;
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('🔒 Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = DatabaseService; 
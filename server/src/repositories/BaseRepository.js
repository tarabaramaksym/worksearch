class BaseRepository {
    constructor(dbService, tableName, primaryKey = 'id') {
        this.db = dbService;
        this.tableName = tableName;
        this.primaryKey = primaryKey;
    }

    /**
     * Get all records
     */
    async getAll(orderBy = null) {
        let query = `SELECT * FROM ${this.tableName}`;
        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }
        return await this.db.all(query);
    }

    /**
     * Get record by ID
     */
    async getById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        return await this.db.get(query, [id]);
    }

    /**
     * Get record by field
     */
    async getBy(field, value) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${field} = ?`;
        return await this.db.get(query, [value]);
    }

    /**
     * Get multiple records by field
     */
    async getAllBy(field, value) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${field} = ?`;
        return await this.db.all(query, [value]);
    }

    /**
     * Create new record
     */
    async create(data) {
        const fields = Object.keys(data);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
        const result = await this.db.run(query, values);
        
        return await this.getById(result.lastID);
    }

    /**
     * Update record by ID
     */
    async update(id, data) {
        const result = await this.db.updateById(this.tableName, id, data, this.primaryKey);
        return result.changes > 0;
    }

    /**
     * Delete record by ID
     */
    async delete(id) {
        const result = await this.db.deleteById(this.tableName, id, this.primaryKey);
        return result.changes > 0;
    }

    /**
     * Check if record exists
     */
    async exists(conditions) {
        return await this.db.exists(this.tableName, conditions);
    }

    /**
     * Get or create record
     */
    async getOrCreate(data, uniqueFields = []) {
        return await this.db.getOrCreate(this.tableName, data, uniqueFields);
    }

    /**
     * Count records
     */
    async count(conditions = {}) {
        return await this.db.count(this.tableName, conditions);
    }

    /**
     * Search records with LIKE
     */
    async search(field, term) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${field} LIKE ?`;
        return await this.db.all(query, [`%${term}%`]);
    }
}

module.exports = BaseRepository; 
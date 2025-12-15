"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Generic Data Access Object (DAO) class.
 * * This class provides a standardized interface for **CRUD (Create, Read, Update, Delete)** operations,
 * decoupling the application's business logic from the underlying MySQL database implementation.
 * * **Key Responsibilities:**
 * 1.  **Query Building:** Translates structured, type-safe condition objects (like `Where` and `Set`)
 * into prepared SQL statements, preventing SQL injection.
 * 2.  **Entity Mapping:** Manages the hydration and transformation of raw database records (rows)
 * into fully instantiated, typed Entity objects (`T`).
 * 3.  **Connection Management:** Utilizes a provided MySQL connection pool to execute queries efficiently.
 * * @template T - The specific Entity model type extending the base {@link Entity} class that this DAO manages (e.g., `User` or `Product`).
 */
class GenericDAO {
    /**
     * Initializes a new DAO instance.
     * @param entityType The entity class (used to determine table name).
     * @param EntityClass The constructor function for the Entity model.
     * @param connection The MySQL connection source, which can be a Pool or an active Connection (for transactions).
     */
    constructor(entityType, EntityClass, connection // Accepts Pool or Connection
    ) {
        this.EntityClass = EntityClass;
        this.connection = connection;
        this.entityName = entityType.EntityName;
    }
    /**
     * Builds a WHERE clause for SQL queries from a Where object.
     * @param where - The Where condition(s) to build.
     * @param params - Array to store parameter values for prepared statements.
     * @returns The constructed WHERE clause string.
     */
    buildWhereClause(where, params, EntityName = this.entityName) {
        // Handle logical connectors (AND/OR)
        if ("connectors" in where) {
            // Recursively build clauses for each condition
            const clauses = where.prepositions.map((prep) => this.buildWhereClause(prep, params));
            return `(${clauses.join(` ${where.connectors} `)})`; // Combine with connector
        }
        else {
            // Handle single condition
            const operator = where.operator || "="; // Default to equality operator
            params.push(EntityName, where.field, where.value); // Add field and value to parameters
            return operator !== "IN"
                ? `??.?? ${operator} ?`
                : `??.?? ${operator} (?)`; // Return prepared statement format
        }
    }
    //**************************************** INSERT OPERATIONS ****************************************
    /**
     * Inserts a single entity into the database.
     * @param entity - The entity to insert.
     * @returns The ID of the newly inserted record.
     * @throws Error if insertion fails.
     */
    async insert(entity) {
        try {
            const data = entity.toDBRecord();
            const [result] = await this.connection.query(`INSERT INTO ?? SET ?`, [
                this.entityName,
                data,
            ]);
            if ("insertId" in result) {
                return result.insertId;
            }
            throw new Error("Insert failed - no insertId returned");
        }
        catch (error) {
            console.error("❌ Insert error:", error);
            throw error;
        }
    }
    /**
     * Bulk inserts multiple entities.
     * @param entities - Array of entities to insert.
     * @returns Array of inserted IDs (may be empty if using INSERT IGNORE).
     */
    async insertAll(entities) {
        if (entities.length === 0)
            return [];
        // Get column names from first entity
        const columns = Object.keys(entities[0].toDBRecord());
        // Prepare values array for bulk insert
        const values = entities.map((entity) => columns.map((col) => entity.toDBRecord()[col]));
        // Create placeholders for prepared statement (?, ?, ?)
        const placeholders = values
            .map(() => `(${columns.map(() => "?").join(", ")})`)
            .join(", ");
        // Build the SQL query
        const sql = `INSERT IGNORE INTO \`${this.entityName}\` (${columns.join(", ")}) VALUES ${placeholders}`;
        // Flatten 2D values array into 1D for query
        const flatValues = values.flat();
        const [result] = await this.connection.query(sql, flatValues);
        return result.insertId ? [result.insertId] : [];
    }
    /**
     * Performs a bulk **Upsert** operation using the MySQL
     * `INSERT INTO ... ON DUPLICATE KEY UPDATE` syntax.
     * * If a row with a matching primary or unique key exists, the row is updated;
     * otherwise, a new row is inserted.
     * * @param entities - Array of entities to upsert.
     * @returns Array of inserted/updated IDs (IDs from the database).
     */
    async upsertAll(entities) {
        if (entities.length === 0)
            return [];
        // Get DB Records and Columns
        const dbRecords = entities.map((entity) => entity.toDBRecord());
        // Get column names from the first entity (all must be consistent)
        const columns = Object.keys(dbRecords[0]);
        // Prepare Values Array
        const values = dbRecords.map((record) => columns.map((col) => record[col]));
        // Build Placeholder Strings
        const columnNames = columns.join(", ");
        const valuePlaceholders = values
            .map(() => `(${columns.map(() => "?").join(", ")})`)
            .join(", ");
        // Build the ON DUPLICATE KEY UPDATE clause
        // This updates all columns except the key columns themselves
        const updateClauses = columns
            // Map each column to its update assignment: `colName` = VALUES(`colName`)
            .map((col) => `\`${col}\` = VALUES(\`${col}\`)`)
            .join(", ");
        // Construct the final SQL query
        const sql = `
        INSERT INTO \`${this.entityName}\` (${columnNames}) 
        VALUES ${valuePlaceholders}
        ON DUPLICATE KEY UPDATE 
        ${updateClauses}
    `;
        // Flatten 2D values array into 1D for query execution
        const flatValues = values.flat();
        try {
            const [result] = await this.connection.query(sql, flatValues);
            // Handling returned IDs is complex for bulk upserts.
            // MySQL returns the ID of the first affected row, but we return an empty array
            // to indicate successful execution without batch ID calculation.
            return [];
        }
        catch (error) {
            console.error("❌ UpsertAll error:", error);
            throw error;
        }
    }
    //**************************************** SELECT OPERATIONS ****************************************
    /**
     * Selects an entity by its ID with optional related entities eagerly loaded.
     * @param id The ID of the entity to retrieve.
     * @param options Options including joins for eager loading.
     * @returns The entity or null if not found.
     */
    async selectWhereID(id, options) {
        const whereCondition = {
            field: "id",
            value: id,
        };
        // Pass the options (which contain joins) to the selectWhere method
        const results = await this.selectWhere(whereCondition, options);
        return results[0] ?? null;
    }
    /**
     * Selects all entities from the table.
     * @returns Array of all entities.
     */
    async selectAll(options) {
        const { limit, offset, orderBy } = options || {};
        let query = `SELECT * FROM ??`;
        const params = [this.entityName];
        // Add ORDER BY
        if (orderBy && orderBy.length > 0) {
            query += " ORDER BY";
            for (let order of orderBy) {
                query += ` ??.?? ${order.direction}`;
                params.push(this.entityName, order.field);
            }
        }
        // Add LIMIT/OFFSET
        if (limit !== undefined) {
            query += " LIMIT ?";
            params.push(limit);
            if (offset !== undefined) {
                query += " OFFSET ?";
                params.push(offset);
            }
        }
        const [rows] = await this.connection.query(query, params);
        if (!Array.isArray(rows)) {
            throw new Error("Unexpected query result format");
        }
        const entities = rows.map((entity) => new this.EntityClass(entity));
        return entities;
    }
    /**
     * Selects paginated results from the table.
     * @param page - Page number (0-based).
     * @param offset - Number of items per page.
     * @returns Array of entities for the requested page.
     */
    async selectAllPaginated(page, offset, options) {
        const { joins, orderBy } = options || {};
        return this.selectWhere({
            field: "id",
            value: 0,
            operator: ">",
        }, {
            limit: offset,
            offset: (page - 1) * offset,
            joins,
            orderBy,
        });
    }
    /**
     * Selects entities matching WHERE conditions.
     * @param where - The conditions to filter by.
     * @returns Array of matching entities.
     */
    async selectWhere(where, options) {
        const { fields = [], joins = [], limit, offset, orderBy } = options || {};
        let query = `SELECT `;
        const params = [];
        if (fields.length === 0) {
            query += `${this.entityName}.*`;
        }
        else {
            query += fields.map((field) => `??.??`).join(", ");
            params.push(...fields.flatMap((field) => [this.entityName, field]));
        }
        // add fields to selects from joined tables (tables other than the one for this model)
        if (joins) {
            // for each join
            for (const join of joins) {
                // append the fields of the join being selected
                // specify name so the attribute names do not conflict
                const fields = join.fields
                    ? join.fields
                        .map((field) => `${join.rightTable.EntityName}.${field} AS ${join.rightTable.EntityName}_${field}`)
                        .join(", ")
                    : "";
                // if the join had fields to select (some times we just join for conditions not to select)
                if (fields) {
                    query += `, ${fields}`;
                }
            }
        }
        // finish select with from
        query += ` FROM ??`;
        params.push(this.entityName);
        // start actually adding join statements
        if (joins) {
            // for each join
            for (const join of joins) {
                // by default left join (join that always returns results from this current table)
                query += ` ${join.type || "LEFT"} JOIN ?? ON ?? = ??`;
                // add params for the joined table and table name
                params.push(join.rightTable.EntityName, `${join.leftTable?.EntityName ?? this.entityName}.${join.on.left}`, `${join.rightTable.EntityName}.${join.on.right}`);
            }
        }
        // final step construct the where
        if (where) {
            query += " WHERE " + this.buildWhereClause(where, params);
        }
        // add where clauses for joined tables
        if (joins) {
            // for each join
            for (const join of joins) {
                if (join.where) {
                    query +=
                        " AND " +
                            this.buildWhereClause(join.where, params, join.where.targetTable?.EntityName ?? join.rightTable.EntityName);
                }
            }
        }
        let countOrderBy = 0;
        // Add ORDER BY
        if (orderBy && orderBy.length > 0) {
            query += " ORDER BY";
            for (let order of orderBy) {
                if (countOrderBy > 0)
                    query += ", ";
                query += ` ??.?? ${order.direction}`;
                params.push(this.entityName, order.field);
                countOrderBy++;
            }
        }
        // another order by if specified
        if (joins) {
            for (const join of joins) {
                if (join.orderBy) {
                    // if the order by clause is already there
                    if (!query.includes("ORDER BY"))
                        query += " ORDER BY";
                    if (countOrderBy > 0)
                        query += ", ";
                    for (let order of join.orderBy) {
                        query += `??.?? ${order?.direction}`;
                        params.push(order.table ? order.table.EntityName : join.leftTable, order.field);
                        countOrderBy++;
                    }
                }
            }
        }
        // Add LIMIT/OFFSET
        if (limit !== undefined) {
            query += " LIMIT ?";
            params.push(limit);
            if (offset !== undefined) {
                query += " OFFSET ?";
                params.push(offset);
            }
        }
        const [rows] = await this.connection.query(query, params);
        if (!Array.isArray(rows)) {
            throw new Error("Unexpected query result format");
        }
        // rows is already the array of results, no need for rows[0]
        const entities = rows.map((rowData) => new this.EntityClass(rowData));
        // Process results
        return rows.map((row) => {
            const entityData = {};
            const joinedData = {};
            // Extract main entity fields
            for (const field of fields.length ? fields : Object.keys(row)) {
                if (row.hasOwnProperty(field)) {
                    // @ts-ignore
                    entityData[field] = row[field];
                }
            }
            // Extract joined fields
            for (const join of joins) {
                joinedData[join.rightTable.EntityName] = {};
                if (join.fields) {
                    for (const field of join.fields) {
                        const rowKey = `${join.rightTable.EntityName}_${field}`;
                        if (row.hasOwnProperty(rowKey)) {
                            // @ts-ignore
                            joinedData[join.rightTable.EntityName][field] = row[rowKey];
                            delete entityData[rowKey];
                        }
                    }
                }
            }
            const entity = new this.EntityClass({
                ...entityData,
                _joins: joinedData,
            });
            return entity;
        });
    }
    async selectRandom() {
        const [result] = await this.query(`SELECT * FROM ??
       ORDER BY RAND()
       LIMIT 1`, [this.entityName]);
        if ("ID" in result && result["ID"])
            return new this.EntityClass(result);
        return null;
    }
    /**
     * Counts total entities in the table.
     * @returns The total count.
     */
    async count() {
        const result = await this.connection.query("SELECT COUNT(*) AS count FROM ??", [this.entityName]);
        return result[0].count;
    }
    /**
     * Counts entities that match the given where condition.
     * @param where - the condition to filter by
     * @returns The count of matching rows.
     */
    async countWhere(where) {
        let query = `SELECT COUNT(*) AS count FROM ??`;
        const params = [this.entityName];
        if (where) {
            query += " WHERE " + this.buildWhereClause(where, params);
        }
        const [rows] = await this.connection.query(query, params);
        return rows[0].count;
    }
    //**************************************** UPDATE OPERATIONS ****************************************
    /**
     * Updates an existing entity.
     * @param entity - The entity with updated values.
     * @returns The updated entity.
     */
    async update(entity) {
        await this.connection.query("UPDATE ?? SET ? WHERE id = ?", [
            this.entityName,
            entity.toDBRecord(),
            entity.id,
        ]);
        return new this.EntityClass(entity);
    }
    ConstructorFactory(entities) {
        return entities.map((rowData) => new this.EntityClass(rowData));
    }
    /**
     * Builds SET clause for UPDATE queries.
     * @param set - The Set conditions to build.
     * @param params - Array to store parameter values.
     * @returns The constructed SET clause string.
     */
    buildSetClause(set, params) {
        const conditions = Array.isArray(set) ? set : [set];
        const clauses = conditions.map((cond) => {
            const op = cond.operator || "=";
            if (op === "+=") {
                params.push(cond.field, cond.field, cond.value);
                return `?? = ?? + ?`;
            }
            else if (op === "-=") {
                params.push(cond.field, cond.field, cond.value);
                return `?? = ?? - ?`;
            }
            else {
                params.push(cond.field, cond.value);
                return `?? = ?`;
            }
        });
        return clauses.join(", ");
    }
    /**
     * Updates entities matching WHERE conditions.
     * @param where - Conditions to select entities to update.
     * @param set - The values to update.
     * @returns Number of affected rows.
     */
    async updateWhere(where, set) {
        let query = "UPDATE ?? SET";
        const params = [this.entityName];
        query += this.buildSetClause(set, params);
        if (where) {
            query += " WHERE " + this.buildWhereClause(where, params);
        }
        const [result] = await this.connection.query(query, params);
        return result.affectedRows;
    }
    //**************************************** DELETE OPERATIONS ****************************************
    /**
     * Deletes an entity by ID.
     * @param id - The ID of the entity to delete.
     * @returns The deleted entity or null if not found.
     */
    async deleteWhereID(id) {
        const result = await this.deleteWhere({
            field: "ID",
            value: id,
        });
        return result ? result[0] : null;
    }
    /**
     * Deletes an entity.
     * @param entity - The entity to delete.
     * @returns The deleted entity or null if no ID.
     */
    async delete(entity) {
        if (entity.id)
            return this.deleteWhereID(entity.id);
        return null;
    }
    /**
     * Deletes entities matching WHERE conditions.
     * @param where - Conditions to select entities to delete.
     * @returns Array of deleted entities or null if none.
     */
    async deleteWhere(where) {
        const rows = await this.selectWhere(where);
        const params = [this.entityName];
        let query = "DELETE FROM ?? WHERE ";
        if (rows && where) {
            query += this.buildWhereClause(where, params);
            await this.connection.query(query, params);
            return rows;
        }
        else {
            return null;
        }
    }
    //**************************************** CUSTOM QUERIES ****************************************
    /**
     * Executes a custom SQL query.
     * @param query - The SQL query string.
     * @param params - Parameters for prepared statement.
     * @returns The query result.
     */
    async query(query, params) {
        const [result] = await this.connection.query(query, params);
        return result;
    }
    getEntityName() {
        return this.entityName;
    }
}
exports.default = GenericDAO;

import { Connection, Pool } from "mysql2/promise";
import Entity from "./entity.model.js";
import { Options, SelectOptions, Where } from "./utils/types.js";
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
export default class GenericDAO<T extends Entity> {
    private EntityClass;
    private connection;
    private entityName;
    /**
     * Initializes a new DAO instance.
     * @param entityType The entity class (used to determine table name).
     * @param EntityClass The constructor function for the Entity model.
     * @param connection The MySQL connection source, which can be a Pool or an active Connection (for transactions).
     */
    constructor(entityType: typeof Entity, EntityClass: new (data: any) => T, connection: Pool | Connection);
    /**
     * Builds a WHERE clause for SQL queries from a Where object.
     * @param where - The Where condition(s) to build.
     * @param params - Array to store parameter values for prepared statements.
     * @returns The constructed WHERE clause string.
     */
    private buildWhereClause;
    /**
     * Inserts a single entity into the database.
     * @param entity - The entity to insert.
     * @returns The ID of the newly inserted record.
     * @throws Error if insertion fails.
     */
    insert(entity: T): Promise<number>;
    /**
     * Bulk inserts multiple entities.
     * @param entities - Array of entities to insert.
     * @returns Array of inserted IDs (may be empty if using INSERT IGNORE).
     */
    insertAll(entities: T[]): Promise<number[]>;
    /**
     * Performs a bulk **Upsert** operation using the MySQL
     * `INSERT INTO ... ON DUPLICATE KEY UPDATE` syntax.
     * * If a row with a matching primary or unique key exists, the row is updated;
     * otherwise, a new row is inserted.
     * * @param entities - Array of entities to upsert.
     * @returns Array of inserted/updated IDs (IDs from the database).
     */
    upsertAll(entities: T[]): Promise<number[]>;
    /**
     * Selects an entity by its ID with optional related entities eagerly loaded.
     * @param id The ID of the entity to retrieve.
     * @param options Options including joins for eager loading.
     * @returns The entity or null if not found.
     */
    selectWhereID(id: number, options?: SelectOptions<T>): Promise<T | null>;
    /**
     * Selects all entities from the table.
     * @returns Array of all entities.
     */
    selectAll(options?: Options<T>): Promise<T[]>;
    /**
     * Selects paginated results from the table.
     * @param page - Page number (0-based).
     * @param offset - Number of items per page.
     * @returns Array of entities for the requested page.
     */
    selectAllPaginated(page: number, offset: number, options?: Options<T>): Promise<T[]>;
    /**
     * Selects entities matching WHERE conditions.
     * @param where - The conditions to filter by.
     * @returns Array of matching entities.
     */
    selectWhere(where: Where<T>, options?: SelectOptions<T>): Promise<T[]>;
    selectRandom(): Promise<T | null>;
    /**
     * Counts total entities in the table.
     * @returns The total count.
     */
    count(): Promise<number>;
    /**
     * Counts entities that match the given where condition.
     * @param where - the condition to filter by
     * @returns The count of matching rows.
     */
    countWhere(where: Where<T>): Promise<number>;
    /**
     * Updates an existing entity.
     * @param entity - The entity with updated values.
     * @returns The updated entity.
     */
    update(entity: T): Promise<T>;
    ConstructorFactory(entities: T[]): T[];
    /**
     * Builds SET clause for UPDATE queries.
     * @param set - The Set conditions to build.
     * @param params - Array to store parameter values.
     * @returns The constructed SET clause string.
     */
    private buildSetClause;
    /**
     * Updates entities matching WHERE conditions.
     * @param where - Conditions to select entities to update.
     * @param set - The values to update.
     * @returns Number of affected rows.
     */
    updateWhere(where: Where<T>, set: Set<T>): Promise<number>;
    /**
     * Deletes an entity by ID.
     * @param id - The ID of the entity to delete.
     * @returns The deleted entity or null if not found.
     */
    deleteWhereID(id: number): Promise<T | null>;
    /**
     * Deletes an entity.
     * @param entity - The entity to delete.
     * @returns The deleted entity or null if no ID.
     */
    delete(entity: T): Promise<T | null>;
    /**
     * Deletes entities matching WHERE conditions.
     * @param where - Conditions to select entities to delete.
     * @returns Array of deleted entities or null if none.
     */
    deleteWhere(where: Where<T> & {}): Promise<T[] | null>;
    /**
     * Executes a custom SQL query.
     * @param query - The SQL query string.
     * @param params - Parameters for prepared statement.
     * @returns The query result.
     */
    protected query(query: string, params: Array<any>): Promise<any>;
    getEntityName(): string;
}

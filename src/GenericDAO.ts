// Import required modules and types
import mysql, { Connection, Pool } from "mysql2/promise"; // MySQL connection pool with promise support
import Entity from "./entity.model.js"; // Base Entity model
import { Options, SelectOptions, Where, WhereCondition } from "./utils/types.js";

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
  private connection: Pool | Connection;
  private entityName: string; // Name of the database table/entity

  /**
   * Initializes a new DAO instance.
   * @param entityType The entity class (used to determine table name).
   * @param EntityClass The constructor function for the Entity model.
   * @param connection The MySQL connection source, which can be a Pool or an active Connection (for transactions).
   */
  constructor(
    entityType: typeof Entity,
    private EntityClass: new (data: any) => T,
    connection: Pool | Connection // Accepts Pool or Connection
  ) {
    this.connection = connection;
    this.entityName = entityType.EntityName;
  }

  /**
   * Builds a WHERE clause for SQL queries from a Where object.
   * @param where - The Where condition(s) to build.
   * @param params - Array to store parameter values for prepared statements.
   * @returns The constructed WHERE clause string.
   */
  private buildWhereClause(
    where: Where<T> & {},
    params: any[],
    EntityName: string = this.entityName
  ): string {
    // Handle logical connectors (AND/OR)
    if ("connectors" in where) {
      // Recursively build clauses for each condition
      const clauses = where.prepositions.map((prep) =>
        this.buildWhereClause(prep, params)
      );
      return `(${clauses.join(` ${where.connectors} `)})`; // Combine with connector
    } else {
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
  async insert(entity: T): Promise<number> {
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
    } catch (error) {
      console.error("❌ Insert error:", error);
      throw error;
    }
  }

  /**
   * Bulk inserts multiple entities.
   * @param entities - Array of entities to insert.
   * @returns Array of inserted IDs (may be empty if using INSERT IGNORE).
   */
  async insertAll(entities: T[]): Promise<number[]> {
    if (entities.length === 0) return [];

    // Get column names from first entity
    const columns: string[] = Object.keys(entities[0].toDBRecord());

    // Prepare values array for bulk insert
    const values: any[][] = entities.map((entity) =>
      columns.map((col) => (entity.toDBRecord() as any)[col])
    );

    // Create placeholders for prepared statement (?, ?, ?)
    const placeholders: string = values
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");

    // Build the SQL query
    const sql = `INSERT IGNORE INTO \`${this.entityName}\` (${columns.join(
      ", "
    )}) VALUES ${placeholders}`;

    // Flatten 2D values array into 1D for query
    const flatValues = values.flat();

    const [result] = await this.connection.query(sql, flatValues);

    return (result as any).insertId ? [(result as any).insertId] : [];
  }

  /**
   * Performs a bulk **Upsert** operation using the MySQL
   * `INSERT INTO ... ON DUPLICATE KEY UPDATE` syntax.
   * * If a row with a matching primary or unique key exists, the row is updated;
   * otherwise, a new row is inserted.
   * * @param entities - Array of entities to upsert.
   * @returns Array of inserted/updated IDs (IDs from the database).
   */
  async upsertAll(entities: T[]): Promise<number[]> {
    if (entities.length === 0) return [];

    // Get DB Records and Columns
    const dbRecords = entities.map((entity) => entity.toDBRecord());
    // Get column names from the first entity (all must be consistent)
    const columns: string[] = Object.keys(dbRecords[0]);

    // Prepare Values Array
    const values: any[][] = dbRecords.map((record) =>
      columns.map((col) => record[col])
    );

    // Build Placeholder Strings
    const columnNames = columns.join(", ");
    const valuePlaceholders: string = values
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");

    // Build the ON DUPLICATE KEY UPDATE clause
    // This updates all columns except the key columns themselves
    const updateClauses: string = columns
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
    } catch (error) {
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
  async selectWhereID(
    id: number,
    options?: SelectOptions<T>
  ): Promise<T | null> {
    const whereCondition: WhereCondition<T> = {
      field: "id" as keyof T,
      value: id as T[keyof T],
    };

    // Pass the options (which contain joins) to the selectWhere method
    const results = await this.selectWhere(whereCondition, options);

    return results[0] ?? null;
  }

  /**
   * Selects all entities from the table.
   * @returns Array of all entities.
   */
  async selectAll(options?: Options<T>): Promise<T[]> {
    const { limit, offset, orderBy } = options || {};

    let query = `SELECT * FROM ??`;
    const params: any[] = [this.entityName];

    // Add ORDER BY
    if (orderBy && orderBy.length > 0) {
      query += " ORDER BY";
      for (let order of orderBy) {
        query += ` ??.?? ${order.direction}`;
        params.push(this.entityName, order.field as keyof T);
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

    const entities: T[] = rows.map(
      (entity: any) => new this.EntityClass(entity)
    );

    return entities;
  }

  /**
   * Selects paginated results from the table.
   * @param page - Page number (0-based).
   * @param offset - Number of items per page.
   * @returns Array of entities for the requested page.
   */
  async selectAllPaginated(
    page: number,
    offset: number,
    options?: Options<T>
  ): Promise<T[]> {
    const { joins, orderBy } = options || {};

    return this.selectWhere(
      {
        field: "id",
        value: 0 as any,
        operator: ">",
      },
      {
        limit: offset,
        offset: (page - 1) * offset,
        joins,
        orderBy,
      }
    );
  }

  /**
   * Selects entities matching WHERE conditions.
   * @param where - The conditions to filter by.
   * @returns Array of matching entities.
   */
  async selectWhere(where: Where<T>, options?: SelectOptions<T>): Promise<T[]> {
    const { fields = [], joins = [], limit, offset, orderBy } = options || {};

    let query = `SELECT `;
    const params: any[] = [];

    if (fields.length === 0) {
      query += `${this.entityName}.*`;
    } else {
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
              .map(
                (field) =>
                  `${join.rightTable.EntityName}.${field as string} AS ${
                    join.rightTable.EntityName
                  }_${field as string}`
              )
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
        params.push(
          join.rightTable.EntityName,
          `${join.leftTable?.EntityName ?? this.entityName}.${
            join.on.left as string
          }`,
          `${join.rightTable.EntityName}.${join.on.right as string}`
        );
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
            this.buildWhereClause(
              join.where,
              params,
              join.where.targetTable?.EntityName ?? join.rightTable.EntityName
            );
        }
      }
    }

    let countOrderBy = 0;
    // Add ORDER BY
    if (orderBy && orderBy.length > 0) {
      query += " ORDER BY";
      for (let order of orderBy) {
        if (countOrderBy > 0) query += ", ";
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
          if (!query.includes("ORDER BY")) query += " ORDER BY";
          if (countOrderBy > 0) query += ", ";
          for (let order of join.orderBy) {
            query += `??.?? ${order?.direction}`;
            params.push(
              order.table ? order.table.EntityName : join.leftTable,
              order.field
            );
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
    const entities: T[] = rows.map(
      (rowData: any) => new this.EntityClass(rowData)
    );

    // Process results
    return rows.map((row) => {
      const entityData: any = {};
      const joinedData: any = {};

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
            const rowKey = `${join.rightTable.EntityName}_${field as string}`;

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

  async selectRandom(): Promise<T | null> {
    const [result] = await this.query(
      `SELECT * FROM ??
       ORDER BY RAND()
       LIMIT 1`,
      [this.entityName]
    );

    if ("ID" in result && result["ID"]) return new this.EntityClass(result);

    return null;
  }

  /**
   * Counts total entities in the table.
   * @returns The total count.
   */
  async count(): Promise<number> {
    const result = await this.connection.query(
      "SELECT COUNT(*) AS count FROM ??",
      [this.entityName]
    );
    return (result as any)[0].count;
  }

  /**
   * Counts entities that match the given where condition.
   * @param where - the condition to filter by
   * @returns The count of matching rows.
   */
  async countWhere(where: Where<T>): Promise<number> {
    let query = `SELECT COUNT(*) AS count FROM ??`;
    const params: any[] = [this.entityName];

    if (where) {
      query += " WHERE " + this.buildWhereClause(where, params);
    }

    const [rows] = await this.connection.query(query, params);

    return (rows as any)[0].count;
  }

  //**************************************** UPDATE OPERATIONS ****************************************

  /**
   * Updates an existing entity.
   * @param entity - The entity with updated values.
   * @returns The updated entity.
   */
  async update(entity: T): Promise<T> {
    await this.connection.query("UPDATE ?? SET ? WHERE id = ?", [
      this.entityName,
      entity.toDBRecord(),
      entity.id,
    ]);

    return new this.EntityClass(entity);
  }

  ConstructorFactory(entities: T[]) {
    return entities.map((rowData: any) => new this.EntityClass(rowData));
  }

  /**
   * Builds SET clause for UPDATE queries.
   * @param set - The Set conditions to build.
   * @param params - Array to store parameter values.
   * @returns The constructed SET clause string.
   */
  private buildSetClause<T extends Entity>(set: Set<T>, params: any[]): string {
    const conditions = Array.isArray(set) ? set : [set];

    const clauses = conditions.map((cond) => {
      const op = cond.operator || "=";

      if (op === "+=") {
        params.push(cond.field, cond.field, cond.value);
        return `?? = ?? + ?`;
      } else if (op === "-=") {
        params.push(cond.field, cond.field, cond.value);
        return `?? = ?? - ?`;
      } else {
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
  async updateWhere(where: Where<T>, set: Set<T>): Promise<number> {
    let query = "UPDATE ?? SET";
    const params: any[] = [this.entityName];

    query += this.buildSetClause(set, params);

    if (where) {
      query += " WHERE " + this.buildWhereClause(where, params);
    }

    const [result] = await this.connection.query(query, params);
    return (result as any).affectedRows;
  }

  //**************************************** DELETE OPERATIONS ****************************************

  /**
   * Deletes an entity by ID.
   * @param id - The ID of the entity to delete.
   * @returns The deleted entity or null if not found.
   */
  async deleteWhereID(id: number): Promise<T | null> {
    const result = await this.deleteWhere({
      field: "ID" as keyof T,
      value: id as T[keyof T],
    });
    return result ? result[0] : null;
  }

  /**
   * Deletes an entity.
   * @param entity - The entity to delete.
   * @returns The deleted entity or null if no ID.
   */
  async delete(entity: T): Promise<T | null> {
    if (entity.id) return this.deleteWhereID(entity.id);
    return null;
  }

  /**
   * Deletes entities matching WHERE conditions.
   * @param where - Conditions to select entities to delete.
   * @returns Array of deleted entities or null if none.
   */
  async deleteWhere(where: Where<T> & {}): Promise<T[] | null> {
    const rows = await this.selectWhere(where);
    const params: any[] = [this.entityName];

    let query = "DELETE FROM ?? WHERE ";

    if (rows && where) {
      query += this.buildWhereClause(where, params);

      await this.connection.query(query, params);

      return rows;
    } else {
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
  protected async query(query: string, params: Array<any>): Promise<any> {
    const [result] = await this.connection.query(query, params);
    return result;
  }

  public getEntityName(): string {
    return this.entityName;
  }
}

import Entity from "../entity.model.js";
/**
 * Represents a basic clause for querying or updating entities,
 * specifying a field and the value to compare or assign.
 *
 * @template T - The entity type extending the base Entity model.
 */
export interface Clause<T extends Entity> {
    /** The entity field to query or update */
    field: keyof T;
    /** * The value used in the clause.
     * It is either the property type, a raw value for IN ([number[]]), or null.
     */
    value: T[keyof T] | any[] | null;
}
/**
 * Supported operators for WHERE clause conditions.
 */
type WhereOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS";
/**
 * Supported operators for SET clause assignments (used in updates).
 */
type SetOperator = "=" | "+=" | "-=";
/**
 * Represents a single condition in a WHERE clause,
 * combining a field, a value, and an optional operator.
 *
 * @template T - The entity type extending Entity.
 */
export interface WhereCondition<T extends Entity> extends Clause<T> {
    /** The comparison operator (e.g., '=', '>', 'LIKE') */
    operator?: WhereOperator;
}
export type WhereExpression<T extends Entity> = WhereCondition<T> | WhereComposite<T>;
/**
 * Represents a composite WHERE condition combining multiple
 * conditions with a logical connector (AND or OR).
 *
 * Example:
 * {
 *   connectors: "AND",
 *   prepositions: [
 *     { field: "userOd", operator: "=", value: "10" },
 *     { field: "age", operator: ">", value: 18 }
 *   ]
 * }
 *
 * @template T - The entity type extending Entity.
 */
export interface WhereComposite<T extends Entity> {
    connectors: "AND" | "OR";
    prepositions: WhereExpression<T>[];
}
/**
 * Represents a single assignment in a SET clause for updates,
 * specifying the field, operator, and value.
 *
 * Example: { field: "userId", operator: "=", value: 10 }
 *
 * @template T - The entity type extending Entity.
 */
export interface SetCondition<T extends Entity> extends Clause<T> {
    operator?: SetOperator;
}
/**
 * Union type representing a WHERE clause,
 * which can be either a single condition, a composite condition, or null.
 *
 * @template T - The entity type extending Entity.
 */
export type Where<T extends Entity> = WhereCondition<T> | WhereComposite<T> | null;
/**
 * Union type representing a SET clause,
 * which can be a single condition or an array of conditions.
 *
 * @template T - The entity type extending Entity.
 */
export type Set<T extends Entity> = SetCondition<T> | SetCondition<T>[];
/**
 * @template L - The left (base) table entity.
 * @template R - The right table entity being joined.
 * An object which defines a join to be made on other tables.
 */
export type Join<L extends Entity, R extends Entity> = {
    /**
     * The left table being joined.
     * If this is not specified:
     * @default by DAO Entity - default it will be for the DAO that is executing the query.
     */
    leftTable?: typeof Entity;
    /**
     * The right table being joined (required).
     */
    rightTable: (new (...args: any[]) => R) & typeof Entity;
    /**
     * The attributes to join on.
     * left - attribute of the left table.
     * right - attribute of the right table.
     */
    on: {
        left: keyof L;
        right: keyof R;
    };
    /**
     * The fields of the right table being joined that you want to select.
     * These will be aliased as `${R.EntityName}_${fieldName}`.
     */
    fields?: (keyof R)[];
    /**
     * The type of join.
     */
    type?: "LEFT" | "RIGHT" | "INNER";
    /**
     * Specify where condition which involves the right hand table.
     */
    where?: JoinWhere<R>;
    /**
     * Any order depending on the joined table.
     */
    orderBy?: OrderBy<R>[];
};
/**
 * To specify the column for which the where clause is targeting during a join
 */
export type JoinWhere<T extends Entity> = {
    /**
     * The table which the where clause will target.
     * @default The right table of the Join.
     */
    targetTable?: typeof Entity;
} & Where<T>;
/**
 * Options for general queries.
 */
export type Options<T extends Entity> = {
    /**
     * Any joins for the query.
     * Note: The inner `any, any` is used to allow mixing Join types in the array.
     */
    joins?: Join<any, any>[];
    /**
     * Limit the results of the query
     */
    limit?: number;
    /**
     * Offset for the query
     */
    offset?: number;
    /**
     * Order the query results
     */
    orderBy?: OrderBy<T>[];
};
/**
 * Specifies an order by clause in an sql section.
 * @template T - The entity type extending Entity.
 */
export type OrderBy<T extends Entity> = {
    /**
     * The table which the attribute ordering is targeting.
     * By default this is the table which the DAO generic is for.
     */
    table?: typeof Entity;
    field: keyof T;
    direction: "ASC" | "DESC";
};
/**
 * Options specifically for selects
 */
export type SelectOptions<T extends Entity> = {
    /**
     * Specific fields to select from the main table
     */
    fields?: (keyof T)[];
} & Options<T>;
/**
 * Custom Error class thrown when an Entity fails its validation checks
 * (implemented in the Entity#validate hook).
 */
export declare class EntityValidationError extends Error {
    constructor(msg?: string);
}
export {};

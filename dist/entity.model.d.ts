import "reflect-metadata";
export interface IUpdateEntity {
    [key: string]: any;
}
export interface IEntity {
    id?: number;
    [key: string]: any;
}
export default abstract class Entity implements IEntity {
    id: number;
    static EntityName: string;
    _joins: {
        [tableName: string]: {
            [columnName: string]: any;
        };
    };
    /**
     * Initializes a new Entity instance.
     * 1. **Assigns Attributes:** Calls {@link Entity#init} to set property values and perform type conversions.
     * 2. **Validates State:** Calls {@link Entity#validate} to run integrity checks.
     * * @param attributes The raw data used to initialize the entity, typically from a database record.
     * @throws {EntityValidationError} If the validation hook returns a string error message (i.e., the entity is invalid).
     * @see Entity#init
     * @see Entity#validate
     */
    constructor(attributes?: IEntity);
    /**
     * **(Override Hook)** Provides a protected hook for inherited classes to implement entity-specific
     * validation logic immediately after initialization.
     * * * By default, this method does nothing and returns `true`.
     * * @protected
     * @returns {true | string} Returns `true` if the entity state is valid. If invalid,
     * it should return a **string containing the specific error message**.
     */
    protected validate(): true | string;
    /**
     * Constructs an Entity instance and assigns all its attributes,
     * performing automatic **deserialization** (string from DB to object/Date).
     * @param attributes: IEntity The raw attributes, typically from a database query result.
     */
    protected init(attributes: IEntity): void;
    protected filterToEntity<T extends IUpdateEntity>(obj: any, keys: (keyof T)[]): T;
    /**
     * This method protects sensitive fields by removing them
     * @param object the object being sanitized
     * @returns the object its sensitive attributes stripped
     */
    abstract sanitize(): any;
    /**
     * A helper for updating attributes of this instance
     * @param attributes the attributes being updated
     */
    protected set(attributes: IUpdateEntity): void;
    /**
     * This method updates a property of the current instance
     * @param attributes the attributes being updated
     */
    abstract update(attributes: IUpdateEntity): void;
    /**
     * Makes this current instance into a DB compatible representation of a record.
     * This handles **serialization** (object/Date from Entity to string/DB format).
     * * - Properties with @Type(JSON) are explicitly JSON.stringified.
     * - Properties with @Type(DATE) or standard Date objects are formatted to 'YYYY-MM-DD HH:MM:SS'.
     * - All other non-primitive objects are still implicitly JSON.stringified (fallback).
     * * @returns A DB-ready plain object representation of the entity.
     */
    toDBRecord(): any;
    private static isISOString;
}

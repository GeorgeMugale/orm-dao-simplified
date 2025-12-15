import "reflect-metadata";
import { EntityPropertyType, getPropertyType } from "./utils/type-decorators.js"; // Assuming it's in a separate file
import { EntityValidationError } from "./utils/types.js";

export interface IUpdateEntity {
  [key: string]: any;
}

export interface IEntity {
  id?: number;
  [key: string]: any;
}

export default abstract class Entity implements IEntity {
  id!: number;
  static EntityName: string;
  _joins!: {
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
  constructor(attributes: IEntity = {}) {
    this.init(attributes);

    // Call validate and store the result (which is either 'true' or a string error message)
    const validationResult = this.validate();

    // Check if validation failed (i.e., if it returned a string)
    if (validationResult !== true) {
      // Pass the specific error message to the EntityValidationError constructor
      throw new EntityValidationError(validationResult);
    }
  }

  /**
   * **(Override Hook)** Provides a protected hook for inherited classes to implement entity-specific
   * validation logic immediately after initialization.
   * * * By default, this method does nothing and returns `true`.
   * * @protected
   * @returns {true | string} Returns `true` if the entity state is valid. If invalid,
   * it should return a **string containing the specific error message**.
   */
  protected validate(): true | string {
    return true;
  }

  /**
   * Constructs an Entity instance and assigns all its attributes,
   * performing automatic **deserialization** (string from DB to object/Date).
   * @param attributes: IEntity The raw attributes, typically from a database query result.
   */
  protected init(attributes: IEntity) {
    for (const prop in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, prop)) {
        const value = attributes[prop as keyof IEntity];
        const propertyType = getPropertyType(this, prop);
        let finalValue = value;

        // 1. Handle JSON property type
        if (
          propertyType === EntityPropertyType.JSON &&
          typeof value === "string"
        ) {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === "object" && parsed !== null) {
              finalValue = parsed;
            }
          } catch (e) {
            // Not valid JSON - assign as normal
          }
        }
        // 2. Handle DATE property type
        else if (
          propertyType === EntityPropertyType.DATE &&
          typeof value === "string"
        ) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              finalValue = date;
            }
          } catch (e) {
            // Not a valid date string - assign as normal
          }
        }

        // Default assignment for non-strings, failed parsing, or non-decorated properties
        (this as any)[prop] = finalValue;
      }
    }
  }

  protected filterToEntity<T extends IUpdateEntity>(
    obj: any,
    keys: (keyof T)[]
  ): T {
    const result = {} as T;
    keys.forEach((key) => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  }

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
  protected set(attributes: IUpdateEntity): void {
    for (const prop in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, prop)) {
        (this as any)[prop] = attributes[prop as keyof IEntity];
      }
    }
  }

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
  toDBRecord() {
    // Create a shallow copy of the object
    const record = { ...this } as any;

    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        let value = record[key];
        const propertyType = getPropertyType(this, key);

        if (value === undefined) {
          record[key] = null; // Undefined becomes NULL
          continue;
        }

        // Check for specific decorator types first
        if (propertyType === EntityPropertyType.JSON) {
          if (typeof value === "object" && value !== null) {
            record[key] = JSON.stringify(value); // Explicitly stringify the object
          }
          continue;
        }

        if (propertyType === EntityPropertyType.DATE || value instanceof Date) {
          // Convert Date objects or decorated strings/objects to DB date string
          let dateObject = value instanceof Date ? value : new Date(value);
          if (!isNaN(dateObject.getTime())) {
            // Format: 'YYYY-MM-DD HH:MM:SS'
            record[key] = dateObject
              .toISOString()
              .slice(0, 19)
              .replace("T", " ");
          }
          continue;
        }

        // Fallback: Handle non-decorated objects (original logic)
        if (
          typeof value === "object" &&
          value !== null &&
          !(value instanceof Buffer)
        ) {
          // Convert non-primitive, non-null, non-Date/Buffer objects to JSON
          // This covers objects that were not explicitly decorated as JSON
          record[key] = JSON.stringify(value);
        }
        // Else: primitive types and Buffer are left as-is
      }
    }

    delete record._joins;

    return record;
  }

  private static isISOString(str: string): boolean {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
    return isoRegex.test(str);
  }
}

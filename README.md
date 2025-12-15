# 📦 orm-dao-simplified

A lightweight and flexible Data Access Object (DAO) library built for TypeScript and MySQL. It provides a structured, type-safe layer over raw SQL, offering the safety and convenience of an ORM without the heavy abstraction.

## ✨ Features

  * **Type-Safe Queries:** Utilize TypeScript generics to ensure query clauses, fields, and joins are type-checked at compile time.
  * **Declarative Entity Modeling:** Define database fields and conversions using decorators (e.g., `@Type(EntityPropertyType.JSON)`).
  * **Robust Validation:** Enforce data integrity immediately upon entity instantiation using the built-in `validate` hook.
  * **Native Transaction Support:** Easily wrap multiple DAO operations in atomic transactions via the `runInTransaction` helper.
  * **Advanced CRUD:** Includes powerful methods like `upsertAll` (on duplicate key update) for efficient data synchronization.
  * **Model Generation Script:** A utility to automatically generate Entity and DAO boilerplate from your existing MySQL schema.

## 💾 Installation

```bash
npm install orm-dao-simplified mysql2 reflect-metadata
```

**Note:** Ensure you have `typescript` installed as a dev dependency and that `experimentalDecorators` and `emitDecoratorMetadata` are set to `true` in your `tsconfig.json`.

## 🏗️ Core Concepts

The library is based on two core classes, both exposed directly from the package:

| Component | Role |
| :--- | :--- |
| **`Entity`** | The abstract base class for all data models. Handles data lifecycle (validation, serialization/deserialization) and automatic type conversions via decorators. |
| **`GenericDAO<T>`** | The abstract class that encapsulates all database operations. Manages query construction and executes SQL via a `mysql2/promise` connection. |

### 1\. Unified Imports

Thanks to the updated structure, all core components and utilities are available from a single import:

```typescript
import { 
    Entity, GenericDAO, 
    EntityPropertyType, Type, 
    Where, Join, 
    runInTransaction 
} from 'orm-dao-simplified';
```

### 2\. Defining Your Entity (`User.model.ts`)

Extend the base `Entity` class and use decorators for type conversions.

```typescript
import { 
    Entity, IUpdateEntity, EntityPropertyType, Type, EntityValidationError 
} from 'orm-dao-simplified';

export interface IUserEntity extends IUpdateEntity {
    username: string;
    // ... other properties
}

export default class User extends Entity implements IUserEntity {
    static EntityName = "users"; 

    id!: number;
    username!: string;
    
    // Automatic DESERIALIZATION and SERIALIZATION handled by the library
    @Type(EntityPropertyType.JSON)
    settings!: { theme: string, notifications: boolean }; 

    @Type(EntityPropertyType.DATE)
    createdAt!: Date;

    constructor(attributes: any) {
        super(attributes);
    }

    /**
     * Required: Validation hook executed in the constructor.
     * @returns true if valid, or a string error message if invalid.
     * @throws EntityValidationError if an error message is returned.
     */
    protected validate(): true | string {
        if (!this.username || this.username.length < 3) {
            return "Username must be at least 3 characters long.";
        }
        return true; 
    }
    
    // REQUIRED: Implements the abstract sanitize method
    sanitize(): IUserEntity {
        const { _joins, id, username, settings, createdAt } = this;
        return { id, username, settings, createdAt };
    }
    
    // REQUIRED: Implements the abstract update method
    update(attributes: IUpdateEntity): void {
        this.set(attributes);
    }
}
```

### 3\. Defining Your DAO (`UserDAO.ts`)

Extend `GenericDAO` and inject the connection source (Pool or active Transaction Connection).

```typescript
import { GenericDAO } from 'orm-dao-simplified';
import { Pool, Connection } from 'mysql2/promise';
import User from './User.model'; // Local import for the generated model

export default class UserDAO extends GenericDAO<User> {
    constructor(connection: Pool | Connection) {
        // Pass the Entity class (for table name) and its constructor (for hydration)
        super(User, User, connection); 
    }
}
```

## 🚀 Advanced Functionality

### 1\. Atomic Transactions

Use `runInTransaction` to ensure atomicity.

```typescript
import { runInTransaction } from 'orm-dao-simplified';
import { createPool } from 'mysql2/promise';
import UserDAO from './UserDAO'; 

const pool = createPool({ /* ... config */ });

async function transferFunds(senderId: number, receiverId: number, amount: number) {
    
    return runInTransaction(pool, async (txConnection) => {
        // IMPORTANT: Use the transaction connection for all DAOs inside the block
        const txUserDAO = new UserDAO(txConnection); 
        
        // ... Perform update operations (e.g., withdraw and deposit)
        // If an error is thrown here, the transaction is automatically rolled back.
    });
}
```

### 2\. Model Generation

Use the provided script to quickly bootstrap your entity and DAO files from an existing database.

```bash
# Run from your project root (after npm run build)

# Usage: node dist/scripts/generateModels.js <host> <user> [password] <database> [port]

node dist/scripts/generateModels.js localhost root mypassword mydatabase 
```
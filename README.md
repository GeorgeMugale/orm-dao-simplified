# 📦 Simple Type-Safe DAO

A lightweight and flexible Data Access Object (DAO) library built for TypeScript and MySQL. It provides a structured, type-safe layer over raw SQL, offering the safety and convenience of an ORM without the heavy abstraction.

## ✨ Features

  * **Type-Safe Queries:** Utilize TypeScript interfaces and generics to ensure query clauses, fields, and joins are type-checked at compile time.
  * **Declarative Entity Modeling:** Define database fields and conversions using decorators (`@Type(JSON)`).
  * **Robust Validation:** Enforce data integrity immediately upon entity instantiation using the built-in `validate` hook.
  * **Native Transaction Support:** Easily wrap multiple DAO operations in atomic transactions.
  * **Advanced CRUD:** Includes powerful methods like `upsertAll` (on duplicate key update) for efficient data synchronization.
  * **Eager Loading (Joins):** Built-in support for complex SQL `JOIN` statements with automatic result mapping.

## 💾 Installation

```bash
npm install orm-dao-simplified reflect-metadata
# Install required types for reflect-metadata
npm install -D @types/reflect-metadata
```

**Note:** You must enable `experimentalDecorators` and `emitDecoratorMetadata` in your `tsconfig.json`.

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    // Required for decorators
    "experimentalDecorators": true, 
    "emitDecoratorMetadata": true 
  }
}
```

## 🏗️ Core Concepts

The library is based on two core classes:

1.  **`Entity`:** The abstract base class for all your data models. It handles data lifecycle (validation, serialization/deserialization) and automatic type conversions.
2.  **`GenericDAO<T>`:** The abstract class that encapsulates all database operations. It manages query construction and executes SQL via a `mysql2/promise` connection.

### 1\. Defining Your Entity (`User.model.ts`)

Extend the base `Entity` class to create your model. Use static properties and decorators to define metadata and conversion rules.

```typescript
import Entity, { IUpdateEntity } from './Entity.model';
import { Type, EntityPropertyType } from './type-decorators'; 

export interface IUserEntity extends IUpdateEntity {
    username: string;
    email: string;
    settings: { theme: string };
    createdAt: Date;
}

export default class User extends Entity implements IUserEntity {
    // Required: Sets the table name for the DAO
    static EntityName = "users"; 

    id!: number;
    username!: string;
    email!: string;
    
    // Automatic DESERIALIZATION: Converts JSON string from DB to JS Object
    @Type(EntityPropertyType.JSON)
    settings!: { theme: string, notifications: boolean }; 

    // Automatic DESERIALIZATION: Converts date string from DB to Date object
    @Type(EntityPropertyType.DATE)
    createdAt!: Date;

    constructor(attributes: any) {
        super(attributes);
    }

    // REQUIRED: Validation hook (throws EntityValidationError if string is returned)
    protected validate() {
        if (!this.username || this.username.length < 3) {
            return "Username must be at least 3 characters.";
        }
        return true; 
    }
    
    // REQUIRED: Sanitization hook (e.g., stripping passwords)
    sanitize(): IUserEntity {
        const { _joins, id, username, email, settings, createdAt } = this;
        return { id, username, email, settings, createdAt };
    }
    
    // REQUIRED: Helper for updating properties
    update(attributes: IUpdateEntity): void {
        this.set(attributes);
    }
}
```

### 2\. Defining Your DAO (`UserDAO.ts`)

Extend `GenericDAO` to create a DAO specific to your `User` entity.

```typescript
import { Pool } from 'mysql2/promise';
import GenericDAO from './GenericDAO';
import User from './User.model';

export default class UserDAO extends GenericDAO<User> {
    constructor(pool: Pool) {
        // Pass the Entity class (for table name) and its constructor (for hydration)
        super(User, User, pool); 
    }
    
    // Add custom methods here if needed, e.g., 'findActiveUsers()'
}
```

## 🚀 Advanced Functionality

### 1\. Transactions (Atomic Operations)

Use the `runInTransaction` utility to safely perform multiple database operations that must succeed or fail together.

```typescript
import { createPool } from 'mysql2/promise';
import { runInTransaction } from './TransactionManager'; // Assuming you expose this function
import UserDAO from './UserDAO'; 

const pool = createPool({ /* ... config */ });

async function changeUsernameAndEmail(userId: number, newUsername: string, newEmail: string) {
    try {
        await runInTransaction(pool, async (txConnection) => {
            // Instantiate DAOs using the transaction-specific connection
            const txUserDAO = new UserDAO(txConnection); 

            // Operation 1
            await txUserDAO.updateWhere(
                { field: 'id', value: userId },
                { field: 'username', value: newUsername }
            );

            // Operation 2
            await txUserDAO.updateWhere(
                { field: 'id', value: userId },
                { field: 'email', value: newEmail }
            );
            
            // If both succeed, the transaction is committed.
        });
        console.log("Update successful and committed.");
    } catch (error) {
        console.error("Transaction failed and rolled back:", error);
    }
}
```

### 2\. Upsert (`INSERT ... ON DUPLICATE KEY UPDATE`)

Use `upsertAll` for synchronization tasks. It requires a primary key or unique index to be defined in your database.

```typescript
// Example: Synchronize a list of users, updating existing ones.
async function syncUsers(dao: UserDAO, users: Partial<User>[]) {
    const userEntities = users.map(data => new User(data));
    await dao.upsertAll(userEntities); 
    console.log(`Successfully upserted ${users.length} records.`);
}
```

### 3\. Advanced Selects with Joins

The `selectWhere` method supports complex joins with automatic result mapping and aliasing.

```typescript
import Post from './Post.model'; // Another entity/table

const options: SelectOptions<User> = {
    // 1. Define the Join
    joins: [{
        rightTable: Post,
        type: 'LEFT',
        on: { left: 'id', right: 'userId' }, // ON users.id = posts.userId
        fields: ['title', 'content'], // Select fields from the joined table
        
        // 2. Optional: Add a WHERE clause specific to the joined table
        where: { field: 'isActive', value: 1, operator: '=' }
    }],
    
    // 3. Add global limit/order/offset
    limit: 10,
    orderBy: [{ field: 'username', direction: 'ASC' }]
};

const usersWithPosts = await userDAO.selectWhere(
    { field: 'id', operator: '>', value: 0 },
    options
);

// Accessing Joined Data:
const user = usersWithPosts[0];
// Joined data is automatically mapped to the reserved _joins property
console.log(user._joins.posts); 
// Output: { title: 'First Post', content: '...' }
```
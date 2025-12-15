// generateModels.ts (Use ts-node or compile and run with node)

import { createPool, Pool, RowDataPacket } from "mysql2/promise";
import * as fs from "fs/promises";
import * as path from "path";

const PACKAGE_NAME = "orm-dao-simplified";

// --- CONFIGURATION ---
const OUTPUT_DIR = path.resolve(__dirname, "..", "..", "src", "models");
// --- END CONFIGURATION ---

// Map MySQL types to TypeScript types and check for DATE/JSON decorators
const typeMap: { [key: string]: { tsType: string; decorator?: string } } = {
  int: { tsType: "number" },
  tinyint: { tsType: "boolean" },
  decimal: { tsType: "number" },
  float: { tsType: "number" },
  double: { tsType: "number" },
  varchar: { tsType: "string" },
  text: { tsType: "string" },
  longtext: { tsType: "string" },
  json: { tsType: "any", decorator: "@Type(EntityPropertyType.JSON)" },
  datetime: { tsType: "Date", decorator: "@Type(EntityPropertyType.DATE)" },
  timestamp: { tsType: "Date", decorator: "@Type(EntityPropertyType.DATE)" },
  // Add more mappings as needed
};

// --- Argument Parsing Logic ---
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("❌ Error: Missing command-line arguments.");
    console.log(
      "Usage: ts-node generateModels.ts <host> <user> [password] <database> [port]"
    );
    process.exit(1);
  }

  const host = args[0];
  const user = args[1];

  let password = "";
  let database = "";
  let port = 3306;

  // Remaining args after host + user
  const rest = args.slice(2);

  // If last arg is a number → it's the port
  if (rest.length && !isNaN(Number(rest[rest.length - 1]))) {
    port = parseInt(rest.pop()!, 10);
  }

  if (rest.length === 1) {
    // password omitted → only database provided
    database = rest[0];
  } else if (rest.length === 2) {
    // password + database provided
    [password, database] = rest;
  } else {
    console.error("❌ Invalid arguments.");
    console.log(
      "Usage: ts-node generateModels.ts <host> <user> [password] <database> [port]"
    );
    process.exit(1);
  }

  return { host, user, password, database, port };
}

// --- End Argument Parsing Logic ---

async function generateModels() {
  const DB_CONFIG = parseArguments();

  console.log(
    `Starting model generation for database: ${DB_CONFIG.database} on ${DB_CONFIG.host}:${DB_CONFIG.port}`
  );
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const pool: Pool = createPool(DB_CONFIG);
  try {
    // Query to get all table names in the database
    const [tables] = await pool.query("SHOW TABLES");
    const tableNames = (tables as RowDataPacket[]).map(
      (row) => Object.values(row)[0] as string
    );

    for (const tableName of tableNames) {
      await generateFilesForTable(pool, tableName);
    }

    console.log(
      `✅ Successfully generated models for ${tableNames.length} tables in ${OUTPUT_DIR}.`
    );
  } catch (error) {
    console.error("❌ Model generation failed:", error);
  } finally {
    await pool.end();
  }
}

async function generateFilesForTable(pool: Pool, tableName: string) {
  // ... (logic to determine class name and file names remains the same)
  const className = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const interfaceName = `I${className}Entity`;
  const modelFileName = `${className}.model.ts`;
  const daoFileName = `${className}DAO.ts`;

  // Query to get column details (name, type)
  const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
  const columnsData = columns as RowDataPacket[];

  let modelContent = "";
  let interfaceContent = `export interface ${interfaceName} extends IUpdateEntity {\n`;

  // --- BUILD ENTITY MODEL CONTENT ---

  const propertyDeclarations: string[] = [];

  for (const column of columnsData) {
    const columnName = column.Field as string;
    const mysqlType = (column.Type as string).split("(")[0];

    const typeInfo = typeMap[mysqlType] || { tsType: "any" };

    // Add property to Interface
    if (columnName !== "id") {
      interfaceContent += `  ${columnName}: ${typeInfo.tsType};\n`;
    }

    // Add property to Model Class
    let propertyLine = `  ${columnName}!: ${typeInfo.tsType};`;

    if (typeInfo.decorator) {
      propertyLine = `  ${typeInfo.decorator}\n${propertyLine}`;
    }

    if (columnName !== "id") {
      propertyDeclarations.push(propertyLine);
    }
  }

  interfaceContent += "}\n";

  // --- TEMPLATE FOR ENTITY FILE ---

  modelContent = `import { Entity, IUpdateEntity, EntityValidationError, Type, EntityPropertyType } from '${PACKAGE_NAME}';';

${interfaceContent}

export default class ${className} extends Entity implements ${interfaceName} {
  static EntityName = "${tableName}"; 

  id!: number;
${propertyDeclarations.join("\n")}

  constructor(attributes: any) {
    super(attributes);
  }

  // Override this method for specific validation logic
  protected validate(): true | string {
    return true; 
  }
  
  // REQUIRED: Implements the abstract sanitize method
  sanitize(): ${interfaceName} {
    const { this._joins, ...safeData } = this;
    // NOTE: You must customize this method to explicitly exclude sensitive fields (e.g., passwords).
    return safeData as ${interfaceName}; 
  }
  
  // REQUIRED: Implements the abstract update method
  update(attributes: IUpdateEntity): void {
    this.set(attributes);
  }
}
`;

  // --- TEMPLATE FOR DAO FILE ---

  const daoContent = `
import { Pool, Connection } from 'mysql2/promise';
import GenericDAO from '${PACKAGE_NAME}';
import ${className} from './${modelFileName.replace(".ts", "")}';

export default class ${className}DAO extends GenericDAO<${className}> {
    constructor(connection: Pool | Connection) {
        super(${className}, ${className}, connection);
    }
}
`;

  // 4. Write Files
  await fs.writeFile(path.join(OUTPUT_DIR, modelFileName), modelContent.trim());
  await fs.writeFile(path.join(OUTPUT_DIR, daoFileName), daoContent.trim());

  console.log(`  -> Generated ${className} files.`);
}

generateModels();

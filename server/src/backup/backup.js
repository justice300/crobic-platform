import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRequire } from "module";
import * as archiverModule from "archiver";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

import unzipper from "unzipper";
import { PassThrough } from "stream";
import { pgPool } from "../db.js";

const BACKUP_VERSION = 1;

const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  "uploads"
);



function jsonValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    return {
      __type: "Buffer",
      data: value.toString("base64")
    };
  }
  return value;
}

function restoreValue(value) {
  if (
    value &&
    typeof value === "object" &&
    value.__type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    return Buffer.from(value.data);
  }

  return value;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function getTables(client) {
  const result = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  return result.rows;
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT
        column_name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows;
}

async function getForeignKeys(client) {
  const result = await client.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `);

  return result.rows;
}

function orderTables(tables, foreignKeys) {
  const names = tables.map((table) => table.table_name);
  const dependencies = new Map(names.map((name) => [name, new Set()]));

  for (const fk of foreignKeys) {
    if (!dependencies.has(fk.child_table)) {
      dependencies.set(fk.child_table, new Set());
    }

    dependencies.get(fk.child_table).add(fk.parent_table);
  }

  const ordered = [];
  const remaining = new Set(names);

  while (remaining.size) {
    const ready = [...remaining].filter((name) => {
      const deps = dependencies.get(name) || new Set();

      for (const dependency of deps) {
        if (remaining.has(dependency)) return false;
      }

      return true;
    });

    if (!ready.length) {
      // Cyclic/self-referencing tables are placed last.
      ordered.push(...remaining);
      break;
    }

    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }

  return ordered;
}

async function collectDatabase() {
  const client = await pgPool.connect();

  try {
    const tables = await getTables(client);
    const foreignKeys = await getForeignKeys(client);

    const tableOrder = orderTables(tables, foreignKeys);
    const tableMap = new Map();

    for (const table of tables) {
      const columns = await getColumns(client, table.table_name);

      const result = await client.query(
        `SELECT * FROM ${quoteIdentifier(table.table_name)}`
      );

      tableMap.set(table.table_name, {
        tableName: table.table_name,
        columns,
        rowCount: result.rows.length,
        rows: result.rows.map((row) => {
          const output = {};

          for (const [key, value] of Object.entries(row)) {
            output[key] = jsonValue(value);
          }

          return output;
        })
      });
    }

    return {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      database: {
        provider: "postgresql",
        schema: "public",
        tables: tableOrder.map((name) => tableMap.get(name))
      }
    };
  } finally {
    client.release();
  }
}

async function addDirectoryToArchive(archive, directory, archiveRoot) {
  try {
    await fs.access(directory);
  } catch {
    return;
  }

  archive.directory(directory, archiveRoot);
}

export async function createBackupArchive() {

  console.log("BACKUP STARTED");

  const database = await collectDatabase();

  console.log("DATABASE COLLECTED");

  const manifest = {
    backupVersion: BACKUP_VERSION,
    product: "CIBI",
    createdAt: database.createdAt,
    databaseProvider: "postgresql",
    tableCount: database.database.tables.length,
    totalRows: database.database.tables.reduce(
      (total, table) => total + Number(table.rowCount || 0),
      0
    ),
    includesDatabase: true,
    includesUploads: true
  };

  const databaseBuffer = Buffer.from(
    JSON.stringify(database, null, 2),
    "utf8"
  );

  const manifestBuffer = Buffer.from(
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  const stream = new PassThrough();

const archive = new archiverModule.ZipArchive({
  zlib: {
    level: 9
  }
});

  archive.on("error", (error) => {
    stream.destroy(error);
  });

  archive.pipe(stream);

  archive.append(manifestBuffer, {
    name: "manifest.json"
  });

  archive.append(databaseBuffer, {
    name: "database.json"
  });

console.log("ADDING UPLOADS", UPLOAD_ROOT);

await addDirectoryToArchive(
  archive,
  UPLOAD_ROOT,
  "uploads"
);

console.log("UPLOADS ADDED");

console.log("FINALIZING ZIP");

archive.finalize();
console.log("ZIP FINALIZED");
  return {
    stream,
    manifest
  };
}

async function readZipEntries(buffer) {
  const directory = await unzipper.Open.buffer(buffer);

  const entries = new Map();

  for (const entry of directory.files) {
    if (entry.type === "File") {
      entries.set(entry.path, entry);
    }
  }

  return entries;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Invalid backup manifest.");
  }

  if (Number(manifest.backupVersion) !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version: ${manifest.backupVersion}.`
    );
  }

  if (manifest.product !== "CIBI") {
    throw new Error("This backup does not belong to CIBI.");
  }

  if (manifest.databaseProvider !== "postgresql") {
    throw new Error("Unsupported backup database provider.");
  }

  if (!manifest.includesDatabase) {
    throw new Error("Backup does not contain database data.");
  }
}

export async function inspectBackupArchive(buffer) {
  const entries = await readZipEntries(buffer);

  if (!entries.has("manifest.json")) {
    throw new Error("Backup is missing manifest.json.");
  }

  if (!entries.has("database.json")) {
    throw new Error("Backup is missing database.json.");
  }

  const manifest = JSON.parse(
    (await entries.get("manifest.json").buffer()).toString("utf8")
  );

  validateManifest(manifest);

  const database = JSON.parse(
    (await entries.get("database.json").buffer()).toString("utf8")
  );

  if (!database?.database?.tables) {
    throw new Error("Backup database payload is invalid.");
  }

  const calculatedTables = database.database.tables.length;

  const calculatedRows = database.database.tables.reduce(
    (total, table) => total + Number(table.rowCount || 0),
    0
  );

  return {
    manifest,
    tableCount: calculatedTables,
    totalRows: calculatedRows,
    uploadFiles: [...entries.keys()].filter((name) =>
      name.startsWith("uploads/")
    ).length
  };
}

async function restoreDatabase(database) {
  const tables = Array.isArray(database?.database?.tables)
    ? database.database.tables
    : [];

  if (!tables.length) {
    throw new Error("Backup contains no database tables.");
  }

  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");

    /*
     * PostgreSQL handles the actual table relationships.
     * TRUNCATE ... CASCADE clears existing application data first.
     */
    const existingTables = await getTables(client);

    if (existingTables.length) {
      const tableNames = existingTables
        .map((table) => quoteIdentifier(table.table_name))
        .join(", ");

      await client.query(
        `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`
      );
    }

    /*
     * Tables are already ordered using their foreign-key dependencies
     * in the backup.
     */
    for (const table of tables) {
      const tableName = String(table.tableName || "");

      if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
        throw new Error(`Invalid table name in backup: ${tableName}`);
      }

      const rows = Array.isArray(table.rows) ? table.rows : [];

      if (!rows.length) continue;

      const columns = Array.isArray(table.columns)
        ? table.columns
            .map((column) => column.column_name)
            .filter(Boolean)
        : [];

      if (!columns.length) {
        throw new Error(`No columns found for table ${tableName}.`);
      }

      const quotedColumns = columns
        .map(quoteIdentifier)
        .join(", ");

      for (const row of rows) {
        const values = columns.map((column) =>
          restoreValue(row[column])
        );

        const placeholders = values
          .map((_, index) => `$${index + 1}`)
          .join(", ");

        await client.query(
          `
            INSERT INTO ${quoteIdentifier(tableName)}
            (${quotedColumns})
            VALUES (${placeholders})
          `,
          values
        );
      }
    }

    /*
     * Reset PostgreSQL sequences after explicit ID restoration.
     * This prevents future inserts from colliding with restored IDs.
     */
const sequenceColumns = await client.query(`
      SELECT
        table_schema,
        table_name,
        column_name,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_default LIKE 'nextval(%'
    `);

    for (const sequence of sequenceColumns.rows) {
      try {
        const tableName = String(sequence.table_name || "");
        const columnName = String(sequence.column_name || "");

        if (
          !/^[A-Za-z0-9_]+$/.test(tableName) ||
          !/^[A-Za-z0-9_]+$/.test(columnName)
        ) {
          continue;
        }

        await client.query(
          `
            SELECT setval(
              pg_get_serial_sequence($1, $2),
              COALESCE(
                (
                  SELECT MAX(${quoteIdentifier(columnName)})
                  FROM ${quoteIdentifier(tableName)}
                ),
                1
              ),
              true
            )
          `,
          [tableName, columnName]
        );
      } catch {
        // Ignore columns that do not expose a usable PostgreSQL sequence.
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function extractUploads(entries) {
  const uploadEntries = [...entries.entries()].filter(([name]) =>
    name.startsWith("uploads/")
  );

  if (!uploadEntries.length) return 0;

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });

  /*
   * Only files under uploads/ are accepted.
   * Absolute paths and ../ traversal are rejected.
   */
  for (const [entryName, entry] of uploadEntries) {
    const relative = entryName.slice("uploads/".length);

    if (
      !relative ||
      path.isAbsolute(relative) ||
      relative.split("/").includes("..") ||
      relative.split("\\").includes("..")
    ) {
      throw new Error("Unsafe upload path detected in backup.");
    }

    const destination = path.resolve(UPLOAD_ROOT, relative);
    const uploadRootResolved = path.resolve(UPLOAD_ROOT);

    if (
      destination !== uploadRootResolved &&
      !destination.startsWith(`${uploadRootResolved}${path.sep}`)
    ) {
      throw new Error("Unsafe upload destination detected.");
    }

    await fs.mkdir(path.dirname(destination), {
      recursive: true
    });

    await fs.writeFile(
      destination,
      await entry.buffer()
    );
  }

  return uploadEntries.length;
}

export async function restoreBackupArchive(buffer) {
  const entries = await readZipEntries(buffer);

  const manifestEntry = entries.get("manifest.json");
  const databaseEntry = entries.get("database.json");

  if (!manifestEntry || !databaseEntry) {
    throw new Error(
      "Backup must contain manifest.json and database.json."
    );
  }

  const manifest = JSON.parse(
    (await manifestEntry.buffer()).toString("utf8")
  );

  validateManifest(manifest);

  const database = JSON.parse(
    (await databaseEntry.buffer()).toString("utf8")
  );

  if (!database?.database?.tables?.length) {
    throw new Error("Backup contains no database tables.");
  }

  /*
   * Database restoration happens inside a PostgreSQL transaction.
   * If the database restoration fails, it rolls back.
   */
  await restoreDatabase(database);

  const uploadFileCount = await extractUploads(entries);

  return {
    restoredAt: new Date().toISOString(),
    tableCount: database.database.tables.length,
    totalRows: database.database.tables.reduce(
      (total, table) => total + Number(table.rowCount || 0),
      0
    ),
    uploadFileCount
  };
}



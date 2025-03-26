import mariadb from "mariadb";
import { ENV } from "../config/env";

// Create a pool that we can reuse for all database connections
const pool = mariadb.createPool({
  host: ENV.DB_HOST || "localhost",
  port: parseInt(ENV.DB_PORT || "3306"),
  database: ENV.DB_NAME,
  user: ENV.DB_USER || "root",
  password: ENV.DB_PASSWORD,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

export interface CurriculumModule {
  id: number;
  title: string;
  content: string;
  date: Date;
  status: string;
  excerpt: string;
  slug: string;
  url: string;
  metadata: Record<string, string>;
}

export class DatabaseService {
  async getCurriculumModules(): Promise<CurriculumModule[]> {
    let conn;
    try {
      conn = await pool.getConnection();

      const query = `
        SELECT 
          p.ID,
          p.post_title,
          p.post_content,
          p.post_date,
          p.post_status,
          p.post_excerpt,
          p.post_name,
          p.guid,
          pm.meta_key,
          pm.meta_value
        FROM wp_posts p
        LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id
        WHERE p.post_type = 'curriculum'
        ORDER BY p.ID ASC;
      `;

      const rows = await conn.query(query);

      // Group the results by post ID
      const modulesMap = new Map<number, CurriculumModule>();

      rows.forEach((row: any) => {
        if (!modulesMap.has(row.ID)) {
          modulesMap.set(row.ID, {
            id: row.ID.toString(),
            title: row.post_title,
            content: row.post_content,
            date: new Date(row.post_date),
            status: row.post_status,
            excerpt: row.post_excerpt || "",
            slug: row.post_name,
            url: row.guid,
            metadata: {},
          });
        }

        // Add metadata if it exists
        if (row.meta_key) {
          modulesMap.get(row.ID)!.metadata[row.meta_key] = row.meta_value;
        }
      });

      return Array.from(modulesMap.values());
    } catch (error) {
      console.error("Database error:", error);
      throw new Error("Failed to fetch curriculum modules");
    } finally {
      if (conn) {
        await conn.end();
      }
    }
  }

  // Add method to get a single module by ID
  async getCurriculumModuleById(id: string): Promise<CurriculumModule | null> {
    let conn;
    try {
      conn = await pool.getConnection();

      const query = `
        SELECT 
          p.ID,
          p.post_title,
          p.post_content,
          p.post_date,
          p.post_status,
          p.post_excerpt,
          p.post_name,
          p.guid,
          pm.meta_key,
          pm.meta_value
        FROM wp_posts p
        LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id
        WHERE p.ID = ?;
      `;

      const rows = await conn.query(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      const module: CurriculumModule = {
        id: rows[0].ID.toString(),
        title: rows[0].post_title,
        content: rows[0].post_content,
        date: new Date(rows[0].post_date),
        status: rows[0].post_status,
        excerpt: rows[0].post_excerpt || "",
        slug: rows[0].post_name,
        url: rows[0].guid,
        metadata: {},
      };

      // Add metadata
      rows.forEach((row: any) => {
        if (row.meta_key) {
          module.metadata[row.meta_key] = row.meta_value;
        }
      });

      return module;
    } catch (error) {
      console.error("Database error:", error);
      throw new Error("Failed to fetch curriculum module");
    } finally {
      if (conn) {
        await conn.end();
      }
    }
  }
}

export const dbService = new DatabaseService();

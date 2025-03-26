import mariadb from "mariadb";
import * as dotenv from "dotenv";

dotenv.config();

async function getModuleDetails() {
  const config: any = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER || "root",
  };

  if (process.env.DB_PASSWORD) {
    config.password = process.env.DB_PASSWORD;
  }

  const pool = mariadb.createPool(config);

  let conn;
  try {
    conn = await pool.getConnection();

    // Query to get detailed module information including content and metadata
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
      WHERE p.ID IN (1105, 1103, 1102, 1101, 1099, 1100, 1098, 1096, 1094, 1083)
      ORDER BY p.post_date DESC;
    `;

    const rows = await conn.query(query);

    console.log("\nCurriculum Module Details:");
    console.log("========================");

    // Group the results by post ID since we'll have multiple metadata rows per post
    const posts = new Map();

    rows.forEach((row: any) => {
      if (!posts.has(row.ID)) {
        posts.set(row.ID, {
          id: row.ID,
          title: row.post_title,
          content: row.post_content,
          date: row.post_date,
          status: row.post_status,
          excerpt: row.post_excerpt,
          slug: row.post_name,
          url: row.guid,
          metadata: {},
        });
      }

      // Add metadata if it exists
      if (row.meta_key) {
        posts.get(row.ID).metadata[row.meta_key] = row.meta_value;
      }
    });

    // Print the detailed information for each post
    posts.forEach((post) => {
      console.log(`\nTitle: ${post.title}`);
      console.log(`ID: ${post.id}`);
      console.log(`Date: ${post.date}`);
      console.log(`Status: ${post.status}`);
      console.log(`URL: ${post.url}`);
      console.log("\nExcerpt:");
      console.log(post.excerpt || "[No excerpt]");
      console.log("\nContent:");
      console.log(post.content || "[No content]");

      if (Object.keys(post.metadata).length > 0) {
        console.log("\nMetadata:");
        Object.entries(post.metadata).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      }

      console.log("\n========================");
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (conn) {
      await conn.end();
    }
    await pool.end();
  }
}

// Run the function
getModuleDetails().catch(console.error);

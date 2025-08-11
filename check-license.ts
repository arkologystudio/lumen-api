import { prisma } from "./src/config/database";

async function checkLicenseAndProduct() {
  try {
    // Check if the product exists
    const product = await prisma.product.findUnique({
      where: { slug: "lumen-search-api" }
    });
    
    console.log("Product 'lumen-search-api':", product ? {
      id: product.id,
      name: product.name,
      slug: product.slug,
      is_active: product.is_active
    } : "NOT FOUND");
    
    // Check licenses for the site
    const licenses = await prisma.license.findMany({
      where: {
        OR: [
          { metadata: { path: ['site_id'], equals: 'c9b9f11e-7ab4-4c1d-a306-cce52ceb4657' } },
          { notes: { contains: 'culturehack' } }
        ]
      },
      include: {
        product: true,
        user: true
      }
    });
    
    console.log("\nLicenses found:", licenses.length);
    licenses.forEach(license => {
      console.log({
        license_key: license.license_key,
        product_slug: license.product?.slug,
        product_name: license.product?.name,
        status: license.status,
        is_active: license.is_active,
        user_email: license.user?.email,
        expires_at: license.expires_at,
        metadata: license.metadata
      });
    });
    
    // Also check all products to see what's available
    const allProducts = await prisma.product.findMany({
      select: { id: true, name: true, slug: true, is_active: true }
    });
    
    console.log("\nAll products in database:");
    allProducts.forEach(p => console.log(`  - ${p.slug}: ${p.name} (active: ${p.is_active})`));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLicenseAndProduct();
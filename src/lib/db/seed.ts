import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ulid } from 'ulid';
import * as schema from './schema';

/**
 * Database seed script
 * Seeds platform admin, test tenants, store configurations, themes, categories, products, variants, and draft pages.
 * Idempotent execution: skips existing tenants and users to prevent duplicate key violations.
 */
export async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Seed error: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  console.log('Connecting to database for seeding...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    console.log('Beginning database seed...');

    // 1. Password hashing
    const defaultPasswordHash = bcrypt.hashSync('AdminPassword123!', 10);

    // 2. Platform Admin User
    let platformAdmin = await db.query.users.findFirst({
      where: eq(schema.users.email, 'admin@platform.local'),
    });

    if (!platformAdmin) {
      const adminId = ulid();
      const [insertedAdmin] = await db
        .insert(schema.users)
        .values({
          id: adminId,
          email: 'admin@platform.local',
          name: 'Platform Admin',
          passwordHash: defaultPasswordHash,
          status: 'active',
        })
        .returning();
      platformAdmin = insertedAdmin;
      console.log('Created platform admin user: admin@platform.local');
    } else {
      console.log('Platform admin user already exists.');
    }

    // 3. Define Seed Tenants configuration
    const seedTenantsData = [
      {
        name: 'Urban Style',
        slug: 'urban-style',
        ownerEmail: 'owner@urbanstyle.local',
        ownerName: 'Urban Style Owner',
        currency: 'INR',
        theme: {
          primary: '#1E3A8A', // Navy
          accent: '#D97706',  // Gold
          background: '#FFFFFF',
          foreground: '#111827',
          surface: '#F3F4F6',
          muted: '#6B7280',
        },
        categories: [
          { name: 'Men', slug: 'men', description: 'Men apparel and collection' },
          { name: 'Women', slug: 'women', description: 'Women apparel and collection' },
          { name: 'Accessories', slug: 'accessories', description: 'Bags, belts, and daily accessories' },
        ],
        products: [
          {
            title: 'Classic Oxford Cotton Shirt',
            slug: 'classic-oxford-cotton-shirt',
            categorySlug: 'men',
            listPrice: 249900, // 2,499.00 INR
            salePrice: 199900,
            isFeatured: true,
            isTrending: true,
            description: 'Premium tailored cotton shirt perfect for work and casual outings.',
            variants: [
              { name: 'Small / White', sku: 'URB-OXF-WHT-S', options: { size: 'S', color: 'White' }, stock: 25 },
              { name: 'Medium / White', sku: 'URB-OXF-WHT-M', options: { size: 'M', color: 'White' }, stock: 40 },
              { name: 'Large / White', sku: 'URB-OXF-WHT-L', options: { size: 'L', color: 'White' }, stock: 30 },
              { name: 'Medium / Blue', sku: 'URB-OXF-BLU-M', options: { size: 'M', color: 'Blue' }, stock: 20 },
            ],
          },
          {
            title: 'Relaxed Fit Linen Trousers',
            slug: 'relaxed-fit-linen-trousers',
            categorySlug: 'men',
            listPrice: 299900,
            salePrice: null,
            isFeatured: false,
            isTrending: true,
            description: 'Breathable linen trousers designed for hot summer days.',
            variants: [
              { name: '30 / Beige', sku: 'URB-TR-BEI-30', options: { waist: '30', color: 'Beige' }, stock: 15 },
              { name: '32 / Beige', sku: 'URB-TR-BEI-32', options: { waist: '32', color: 'Beige' }, stock: 35 },
              { name: '34 / Beige', sku: 'URB-TR-BEI-34', options: { waist: '34', color: 'Beige' }, stock: 20 },
            ],
          },
          {
            title: 'Silk Wrap Midi Dress',
            slug: 'silk-wrap-midi-dress',
            categorySlug: 'women',
            listPrice: 459900,
            salePrice: 399900,
            isFeatured: true,
            isTrending: true,
            description: 'Elegant silk wrap dress with a flowing silhouette.',
            variants: [
              { name: 'Small / Emerald', sku: 'URB-DRS-EMR-S', options: { size: 'S', color: 'Emerald' }, stock: 12 },
              { name: 'Medium / Emerald', sku: 'URB-DRS-EMR-M', options: { size: 'M', color: 'Emerald' }, stock: 18 },
            ],
          },
          {
            title: 'Minimalist Leather Belt',
            slug: 'minimalist-leather-belt',
            categorySlug: 'accessories',
            listPrice: 129900,
            salePrice: 99900,
            isFeatured: false,
            isTrending: false,
            description: 'Handcrafted full-grain leather belt with solid brass buckle.',
            variants: [
              { name: 'Standard / Tan', sku: 'URB-BLT-TAN-STD', options: { color: 'Tan' }, stock: 50 },
              { name: 'Standard / Black', sku: 'URB-BLT-BLK-STD', options: { color: 'Black' }, stock: 45 },
            ],
          },
        ],
      },
      {
        name: 'Bloom Flowers',
        slug: 'bloom-flowers',
        ownerEmail: 'owner@bloomflowers.local',
        ownerName: 'Bloom Flowers Owner',
        currency: 'INR',
        theme: {
          primary: '#059669', // Emerald Green
          accent: '#EC4899',  // Pink
          background: '#FAFAFA',
          foreground: '#1F2937',
          surface: '#F0FDF4',
          muted: '#6B7280',
        },
        categories: [
          { name: 'Roses', slug: 'roses', description: 'Fresh garden roses in multiple colors' },
          { name: 'Mixed Bouquets', slug: 'mixed-bouquets', description: 'Artisan hand-tied bouquets' },
          { name: 'Plants', slug: 'plants', description: 'Indoor and outdoor potted green plants' },
        ],
        products: [
          {
            title: 'Velvet Red Roses Bouquet',
            slug: 'velvet-red-roses-bouquet',
            categorySlug: 'roses',
            listPrice: 149900,
            salePrice: 129900,
            isFeatured: true,
            isTrending: true,
            description: 'One dozen premium long-stem red roses wrapped in eco-friendly paper.',
            variants: [
              { name: '12 Stems', sku: 'BLM-ROS-RED-12', options: { stems: '12' }, stock: 40 },
              { name: '24 Stems', sku: 'BLM-ROS-RED-24', options: { stems: '24' }, stock: 20 },
            ],
          },
          {
            title: 'Sunlit Meadow Wildflower Bunch',
            slug: 'sunlit-meadow-wildflower-bunch',
            categorySlug: 'mixed-bouquets',
            listPrice: 189900,
            salePrice: null,
            isFeatured: true,
            isTrending: false,
            description: 'Sunflowers, chamomile, and fresh eucalyptus tied with satin ribbon.',
            variants: [
              { name: 'Standard Bunch', sku: 'BLM-WLD-STD', options: { size: 'Standard' }, stock: 25 },
              { name: 'Grand Bunch', sku: 'BLM-WLD-GRD', options: { size: 'Grand' }, stock: 15 },
            ],
          },
          {
            title: 'Monstera Deliciosa Potted Plant',
            slug: 'monstera-deliciosa-potted-plant',
            categorySlug: 'plants',
            listPrice: 119900,
            salePrice: 99900,
            isFeatured: false,
            isTrending: true,
            description: 'Healthy indoor Swiss Cheese plant in a white ceramic pot.',
            variants: [
              { name: 'Ceramic Pot / Medium', sku: 'BLM-PLT-MON-MED', options: { pot: 'Ceramic' }, stock: 30 },
              { name: 'Terracotta Pot / Medium', sku: 'BLM-PLT-MON-TER', options: { pot: 'Terracotta' }, stock: 25 },
            ],
          },
        ],
      },
    ];

    for (const tenantData of seedTenantsData) {
      // Check tenant idempotency
      const existingTenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.slug, tenantData.slug),
      });

      if (existingTenant) {
        console.log(`Tenant '${tenantData.name}' (${tenantData.slug}) already exists. Skipping.`);
        continue;
      }

      console.log(`Seeding tenant: ${tenantData.name}...`);
      const tenantId = ulid();

      // Create Tenant
      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          id: tenantId,
          name: tenantData.name,
          slug: tenantData.slug,
          status: 'active',
          plan: 'pro',
        })
        .returning();

      // Create or find Tenant Owner User
      let ownerUser = await db.query.users.findFirst({
        where: eq(schema.users.email, tenantData.ownerEmail),
      });

      if (!ownerUser) {
        const ownerId = ulid();
        const [insertedOwner] = await db
          .insert(schema.users)
          .values({
            id: ownerId,
            email: tenantData.ownerEmail,
            name: tenantData.ownerName,
            passwordHash: defaultPasswordHash,
            status: 'active',
          })
          .returning();
        ownerUser = insertedOwner;
        console.log(`Created owner user: ${tenantData.ownerEmail}`);
      }

      // Link Owner to Tenant via Membership
      await db.insert(schema.memberships).values({
        id: ulid(),
        tenantId: tenant.id,
        userId: ownerUser.id,
        role: 'tenant_owner',
        status: 'active',
      });

      // Link Platform Admin to Tenant as well
      await db.insert(schema.memberships).values({
        id: ulid(),
        tenantId: tenant.id,
        userId: platformAdmin.id,
        role: 'platform_admin',
        status: 'active',
      });

      // Default Store Settings
      await db.insert(schema.storeSettings).values({
        id: ulid(),
        tenantId: tenant.id,
        storeName: tenantData.name,
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
        currency: tenantData.currency,
        contactEmail: tenantData.ownerEmail,
        deliveryFeeDefault: 5000, // 50.00 INR
        freeDeliveryThreshold: 99900, // 999.00 INR
        analyticsEnabled: true,
        consentRequired: true,
        metaTitle: `${tenantData.name} - Official Store`,
        metaDescription: `Discover quality products crafted with care at ${tenantData.name}.`,
      });

      // Default Theme with Color Tokens
      await db.insert(schema.themes).values({
        id: ulid(),
        tenantId: tenant.id,
        name: 'default',
        draftConfig: {
          colors: tenantData.theme,
          typography: {
            fontHeading: 'Inter',
            fontBody: 'Inter',
          },
          layout: {
            borderRadius: '8px',
            containerMaxWidth: '1280px',
          },
        },
        publishedConfig: {
          colors: tenantData.theme,
          typography: {
            fontHeading: 'Inter',
            fontBody: 'Inter',
          },
          layout: {
            borderRadius: '8px',
            containerMaxWidth: '1280px',
          },
        },
        version: 1,
      });

      // Categories
      const categoryMap = new Map<string, string>();
      for (let i = 0; i < tenantData.categories.length; i++) {
        const cat = tenantData.categories[i];
        const categoryId = ulid();
        await db.insert(schema.categories).values({
          id: categoryId,
          tenantId: tenant.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          sortOrder: i,
          status: 'active',
        });
        categoryMap.set(cat.slug, categoryId);
      }

      // Products and Variants
      for (const prod of tenantData.products) {
        const productId = ulid();
        const categoryId = categoryMap.get(prod.categorySlug) ?? null;

        await db.insert(schema.products).values({
          id: productId,
          tenantId: tenant.id,
          title: prod.title,
          slug: prod.slug,
          description: prod.description,
          categoryId,
          status: 'active',
          listPrice: prod.listPrice,
          salePrice: prod.salePrice,
          isFeatured: prod.isFeatured,
          isTrending: prod.isTrending,
        });

        for (let vIdx = 0; vIdx < prod.variants.length; vIdx++) {
          const variant = prod.variants[vIdx];
          await db.insert(schema.productVariants).values({
            id: ulid(),
            tenantId: tenant.id,
            productId,
            sku: variant.sku,
            name: variant.name,
            optionValues: variant.options,
            stockQuantity: variant.stock,
            isActive: true,
            sortOrder: vIdx,
          });
        }
      }

      // Draft Home Page with Blocks
      const homePageId = ulid();
      await db.insert(schema.pages).values({
        id: homePageId,
        tenantId: tenant.id,
        slug: 'home',
        pageType: 'home',
        title: 'Home',
        status: 'draft',
        seoTitle: `${tenantData.name} - Welcome`,
        seoDescription: `Shop the curated collection at ${tenantData.name}.`,
      });

      await db.insert(schema.pageVersions).values({
        id: ulid(),
        tenantId: tenant.id,
        pageId: homePageId,
        versionNumber: 1,
        schemaVersion: 1,
        blocks: [
          {
            id: 'block-hero-1',
            type: 'hero',
            settings: {
              heading: `Welcome to ${tenantData.name}`,
              subheading: 'Carefully curated essentials designed just for you.',
              ctaText: 'Explore Collection',
              ctaLink: '/products',
            },
          },
          {
            id: 'block-featured-1',
            type: 'featured_products',
            settings: {
              title: 'Featured Collection',
              limit: 4,
            },
          },
        ],
      });

      console.log(`Successfully completed seed for ${tenantData.name}.`);
    }

    console.log('Database seed completed successfully!');
  } catch (error) {
    console.error('Seed execution encountered an error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

// Automatically execute when run as script
void seed();

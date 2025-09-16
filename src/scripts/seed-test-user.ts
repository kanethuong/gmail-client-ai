import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Script to seed a test user for development and testing
 */
async function seedTestUser() {
  try {
    const testEmail = "test@example.com";

    console.log("🌱 Seeding test user...");

    // Check if test user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("✅ Test user already exists");
      console.log("User ID:", existingUser[0]!.id);
      console.log("Email:", existingUser[0]!.email);
      return existingUser[0];
    }

    // Create test user
    const [newUser] = await db.insert(users).values({
      email: testEmail,
      name: "Test User",
      oauthAccessToken: "mock-access-token-for-testing",
      oauthRefreshToken: "mock-refresh-token-for-testing",
      oauthTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    }).returning();

    console.log("✅ Test user created successfully!");
    console.log("User ID:", newUser!.id);
    console.log("Email:", newUser!.email);
    console.log("Name:", newUser!.name);

    return newUser;

  } catch (error) {
    console.error("❌ Error seeding test user:", error);
    throw error;
  }
}

// Run immediately
seedTestUser()
  .then(() => {
    console.log("🎉 Database seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seeding failed:", error);
    process.exit(1);
  });
import { getAllUsers } from '../services/user.service';
import prisma from '../lib/prisma';

// Global BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

async function test() {
  try {
    console.log("Connecting database...");
    await prisma.$connect();
    console.log("Fetching users...");
    const result = await getAllUsers(1, 2);
    console.log("Users fetched successfully:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error fetching users:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();

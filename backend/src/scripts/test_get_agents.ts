import { getAgents } from '../services/user.service';
import prisma from '../lib/prisma';

// Global BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

async function test() {
  try {
    console.log("Connecting database...");
    await prisma.$connect();
    console.log("Fetching agents...");
    const result = await getAgents(1, 10);
    console.log("Agents fetched successfully:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error fetching agents:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();

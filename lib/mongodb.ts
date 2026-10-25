import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || "patentscan";

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env.local");
}

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
};

const client = new MongoClient(uri);

const clientPromise =
  globalForMongo.mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClientPromise = clientPromise;
}

export async function getMongoDatabase(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(databaseName);
}
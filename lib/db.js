import mongoose from "mongoose";

// One cached connection per server instance (important on serverless platforms like Vercel,
// where every cold start would otherwise open a new pool).
const globalForMongoose = globalThis;
if (!globalForMongoose.__workoraMongoose) {
  globalForMongoose.__workoraMongoose = { conn: null, promise: null };
}
const cached = globalForMongoose.__workoraMongoose;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not defined. Local: put it in .env.local. Vercel: Project Settings → Environment Variables."
    );
  }
  return uri;
}

// Atlas "connect" strings often have no database name (…mongodb.net/?appName=…), which would silently
// use the "test" database. If the URI has no db in its path we use MONGODB_DB (default "workora").
function resolveDbName(uri) {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  const hasDbInPath = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri);
  return hasDbInPath ? undefined : "workora";
}

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  const uri = getMongoUri();
  if (!cached.promise) {
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL || 5), // many short-lived instances → keep pools small
      maxIdleTimeMS: 60000,
    };
    const dbName = resolveDbName(uri);
    if (dbName) options.dbName = dbName;
    cached.promise = mongoose.connect(uri, options);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

import { MongoClient, Db } from "mongodb";

// MongoDB ulanishi — dev rejimida HMR har safar yangi ulanish ochib
// yubormasligi uchun global keshda saqlaymiz.
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "crm_akademiya";

if (!uri) {
  // Ilk chaqiruvda tushunarli xato beramiz (build vaqtida emas, so'rov vaqtida).
  console.warn("[mongodb] MONGODB_URI .env.local da o'rnatilmagan");
}

let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient() {
  const client = new MongoClient(uri as string);
  return client.connect();
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClient();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = createClient();
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI o'rnatilmagan (.env.local ni tekshiring)");
  const client = await clientPromise;
  return client.db(dbName);
}

let indexesEnsured = false;

// Kerakli indekslarni bir marta yaratamiz: telefon unikal, verification kodlar
// uchun TTL (rate-limit oynasidan keyin avtomatik o'chadi).
export async function ensureIndexes(): Promise<Db> {
  const db = await getDb();
  if (indexesEnsured) return db;
  indexesEnsured = true;
  try {
    await db.collection("users").createIndex({ phone: 1 }, { unique: true });
    await db.collection("users").createIndex({ "invite.token": 1 }, { sparse: true });
    await db.collection("employees").createIndex({ phone: 1 });
    await db.collection("verification_codes").createIndex({ phone: 1, purpose: 1 });
    // purgeAt vaqti kelganda hujjat avtomatik o'chadi (TTL).
    await db.collection("verification_codes").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("tasks").createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    indexesEnsured = false;
    throw e;
  }
  return db;
}

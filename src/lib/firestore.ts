import { redis } from '@/lib/redis';

let db: any = null;

const hasCredentials =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

if (hasCredentials) {
  try {
    const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');

    let app;
    if (getApps().length === 0) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else {
      app = getApp();
    }

    const dbId = process.env.FIREBASE_DATABASE_ID || 'default';
    db = getFirestore(app, dbId);
  } catch (err) {
    console.error('[Firestore] Failed to initialize real client, falling back to mock:', err);
  }
}

export interface QueryCondition {
  field: string;
  op: '==' | '<' | '>';
  value: any;
}

export const firestoreService = {
  isMock: () => !db,

  setMockMode(mock: boolean) {
    if (mock) {
      db = null;
    }
  },

  async setDoc(collectionName: string, docId: string, data: any): Promise<void> {
    if (db) {
      await db.collection(collectionName).doc(docId).set(data);
    } else {
      await redis.set(`mock_firestore:${collectionName}:${docId}`, JSON.stringify(data));
      await redis.sadd(`mock_firestore_index:${collectionName}`, docId);
    }
  },

  async getDoc(collectionName: string, docId: string): Promise<any | null> {
    if (db) {
      const snap = await db.collection(collectionName).doc(docId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } else {
      const raw = await redis.get(`mock_firestore:${collectionName}:${docId}`);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { id: docId, ...parsed };
    }
  },

  async updateDoc(collectionName: string, docId: string, data: any): Promise<void> {
    if (db) {
      await db.collection(collectionName).doc(docId).update(data);
    } else {
      const existing = await this.getDoc(collectionName, docId);
      const merged = { ...(existing || {}), ...data };
      await this.setDoc(collectionName, docId, merged);
    }
  },

  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    if (db) {
      await db.collection(collectionName).doc(docId).delete();
    } else {
      await redis.del(`mock_firestore:${collectionName}:${docId}`);
      await redis.srem(`mock_firestore_index:${collectionName}`, docId);
    }
  },

  async queryDocs(
    collectionName: string,
    options?: { where?: QueryCondition[] }
  ): Promise<any[]> {
    if (db) {
      let ref = db.collection(collectionName);
      if (options?.where) {
        for (const cond of options.where) {
          ref = ref.where(cond.field, cond.op, cond.value);
        }
      }
      const snap = await ref.get();
      const docs: any[] = [];
      snap.forEach((doc: any) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      return docs;
    } else {
      const ids = await redis.smembers(`mock_firestore_index:${collectionName}`);
      if (!ids || ids.length === 0) return [];

      const docs = await Promise.all(
        ids.map(async (id) => {
          const raw = await redis.get(`mock_firestore:${collectionName}:${id}`);
          if (!raw) return null;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return { id, ...parsed };
        })
      );

      const filtered = docs.filter(Boolean) as any[];

      if (options?.where) {
        return filtered.filter((doc) => {
          return options.where!.every((cond) => {
            const val = doc[cond.field];
            if (cond.op === '==') return val === cond.value;
            if (cond.op === '<') return val < cond.value;
            if (cond.op === '>') return val > cond.value;
            return true;
          });
        });
      }

      return filtered;
    }
  },
};

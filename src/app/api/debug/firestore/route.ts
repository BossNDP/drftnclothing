import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  const logs: string[] = [];
  const addLog = (msg: string) => {
    console.log(`[FirestoreDebug] ${msg}`);
    logs.push(msg);
  };

  try {
    addLog('--- ENVIRONMENT DIAGNOSTICS ---');
    addLog(`process.env.FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID}`);
    addLog(`process.env.FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL}`);
    addLog(`process.env.FIREBASE_DATABASE_ID: ${process.env.FIREBASE_DATABASE_ID}`);
    addLog(`process.env.GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
    addLog(`process.env.GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT}`);
    addLog(`process.env.FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST}`);

    const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');

    addLog(`Apps before init: ${getApps().map((a: any) => a.name).join(', ') || 'none'}`);

    if (getApps().length === 0) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      addLog(`Initializing default app with cert for project: ${process.env.FIREBASE_PROJECT_ID}`);
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }

    const app = getApp();
    addLog(`App Name: ${app.name}`);
    addLog(`App Options: ${JSON.stringify(app.options)}`);

    const dbId = process.env.FIREBASE_DATABASE_ID || 'default';
    addLog(`FIREBASE_DATABASE_ID: "${dbId}"`);

    const dbToUse = getFirestore(app, dbId);
    addLog(`Target database formattedName: ${(dbToUse as any).formattedName}`);

    addLog('--- STEP 1: CREATE COLLECTION & DOC ---');
    const testDocRef = dbToUse.collection('debug').doc('test');
    addLog(`Doc path: ${testDocRef.path}`);

    const testPayload = {
      timestamp: new Date().toISOString(),
      message: 'Hello from DRFTN Firestore Diagnostic test',
      status: 'ok',
    };

    addLog('Executing set()...');
    await testDocRef.set(testPayload);
    addLog('Step 1 SUCCESS: Doc set() completed.');

    addLog('--- STEP 2: READ DOC ---');
    const snap = await testDocRef.get();
    addLog(`Doc exists: ${snap.exists}`);
    if (snap.exists) {
      addLog(`Doc data: ${JSON.stringify(snap.data())}`);
    } else {
      throw new Error('Doc set() succeeded but get() returned exists=false!');
    }

    addLog('--- STEP 3: UPDATE DOC ---');
    await testDocRef.update({ updated: true, updateTime: new Date().toISOString() });
    addLog('Step 3 SUCCESS: Doc update() completed.');

    addLog('--- STEP 4: DELETE DOC ---');
    await testDocRef.delete();
    addLog('Step 4 SUCCESS: Doc delete() completed.');

    addLog('--- STEP 5: TEST FIRESTORE SERVICE WRAPPER ---');
    const { firestoreService } = await import('@/lib/firestore');
    await firestoreService.setDoc('debug', 'wrapper_test', { wrapper: true });
    const wrapperSnap = await firestoreService.getDoc('debug', 'wrapper_test');
    addLog(`Wrapper Read: ${JSON.stringify(wrapperSnap)}`);
    await firestoreService.deleteDoc('debug', 'wrapper_test');
    addLog('Step 5 SUCCESS: firestoreService wrapper setDoc/getDoc/deleteDoc completed.');

    return NextResponse.json({
      success: true,
      message: 'Firestore end-to-end CRUD test completed successfully!',
      logs,
    });
  } catch (error: any) {
    addLog(`CRITICAL FAILURE: ${error.message}`);
    if (error.stack) {
      addLog(`Stack: ${error.stack}`);
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        logs,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

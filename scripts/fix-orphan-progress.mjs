// scripts/fix-orphan-progress.mjs
// Script fix orphan progress docs cho user cụ thể
// Chạy: node scripts/fix-orphan-progress.mjs

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env
const envContent = readFileSync(resolve('.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) continue;
  const k = line.slice(0, eqIdx).trim();
  const v = line.slice(eqIdx + 1).trim();
  if (k) env[k] = v;
}

let privateKey = env['FIREBASE_PRIVATE_KEY'] || '';
if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, '\n');

const app = getApps().find(a => a.name === 'fix') || initializeApp({
  credential: cert({
    projectId: env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    clientEmail: env['FIREBASE_CLIENT_EMAIL'],
    privateKey,
  }),
}, 'fix');

const db = getFirestore(app);

// UID cần fix — thêm nhiều user nếu cần
const USERS_TO_FIX = [
  'DiTTUvmbTQT3EQXe69ud5zr8t1x2', // phamhoainam03@gmail.com
];

async function fixUser(uid) {
  console.log(`\n📋 Đang xử lý user: ${uid}`);

  // Lấy toàn bộ progress docs
  const progressSnap = await db.collection('users').doc(uid).collection('progress').get();
  const progressDocs = progressSnap.docs.filter(d => d.id !== 'stats');
  console.log(`   Progress docs: ${progressDocs.length}`);

  // Tìm orphan
  const orphanIds = [];
  for (const pd of progressDocs) {
    const wordId = pd.id;
    const vocabDoc = await db.collection('vocabulary').doc(wordId).get();
    if (!vocabDoc.exists) {
      orphanIds.push({ id: pd.id, srLevel: pd.data().srLevel ?? 0 });
    }
  }

  console.log(`   ❌ Orphan docs: ${orphanIds.length}`);
  if (orphanIds.length === 0) {
    console.log('   ✅ Không có orphan, bỏ qua.');
    return;
  }

  // Xóa orphan docs theo batch (Firestore batch limit = 500)
  const BATCH_SIZE = 400;
  let deleted = 0;
  for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = orphanIds.slice(i, i + BATCH_SIZE);
    for (const { id } of chunk) {
      const ref = db.collection('users').doc(uid).collection('progress').doc(id);
      batch.delete(ref);
    }
    await batch.commit();
    deleted += chunk.length;
    console.log(`   🗑️  Đã xóa batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs`);
  }

  // Tính lại srDistrib sau fix
  const newSnap = await db.collection('users').doc(uid).collection('progress').get();
  const newDocs = newSnap.docs.filter(d => d.id !== 'stats');
  const srDistrib = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalLearned = 0;
  for (const d of newDocs) {
    const lv = d.data().srLevel ?? 0;
    if (lv >= 1 && lv <= 5) {
      srDistrib[lv]++;
      totalLearned++;
    }
  }

  // Cập nhật totalLearned trong stats doc
  const statsRef = db.collection('users').doc(uid).collection('progress').doc('stats');
  const statsSnap = await statsRef.get();
  if (statsSnap.exists) {
    await statsRef.update({ totalLearned });
    console.log(`   📊 Cập nhật totalLearned → ${totalLearned}`);
  }

  console.log(`\n   ✅ Kết quả sau fix:`);
  console.log(`      Đã xóa: ${deleted} orphan docs`);
  console.log(`      Còn lại: ${newDocs.length} progress docs`);
  console.log(`      Phân bố srLevel:`, srDistrib);
}

// Chạy fix cho tất cả users
for (const uid of USERS_TO_FIX) {
  await fixUser(uid);
}

console.log('\n🎉 Hoàn thành!');
process.exit(0);

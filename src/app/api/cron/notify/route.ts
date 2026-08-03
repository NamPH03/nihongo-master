// src/app/api/cron/notify/route.ts
// Smart Push Notification Engine — Hỗ trợ Cron chạy hàng giờ hoặc Vercel Cron
// Áp dụng: Smart Time Window, Cooldown 8 tiếng, Quota-Saving Early Exit

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ===== HELPERS & TIME WINDOWS =====

function getVNTimeInfo() {
  const nowUtc = Date.now();
  const vnOffset = 7 * 60 * 60 * 1000;
  const vnDate = new Date(nowUtc + vnOffset);
  const hour = vnDate.getUTCHours();
  const dateStr = vnDate.toISOString().split('T')[0];
  return { dateStr, hour, timestamp: nowUtc };
}

function getDaysSinceLastStudy(lastStudyDate: string, todayVN: string): number {
  if (!lastStudyDate) return -1;
  const todayMs = new Date(todayVN).getTime();
  const lastMs = new Date(lastStudyDate).getTime();
  const diff = Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function getReviewReminderMessage(dueCount: number, dueWordsSample: string[]): { title: string; body: string } {
  if (dueWordsSample.length > 0) {
    const sampleStr = dueWordsSample.slice(0, 2).join(', ');
    return {
      title: `🧠 Trí nhớ dài hạn: Ôn lại ${dueCount} từ vựng!`,
      body: `Các từ như [ ${sampleStr} ] sắp bị quên. Dành 3 phút ôn ngay nào!`,
    };
  }
  return {
    title: `📚 ${dueCount} từ vựng đang chờ bạn ôn tập!`,
    body: 'Quên từ vựng theo thời gian là tự nhiên. Ôn ngay để chuyển vào trí nhớ dài hạn nhé!',
  };
}

function getStreakProtectionMessage(streak: number): { title: string; body: string } {
  if (streak > 0) {
    return {
      title: `🔥 Đừng để mất chuỗi ${streak} ngày học!`,
      body: 'Chỉ còn vài tiếng nữa là hết ngày. Học 1 bài ngắn để giữ vững phong độ nhé!',
    };
  }
  return {
    title: '🌙 Dành 5 phút trước khi đi ngủ!',
    body: 'Học vài từ vựng nhẹ nhàng giúp não bộ ghi nhớ sâu hơn trong giấc ngủ.',
  };
}

function getStudyReminderMessage(days: number): { title: string; body: string } | null {
  if (days < 1) return null;

  if (days === 1)
    return {
      title: '🌸 Khởi động ngày mới với vài từ vựng!',
      body: 'Chưa thấy bạn học hôm nay. Mở app nạp thêm kiến thức mới thôi nào!',
    };

  if (days === 2)
    return {
      title: '😟 2 ngày rồi bạn chưa quay lại!',
      body: 'Đừng để kiến thức bốc hơi — vào ôn 5 từ ngắn gọn nhé!',
    };

  if (days === 3)
    return {
      title: '😰 Kiến thức sắp bị trôi mất!',
      body: '3 ngày không học rồi. Quay lại ngay trước khi quên hết từ vựng!',
    };

  if (days >= 5)
    return {
      title: `🚨 ${days} ngày chưa chạm vào Tiếng Nhật!`,
      body: 'Chỉ 1 bài học ngắn thôi cũng giúp bạn duy trì cảm giác ngôn ngữ.',
    };

  return {
    title: `📅 ${days} ngày chưa học!`,
    body: `Đã ${days} ngày trôi qua. Dành vài phút ôn tập hôm nay nhé!`,
  };
}

// ===== MAIN CRON HANDLER =====

export async function GET(req: NextRequest) {
  // 1. Kiểm tra xác thực
  const authHeader = req.headers.get('authorization');
  const secretParam = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = authHeader === `Bearer ${cronSecret}`;
  const isManualTest = secretParam === cronSecret;

  if (!isVercelCron && !isManualTest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dateStr: todayVN, hour: currentHourVN, timestamp: nowMs } = getVNTimeInfo();
  const nowIso = new Date().toISOString();

  // 2. CRITICAL QUOTA SAVER: EARLY EXIT
  // Nếu không phải 3 khung giờ vàng (Sáng 7-9h, Tối 18-20h, Đêm 21-23h) -> Thoát ngay lập tức (0 READS FIRESTORE!)
  const isMorningWindow = currentHourVN >= 7 && currentHourVN <= 9;
  const isEveningWindow = currentHourVN >= 18 && currentHourVN <= 20;
  const isNightWindow = currentHourVN >= 21 && currentHourVN <= 23;

  if (!isManualTest && !isMorningWindow && !isEveningWindow && !isNightWindow) {
    return NextResponse.json({
      success: true,
      message: `[0 Reads] Khung giờ ${currentHourVN}h VN ngoài giờ gửi. Skip để bảo vệ Firebase Read Quota.`,
      skipped: true,
      readsUsed: 0,
    });
  }

  const adminDb = getAdminDb();
  const adminMessaging = getAdminMessaging();

  const userTokens: Record<string, string[]> = {};
  let tokensSnap: FirebaseFirestore.QuerySnapshot | null = null;

  try {
    tokensSnap = await adminDb.collectionGroup('fcmTokens').get();
    tokensSnap.forEach((doc) => {
      const userId = doc.ref.parent.parent?.id;
      if (!userId) return;
      const { token, origin } = doc.data();
      if (!token) return;
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return;
      if (!userTokens[userId]) userTokens[userId] = [];
      userTokens[userId].push(token);
    });
  } catch (e) {
    console.error('[cron/notify] Fallback collectionGroup query failed:', e);
    const usersSnap = await adminDb.collection('users').get();
    for (const uDoc of usersSnap.docs) {
      const uTokensSnap = await uDoc.ref.collection('fcmTokens').get();
      uTokensSnap.forEach((tDoc) => {
        const { token, origin } = tDoc.data();
        if (!token) return;
        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return;
        if (!userTokens[uDoc.id]) userTokens[uDoc.id] = [];
        userTokens[uDoc.id].push(token);
      });
    }
  }

  const userIds = Object.keys(userTokens);
  let totalSent = 0;
  const errors: string[] = [];

  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

  for (const userId of userIds) {
    const tokens = userTokens[userId];

    try {
      // 3. Check Cooldown trước khi đọc dữ liệu từ vựng nặng
      const notifStateRef = adminDb.doc(`users/${userId}/notificationState/data`);
      const notifStateSnap = await notifStateRef.get();
      const notifState = notifStateSnap.data() || {};

      const lastSentTime = notifState.lastSentTimestamp || 0;
      if (!isManualTest && nowMs - lastSentTime < EIGHT_HOURS_MS) {
        continue; // Bỏ qua ngay, không đọc progress collection!
      }

      // 4. Đọc Thống kê học tập
      const statsSnap = await adminDb.doc(`users/${userId}/progress/stats`).get();
      const stats = statsSnap.data() || {};
      const streak = stats.streakCount || 0;
      const lastStudyDate = stats.lastStudyDate || stats.lastReviewDate || '';
      const daysSince = getDaysSinceLastStudy(lastStudyDate, todayVN);
      const studiedToday = daysSince === 0;

      // 5. Đếm số từ đến hạn SRS (Tối ưu: Chỉ đếm các doc thỏa điều kiện nextReview <= now)
      // Dùng query lọc trực tiếp thay vì get() toàn bộ progress
      const dueQuerySnap = await adminDb
        .collection(`users/${userId}/progress`)
        .where('status', '==', 'learned')
        .where('nextReview', '<=', nowIso)
        .get();

      const dueCount = dueQuerySnap.size;
      const dueWordsSample: string[] = [];

      dueQuerySnap.docs.slice(0, 3).forEach((doc) => {
        const data = doc.data();
        if (data.kanji) dueWordsSample.push(data.kanji);
        else if (data.word) dueWordsSample.push(data.word);
      });

      const stateUpdates: Record<string, unknown> = {};
      let notification: { title: string; body: string } | null = null;
      let notifUrl = '/dashboard';

      // ===== PRIORITY MATRIX =====

      if (isNightWindow || (isManualTest && !studiedToday && streak > 0)) {
        if (!studiedToday) {
          notification = getStreakProtectionMessage(streak);
          notifUrl = '/dashboard';
        }
      }

      if (!notification && dueCount >= 3) {
        const lastNotifiedDueCount = notifState.lastNotifiedDueCount || 0;
        if (dueCount > lastNotifiedDueCount || !notifState.lastReviewNotifiedDate) {
          notification = getReviewReminderMessage(dueCount, dueWordsSample);
          stateUpdates.lastNotifiedDueCount = dueCount;
          stateUpdates.lastReviewNotifiedDate = todayVN;
          notifUrl = '/review';
        }
      }

      if (!notification && !studiedToday && daysSince >= 1) {
        const lastStudyReminderDate = notifState.lastStudyReminderDate || '';
        if (lastStudyReminderDate !== todayVN) {
          notification = getStudyReminderMessage(daysSince);
          stateUpdates.lastStudyReminderDate = todayVN;
          notifUrl = '/dashboard';
        }
      }

      if (dueCount === 0 && (notifState.lastNotifiedDueCount || 0) > 0) {
        stateUpdates.lastNotifiedDueCount = 0;
      }

      // ===== GỬI PUSH NOTIFICATION =====
      if (notification && tokens.length > 0) {
        const result = await adminMessaging.sendEachForMulticast({
          tokens,
          data: {
            title: notification.title,
            body: notification.body,
            url: notifUrl,
          },
        });

        const invalidTokenKeys: Promise<FirebaseFirestore.WriteResult>[] = [];
        result.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === 'messaging/registration-token-not-registered' ||
              resp.error?.code === 'messaging/invalid-registration-token')
          ) {
            if (tokensSnap) {
              tokensSnap.forEach((doc) => {
                if (doc.ref.parent.parent?.id === userId && doc.data().token === tokens[idx]) {
                  invalidTokenKeys.push(doc.ref.delete());
                }
              });
            }
          }
        });
        await Promise.all(invalidTokenKeys);

        if (result.successCount > 0) {
          totalSent++;
          stateUpdates.lastSentTimestamp = nowMs;
        }
      }

      if (Object.keys(stateUpdates).length > 0) {
        await notifStateRef.set(stateUpdates, { merge: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${userId}: ${msg}`);
      console.error(`[cron/notify] Lỗi user ${userId}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    time: nowIso,
    hourVN: currentHourVN,
    usersProcessed: userIds.length,
    notificationsSent: totalSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}


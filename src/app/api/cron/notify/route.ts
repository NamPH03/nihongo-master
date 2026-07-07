// src/app/api/cron/notify/route.ts
// Vercel Cron Job — chạy 2 lần/ngày theo lịch trong vercel.json
// Kiểm tra từng user → gửi push notification phù hợp

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ===== HELPERS =====

function getTodayVN(): string {
  // UTC+7
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

function getDaysSinceLastStudy(lastStudyDate: string): number {
  if (!lastStudyDate) return 999;
  const todayVN = getTodayVN();
  const todayMs = new Date(todayVN).getTime();
  const lastMs = new Date(lastStudyDate).getTime();
  const diff = Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function getStudyReminderMessage(days: number): { title: string; body: string } | null {
  if (days < 1) return null; // Đã học hôm nay

  if (days === 1)
    return {
      title: '📚 Nhắc học tiếng Nhật!',
      body: 'Bạn chưa học hôm nay. Chỉ 5 phút thôi, vào học ngay nào!',
    };

  if (days === 2)
    return {
      title: '😟 2 ngày chưa học rồi!',
      body: 'Đừng để kiến thức bốc hơi — vào ôn vài từ nhé!',
    };

  if (days === 3)
    return {
      title: '😰 Streak đang nguy hiểm!',
      body: '3 ngày không học rồi. Quay lại ngay trước khi quên hết!',
    };

  if (days === 5)
    return {
      title: '💀 5 ngày bỏ học rồi!',
      body: 'Từ vựng sắp bốc hơi hết. Học ngay thôi, đừng để muộn hơn!',
    };

  if (days >= 7)
    return {
      title: `🚨 ${days} ngày không động tiếng Nhật!`,
      body: 'Quay lại đây! Chỉ 1 từ thôi cũng được, đừng bỏ cuộc nhé.',
    };

  return {
    title: `📅 ${days} ngày chưa học!`,
    body: `Đã ${days} ngày rồi. Dành vài phút ôn tập hôm nay nhé!`,
  };
}

function getReviewReminderMessage(dueCount: number): { title: string; body: string } {
  return {
    title: '⏰ Đến giờ ôn tập rồi!',
    body: `Bạn có ${dueCount} từ đang chờ ôn tập. Ôn ngay để không quên nhé!`,
  };
}

// ===== MAIN CRON HANDLER =====

export async function GET(req: NextRequest) {
  // Bảo vệ endpoint — chỉ Vercel Cron hoặc request có secret mới được gọi
  const authHeader = req.headers.get('authorization');
  const secretParam = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = authHeader === `Bearer ${cronSecret}`;
  const isManualTest = secretParam === cronSecret;

  if (!isVercelCron && !isManualTest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const todayVN = getTodayVN();

  const adminDb = getAdminDb();
  const adminMessaging = getAdminMessaging();

  // Lấy tất cả FCM tokens từ tất cả users (collectionGroup query)
  const tokensSnap = await adminDb.collectionGroup('fcmTokens').get();

  // Nhóm tokens theo userId
  const userTokens: Record<string, string[]> = {};
  tokensSnap.forEach((doc) => {
    const userId = doc.ref.parent.parent?.id;
    if (!userId) return;
    const { token } = doc.data();
    if (!token) return;
    if (!userTokens[userId]) userTokens[userId] = [];
    userTokens[userId].push(token);
  });

  const userIds = Object.keys(userTokens);
  let totalSent = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    const tokens = userTokens[userId];

    try {
      // Đọc stats học tập
      const statsSnap = await adminDb.doc(`users/${userId}/progress/stats`).get();
      const stats = statsSnap.data() || {};

      // Đọc trạng thái notification (tránh spam)
      const notifStateRef = adminDb.doc(`users/${userId}/notificationState/data`);
      const notifStateSnap = await notifStateRef.get();
      const notifState = notifStateSnap.data() || {};

      // Đếm số từ đến hạn ôn tập
      const progressSnap = await adminDb.collection(`users/${userId}/progress`).get();
      let dueCount = 0;
      progressSnap.forEach((doc) => {
        if (doc.id === 'stats') return;
        const data = doc.data();
        if (data.status !== 'learned') return;
        if (!data.nextReview || data.nextReview <= now) dueCount++;
      });

      const stateUpdates: Record<string, unknown> = {};
      let notification: { title: string; body: string } | null = null;
      let notifUrl = '/dashboard';

      // --- Ưu tiên 1: Nhắc ôn tập (khi số từ đến hạn là bội của 10) ---
      if (dueCount > 0 && dueCount % 10 === 0) {
        const lastNotifiedThreshold = notifState.lastNotifiedDueThreshold || 0;
        const lastNotifiedDate = notifState.lastNotifiedDueDate || '';

        // Chỉ notify nếu: ngưỡng mới HOẶC ngày mới
        if (dueCount !== lastNotifiedThreshold || lastNotifiedDate !== todayVN) {
          notification = getReviewReminderMessage(dueCount);
          stateUpdates.lastNotifiedDueThreshold = dueCount;
          stateUpdates.lastNotifiedDueDate = todayVN;
          notifUrl = '/review';
        }
      }

      // --- Ưu tiên 2: Nhắc học (nếu chưa gửi nhắc ôn tập hôm nay) ---
      if (!notification) {
        const lastStudyDate: string = stats.lastStudyDate || '';
        const daysSince = getDaysSinceLastStudy(lastStudyDate);
        const lastReminderDate: string = notifState.lastStudyReminderDate || '';

        // Chỉ gửi 1 lần/ngày
        if (daysSince >= 1 && lastReminderDate !== todayVN) {
          notification = getStudyReminderMessage(daysSince);
          stateUpdates.lastStudyReminderDate = todayVN;
          notifUrl = '/dashboard';
        }
      }

      // --- Gửi notification ---
      if (notification && tokens.length > 0) {
        const result = await adminMessaging.sendEachForMulticast({
          tokens,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          webpush: {
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'nihongo-master',
              requireInteraction: false,
            },
            fcmOptions: {
              link: notifUrl,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: dueCount > 0 ? dueCount : undefined,
              },
            },
          },
        });

        // Xoá tokens hết hạn / không hợp lệ
        const invalidTokenKeys: Promise<FirebaseFirestore.WriteResult>[] = [];
        result.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === 'messaging/registration-token-not-registered' ||
              resp.error?.code === 'messaging/invalid-registration-token')
          ) {
            // Tìm doc key để xoá
            tokensSnap.forEach((doc) => {
              if (doc.ref.parent.parent?.id === userId && doc.data().token === tokens[idx]) {
                invalidTokenKeys.push(doc.ref.delete());
              }
            });
          }
        });
        await Promise.all(invalidTokenKeys);

        if (result.successCount > 0) totalSent++;
      }

      // Lưu trạng thái mới nếu có thay đổi
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
    time: now,
    usersProcessed: userIds.length,
    notificationsSent: totalSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}

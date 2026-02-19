import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notificationEvents } from '@/lib/notification-events';

// ==========================================
// SSE Notification Stream - Real-time Push
// GET /api/notifications/stream
// ==========================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = authUser.userId;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`)
      );

      // Keep-alive every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      // Subscribe to notification events for this user
      const unsubscribe = notificationEvents.subscribe(userId, (data) => {
        try {
          controller.enqueue(
            encoder.encode(`event: notification\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      });

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

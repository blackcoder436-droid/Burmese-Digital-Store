// ==========================================
// Notification Event Emitter - Real-time SSE
// In-memory event bus for pushing notifications
// ==========================================

type NotificationListener = (data: {
  type: string;
  title: string;
  message: string;
  notificationId: string;
  orderId?: string;
}) => void;

class NotificationEventEmitter {
  private listeners: Map<string, Set<NotificationListener>> = new Map();

  /**
   * Subscribe a user to notification events.
   * Returns an unsubscribe function.
   */
  subscribe(userId: string, listener: NotificationListener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(listener);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Emit a notification event to a specific user.
   */
  emit(userId: string, data: {
    type: string;
    title: string;
    message: string;
    notificationId: string;
    orderId?: string;
  }) {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      for (const listener of userListeners) {
        try {
          listener(data);
        } catch {
          // Don't let one listener break others
        }
      }
    }
  }

  /**
   * Emit to multiple users (e.g., all admins).
   */
  emitToMany(userIds: string[], data: {
    type: string;
    title: string;
    message: string;
    notificationId: string;
    orderId?: string;
  }) {
    for (const userId of userIds) {
      this.emit(userId, data);
    }
  }

  /**
   * Get count of connected users (for monitoring).
   */
  getConnectedCount(): number {
    return this.listeners.size;
  }
}

// Singleton — survives hot reloads in dev via globalThis
const globalForEvents = globalThis as typeof globalThis & {
  notificationEvents?: NotificationEventEmitter;
};

export const notificationEvents =
  globalForEvents.notificationEvents ?? new NotificationEventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.notificationEvents = notificationEvents;
}

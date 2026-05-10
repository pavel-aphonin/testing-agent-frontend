import type { NotificationInstance } from "antd/es/notification/interface";

/**
 * Global notification helpers.
 *
 * AntD's static `notification.success(...)` API does NOT inherit the
 * ConfigProvider theme — it always renders in the default light theme,
 * which looks broken on a dark page. To get themed notifications we
 * have to use the `useNotification()` hook and route every call through
 * its returned api instance. The hook lives inside React state, but
 * non-React code (axios interceptors, mutation handlers) needs to call
 * `notify.error(...)` too — so we keep a module-level reference and
 * register it once from `<NotifyHost>` mounted at the app root.
 *
 * Until the host has registered, calls fall back to the static API so
 * very early errors still surface (just unthemed).
 */

let instance: NotificationInstance | null = null;

export function setNotificationInstance(api: NotificationInstance | null): void {
  instance = api;
}

async function fallback(
  level: "success" | "error" | "warning" | "info",
  title: string,
  description?: string,
  duration?: number,
): Promise<void> {
  // Lazy import to avoid pulling antd's static notification into the
  // hot path when the hook-based instance is already registered.
  const { notification } = await import("antd");
  notification[level]({
    message: title,
    description,
    placement: "topRight",
    duration,
  });
}

export const notify = {
  success(title: string, description?: string): void {
    if (instance) {
      instance.success({ message: title, description, placement: "topRight" });
    } else {
      void fallback("success", title, description);
    }
  },
  error(title: string, description?: string): void {
    if (instance) {
      instance.error({ message: title, description, placement: "topRight", duration: 6 });
    } else {
      void fallback("error", title, description, 6);
    }
  },
  warning(title: string, description?: string): void {
    if (instance) {
      instance.warning({ message: title, description, placement: "topRight", duration: 5 });
    } else {
      void fallback("warning", title, description, 5);
    }
  },
  info(title: string, description?: string): void {
    if (instance) {
      instance.info({ message: title, description, placement: "topRight" });
    } else {
      void fallback("info", title, description);
    }
  },
};

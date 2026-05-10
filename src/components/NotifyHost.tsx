import { notification } from "antd";
import { useEffect } from "react";

import { setNotificationInstance } from "@/utils/notify";

/**
 * Bridge between AntD's `notification.useNotification()` hook (which
 * inherits the ConfigProvider theme) and our module-level `notify`
 * helper used everywhere outside the React tree.
 *
 * Mount this once near the app root, INSIDE <ConfigProvider>. It
 * registers the themed api instance globally on mount and renders the
 * matching context holder so the popups have a place to attach.
 */
export function NotifyHost() {
  const [api, contextHolder] = notification.useNotification({
    placement: "topRight",
    duration: 4,
  });

  useEffect(() => {
    setNotificationInstance(api);
    return () => setNotificationInstance(null);
  }, [api]);

  return contextHolder;
}

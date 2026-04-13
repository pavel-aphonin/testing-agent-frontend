import { notification } from "antd";

/**
 * Global notification helpers.
 *
 * Shows a card in the top-right corner with an icon.
 * Use these instead of `message.success/error` everywhere.
 */

notification.config({
  placement: "topRight",
  duration: 4,
});

export const notify = {
  success(title: string, description?: string) {
    notification.success({
      message: title,
      description,
      placement: "topRight",
    });
  },
  error(title: string, description?: string) {
    notification.error({
      message: title,
      description,
      placement: "topRight",
      duration: 6,
    });
  },
  warning(title: string, description?: string) {
    notification.warning({
      message: title,
      description,
      placement: "topRight",
      duration: 5,
    });
  },
  info(title: string, description?: string) {
    notification.info({
      message: title,
      description,
      placement: "topRight",
    });
  },
};

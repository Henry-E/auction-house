import create, { State } from "zustand";
import produce from "immer";

interface NotificationStore extends State {
  notifications: Array<{
    type: string;
    message: string;
    description?: string;
    txid?: string;
  }>;
  set: (x: any) => void;
}

const useNotificationStore = create<NotificationStore>((set, _get) => ({
  notifications: [],
  set: (fn) => set(produce(fn)),
}));

export function notify(newNotification: {
  type?: string;
  message: string;
  description?: string;
  txid?: string;
}) {
  const { notifications, set: setNotificationStore } =
    useNotificationStore.getState();

  setNotificationStore((s: NotificationStore) => {
    s.notifications = [
      ...notifications,
      { type: "success", ...newNotification },
    ];
  });
}

export default useNotificationStore;

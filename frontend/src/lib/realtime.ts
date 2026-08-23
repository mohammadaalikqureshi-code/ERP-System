/**
 * What to refresh when a realtime event arrives.
 *
 * The backend publishes events named in `app/websockets/events.py`; this map is
 * the other half of that contract. When a socket message comes in, the query
 * keys listed here are invalidated and React Query refetches them — so a screen
 * updates without anyone pressing refresh.
 *
 * Adding an event: add the constant on the backend, then add a line here.
 */

export type RealtimeEvent = {
  type: string;
  entityId?: string;
  data?: Record<string, unknown>;
};

/** Event name -> the React Query keys it makes stale. */
export const EVENT_QUERY_KEYS: Record<string, string[][]> = {
  APPOINTMENT_CREATED: [['appointments'], ['queue'], ['dashboard']],
  APPOINTMENT_STATUS_CHANGED: [['appointments'], ['queue'], ['dashboard']],
  APPOINTMENT_RESCHEDULED: [['appointments'], ['queue']],
  QUEUE_UPDATED: [['queue']],

  VITALS_RECORDED: [['vitals'], ['appointments']],
  PRESCRIPTION_CREATED: [['prescriptions'], ['appointments']],

  LAB_ORDER_CREATED: [['labOrders'], ['dashboard']],
  LAB_ORDER_STATUS_CHANGED: [['labOrders']],
  LAB_RESULT_READY: [['labOrders'], ['dashboard']],

  BILL_CREATED: [['bills'], ['dashboard'], ['reports']],
  PAYMENT_RECORDED: [['bills'], ['dashboard'], ['reports']],

  STOCK_CHANGED: [['inventory']],
  STOCK_LOW: [['inventory'], ['lowStock']],

  NOTIFICATION_RECEIVED: [['inbox-notifications']],
};

/** Events worth showing the user a toast for, with the message to show. */
export const EVENT_TOASTS: Record<string, (event: RealtimeEvent) => string> = {
  STOCK_LOW: (event) =>
    `${event.data?.name ?? 'An item'} is running low (${event.data?.stock} left).`,
  LAB_RESULT_READY: () => 'A lab result has just been published.',
};

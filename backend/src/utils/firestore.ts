import { Timestamp } from 'firebase-admin/firestore';

export function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

export function toFirestoreDate(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

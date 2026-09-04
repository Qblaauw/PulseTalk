export function getErrorMessage(value: unknown, fallback: string): string {
  let message: string;

  if (typeof value === 'string') {
    message = value;
  } else if (value instanceof Error) {
    message = value.message;
  } else if (value !== null && typeof value === 'object' && 'message' in value) {
    const objectMessage = (value as { message?: unknown }).message;
    message = typeof objectMessage === 'string' ? objectMessage : stringify(value);
  } else if (value == null) {
    return fallback;
  } else {
    message = stringify(value);
  }

  return message.length > 0 ? message : fallback;
}

function stringify(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '';
  }
}

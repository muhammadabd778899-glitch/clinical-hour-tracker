/** Subscribes to browser online/offline events. */
import { useEffect, useState } from 'react';
import { isOnline, subscribeOnline } from '@/lib/pwa';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => subscribeOnline(setOnline), []);
  return online;
}

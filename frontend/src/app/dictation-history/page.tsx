'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Legacy route. Dictations now live in the Library. */
export default function DictationHistoryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/library?filter=dictations');
  }, [router]);
  return null;
}

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHashQueryParams } from '../../lib/hashRouteQuery';

export type InboxFolder = 'primary' | 'requests';

export function useInboxQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hashParams = getHashQueryParams();

  const conversationId = searchParams.get('c') || hashParams.get('c');
  const folder: InboxFolder =
    (searchParams.get('folder') || hashParams.get('folder')) === 'requests' ? 'requests' : 'primary';

  const setInboxParams = useCallback(
    (next: { c?: string | null; folder?: InboxFolder | null }) => {
      const params = new URLSearchParams();
      const c = next.c !== undefined ? next.c : searchParams.get('c') || hashParams.get('c');
      const f =
        next.folder !== undefined
          ? next.folder
          : (searchParams.get('folder') || hashParams.get('folder')) === 'requests'
            ? 'requests'
            : 'primary';
      if (c) params.set('c', c);
      if (f === 'requests') params.set('folder', 'requests');
      setSearchParams(params);
    },
    [searchParams, hashParams, setSearchParams],
  );

  return useMemo(
    () => ({ conversationId, folder, setInboxParams }),
    [conversationId, folder, setInboxParams],
  );
}

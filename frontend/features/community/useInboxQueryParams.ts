import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHashQueryParams } from '../../lib/hashRouteQuery';

export type InboxFolder = 'primary' | 'requests' | 'starred';

function parseFolder(raw: string | null): InboxFolder {
  if (raw === 'requests') return 'requests';
  if (raw === 'starred') return 'starred';
  return 'primary';
}

export function useInboxQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hashParams = getHashQueryParams();

  const conversationId = searchParams.get('c') || hashParams.get('c');
  const folder = parseFolder(searchParams.get('folder') || hashParams.get('folder'));

  const setInboxParams = useCallback(
    (next: { c?: string | null; folder?: InboxFolder | null }) => {
      const params = new URLSearchParams();
      const c = next.c !== undefined ? next.c : searchParams.get('c') || hashParams.get('c');
      const f =
        next.folder !== undefined
          ? next.folder
          : parseFolder(searchParams.get('folder') || hashParams.get('folder'));
      if (c) params.set('c', c);
      if (f === 'requests') params.set('folder', 'requests');
      if (f === 'starred') params.set('folder', 'starred');
      setSearchParams(params);
    },
    [searchParams, hashParams, setSearchParams],
  );

  return useMemo(
    () => ({ conversationId, folder, setInboxParams }),
    [conversationId, folder, setInboxParams],
  );
}

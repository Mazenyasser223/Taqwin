import { useCallback, useState } from 'react';

import {
  persistCoachDisclaimerAccepted,
  readCoachDisclaimerAccepted,
} from './coachChatConstants';

export function useCoachDisclaimer() {
  const [accepted, setAccepted] = useState(() => readCoachDisclaimerAccepted());

  const accept = useCallback(() => {
    persistCoachDisclaimerAccepted();
    setAccepted(true);
  }, []);

  return { accepted, accept };
}

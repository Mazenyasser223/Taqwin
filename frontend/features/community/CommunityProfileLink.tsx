import React from 'react';
import { Link } from 'react-router-dom';
import { communityProfilePath } from './communityUtils';
import { prefetchCommunityProfile } from '../../lib/communityCache';

type Props = {
  userId: string;
  className?: string;
  children: React.ReactNode;
};

/** Profile link with hover/touch prefetch so the page opens instantly from cache. */
export const CommunityProfileLink: React.FC<Props> = ({ userId, className, children }) => (
  <Link
    to={communityProfilePath(userId)}
    className={className}
    onMouseEnter={() => prefetchCommunityProfile(userId)}
    onFocus={() => prefetchCommunityProfile(userId)}
    onTouchStart={() => prefetchCommunityProfile(userId)}
  >
    {children}
  </Link>
);

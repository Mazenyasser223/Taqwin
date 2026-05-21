import React from 'react';
import { Link } from 'react-router-dom';
import type { CommunityMention } from '../../types';
import { displayName } from './communityUtils';

export const PostMentions: React.FC<{ mentions?: CommunityMention[] }> = ({ mentions }) => {
  if (!mentions?.length) return null;
  return (
    <div className="px-4 pb-2 flex flex-wrap gap-2">
      {mentions.map((m) => {
        if (m.type === 'user' && m.user) {
          return (
            <Link
              key={`u-${m.id}`}
              to={`/community/profile/${m.user.id}`}
              className="text-xs font-bold text-primary hover:underline"
            >
              @{displayName(m.user)}
            </Link>
          );
        }
        if (m.type === 'gym' && m.gym) {
          const profileId = m.gym.ownerId;
          return profileId ? (
            <Link
              key={`g-${m.id}`}
              to={`/community/profile/${profileId}`}
              className="text-xs font-bold text-amber-400 hover:underline inline-flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-sm">fitness_center</span>
              {m.gym.name}
            </Link>
          ) : (
            <span key={`g-${m.id}`} className="text-xs font-bold text-amber-400">
              {m.gym.name}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
};

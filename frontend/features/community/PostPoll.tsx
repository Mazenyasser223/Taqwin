import React, { useState } from 'react';

import communityService from '../../services/communityService';

import type { CommunityPost } from '../../types';

import { useI18n } from '../../lib/i18n/useI18n';

import { optimisticPollVote } from './communityOptimistic';



interface PostPollProps {

  post: CommunityPost;

  onPostChange: (post: CommunityPost) => void;

}



export const PostPoll: React.FC<PostPollProps> = ({ post, onPostChange }) => {

  const { t } = useI18n();

  const poll = post.poll;

  const [voteError, setVoteError] = useState<string | null>(null);



  if (!poll) return null;



  const voteLabel =

    poll.totalVotes === 1

      ? t('community.pollOneVote')

      : t('community.pollVotes', { count: String(poll.totalVotes) });



  const vote = async (optionId: string) => {

    if (poll.ended || poll.myOptionId === optionId) return;



    const snapshot = post;

    setVoteError(null);

    onPostChange({ ...post, poll: optimisticPollVote(poll, optionId) });



    const res = await communityService.votePoll(post.id, optionId);

    if (res.error) {

      setVoteError(res.error);

      onPostChange(snapshot);

      return;

    }

    if (res.data?.poll) {

      onPostChange({ ...post, poll: res.data.poll });

    }

  };



  return (

    <div className="rounded-xl border border-subtle bg-elevated/30 p-3 space-y-2">

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">

        <span>{voteLabel}</span>

        {poll.ended && <span className="text-amber-500 font-semibold">{t('community.pollEnded')}</span>}

      </div>

      {voteError && (

        <p className="text-xs text-red-400" role="alert">

          {voteError}

        </p>

      )}

      <div className="space-y-2">

        {poll.options.map((opt) => {

          const selected = poll.myOptionId === opt.id;

          const showBar = poll.myOptionId != null || poll.ended;

          return (

            <button

              key={opt.id}

              type="button"

              disabled={poll.ended}

              onClick={() => void vote(opt.id)}

              className={`relative w-full text-left rounded-lg border px-3 py-2.5 overflow-hidden transition-colors ${

                selected

                  ? 'border-primary/60 bg-primary/10'

                  : 'border-subtle hover:border-primary/40 hover:bg-elevated/60'

              }`}

            >

              {showBar && (

                <span

                  className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200 ease-out"

                  style={{ width: `${Math.max(opt.percent, selected ? 8 : 0)}%` }}

                  aria-hidden

                />

              )}

              <span className="relative flex items-center justify-between gap-2 text-sm">

                <span className="font-medium text-foreground">{opt.label}</span>

                {showBar && (

                  <span className="text-xs text-muted shrink-0">

                    {opt.percent}% · {opt.votesCount}

                  </span>

                )}

              </span>

            </button>

          );

        })}

      </div>

    </div>

  );

};


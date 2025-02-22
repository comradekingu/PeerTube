import { isTestInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { ACTOR_FOLLOW_SCORE, SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { ActorFollowHealthCache } from '../actor-follow-health-cache'
import { AbstractScheduler } from './abstract-scheduler'

export class ActorFollowScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.actorFollowScores

  private constructor () {
    super()
  }

  protected async internalExecute () {
    await this.processPendingScores()

    await this.removeBadActorFollows()
  }

  private async processPendingScores () {
    const pendingScores = ActorFollowHealthCache.Instance.getPendingFollowsScore()
    const badServerIds = ActorFollowHealthCache.Instance.getBadFollowingServerIds()
    const goodServerIds = ActorFollowHealthCache.Instance.getGoodFollowingServerIds()

    ActorFollowHealthCache.Instance.clearPendingFollowsScore()
    ActorFollowHealthCache.Instance.clearBadFollowingServerIds()
    ActorFollowHealthCache.Instance.clearGoodFollowingServerIds()

    for (const inbox of Object.keys(pendingScores)) {
      await ActorFollowModel.updateScore(inbox, pendingScores[inbox])
    }

    await ActorFollowModel.updateScoreByFollowingServers(badServerIds, ACTOR_FOLLOW_SCORE.PENALTY)
    await ActorFollowModel.updateScoreByFollowingServers(goodServerIds, ACTOR_FOLLOW_SCORE.BONUS)
  }

  private async removeBadActorFollows () {
    if (!isTestInstance()) logger.info('Removing bad actor follows (scheduler).')

    try {
      await ActorFollowModel.removeBadActorFollows()
    } catch (err) {
      logger.error('Error in bad actor follows scheduler.', { err })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

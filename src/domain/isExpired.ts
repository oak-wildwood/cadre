import type { Member } from './member'

/** True once a member's retention period has run out. A member with no `expiresAt` never expires. */
export function isExpired(member: Pick<Member, 'expiresAt'>, now: Date = new Date()): boolean {
  if (member.expiresAt === null) {
    return false
  }
  return member.expiresAt.getTime() <= now.getTime()
}

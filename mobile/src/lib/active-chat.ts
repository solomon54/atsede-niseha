/**
 * Tracks which conversation is currently on screen.
 *
 * The chat tab stays mounted underneath the chat detail screen, so its Pusher
 * listeners keep receiving events. Without this marker it would increment an
 * unread badge for the room the user is actively reading.
 */
let activeChatChannelId: string | null = null;

export function setActiveChatChannel(channelId: string | null): void {
  activeChatChannelId = channelId;
}

export function getActiveChatChannel(): string | null {
  return activeChatChannelId;
}

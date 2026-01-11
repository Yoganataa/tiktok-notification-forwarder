
export interface DiscordChannelManagerPort {
  /**
   * Creating a new Text Channel under a specific category.
   * @param name Sanitized channel name (lowercase, letters only)
   * @returns ID of the newly created channel
   */
  createChannel(name: string): Promise<string>;
}

export class AppVersionDto {
  /**
   * Older versions must update before they can be used.
   * @example "1.0.0"
   */
  minVersion: string;
}

export class AppConfigDto {
  business: AppVersionDto;
  customer: AppVersionDto;
  admin: AppVersionDto;
}

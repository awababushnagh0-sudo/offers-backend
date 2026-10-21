import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResolveLocationDto {
  /**
   * A Google Maps link, full or short (maps.app.goo.gl), or plain
   * coordinates.
   * @example "https://maps.app.goo.gl/AbC123"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  link: string;
}

export class ResolvedLocationDto {
  /** @example 32.8872 */
  latitude: number;

  /** @example 13.1913 */
  longitude: number;
}

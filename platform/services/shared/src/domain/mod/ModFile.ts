/**
 * ModFile - Domain model for downloadable mod file
 */

/**
 * File hash information
 */
export interface ModFileHashes {
  sha1?: string;
  sha512?: string;
  md5?: string;
}

/**
 * Represents a downloadable mod file
 */
export interface ModFile {
  /** Direct download URL */
  url: string;

  /** File name */
  filename: string;

  /** File size in bytes */
  size: number;

  /** File hashes for verification */
  hashes: ModFileHashes;

  /** Whether this is the primary file */
  primary: boolean;
}

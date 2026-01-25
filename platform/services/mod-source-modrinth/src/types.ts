/**
 * Modrinth API Raw Types
 * Types matching the Modrinth API responses
 * https://docs.modrinth.com/api-spec
 */

/**
 * Raw project from Modrinth API
 */
export interface ModrinthProjectRaw {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader';
  downloads: number;
  icon_url: string | null;
  id: string;
  team: string;
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  license: {
    id: string;
    name: string;
    url: string | null;
  };
  gallery: Array<{
    url: string;
    featured: boolean;
    title: string | null;
    description: string | null;
    created: string;
    ordering: number;
  }>;
}

/**
 * Raw search result from Modrinth API
 */
export interface ModrinthSearchResultRaw {
  hits: ModrinthSearchHitRaw[];
  offset: number;
  limit: number;
  total_hits: number;
}

/**
 * Raw search hit from Modrinth API
 */
export interface ModrinthSearchHitRaw {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader';
  downloads: number;
  icon_url: string | null;
  project_id: string;
  author: string;
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  license: string;
  gallery: string[];
}

/**
 * Raw version from Modrinth API
 */
export interface ModrinthVersionRaw {
  id: string;
  project_id: string;
  author_id: string;
  name: string;
  version_number: string;
  changelog: string;
  date_published: string;
  downloads: number;
  version_type: 'release' | 'beta' | 'alpha';
  files: ModrinthFileRaw[];
  dependencies: ModrinthDependencyRaw[];
  game_versions: string[];
  loaders: string[];
  featured: boolean;
}

/**
 * Raw file from Modrinth API
 */
export interface ModrinthFileRaw {
  hashes: {
    sha1: string;
    sha512: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

/**
 * Raw dependency from Modrinth API
 */
export interface ModrinthDependencyRaw {
  version_id: string | null;
  project_id: string;
  file_name: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

/**
 * Team member from Modrinth API (for author lookup)
 */
export interface ModrinthTeamMemberRaw {
  team_id: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar_url: string | null;
  };
  role: string;
  accepted: boolean;
  ordering: number;
}

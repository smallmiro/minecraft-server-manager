#!/bin/bash
# =============================================================================
# backup.sh - GitHub backup for worlds/ directory
# =============================================================================
# Backup Minecraft worlds to a private GitHub repository.
#
# Usage:
#   ./scripts/backup.sh push [--message "msg"]  # Backup to GitHub
#   ./scripts/backup.sh status                   # Show backup configuration
#   ./scripts/backup.sh history [--json]         # Show backup history
#   ./scripts/backup.sh restore <commit>         # Restore from specific commit
#   ./scripts/backup.sh diff [commit]            # Show differences
#
# Environment Variables (in .env):
#   BACKUP_GITHUB_TOKEN    - GitHub Personal Access Token
#   BACKUP_GITHUB_REPO     - Repository (username/repo-name)
#   BACKUP_GITHUB_BRANCH   - Branch name (default: main)
#   BACKUP_AUTO_ON_STOP    - Auto backup on server stop (true/false)
#
# Exit codes:
#   0 - Success
#   1 - Error
#   2 - Warning (backup skipped, no changes, etc.)
# =============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

WORLDS_DIR="$PLATFORM_DIR/worlds"
BACKUP_CACHE_DIR="$PLATFORM_DIR/backups/worlds"
ENV_FILE="$PLATFORM_DIR/.env"

# =============================================================================
# Usage
# =============================================================================

usage() {
    cat <<EOF
Usage: $(basename "$0") <command> [options]

Backup Minecraft worlds to a private GitHub repository.

Commands:
  push [--message "msg"]     Backup worlds to GitHub
  push --auto                Backup with automatic timestamp message
  status                     Show backup configuration and status
  history [--json]           Show recent backup history
  restore <commit>           Restore worlds from specific commit
  diff [commit]              Show differences with backup

Options:
  --json                     Output in JSON format
  --message, -m "msg"        Custom commit message
  --auto                     Use automatic timestamp message
  -h, --help                 Show this help message

Environment Variables (set in .env):
  BACKUP_GITHUB_TOKEN        GitHub Personal Access Token (required)
  BACKUP_GITHUB_REPO         Repository as username/repo (required)
  BACKUP_GITHUB_BRANCH       Branch name (default: main)
  BACKUP_AUTO_ON_STOP        Auto backup on server stop (default: false)

Examples:
  $(basename "$0") push -m "Before server upgrade"
  $(basename "$0") push --auto
  $(basename "$0") status
  $(basename "$0") history --json
  $(basename "$0") restore abc1234
  $(basename "$0") diff HEAD~1
EOF
}

# =============================================================================
# Helper Functions
# =============================================================================

# Load environment variables from .env file
load_env() {
    if [[ -f "$ENV_FILE" ]]; then
        # Export variables from .env, ignoring comments and empty lines
        set -a
        source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
        set +a
    fi
}

# Check if backup is configured
check_backup_config() {
    local missing=()

    if [[ -z "${BACKUP_GITHUB_TOKEN:-}" ]]; then
        missing+=("BACKUP_GITHUB_TOKEN")
    fi

    if [[ -z "${BACKUP_GITHUB_REPO:-}" ]]; then
        missing+=("BACKUP_GITHUB_REPO")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing[*]}"
        error "Please configure them in $ENV_FILE"
        return 1
    fi

    return 0
}

# Get the backup repository URL with authentication
get_repo_url() {
    echo "https://${BACKUP_GITHUB_TOKEN}@github.com/${BACKUP_GITHUB_REPO}.git"
}

# Get the backup repository URL for display (masked token)
get_repo_url_display() {
    echo "https://***@github.com/${BACKUP_GITHUB_REPO}.git"
}

# Initialize or update the backup cache directory
init_backup_cache() {
    local branch="${BACKUP_GITHUB_BRANCH:-main}"

    if [[ ! -d "$BACKUP_CACHE_DIR/.git" ]]; then
        info "Initializing backup cache..."
        mkdir -p "$BACKUP_CACHE_DIR"

        # Try to clone existing repo
        if git clone --depth 50 --branch "$branch" "$(get_repo_url)" "$BACKUP_CACHE_DIR" 2>/dev/null; then
            info "Cloned existing backup repository"
        else
            # Initialize new repo if clone fails
            info "Creating new backup repository..."
            cd "$BACKUP_CACHE_DIR"
            git init
            git checkout -b "$branch"
            echo "# Minecraft Worlds Backup" > README.md
            echo "" >> README.md
            echo "This repository contains automated backups of Minecraft world data." >> README.md
            echo "" >> README.md
            echo "**Do not edit manually.**" >> README.md
            git add README.md
            git commit -m "Initial backup repository setup"
            git remote add origin "$(get_repo_url)"
        fi
    else
        # Update existing cache
        cd "$BACKUP_CACHE_DIR"
        git remote set-url origin "$(get_repo_url)" 2>/dev/null || git remote add origin "$(get_repo_url)"
        git fetch origin "$branch" 2>/dev/null || true
        git checkout "$branch" 2>/dev/null || git checkout -b "$branch"
        git pull origin "$branch" --rebase 2>/dev/null || true
    fi

    # Configure git user for backup commits (local to this repo)
    cd "$BACKUP_CACHE_DIR"
    git config user.email "minecraft-backup@localhost"
    git config user.name "Minecraft Backup"

    cd "$PLATFORM_DIR"
}

# Sync worlds to backup cache
sync_worlds_to_cache() {
    if [[ ! -d "$WORLDS_DIR" ]]; then
        error "Worlds directory not found: $WORLDS_DIR"
        return 1
    fi

    # Sync worlds, excluding .locks directory
    rsync -av --delete \
        --exclude='.locks' \
        --exclude='.locks/' \
        "$WORLDS_DIR/" "$BACKUP_CACHE_DIR/worlds/"

    return 0
}

# Check if there are changes to backup
has_changes() {
    cd "$BACKUP_CACHE_DIR"
    git add -A
    if git diff --cached --quiet; then
        return 1  # No changes
    fi
    return 0  # Has changes
}

# =============================================================================
# Commands
# =============================================================================

# Push command - backup worlds to GitHub
cmd_push() {
    local message=""
    local auto_message=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --message|-m)
                message="$2"
                shift 2
                ;;
            --auto)
                auto_message=true
                shift
                ;;
            -*)
                error "Unknown option: $1"
                return 1
                ;;
            *)
                error "Unexpected argument: $1"
                return 1
                ;;
        esac
    done

    check_backup_config || return 1

    # Generate auto message if requested
    if $auto_message || [[ -z "$message" ]]; then
        message="Backup: $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    info "Starting backup to $(get_repo_url_display)..."

    # Initialize/update cache
    init_backup_cache || return 1

    # Sync worlds
    info "Syncing worlds directory..."
    sync_worlds_to_cache || return 1

    # Check for changes
    cd "$BACKUP_CACHE_DIR"

    if ! has_changes; then
        warn "No changes to backup"
        return 2
    fi

    # Commit and push
    info "Committing changes..."
    git commit -m "$message"

    info "Pushing to GitHub..."
    local branch="${BACKUP_GITHUB_BRANCH:-main}"
    git push -u origin "$branch"

    local commit_hash
    commit_hash=$(git rev-parse --short HEAD)

    info "Backup complete: $commit_hash"
    echo ""
    echo -e "${GREEN}✓${NC} Backup successful"
    echo "  Commit: $commit_hash"
    echo "  Message: $message"
    echo "  Repository: https://github.com/${BACKUP_GITHUB_REPO}"

    cd "$PLATFORM_DIR"
}

# Status command - show backup configuration
cmd_status() {
    local json_output=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                json_output=true
                JSON_OUTPUT=true
                setup_colors
                shift
                ;;
            *)
                error "Unknown option: $1"
                return 1
                ;;
        esac
    done

    local configured=false
    local cache_exists=false
    local last_commit=""
    local last_date=""
    local repo="${BACKUP_GITHUB_REPO:-not set}"
    local branch="${BACKUP_GITHUB_BRANCH:-main}"
    local auto_stop="${BACKUP_AUTO_ON_STOP:-false}"

    # Check if configured
    if [[ -n "${BACKUP_GITHUB_TOKEN:-}" && -n "${BACKUP_GITHUB_REPO:-}" ]]; then
        configured=true
    fi

    # Check cache
    if [[ -d "$BACKUP_CACHE_DIR/.git" ]]; then
        cache_exists=true
        cd "$BACKUP_CACHE_DIR"
        last_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
        last_date=$(git log -1 --format="%ci" 2>/dev/null || echo "none")
        cd "$PLATFORM_DIR"
    fi

    if $json_output; then
        cat <<EOF
{
  "configured": $configured,
  "repository": "$repo",
  "branch": "$branch",
  "auto_on_stop": $auto_stop,
  "cache_exists": $cache_exists,
  "last_commit": "$last_commit",
  "last_date": "$last_date",
  "worlds_dir": "$WORLDS_DIR",
  "cache_dir": "$BACKUP_CACHE_DIR"
}
EOF
    else
        echo -e "${BOLD}=== Backup Status ===${NC}"
        echo ""

        if $configured; then
            echo -e "Configuration: ${GREEN}Configured${NC}"
        else
            echo -e "Configuration: ${RED}Not configured${NC}"
        fi

        echo "Repository:    $repo"
        echo "Branch:        $branch"
        echo "Auto on stop:  $auto_stop"
        echo ""

        if $cache_exists; then
            echo -e "Cache:         ${GREEN}Exists${NC}"
            echo "Last commit:   $last_commit"
            echo "Last date:     $last_date"
        else
            echo -e "Cache:         ${YELLOW}Not initialized${NC}"
        fi

        echo ""
        echo "Worlds dir:    $WORLDS_DIR"
        echo "Cache dir:     $BACKUP_CACHE_DIR"

        if ! $configured; then
            echo ""
            echo -e "${YELLOW}To configure backup, add to $ENV_FILE:${NC}"
            echo "  BACKUP_GITHUB_TOKEN=ghp_your_token"
            echo "  BACKUP_GITHUB_REPO=username/repo-name"
            echo "  BACKUP_AUTO_ON_STOP=true"
        fi
    fi
}

# History command - show backup history
cmd_history() {
    local json_output=false
    local limit=10

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                json_output=true
                JSON_OUTPUT=true
                setup_colors
                shift
                ;;
            -n|--limit)
                limit="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                return 1
                ;;
        esac
    done

    if [[ ! -d "$BACKUP_CACHE_DIR/.git" ]]; then
        error "Backup cache not initialized. Run 'backup.sh push' first."
        return 1
    fi

    cd "$BACKUP_CACHE_DIR"

    if $json_output; then
        echo "{"
        echo '  "history": ['
        local first=true
        while IFS='|' read -r hash date message; do
            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            first=false
            printf '    {"commit": "%s", "date": "%s", "message": "%s"}' \
                "$hash" "$date" "$(echo "$message" | sed 's/"/\\"/g')"
        done < <(git log -n "$limit" --format="%h|%ci|%s")
        echo ""
        echo "  ]"
        echo "}"
    else
        echo -e "${BOLD}=== Backup History ===${NC}"
        echo ""
        printf "%-10s %-20s %s\n" "COMMIT" "DATE" "MESSAGE"
        printf "%-10s %-20s %s\n" "------" "----" "-------"

        git log -n "$limit" --format="%h|%ci|%s" | while IFS='|' read -r hash date message; do
            printf "%-10s %-20s %s\n" "$hash" "${date%% *}" "$message"
        done
    fi

    cd "$PLATFORM_DIR"
}

# Restore command - restore from specific commit
cmd_restore() {
    local commit="$1"

    if [[ -z "$commit" ]]; then
        error "Usage: restore <commit>"
        return 1
    fi

    if [[ ! -d "$BACKUP_CACHE_DIR/.git" ]]; then
        error "Backup cache not initialized. Run 'backup.sh push' first."
        return 1
    fi

    cd "$BACKUP_CACHE_DIR"

    # Verify commit exists
    if ! git rev-parse "$commit" &>/dev/null; then
        error "Commit not found: $commit"
        return 1
    fi

    local commit_full
    commit_full=$(git rev-parse "$commit")
    local commit_short="${commit_full:0:7}"
    local commit_date
    commit_date=$(git log -1 --format="%ci" "$commit")

    warn "This will restore worlds from commit $commit_short ($commit_date)"
    warn "Current worlds will be backed up to $WORLDS_DIR.bak"
    echo ""
    read -p "Are you sure? (yes/no): " confirm

    if [[ "$confirm" != "yes" ]]; then
        info "Restore cancelled"
        return 2
    fi

    # Backup current worlds
    if [[ -d "$WORLDS_DIR" ]]; then
        local backup_name="$WORLDS_DIR.bak.$(date +%Y%m%d%H%M%S)"
        info "Backing up current worlds to $backup_name"
        cp -r "$WORLDS_DIR" "$backup_name"
    fi

    # Checkout specific commit
    info "Checking out commit $commit_short..."
    git checkout "$commit" -- worlds/ 2>/dev/null || {
        error "Failed to checkout. The commit may not contain worlds directory."
        return 1
    }

    # Sync to worlds directory
    info "Restoring worlds..."
    mkdir -p "$WORLDS_DIR"
    rsync -av --delete "$BACKUP_CACHE_DIR/worlds/" "$WORLDS_DIR/"

    # Restore .locks directory if missing
    mkdir -p "$WORLDS_DIR/.locks"

    # Return to branch
    local branch="${BACKUP_GITHUB_BRANCH:-main}"
    git checkout "$branch" 2>/dev/null

    cd "$PLATFORM_DIR"

    info "Restore complete from $commit_short"
    echo ""
    echo -e "${GREEN}✓${NC} Worlds restored from commit $commit_short"
    echo "  Previous worlds backed up to: ${backup_name:-none}"
}

# Diff command - show differences
cmd_diff() {
    local commit="${1:-HEAD}"

    if [[ ! -d "$BACKUP_CACHE_DIR/.git" ]]; then
        error "Backup cache not initialized. Run 'backup.sh push' first."
        return 1
    fi

    # Sync current state to cache first
    sync_worlds_to_cache || return 1

    cd "$BACKUP_CACHE_DIR"
    git add -A

    echo -e "${BOLD}=== Differences from backup ($commit) ===${NC}"
    echo ""

    if git diff --cached --stat "$commit" 2>/dev/null; then
        echo ""
        git diff --cached --name-status "$commit" 2>/dev/null
    else
        warn "Cannot diff with $commit"
    fi

    cd "$PLATFORM_DIR"
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Load environment variables
    load_env

    local command="${1:-}"
    shift || true

    case "$command" in
        push)
            cmd_push "$@"
            ;;
        status)
            cmd_status "$@"
            ;;
        history)
            cmd_history "$@"
            ;;
        restore)
            cmd_restore "$@"
            ;;
        diff)
            cmd_diff "$@"
            ;;
        -h|--help|help)
            usage
            exit 0
            ;;
        "")
            error "No command specified"
            usage
            exit 1
            ;;
        *)
            error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

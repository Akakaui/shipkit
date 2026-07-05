# CLEANUP SKILL

Last updated: 2026-06-28
Version: 3
Scope: OPEX system — end of every session
Invoked by: OPEX (automatic) or user request

## PURPOSE

Keep the VPS clean within storage limits.
Push approved content to Notion for posting.
Backup memory files to Google Drive weekly.
Log the session and free up space after every session.

## CLEANUP TRIGGER

Automatic: OPEX invokes this at end of every session
Manual: User says "clean up", "end session", "clear temp files", "push to notion"

## WHAT GETS DELETED (Immediate — no confirmation)

### Audio files (after transcription)
  /tmp/opex-audio-*          ← downloaded audio files
  /tmp/opex-transcript-*     ← transcript temp files
  /tmp/*.webm                ← any WebM audio
  /tmp/*.wav                 ← any WAV audio (after transcription)
  /tmp/*.mp3                 ← any MP3 audio

### Video frames (after analysis)
  /tmp/opex-frames-*         ← extracted frame folders
  /tmp/frames-*              ← extracted frame folders
  /tmp/*.jpg                 ← extracted JPEG frames
  /tmp/*.png                 ← extracted PNG frames

### Video files (after analysis)
  /tmp/opex-video-*          ← downloaded video files
  /tmp/watch-*               ← video download folders
  /tmp/*.mp4                 ← any MP4 video
  /tmp/*.mkv                 ← any MKV video

### Extraction temp files
  /tmp/opex-extract-*        ← extraction temp folders
  /tmp/remotion-*            ← Remotion working files
  /tmp/*.vtt                 ← subtitle files (after transcript extraction)
  /tmp/*.srt                 ← subtitle files

### Content export files (after confirmed push)
  /home/ubuntu/slides/       ← exported PNG slides
                              (only after confirmed push to Notion)
  /home/ubuntu/*.html        ← carousel preview files
                              (only after export confirmed)

### Any file in /tmp/ older than 24 hours
  find /tmp -type f -mtime +1 -delete 2>/dev/null

## FLAGGED FOR REVIEW (requires confirmation)

  Files in /video-engine/ not referenced in any config
  Duplicate asset files
  Old versions of skill files (keep last 3 versions)
  Qdrant data older than 90 days (flag only, user decides)

## NEVER delete (protected)

  ~/.config/opencode/skills/
  ~/.config/opencode/agents/
  ~/.config/opencode/tools/
  ~/.opex/memory/
  ~/.opex/knowledge/
  ~/.opex/config/
  ~/.opex/video-engine/global-assets/
  Any file flagged as permanent in its header

## AUTOMATIC CLEANUP FLOW

After EVERY ingestion or analysis:

  1. Process content (transcribe, analyze, extract patterns)
  2. Store knowledge/transcript in domain
  3. IMMEDIATELY delete:
     - Downloaded audio (.webm, .wav, .mp3)
     - Downloaded video (.mp4, .mkv)
     - Extracted frames (.jpg, .png)
     - Subtitle files (.vtt, .srt)
     - Temp folders (/tmp/opex-*)
  4. Log what was deleted
  5. Report storage status

## PUSH TO NOTION

Daily brief: Create/update page in Notion
  Page title: Daily Brief — [DATE]
  Contents:
    Active goal status
    Today's approved content with full copy
    Platform and format for each piece
    Mission tag
    Any pending tasks

Content calendar update:
  Update calendar with approved content
  Date, platform, format, mission, copy (linked), status

Goals update:
  Sync goals.memory.md status to Notion Goals dashboard

## PUSH TO GOOGLE DRIVE (Weekly backup)

Memory backups (weekly, on Sundays):
  Folder: OPEX-System/Memory-Backups/[YYYY-MM-DD]/
  Contents: Copy of all .memory.md files

## CODE SYSTEM INTERACTION

When OPEX runs cleanup, it checks for CODE project work:

  1. If CODE project in progress → preserve code files
  2. If only temp files → delete (OPEX scope only)
  3. If shared assets → flag for user decision

Code folders protected:
  ~/create-code/     ← active project
  Any node_modules/  ← dependencies (never delete)
  Any .git/         ← version control (never delete)

## CLEANUP REPORT FORMAT

After cleanup runs:

CLEANUP COMPLETE — [DATE]

Temp files removed:
  [filename or folder] — [size]
  [total]: [X MB freed]

Content pushed to Notion:
  [page names updated]

VPS storage status:
  Used: [X GB] / [total] GB
  Free: [Y GB]
  Status: [healthy / watch / critical]

Session logged to sessions.memory.md.

## STORAGE ALERTS

>70% used: "VPS is 70% full. Consider pushing older assets to Drive."
>80% used: "VPS is 80% full. Initiating asset cleanup and Drive migration."
>90% used: "VPS is 90% full. URGENT — manual review required."

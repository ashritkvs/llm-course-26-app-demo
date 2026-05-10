# Desktop Cleaner

A Windows desktop organisation tool that uses Anthropic Claude LLM to intelligently sort and categorise every file, shortcut, and application on your desktop into labelled folders.

## Features

- Scans your Windows desktop for all files, shortcuts, and applications
- Uses Claude AI (claude-sonnet-4-6) to intelligently categorise files
- Supports user-defined custom categories (Pass 1) with auto-categorisation fallback (Pass 2)
- Preview changes before applying (dry-run mode)
- Flags old files (not accessed in N days) for optional review
- NEVER permanently deletes files — only moves to a "Review for Deletion" folder
- Full GUI with PyQt5
- REST API via FastAPI for programmatic access
- All actions logged to logs/cleaner_log.txt

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Configure your Anthropic API key in `.env`:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key
   ```

3. (Optional) Edit `config/settings.json` to adjust age threshold and other settings.

## Running

### GUI Mode (default)
```
python src/main.py
```

### API Mode
```
python src/main.py --mode api
```
Then visit http://localhost:8000/docs for the interactive API documentation.

## Configuration

- `config/settings.json` — application settings (age threshold, dry run, log level, etc.)
- `config/user_categories.json` — your custom category definitions

## How It Works

1. **Scan**: Scans the Windows desktop using pywin32 for accurate path detection.
2. **Classify (Pass 1)**: For each file, asks Claude if it fits any of your user-defined categories.
3. **Classify (Pass 2)**: For unmatched files, asks Claude to auto-generate an appropriate category.
4. **Review**: Shows you a tree of planned folder moves before anything happens.
5. **Organise**: Creates folders on the desktop and moves files (unless dry-run mode is on).
6. **Deletion Review**: Flags files not accessed in N days and lets you optionally move them to a review folder.

## Safety

- Dry-run mode previews all operations without moving anything
- Files flagged for deletion are moved to a "Review for Deletion" folder, never permanently deleted
- All operations are logged with timestamps

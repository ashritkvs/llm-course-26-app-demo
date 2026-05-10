# Desktop Cleaner

A Windows desktop organisation tool that uses a local Llama 3.2 model (via Ollama) to intelligently sort and categorise every file, shortcut, and application on your desktop into labelled folders.

## Features

- Scans your Windows desktop for all files, shortcuts, and applications
- Uses Llama 3.2 (local, via Ollama) to intelligently categorise files — no API key, no rate limits
- Supports user-defined custom categories (Pass 1) with extension-based auto-categorisation fallback (Pass 2)
- Flags old files (not accessed in N days) for optional review, with a popup notification after each scan
- NEVER permanently deletes files — only moves to a "Review for Deletion" folder
- Full GUI with PyQt5
- All actions logged to logs/cleaner_log.txt

## Setup

1. Install and start [Ollama](https://ollama.com), then pull the model:
   ```
   ollama pull llama3.2
   ```

2. Install Python dependencies (run `setup.bat` or manually):
   ```
   pip install -r requirements.txt
   ```

3. (Optional) Edit `config/settings.json` to adjust the age threshold and other settings.

## Running

```
python src/main.py
```

## Configuration

- `config/settings.json` — application settings (age threshold, log level, review folder name, etc.)
- `config/user_categories.json` — your custom category definitions

## How It Works

1. **Scan**: Scans the Windows desktop using pywin32 for accurate path detection.
2. **Classify (Pass 1)**: Sends all filenames to Llama 3.2 in one batch call to match against your user-defined categories.
3. **Classify (Pass 2)**: Files that didn't match any user category are auto-categorised by file extension (Documents, Images, Shortcuts, etc.).
4. **Deletion Notification**: If any files haven't been accessed within the configured threshold, a popup notifies you after the scan.
5. **Review**: Shows a tree of planned folder moves — uncheck any folder to leave those files on the desktop.
6. **Organise**: Creates folders on the desktop and moves the checked files.
7. **Deletion Review**: Optionally move stale files to a "Review for Deletion" folder via the Review Deletions button.

## Safety

- All moves require explicit confirmation before anything happens
- Files flagged for deletion are moved to a "Review for Deletion" folder, never permanently deleted
- All operations are logged with timestamps

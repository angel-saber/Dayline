# Note attachments

Daily and Focus notes accept files from **Attach files** in the editor, or by dropping files onto the note or editor. Each note supports ten files of up to 10 MB each. Download or remove files using the attachment list. Notes can contain only attachments, without a title or body.

File contents live in IndexedDB on the current browser and device. Signing in does not upload or sync those contents. Clearing site data removes the local files. Clean-text sharing does not send attachments; download and attach the files separately to an email or message.

Settings → Download backup includes all referenced file contents. Restore backup imports files with fresh IDs before replacing notes, so a failed restore cannot overwrite files used by existing notes. Older text-only backups remain supported. Backups support up to 70 MB of combined file contents, within a 100 MB JSON import limit. Export reports missing files rather than silently omitting them.

Removing a file reference or deleting a note does not immediately erase its stored binary, preserving existing Undo behavior. Files are never embedded into the page as executable content; the download action uses a binary Blob.

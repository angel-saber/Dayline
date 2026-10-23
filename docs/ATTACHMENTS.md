# Note attachments

Daily and Focus notes accept files from **Attach files** in the editor, or by dropping files onto the note or editor. Each note supports ten files of up to 10 MB each. Download or remove files using the attachment list. Notes can contain only attachments, without a title or body.

File contents live in IndexedDB on the current browser and device. Signing in does not upload or sync those contents. Clearing site data removes the local files. Clean-text sharing does not send attachments; download and attach the files separately to an email or message.

Settings → Download backup includes all referenced file contents. Restore backup imports files with fresh IDs before replacing notes, so a failed restore cannot overwrite files used by existing notes. Older text-only backups remain supported. Backups support up to 70 MB of combined file contents, within a 100 MB JSON import limit. Export reports missing files rather than silently omitting them.

Removing a file reference or deleting a note does not immediately erase its stored binary, preserving existing Undo behavior. Files are never embedded into the page as executable content; the download action uses a binary Blob.

## Sharing files

The share preview has **Include attachments**, off by default, for both single and multiple notes. The native **Share…** menu receives the text and actual files when the browser supports the selected batch. Choose an email or messaging app there. Receiving apps may impose additional limits or omit accompanying text. Repeated references to the same file are sent once; distinct files with matching names receive unique filenames.

If native file sharing is unavailable, download each attachment from the preview and add it in the receiving app. **Copy text** never includes files; **Email text only** uses a mail link and never attaches files. No account or hosted file link is required for the recipient.

## Optional compression

Uploading a PDF, JPEG, PNG or WebP larger than 10 MB offers an optional review before attaching a smaller copy. Image controls reduce dimensions and, for JPEG/WebP, quality. PNG remains PNG and preserves transparency. Image processing can remove metadata and converts animations to a still image; review the preview before accepting. The source file is never changed. Unsupported encoders report an error instead of silently changing formats.

PDF optimization uses the bundled MIT-licensed pdf-lib 1.17.1 library to serialize compressed object streams, preserving vector pages and selectable text rather than converting pages into images. It may offer little or no reduction for scanned or already optimized PDFs. Signed PDFs, password-protected PDFs and XFA forms are not supported. Download the candidate to review before accepting it. A copy is accepted only if it is smaller and at most 10 MB; otherwise choose another file or retry image settings. PDFs have no lossy rasterization option.

Files larger than 100 MB are rejected before processing to limit browser memory use. Video, audio and all other types have no compression option. Compression runs locally without a server or ZIP archive. Canceling review cancels the entire upload batch before any file is attached.

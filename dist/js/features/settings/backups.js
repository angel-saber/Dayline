import { deviceNotes } from '../accounts/device-notes.js?v=new-personalities-1';
import { validState, save } from '../../shared/storage.js?v=new-personalities-1';
import { dayKey } from '../../shared/schedule.js?v=new-personalities-1';
import {
  exportFiles,
  prepareFiles,
  storeFiles,
  MAX_BACKUP_SIZE,
} from '../attachments/attachments.js?v=new-personalities-1';
import { downloadText } from '../../shared/download.js';
const $ = (selector) => document.querySelector(selector);
export function setupBackups({
  getState,
  getReadFailed,
  getAccounts,
  flushEditor,
  toast,
  onRestore,
}) {
  let pendingImport = null;
  $('#export').onclick = async () => {
    flushEditor();
    try {
      let backup = getState();
      if (getReadFailed()) {
        const raw = localStorage.getItem('dayline.v1');
        if (raw) backup = JSON.parse(raw);
      }
      const data = JSON.stringify(await exportFiles(structuredClone(backup)));
      downloadText(data, `dayline-backup-${dayKey()}.json`);
    } catch (error) {
      toast(`Could not export: ${error.message}`);
    }
  };
  async function downloadDeviceBackup() {
    let backup;
    try {
      backup = deviceNotes();
    } catch {
      const raw = localStorage.getItem('dayline.v1');
      if (!raw) throw new Error('No device copy was found in this browser.');
      downloadText(raw, `dayline-device-recovery-${dayKey()}.json`);
      return;
    }
    const data = JSON.stringify(await exportFiles(structuredClone(backup)));
    downloadText(data, `dayline-device-notes-${dayKey()}.json`);
  }
  $('#import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_SIZE) throw new Error('Choose a backup under 100 MB.');
      const data = JSON.parse(await file.text());
      pendingImport = prepareFiles(validState(data), data.attachmentFiles);
      $('#restore-dialog').showModal();
    } catch (error) {
      toast(`Could not restore: ${error.message}`);
    }
    e.target.value = '';
  };
  $('#restore-dialog').addEventListener('close', async () => {
    if ($('#restore-dialog').returnValue === 'restore' && pendingImport) {
      // Permission and audio must be enabled deliberately on each new device.
      const backup = pendingImport;
      pendingImport = null;
      backup.state.settings.notifications = false;
      backup.state.settings.sound = false;
      try {
        await storeFiles(backup.files);
        if (getAccounts()) getAccounts().persist(backup.state);
        else save(backup.state);
        onRestore(backup.state);
        toast('Backup restored. Enable reminders again when you’re ready.');
      } catch {
        toast('Your browser could not save the backup. Existing data was kept.');
      }
    }
    pendingImport = null;
  });
  return { downloadDeviceBackup };
}

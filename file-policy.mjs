export const MAX_SUBTITLE_FILE_BYTES = 25 * 1024 * 1024;

export function rejectOversizedFile(file, input) {
  if (file.size <= MAX_SUBTITLE_FILE_BYTES) return false;
  input.value = '';
  return true;
}

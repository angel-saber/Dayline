import { MAX_FILE_SIZE } from './attachments.js?v=5010270c32fe';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function compressionType(file) {
  const extension = file.name?.split('.').at(-1).toLowerCase();
  const inferred = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }[extension];
  const type = file.type || inferred;
  return IMAGE_TYPES.has(type) || type === 'application/pdf' ? type : null;
}
export function scaledDimensions(width, height, longest = 2400) {
  if (!width || !height || width * height > 100000000)
    throw new Error('This image is too large to process safely. Choose a smaller image.');
  const scale = Math.min(1, longest / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}
export async function compressImage(file, { longest = 2400, quality = 0.8 } = {}) {
  const type = compressionType(file);
  if (!IMAGE_TYPES.has(type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  const image = new Image(),
    url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be decoded.'));
      image.src = url;
    });
    const [width, height] = scaledDimensions(image.naturalWidth, image.naturalHeight, longest),
      canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image compression is unavailable in this browser.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    canvas.width = canvas.height = 0;
    if (!blob || blob.type !== type)
      throw new Error('Your browser cannot encode this original image format.');
    return { file: new File([blob], file.name, { type }), details: `${width} × ${height} pixels` };
  } finally {
    URL.revokeObjectURL(url);
    image.src = '';
  }
}
export async function compressPdf(
  file,
  loadLibrary = () => import('../../../vendor/pdf-lib-1.17.1.js?v=5010270c32fe'),
) {
  const { PDFDocument, PDFSignature } = await loadLibrary();
  const document = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const form = document.getForm();
  if (form.hasXFA()) throw new Error('XFA forms are not supported. Use a regular PDF copy.');
  if (form.getFields().some((field) => field instanceof PDFSignature))
    throw new Error(
      'Signed PDFs are left unchanged to protect their signatures. Use an unsigned copy.',
    );
  const bytes = await document.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  return {
    file: new File([bytes], file.name, { type: 'application/pdf' }),
    details: 'PDF optimized without rasterizing pages. Review the copy before using it.',
  };
}
const size = (bytes) => (bytes / 1048576).toFixed(2) + ' MB';
// The review stays inside the editor, so outside-click saving cannot dismiss it.
export function reviewCompression(file, host, signal) {
  return new Promise((resolve, reject) => {
    const node = (tag, text) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      return el;
    };
    const panel = node('section');
    panel.className = 'compression-review';
    panel.tabIndex = -1;
    const type = compressionType(file),
      heading = node('h4', `Reduce ${file.name}?`),
      description = node(
        'p',
        `${size(file.size)} · Limit: 10 MB. The original file stays untouched.`,
      );
    const result = node('p'),
      preview = node('div'),
      controls = node('div');
    controls.className = 'inline';
    let candidate = null,
      previewUrl = null,
      settled = false;
    const button = (text, action) => {
      const el = node('button', text);
      el.type = 'button';
      el.onclick = action;
      return el;
    };
    function cleanup() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      panel.remove();
      signal?.removeEventListener('abort', abort);
    }
    function finish(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }
    function abort() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Upload cancelled because the note was closed.'));
    }
    const use = button('Use smaller copy', () => finish(candidate));
    use.disabled = true;
    const cancel = button('Cancel upload', () => finish(null));
    const dimension = node('select');
    dimension.setAttribute('aria-label', 'Maximum image dimension');
    for (const value of [2400, 1600, 1000, 600]) {
      const option = node('option', `${value}px maximum`);
      option.value = value;
      dimension.append(option);
    }
    const quality = node('select');
    quality.setAttribute('aria-label', 'Image quality');
    for (const [value, label] of [
      [0.85, 'Higher quality'],
      [0.65, 'Balanced quality'],
      [0.45, 'Smaller size'],
    ]) {
      const option = node('option', label);
      option.value = value;
      quality.append(option);
    }
    const compress = button(
      type === 'application/pdf' ? 'Try PDF optimization' : 'Try reducing size',
      async () => {
        candidate = null;
        use.disabled = true;
        compress.disabled = true;
        dimension.disabled = quality.disabled = true;
        result.textContent = 'Preparing a smaller copy…';
        preview.replaceChildren();
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          previewUrl = null;
        }
        try {
          const output =
            type === 'application/pdf'
              ? await compressPdf(file)
              : await compressImage(file, {
                  longest: Number(dimension.value),
                  quality: Number(quality.value),
                });
          if (settled) return;
          const smaller = output.file.size < file.size,
            fits = output.file.size <= MAX_FILE_SIZE;
          result.textContent = `${size(file.size)} → ${size(output.file.size)}. ${output.details} ${!smaller ? 'No size reduction was possible.' : !fits ? 'Still over 10 MB. Try a smaller image dimension or choose another file.' : ''}`;
          if (smaller && fits) {
            candidate = output.file;
            use.disabled = false;
          }
          if (type !== 'application/pdf') {
            previewUrl = URL.createObjectURL(output.file);
            const image = node('img');
            image.src = previewUrl;
            image.alt = 'Smaller image preview';
            preview.append(image);
          } else {
            previewUrl = URL.createObjectURL(output.file);
            const link = node('a', 'Download copy to review');
            link.href = previewUrl;
            link.download = file.name;
            preview.append(link);
          }
        } catch (error) {
          if (!settled) result.textContent = `Could not reduce this file: ${error.message}`;
        } finally {
          if (!settled) {
            compress.disabled = false;
            dimension.disabled = quality.disabled = false;
          }
        }
      },
    );
    for (const control of [dimension, quality])
      control.addEventListener('change', () => {
        candidate = null;
        use.disabled = true;
        result.textContent = 'Settings changed. Try reducing size again to review a new copy.';
      });
    panel.append(heading, description);
    if (type === 'application/pdf')
      panel.append(
        node(
          'p',
          'Lossless PDF optimization may not reduce scanned or already compressed PDFs enough. Password-protected and signed PDFs are not supported.',
        ),
      );
    else {
      const label = node('label', 'Image size ');
      label.append(dimension);
      panel.append(label);
      if (type !== 'image/png') {
        const label = node('label', 'Quality ');
        label.append(quality);
        panel.append(label);
      }
      panel.append(
        node(
          'p',
          'Resizing can reduce detail. PNG keeps transparency; PNG size is controlled by dimensions. Animated images become a still image.',
        ),
      );
    }
    controls.append(compress, use, cancel);
    panel.append(controls, result, preview);
    host.append(panel);
    panel.focus();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}
export async function prepareUploadFiles(files, review) {
  files = Array.from(files);
  for (const file of files) {
    if (file.size > 100 * 1024 * 1024)
      throw new Error('Choose files under 100 MB for browser processing.');
    if (file.size > MAX_FILE_SIZE && !compressionType(file))
      throw new Error(
        `${file.name}: only PDF, JPEG, PNG and WebP files offer size reduction. Other files must be 10 MB or smaller.`,
      );
  }
  const prepared = [];
  for (const file of files) {
    if (file.size <= MAX_FILE_SIZE) {
      prepared.push(file);
      continue;
    }
    const smaller = await review(file);
    if (!smaller) return null;
    if (
      smaller.size > MAX_FILE_SIZE ||
      smaller.size >= file.size ||
      compressionType(smaller) !== compressionType(file)
    )
      throw new Error('The smaller copy must preserve its format and fit within 10 MB.');
    prepared.push(smaller);
  }
  return prepared;
}

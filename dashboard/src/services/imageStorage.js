import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';

function safeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .toLowerCase();
}

export function uploadVehicleImage({ file, vehicleId, imageType, onProgress }) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const fileName = `${imageType}-${Date.now()}.${safeName(extension)}`;
  const targetRef = ref(storage, `vehicle-images/${vehicleId || 'drafts'}/${fileName}`);
  const uploadTask = uploadBytesResumable(targetRef, file, {
    contentType: file.type,
    customMetadata: {
      vehicleId: vehicleId || 'draft',
      imageType,
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      async () => resolve(getDownloadURL(uploadTask.snapshot.ref)),
    );
  });
}

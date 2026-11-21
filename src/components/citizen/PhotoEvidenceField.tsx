'use client';

import React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { compressImageFile } from '@/lib/imageCompress';

function createSamplePngDataUri(label: string, accent: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, 24, 592, 312);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 592, 312);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FIELD PHOTO', 320, 160);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px sans-serif';
  ctx.fillText(label, 320, 210);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText('CivicResolve Verified PNG Preview', 320, 250);

  return canvas.toDataURL('image/png');
}

interface PhotoEvidenceFieldProps {
  imageUrl?: string;
  onChangeImage: (url: string | undefined) => void;
  onError: (message: string | null) => void;
}

/** Evidence photo upload dropzone with client-side JPEG compression and preview. */
export function PhotoEvidenceField({
  imageUrl,
  onChangeImage,
  onError,
}: PhotoEvidenceFieldProps) {
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onError('Only PNG, JPEG, or WebP images are permitted.');
      return;
    }
    if (file.size > 10_000_000) {
      onError('Please upload an image smaller than 10 MB.');
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      onChangeImage(compressed);
      onError(null);
    } catch {
      onError('Unable to process the selected image file.');
    }
  };

  return (
    <div>
      <label htmlFor="issue-photo-upload" className="block text-sm font-semibold text-slate-800">
        Evidence Photo (Optional)
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <label
          htmlFor="issue-photo-upload"
          className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2"
        >
          <Upload className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span>Upload Photo</span>
          <input
            id="issue-photo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileUpload}
            className="sr-only"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            const png = createSamplePngDataUri('Road Damage Evidence #01', '#f59e0b');
            if (png) onChangeImage(png);
          }}
          className="focus-ring inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Camera className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
          <span>Attach Sample Photo</span>
        </button>
      </div>

      {imageUrl && (
        <div className="relative mt-3 inline-block overflow-hidden rounded-xl border border-slate-200">
          <img
            src={imageUrl}
            alt="Uploaded civic issue preview"
            className="h-32 w-56 object-cover"
          />
          <button
            type="button"
            onClick={() => onChangeImage(undefined)}
            aria-label="Remove attached photo"
            className="focus-ring absolute right-2 top-2 rounded-full bg-slate-900/80 p-1 text-white hover:bg-slate-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

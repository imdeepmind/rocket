'use client';

import React, {useRef, useState} from 'react';

import Button from '@/componentsV2/bits/Button';
import Typography from '@/componentsV2/bits/Typography';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';
import UploadCloudIcon from '@/icons/UploadCloudIcon';

import styles from './styles.module.css';

export interface SelectedFile {
  name: string;
  size: string;
}

export interface FileDropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
  accept?: string;
  maxSizeText?: string;
  file?: SelectedFile | null;
  onFileSelect?: (file: File) => void;
  onFileRemove?: () => void;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  classNameOverride?: string;
}

export default function FileDropzone({
  accept = '.zip',
  maxSizeText = '.zip up to 50 MB',
  file,
  onFileSelect,
  onFileRemove,
  title = 'Drag and drop your ZIP file here',
  subtitle,
  buttonText = 'Choose ZIP file',
  classNameOverride,
  ...props
}: FileDropzoneProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && onFileSelect) {
      onFileSelect(dropped);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected && onFileSelect) {
      onFileSelect(selected);
    }
  }

  const dropzoneClasses = [
    styles.dropzone,
    isDragging ? styles.dropzoneActive : '',
    file ? styles.hasFile : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? dropzoneClasses;

  return (
    <div
      className={combinedClass}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          fileInputRef.current?.click();
        }
      }}
      {...props}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className={styles.hiddenInput}
      />

      <div className={styles.iconWrapper}>
        <UploadCloudIcon width={28} height={28} />
      </div>

      <Typography
        variant="body"
        weight="medium"
        classNameOverride={styles.title}
      >
        {title}
      </Typography>

      <Typography variant="caption" color="muted">
        {subtitle || `or browse from your computer · ${maxSizeText}`}
      </Typography>

      <div className={styles.buttonWrapper}>
        <Button
          variant="secondary"
          size="sm"
          onClick={e => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          {buttonText}
        </Button>
      </div>

      {file && (
        <div
          className={styles.selectedBadge}
          onClick={e => e.stopPropagation()}
        >
          <span className={styles.checkIcon}>
            <CheckIcon width={14} height={14} strokeWidth={2.5} />
          </span>
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.fileSize}>{file.size}</span>
          {onFileRemove && (
            <button
              type="button"
              className={styles.removeBtn}
              onClick={onFileRemove}
              aria-label="Remove file"
            >
              <CloseIcon width={12} height={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

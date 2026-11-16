"use client";

import { useRef, ChangeEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faVolumeHigh, faXmark } from '@fortawesome/free-solid-svg-icons'

import { uploadImage, uploadAudio } from "@/api/process";
import { BASE_URL } from '@/api';

export default function MediaLoader({
  imageUrl = [],
  setImageUrl,
  audioUrl = [],
  setAudioUrl
}: {
  imageUrl?: string[];
  setImageUrl: (imageUrl: string[]) => void;
  audioUrl?: string[];
  setAudioUrl: (audioUrl: string[]) => void;
}) {
  const t = useTranslations("media");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string[]>(
    imageUrl.length > 0 ? imageUrl.map((url) => `${BASE_URL}${url}`) : []
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string[]>(
    audioUrl.length ? audioUrl.map((url) => `${BASE_URL}${url}`) : []
  );

  const getFileExtension = (filename: string): string => {
    return filename.toLowerCase().split('.').pop() || '';
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    
    const isImage = imageExtensions.some(ext => extension.endsWith(ext));
    
    if (!isImage) {
      console.error("Invalid file type. Please upload an image file.");
      return;
    }

    try {
      const { url } = await uploadImage(file);
      const fullUrl = `${BASE_URL}${url}`;
      setImagePreviewUrl([...imagePreviewUrl, fullUrl]);
      setImageUrl([...imageUrl, url]);
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleAudioChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name);
    const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
    
    const isAudio = audioExtensions.some(ext => extension.endsWith(ext));
    
    if (!isAudio) {
      console.error("Invalid file type. Please upload an audio file.");
      return;
    }

    try {
      const { url } = await uploadAudio(file);
      const fullUrl = `${BASE_URL}${url}`;
      setAudioPreviewUrl([...audioPreviewUrl, fullUrl]);
      setAudioUrl([...audioUrl, url]);
    } catch (error) {
      console.error("Error uploading audio:", error);
      throw error;
    }
  };

  const clearImage = () => {
    setImagePreviewUrl([]);
    setImageUrl([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const clearAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioPreviewUrl([]);
    setAudioUrl([]);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const removeAt = <T,>(list: T[], index: number) => list.filter((_, i) => i !== index);

  return (
    <div
      className="grid gap-6 sm:grid-cols-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Images: upload, then thumbnails with a small remove button each */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">{t("mediaLoaderImage")}</h3>
          {imagePreviewUrl.length > 1 && (
            <button type="button" onClick={clearImage} className="text-sm text-danger underline-offset-2 hover:underline">{t("mediaLoaderClearImages")}</button>
          )}
        </div>
        <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageChange} className="hidden" />
        <button type="button" onClick={() => imageInputRef.current?.click()} className="btn btn-secondary min-h-11 self-start">
          <FontAwesomeIcon icon={faImage} aria-hidden="true" /> {t("mediaLoaderUploadImage")}
        </button>
        {imagePreviewUrl.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {imagePreviewUrl.map((url, index) => (
              <li key={url + index} className="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-surface">
                <Image src={url} alt={t("mediaLoaderPreview")} className="object-contain" fill sizes="96px" />
                <button type="button" aria-label={t("mediaLoaderRemoveImage")} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-danger"
                  onClick={() => { setImagePreviewUrl(removeAt(imagePreviewUrl, index)); setImageUrl(removeAt(imageUrl, index)); }}>
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Audio: upload, then one player row per file */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">{t("mediaLoaderAudio")}</h3>
          {audioPreviewUrl.length > 1 && (
            <button type="button" onClick={clearAudio} className="text-sm text-danger underline-offset-2 hover:underline">{t("mediaLoaderClearAudios")}</button>
          )}
        </div>
        <input type="file" ref={audioInputRef} accept="audio/*" onChange={handleAudioChange} className="hidden" />
        <button type="button" onClick={() => audioInputRef.current?.click()} className="btn btn-secondary min-h-11 self-start">
          <FontAwesomeIcon icon={faVolumeHigh} aria-hidden="true" /> {t("mediaLoaderUploadAudio")}
        </button>
        {audioPreviewUrl.length > 0 && (
          <ul className="flex flex-col gap-2">
            {audioPreviewUrl.map((url, index) => (
              <li key={url + index} className="flex items-center gap-2">
                <audio ref={index === 0 ? audioRef : undefined} src={url} className="h-10 min-w-0 flex-1" controls />
                <button type="button" aria-label={t("mediaLoaderRemoveAudio")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-danger hover:bg-accent-soft"
                  onClick={() => { setAudioPreviewUrl(removeAt(audioPreviewUrl, index)); setAudioUrl(removeAt(audioUrl, index)); }}>
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

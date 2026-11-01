"use client";

import { useRef, ChangeEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDeleteLeft } from '@fortawesome/free-solid-svg-icons'

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

  return (
    <div 
      className="space-y-6"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div>
        <h3 className="text-sm font-medium mb-2">{t("mediaLoaderImage")}</h3>
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
        <div className='flex flex-row space-x-4'>
          <button
            type='button'
            onClick={() => imageInputRef.current?.click()}
            className="btn btn-secondary"
          >
            {t("mediaLoaderUploadImage")}
          </button>
          {imagePreviewUrl && (
            <button
              type='button'
              onClick={clearImage}
              className="btn btn-danger"
            >
              {t("mediaLoaderClearImages")}
            </button>
          )}
        </div>
        {imagePreviewUrl.length > 0 && (
          <span className="my-10 flex flex-col space-y-4 items-center">
            {
              imagePreviewUrl.map((url, index) => (
                <figure key={index} className="flex flex-row items-center space-x-4 mb-4">
                  <Image
                    src={url}
                    alt={t("mediaLoaderPreview")}
                    className="object-contain"
                    width={150}
                    height={150}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPreviewUrls = [...imagePreviewUrl];
                      const newUrls = [...imageUrl];
                      newPreviewUrls.splice(index, 1);
                      newUrls.splice(index, 1);
                      setImagePreviewUrl(newPreviewUrls);
                      setImageUrl(newUrls);
                    }}
                    className="btn btn-danger px-2 py-1"
                  >
                    <FontAwesomeIcon icon={faDeleteLeft} />
                  </button>
                </figure>
              ))
            }
          </span>
        )}
      </div>

      {/* Audio Upload Section */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("mediaLoaderAudio")}</h3>
        <input
          type="file"
          ref={audioInputRef}
          accept="audio/*"
          onChange={handleAudioChange}
          className="hidden"
        />
        <div className='flex flex-row space-x-4'>
          <button
            type='button'
            onClick={() => audioInputRef.current?.click()}
            className="btn btn-secondary"
          >
            {t("mediaLoaderUploadAudio")}
          </button>
          {audioPreviewUrl && (
            <button
              type='button'
              onClick={clearAudio}
              className="btn btn-danger"
            >
              {t("mediaLoaderClearAudios")}
            </button>
          )}
        </div>
        {audioPreviewUrl.length > 0 && (
          <span className="my-10 flex flex-col space-y-4 items-center">
            {
              audioPreviewUrl.map((url, index) => (
                <figure key={index} className="flex flex-row items-center space-x-4 mb-4">
                  <audio
                    ref={audioRef}
                    src={url}
                    className="w-full"
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPreviewUrls = [...audioPreviewUrl];
                      const newUrls = [...audioUrl];
                      newPreviewUrls.splice(index, 1);
                      newUrls.splice(index, 1);
                      setAudioPreviewUrl(newPreviewUrls);
                      setAudioUrl(newUrls);
                    }}
                    className="btn btn-danger px-2 py-1"
                  >
                    <FontAwesomeIcon icon={faDeleteLeft} />
                  </button>
                </figure>
              ))
            }
          </span>
        )}
      </div>
    </div>
  );
}
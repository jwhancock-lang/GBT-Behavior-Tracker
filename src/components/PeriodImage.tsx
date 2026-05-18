import React, { useRef } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { resizeImage, getDefaultEmojiForPeriod } from "../lib/imageUtils";

interface PeriodImageProps {
  period: string;
  image?: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onImageSelected?: (base64Str: string) => void;
}

export function PeriodImage({ period, image, size = "md", editable = false, onImageSelected }: PeriodImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageSelected) return;

    try {
      const resized = await resizeImage(file, 400, 400);
      onImageSelected(resized);
    } catch (err) {
      console.error("Failed to resize image", err);
    }
  };

  const getDimensions = () => {
    switch (size) {
      case "sm": return "w-8 h-8 text-xl";
      case "md": return "w-12 h-12 text-3xl";
      case "lg": return "w-24 h-24 text-6xl";
      default: return "w-12 h-12 text-3xl";
    }
  };

  const dims = getDimensions();
  const content = image ? (
    <img src={image} alt={`Visual for ${period}`} className={`object-cover rounded-md ${dims.split(' ').slice(0,2).join(' ')}`} />
  ) : (
    <div className={`flex items-center justify-center bg-orange-100 text-orange-800 rounded-md select-none ${dims}`}>
      {getDefaultEmojiForPeriod(period)}
    </div>
  );

  if (editable) {
    return (
      <div className="relative group cursor-pointer inline-block" onClick={() => fileInputRef.current?.click()}>
        {content}
        <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-md transition-opacity ${dims.split(' ').slice(0,2).join(' ')}`}>
          <Camera className="text-white w-1/2 h-1/2" />
        </div>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
        />
      </div>
    );
  }

  return content;
}

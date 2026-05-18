export const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress using WebP for better size if supported, fallback to jpeg
        const dataUrl = canvas.toDataURL("image/webp", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const getDefaultEmojiForPeriod = (period: string): string => {
  const p = period.toLowerCase();
  if (p.includes("lunch") || p.includes("eat") || p.includes("food") || p.includes("cafeteria")) return "🍱";
  if (p.includes("recess") || p.includes("play") || p.includes("outside")) return "🏃";
  if (p.includes("math")) return "📐";
  if (p.includes("read") || p.includes("ela") || p.includes("lit") || p.includes("book")) return "📚";
  if (p.includes("science")) return "🔬";
  if (p.includes("art")) return "🎨";
  if (p.includes("pe") || p.includes("phys") || p.includes("gym")) return "⚽";
  if (p.includes("music") || p.includes("band") || p.includes("choir")) return "🎵";
  if (p.includes("arri") || p.includes("morn")) return "👋";
  if (p.includes("dism") || p.includes("pack") || p.includes("home")) return "🎒";
  if (p.includes("snack")) return "🍎";
  if (p.includes("writ")) return "✍️";
  if (p.includes("social") || p.includes("hist")) return "🌍";
  if (p.includes("break")) return "🧘";
  if (p.includes("circle") || p.includes("meet")) return "💬";
  if (p.includes("tech") || p.includes("comp")) return "💻";
  if (p.includes("library")) return "📖";
  
  return "🕒"; // default
};

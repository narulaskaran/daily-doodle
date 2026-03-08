import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
  }).onUploadComplete(({ file }) => {
    console.log("PDF uploaded:", file.url);
    return { url: file.url };
  }),

  imageUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  }).onUploadComplete(({ file }) => {
    console.log("Image uploaded:", file.url);
    return { url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

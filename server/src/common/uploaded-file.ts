/** Мінімальний контракт файлу від multer (FileInterceptor). */
export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

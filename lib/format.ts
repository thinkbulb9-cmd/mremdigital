/** Shared by server pages and the client viewer. */
export const DOWNLOADABLE=['.mp4','.m4v','.webm','.mov','.avi','.mkv','.pdf','.txt','.md','.html','.htm','.jpg','.jpeg','.png','.gif','.webp','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv','.zip','.rar','.7z'];
export const sizeOf=(n:number)=>n>=1073741824?(n/1073741824).toFixed(1)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B';

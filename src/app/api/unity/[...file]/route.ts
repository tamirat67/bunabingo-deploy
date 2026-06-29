import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: { file: string[] } }) {
  const fileArray = params.file;
  if (!fileArray || fileArray.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filename = fileArray.join('/');
  
  // Prevent directory traversal attacks
  if (filename.includes('..')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const filePath = path.join(process.cwd(), 'public', 'unity', filename);

  try {
    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const headers = new Headers();
    headers.set('Content-Length', stat.size.toString());
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Unity files ending in .unityweb are GZIP compressed by the Unity build.
    // Next.js standalone mode strips these headers from public/ static files, 
    // so we serve them via this API route to guarantee the browser decompresses them.
    if (filename.endsWith('.unityweb')) {
      headers.set('Content-Encoding', 'gzip');
    }

    // Set correct MIME types
    if (filename.endsWith('.wasm.unityweb')) {
      headers.set('Content-Type', 'application/wasm');
    } else if (filename.endsWith('.js.unityweb') || filename.endsWith('.loader.js')) {
      headers.set('Content-Type', 'application/javascript');
    } else if (filename.endsWith('.data.unityweb')) {
      headers.set('Content-Type', 'application/octet-stream');
    }

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error) {
    console.error('[Unity API Route] Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { NextApiRequest } from 'next'; // Import NextApiRequest for type casting

// Define the path where uploads will be stored
// IMPORTANT: This path must be relative to the project root where the server runs
const uploadDir = path.join(process.cwd(), 'public/uploads');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}

// Disable Next.js body parsing for this route
// Formidable needs to parse the raw request stream
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  // We need to cast the Request to NextApiRequest to work with formidable's parse method
  // This is a common workaround for using formidable with Next.js App Router Route Handlers
  const req = request as unknown as NextApiRequest;

  const form = formidable({
    uploadDir: uploadDir, // Directory to save files temporarily
    keepExtensions: true, // Keep original file extensions
    // You can add options like maxFileSize, multiples: true, etc.
    // maxFileSize: 10 * 1024 * 1024, // Example: 10MB limit
    filename: (name, ext, part, form) => {
        // Create a unique filename (e.g., timestamp + original name)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Sanitize filename (optional but recommended)
        const originalName = part.originalFilename || 'upload';
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${uniqueSuffix}-${sanitizedName}`;
    }
  });

  try {
    const [fields, files] = await form.parse(req);

    // Assuming single file upload with the key 'file' (adjust if needed)
    const uploadedFile = files.file?.[0];

    if (!uploadedFile) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // The file is already saved by formidable due to uploadDir option
    const savedFileName = uploadedFile.newFilename;
    const fileUrl = `/uploads/${savedFileName}`; // URL relative to the public directory

    console.log('File uploaded successfully:', savedFileName);
    console.log('Accessible URL:', fileUrl);

    // Return the URL of the uploaded file
    return NextResponse.json({ success: true, url: fileUrl, fileName: uploadedFile.originalFilename });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    // Clean up partially uploaded file if error occurs? Maybe not needed if formidable handles it.
    return NextResponse.json({ error: 'Failed to upload file.', details: error.message }, { status: 500 });
  }
}